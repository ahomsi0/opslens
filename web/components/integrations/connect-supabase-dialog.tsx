"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createConnection } from "@/lib/api";

export function ConnectSupabaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("Supabase");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("Supabase");
    setToken("");
    setError(null);
    setBusy(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Access token is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createConnection({
        provider: "supabase",
        name,
        token: token.trim(),
      });
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
          <h2 className="text-base font-semibold tracking-tight">
            Connect Supabase
          </h2>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Paste a Supabase Management API access token. We&apos;ll pull your
            projects and their health status. Since Supabase projects aren&apos;t
            deployed in the traditional sense, the deployments tab will stay
            empty.
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
              className="mt-1"
              disabled={busy}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-fg-muted)]">
                Personal access token
              </label>
              <a
                href="https://supabase.com/dashboard/account/tokens"
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
              placeholder="sbp_…"
              className="mt-1 font-mono"
              autoFocus
              disabled={busy}
            />
            <p className="mt-1.5 text-[11px] text-[var(--color-fg-subtle)]">
              Stored encrypted. Read-only scope is enough.
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
      </DialogContent>
    </Dialog>
  );
}
