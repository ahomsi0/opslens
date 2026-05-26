"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api";

// Docker is agent-based, not API-based. Creating a connection mints a
// heartbeat token the user installs on their Docker host. We show the
// install one-liner once — they can't recover the token after closing.
export function ConnectDockerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [name, setName] = useState("Docker host");
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setHostName("");
    setName("Docker host");
    setAgentToken(null);
    setError(null);
    setBusy(false);
    setCopied(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl("/api/connections")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "docker",
          name,
          hostName,
        }),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data = await res.json();
      setAgentToken(data.agentToken);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const oneLiner = agentToken
    ? `OPSLENS_TOKEN=${agentToken} OPSLENS_URL=${apiUrl("/api/docker/heartbeat")} sh -c '
while true; do
  C=$(docker ps --format "{{json .}}" | jq -s ".[] | {id: .ID, name: .Names, image: .Image, status: (.State // \\"running\\"), state: .Status}" | jq -s .)
  curl -s -X POST -H "Authorization: Bearer $OPSLENS_TOKEN" -H "Content-Type: application/json" \\
    -d "{\\"hostName\\": \\"$(hostname)\\", \\"agentVer\\": \\"1.0\\", \\"containers\\": $C}" $OPSLENS_URL > /dev/null
  sleep 30
done'`
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Connect Docker host
          </h2>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Docker isn&apos;t a SaaS — we can&apos;t pull from it. Instead, run
            a small heartbeat loop on your Docker host that reports container
            state every 30 seconds. We&apos;ll mint a token below.
          </p>
        </div>

        {!agentToken ? (
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
              <label className="text-xs font-medium text-[var(--color-fg-muted)]">
                Host nickname (optional)
              </label>
              <Input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. fly-bastion-01"
                className="mt-1 font-mono"
                disabled={busy}
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-fg-subtle)]">
                Used as a label until the agent reports its real hostname.
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
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Creating…" : "Generate token"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-[oklch(0.78_0.16_155/0.4)] bg-[oklch(0.78_0.16_155/0.08)] p-3 text-xs text-[oklch(0.85_0.14_155)]">
              <div className="font-semibold">Token generated</div>
              <p className="mt-1 text-[var(--color-fg-muted)]">
                Run the script below on your Docker host. The token is shown
                <strong> once</strong> — copy it now.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[var(--color-fg-muted)]">
                  Install command
                </label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(oneLiner);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="font-mono text-[11px] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
{oneLiner}
              </pre>
              <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
                Requires <span className="font-mono">docker</span>,{" "}
                <span className="font-mono">curl</span>, and{" "}
                <span className="font-mono">jq</span> on the host. Runs
                indefinitely; restart it under systemd / a docker container
                for production use.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
