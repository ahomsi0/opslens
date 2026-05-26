"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Pause, Play, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchLogs } from "@/lib/api";
import type { LogEntry, LogLevel } from "@/lib/types";
import { formatTime } from "@/lib/format";

const LEVELS: LogLevel[] = ["info", "warn", "error", "debug"];

const levelStyles: Record<
  LogLevel,
  { dot: string; chip: string; row: string }
> = {
  info: {
    dot: "bg-[oklch(0.81_0.14_200)]",
    chip: "text-[oklch(0.88_0.12_200)] border-[oklch(0.81_0.14_200/0.4)] bg-[oklch(0.81_0.14_200/0.08)]",
    row: "",
  },
  warn: {
    dot: "bg-[oklch(0.82_0.16_80)]",
    chip: "text-[oklch(0.88_0.14_80)] border-[oklch(0.82_0.16_80/0.4)] bg-[oklch(0.82_0.16_80/0.08)]",
    row: "bg-[oklch(0.82_0.16_80/0.03)]",
  },
  error: {
    dot: "bg-[oklch(0.69_0.22_25)]",
    chip: "text-[oklch(0.82_0.18_25)] border-[oklch(0.69_0.22_25/0.45)] bg-[oklch(0.69_0.22_25/0.06)]",
    row: "bg-[oklch(0.69_0.22_25/0.04)]",
  },
  debug: {
    dot: "bg-[var(--color-fg-subtle)]",
    chip: "text-[var(--color-fg-muted)] border-[var(--color-border)] bg-[var(--color-surface-2)]",
    row: "",
  },
};

interface Props {
  projectId: string;
  initial: { logs: LogEntry[]; nextCursor: number | null };
}

export function LogViewer({ projectId, initial }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>(initial.logs);
  const [cursor, setCursor] = useState<number | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [follow, setFollow] = useState(false);
  const [search, setSearch] = useState("");
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    new Set(LEVELS),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(
      (l) =>
        activeLevels.has(l.level) &&
        (!q ||
          l.message.toLowerCase().includes(q) ||
          l.source.toLowerCase().includes(q)),
    );
  }, [logs, search, activeLevels]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const loadMore = useCallback(async () => {
    if (loading || !cursor || exhausted) return;
    setLoading(true);
    try {
      const next = await fetchLogs(projectId, { cursor, limit: 200 });
      if (next.logs.length === 0) {
        setExhausted(true);
      } else {
        setLogs((prev) => prev.concat(next.logs));
        setCursor(next.nextCursor);
        if (!next.nextCursor) setExhausted(true);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, cursor, loading, exhausted]);

  // Auto-load more when scrolled near bottom
  useEffect(() => {
    const last = virtualizer.getVirtualItems().at(-1);
    if (!last) return;
    if (last.index >= filtered.length - 20) {
      loadMore();
    }
  }, [virtualizer.getVirtualItems(), filtered.length, loadMore]);

  // Follow tail: poll for new logs (simulates streaming since logs aren't streamed via WS in this prototype)
  useEffect(() => {
    if (!follow) return;
    const tick = async () => {
      try {
        const fresh = await fetchLogs(projectId, { limit: 50 });
        if (fresh.logs.length > 0) {
          setLogs((prev) => {
            const known = new Set(prev.slice(0, 50).map((l) => l.id));
            const additions = fresh.logs.filter((l) => !known.has(l.id));
            if (!additions.length) return prev;
            return additions.concat(prev);
          });
        }
      } catch {
        // ignore
      }
    };
    const interval = setInterval(tick, 4000);
    return () => clearInterval(interval);
  }, [follow, projectId]);

  const toggleLevel = (l: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      if (next.size === 0) return new Set(LEVELS);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages, sources…"
            className="pl-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {LEVELS.map((l) => {
            const on = activeLevels.has(l);
            return (
              <button
                key={l}
                onClick={() => toggleLevel(l)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono uppercase tracking-wider transition",
                  on
                    ? levelStyles[l].chip
                    : "border-[var(--color-border)] text-[var(--color-fg-subtle)] bg-transparent",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", levelStyles[l].dot)} />
                {l}
              </button>
            );
          })}
        </div>
        <Button
          variant={follow ? "default" : "outline"}
          size="sm"
          onClick={() => setFollow((v) => !v)}
          className="gap-1.5"
        >
          {follow ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              Following
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Follow tail
            </>
          )}
        </Button>
        <div className="ml-auto text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {filtered.length.toLocaleString()} entries
          {exhausted && " · all loaded"}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[70vh] overflow-auto font-mono text-[12px]"
        role="log"
        aria-live={follow ? "polite" : "off"}
      >
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-fg-muted)]">
            No logs match the current filters.
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const log = filtered[vi.index];
              const styles = levelStyles[log.level];
              const isOpen = expanded.has(log.id);
              return (
                <div
                  key={log.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vi.start}px)`,
                  }}
                  className={cn(
                    "border-b border-[var(--color-border)]/60",
                    styles.row,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="w-full flex items-start gap-3 px-4 py-1.5 text-left hover:bg-[var(--color-surface-2)] transition"
                  >
                    <ChevronRight
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0 text-[var(--color-fg-subtle)] transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />
                    <span className="text-[var(--color-fg-subtle)] tabular-nums shrink-0">
                      {formatTime(log.createdAt)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center rounded border px-1.5 text-[10px] uppercase tracking-wider",
                        styles.chip,
                      )}
                    >
                      {log.level}
                    </span>
                    <span className="text-[var(--color-fg-subtle)] shrink-0 w-16 truncate">
                      {log.source}
                    </span>
                    <span className="flex-1 text-[var(--color-fg)] truncate">
                      {log.message}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-12 pb-3 text-[var(--color-fg-muted)] space-y-1.5">
                      <div>
                        <span className="text-[var(--color-fg-subtle)]">
                          full:
                        </span>{" "}
                        {log.message}
                      </div>
                      {log.level === "error" && (
                        <pre className="text-[11px] leading-relaxed text-[var(--color-fg-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md p-3 overflow-x-auto">
{`Error: ${log.message}
    at ${log.source}.handle (${log.source}.go:142)
    at server.dispatch (server.go:88)
    at runtime.main (runtime.go:267)`}
                        </pre>
                      )}
                      <div className="text-[10px] text-[var(--color-fg-subtle)]">
                        id={log.id} · {new Date(log.createdAt).toISOString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
