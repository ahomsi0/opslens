"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createConnection } from "@/lib/api";

export function ConnectVercelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("Vercel");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("Vercel");
    setToken("");
    setError(null);
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Token is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createConnection({ provider: "vercel", name, token: token.trim() });
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <VercelMark />
            </span>
            <h2 className="text-base font-semibold tracking-tight">
              Connect Vercel
            </h2>
          </div>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Paste a Vercel access token. We&apos;ll pull your projects and
            recent deployments, then re-sync every 30 seconds.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--color-fg-muted)]">
              Display name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Personal account"
              className="mt-1"
              disabled={busy}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-fg-muted)]">
                Vercel access token
              </label>
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
              >
                Get one
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="vc_…"
              className="mt-1 font-mono"
              autoFocus
              disabled={busy}
            />
            <p className="mt-1.5 text-[11px] text-[var(--color-fg-subtle)]">
              Stored encrypted (AES-256-GCM). Never logged. Used only to call
              the Vercel API on your behalf.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-[oklch(0.69_0.22_25/0.4)] bg-[oklch(0.69_0.22_25/0.08)] p-2.5 text-xs text-[oklch(0.82_0.18_25)]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !token.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Verifying…" : "Connect"}
            </Button>
          </div>
        </form>

        <details className="text-[11px] text-[var(--color-fg-subtle)]">
          <summary className="cursor-pointer text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            How do I get a Vercel token?
          </summary>
          <ol className="mt-2 space-y-1 pl-5 list-decimal">
            <li>
              Go to{" "}
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--color-accent)] hover:underline"
              >
                vercel.com/account/tokens
              </a>
            </li>
            <li>Click <span className="font-mono">Create Token</span></li>
            <li>
              Name it <span className="font-mono">Opslens</span>, scope to
              your account (read-only is enough), no expiry or 90 days
            </li>
            <li>Copy the token and paste it above</li>
          </ol>
        </details>
      </DialogContent>
    </Dialog>
  );
}

function VercelMark() {
  return (
    <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5" aria-hidden>
      <path d="M12 2 22 20H2L12 2Z" />
    </svg>
  );
}
