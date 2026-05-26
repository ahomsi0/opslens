"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pickResponse, promptSuggestions } from "./responses";
import { cn } from "@/lib/utils";
import {
  fetchAIConfig,
  fetchAIUsage,
  streamAIChat,
  type AIUsage,
  type ChatMessage,
} from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function AssistantPanel({
  open,
  onOpenChange,
  context,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context?: string;
  projectId?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null); // null = unknown, true/false = checked
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check whether the backend has GROQ_API_KEY configured + load current usage.
  useEffect(() => {
    if (!open || aiEnabled !== null) return;
    fetchAIConfig()
      .then((c) => {
        setAiEnabled(c.enabled);
        if (c.enabled) {
          fetchAIUsage().then((u) => u && setUsage(u));
        }
      })
      .catch(() => setAiEnabled(false));
  }, [open, aiEnabled]);

  const refreshUsage = useCallback(async () => {
    if (!aiEnabled) return;
    const u = await fetchAIUsage();
    if (u) setUsage(u);
  }, [aiEnabled]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Fake streaming for the canned fallback — same per-chunk pacing the
  // real Groq stream tends to produce, so it doesn't feel like a downgrade.
  const streamCanned = useCallback(
    (assistantId: string, prompt: string): Promise<void> => {
      return new Promise((resolve) => {
        const full = pickResponse(prompt, context);
        let i = 0;
        const tick = () => {
          const chunk = Math.max(3, Math.floor(Math.random() * 8));
          i = Math.min(full.length, i + chunk);
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: full.slice(0, i),
                    streaming: i < full.length,
                  }
                : msg,
            ),
          );
          if (i < full.length) {
            setTimeout(tick, 18 + Math.random() * 18);
          } else {
            resolve();
          }
        };
        setTimeout(tick, 200);
      });
    },
    [context],
  );

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const draft: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      // Snapshot prior conversation so we can pass it to the API.
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: "user", content: trimmed });

      setMessages((m) => [...m, userMsg, draft]);
      setInput("");
      setBusy(true);

      const finish = () => {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, streaming: false } : msg,
          ),
        );
        setBusy(false);
      };

      if (aiEnabled === false) {
        await streamCanned(assistantId, trimmed);
        finish();
        return;
      }

      try {
        let acc = "";
        for await (const delta of streamAIChat(history, { projectId })) {
          acc += delta;
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: acc, streaming: true }
                : msg,
            ),
          );
        }
        finish();
        refreshUsage();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isQuotaError = /quota|minute|exceeds|too many|max/i.test(msg);
        if (isQuotaError) {
          // Show the rate-limit message as the assistant reply — don't burn
          // the canned fallback for what's actually a "wait a sec" signal.
          setMessages((m) =>
            m.map((msg2) =>
              msg2.id === assistantId
                ? {
                    ...msg2,
                    content: `**You've hit a rate limit.** ${msg}\n\nTry again in a minute, or tomorrow if it's the daily cap.`,
                    streaming: false,
                  }
                : msg2,
            ),
          );
          setBusy(false);
          refreshUsage();
          return;
        }
        // Backend unconfigured or error — gracefully fall back to canned.
        console.warn("AI stream failed, falling back to canned:", err);
        setAiEnabled(false);
        setMessages((m) =>
          m.map((msg2) =>
            msg2.id === assistantId ? { ...msg2, content: "" } : msg2,
          ),
        );
        await streamCanned(assistantId, trimmed);
        finish();
      }
    },
    [busy, aiEnabled, messages, projectId, streamCanned, refreshUsage],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 h-screen w-full sm:w-[440px] flex flex-col border-l border-[var(--color-border)] glass-strong"
          >
            <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent-2)]">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </span>
                <div>
                  <div className="text-sm font-semibold tracking-tight">
                    Opslens AI
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]">
                    Preview · canned responses
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="px-5 py-6 space-y-5">
                {messages.length === 0 && (
                  <EmptyState
                    onSelect={send}
                    context={context}
                  />
                )}
                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-[var(--color-border)] p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className={cn(
                  "flex items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2",
                  "focus-within:border-[var(--color-accent)]",
                )}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask about your infrastructure…"
                  className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-subtle)] py-1 px-1"
                  disabled={busy}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || busy}
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--color-fg-subtle)]">
                <span>
                  {aiEnabled
                    ? "Powered by Groq · Llama 3.3"
                    : "Canned preview responses"}
                </span>
                {aiEnabled && usage && (
                  <span
                    className={
                      usage.remainingToday <= 3
                        ? "text-[oklch(0.88_0.14_80)]"
                        : ""
                    }
                    title={`${usage.usedTodayUser} of ${usage.limits.perUserPerDay} used today · ${usage.usedThisMinute} of ${usage.limits.perUserPerMinute} this minute`}
                  >
                    {usage.remainingToday} / {usage.limits.perUserPerDay} left today
                  </span>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState({
  onSelect,
  context,
}: {
  onSelect: (p: string) => void;
  context?: string;
}) {
  return (
    <div>
      <div className="rounded-xl border border-[oklch(0.65_0.22_350/0.3)] bg-[oklch(0.65_0.22_350/0.06)] p-4">
        <div className="text-sm leading-relaxed">
          <span className="text-[oklch(0.78_0.16_350)] font-semibold">
            Hi — I&apos;m Opslens AI.
          </span>{" "}
          I have access to your projects, deploys, metrics, and logs. Ask me
          anything — I&apos;ll explain in plain English.
        </div>
        {context && (
          <div className="mt-3 text-[11px] font-mono text-[var(--color-fg-muted)] border-t border-[oklch(0.65_0.22_350/0.2)] pt-3">
            {context}
          </div>
        )}
      </div>
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-2">
          Try asking
        </div>
        <div className="space-y-1.5">
          {promptSuggestions.map((p) => (
            <button
              key={p}
              onClick={() => onSelect(p)}
              className="block w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3.5 py-2.5 text-sm">
          {message.content}
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-2)] text-xs font-semibold text-white shrink-0">
          <User className="h-3.5 w-3.5" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent-2)] shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-[var(--color-surface)] border border-[var(--color-border)] px-3.5 py-2.5 text-sm">
        <Rich content={message.content} />
        {message.streaming && (
          <span className="ml-0.5 inline-block h-3 w-1.5 align-middle bg-[var(--color-accent)] animate-pulse" />
        )}
      </div>
    </div>
  );
}

function Rich({ content }: { content: string }) {
  // very light markdown rendering: **bold**, `code`, ```fenced```, lists, paragraphs
  const blocks = content.split(/\n\n+/);
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((b, i) => {
        if (b.startsWith("```")) {
          const code = b.replace(/^```\w*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={i}
              className="text-[11px] font-mono bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md p-3 overflow-x-auto whitespace-pre"
            >
              {code}
            </pre>
          );
        }
        if (/^(\d+\.|-)\s/m.test(b)) {
          const items = b.split(/\n/).filter(Boolean);
          return (
            <ul key={i} className="space-y-1 pl-4 list-disc marker:text-[var(--color-fg-subtle)]">
              {items.map((it, j) => (
                <li key={j}>{inline(it.replace(/^(\d+\.|-)\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}

function inline(s: string): React.ReactNode {
  // **bold** and `code`
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-fg)]">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-[var(--color-surface-3)] px-1 py-0.5 text-[12px] font-mono text-[var(--color-fg)]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return p;
  });
}
