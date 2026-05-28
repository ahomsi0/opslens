"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plug, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderIcon, providerLabels } from "@/components/projects/provider-icon";
import { ConnectVercelDialog } from "./connect-vercel-dialog";
import { ConnectRenderDialog } from "./connect-render-dialog";
import { ConnectNeonDialog } from "./connect-neon-dialog";
import { ConnectSupabaseDialog } from "./connect-supabase-dialog";
import { ConnectRailwayDialog } from "./connect-railway-dialog";
import { ConnectDockerDialog } from "./connect-docker-dialog";
import { ConnectUptimeRobotDialog } from "./connect-uptimerobot-dialog";
import { deleteConnection } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Connection, Provider } from "@/lib/types";

interface ProviderInfo {
  provider: Provider;
  description: string;
}

const catalog: ProviderInfo[] = [
  {
    provider: "vercel",
    description:
      "Pull your Vercel projects, recent deployments, and commit history. Re-syncs every 30 seconds.",
  },
  {
    provider: "render",
    description:
      "Pull your Render services, their live URLs, and recent deploys. Re-syncs every 30 seconds.",
  },
  {
    provider: "railway",
    description:
      "Pull every service across your Railway projects with each service's recent deploys, statuses, and commits.",
  },
  {
    provider: "neon",
    description:
      "Pull your Postgres projects from Neon — name, region, version. No deployment history (Neon is a managed database).",
  },
  {
    provider: "supabase",
    description:
      "Pull projects from the Supabase Management API: name, region, health status. No deployment history.",
  },
  {
    provider: "uptimerobot",
    description:
      "Pull every monitor on your UptimeRobot account with their current up/down status. Useful if you already track external services there.",
  },
  {
    provider: "docker",
    description:
      "Self-hosted. Run a small heartbeat agent on your Docker host that reports container state every 30s — we mint the token here.",
  },
];

export function IntegrationsList({
  connections,
}: {
  connections: Connection[];
}) {
  const [openDialog, setOpenDialog] = useState<Provider | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const connectedByProvider = new Map<string, Connection[]>();
  for (const c of connections) {
    const arr = connectedByProvider.get(c.provider) ?? [];
    arr.push(c);
    connectedByProvider.set(c.provider, arr);
  }

  const onDisconnect = (id: string) => {
    if (!confirm("Disconnect this provider? Your synced projects will be removed.")) return;
    startTransition(async () => {
      await deleteConnection(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {catalog.map((p) => {
        const connected = connectedByProvider.get(p.provider) ?? [];
        const hasAny = connected.length > 0;
        return (
          <div
            key={p.provider}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 noise"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shrink-0">
                  <ProviderIcon provider={p.provider} className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight">
                      {providerLabels[p.provider]}
                    </h3>
                    {hasAny && (
                      <Badge variant="success" className="font-mono uppercase text-[10px] tracking-wider">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </Badge>
                    )}
                    {p.provider === "docker" && !hasAny && (
                      <Badge variant="outline" className="font-mono uppercase text-[10px] tracking-wider">
                        Agent-based
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)] leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <Button
                  size="sm"
                  variant={hasAny ? "outline" : "default"}
                  onClick={() => setOpenDialog(p.provider)}
                  className="gap-1.5"
                >
                  <Plug className="h-3.5 w-3.5" />
                  {hasAny ? "Add another" : "Connect"}
                </Button>
              </div>
            </div>

            {hasAny && (
              <div className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-3">
                {connected.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-[var(--color-fg)]">
                        {c.name}
                      </span>
                      {c.accountLabel && (
                        <span className="font-mono text-[var(--color-fg-muted)]">
                          @{c.accountLabel}
                        </span>
                      )}
                      <span className="text-[var(--color-fg-subtle)]">
                        {c.lastSyncedAt
                          ? `synced ${timeAgo(c.lastSyncedAt)}`
                          : c.provider === "docker"
                            ? "awaiting first heartbeat"
                            : "syncing…"}
                      </span>
                      {c.lastError && (
                        <span
                          className="text-[oklch(0.82_0.18_25)] truncate"
                          title={c.lastError}
                        >
                          · sync error
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onDisconnect(c.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[var(--color-fg-muted)] hover:text-[oklch(0.82_0.18_25)] hover:bg-[oklch(0.69_0.22_25/0.08)] transition disabled:opacity-50"
                      aria-label="Disconnect"
                    >
                      <Trash2 className="h-3 w-3" />
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <ConnectVercelDialog
        open={openDialog === "vercel"}
        onOpenChange={(v) => setOpenDialog(v ? "vercel" : null)}
      />
      <ConnectRenderDialog
        open={openDialog === "render"}
        onOpenChange={(v) => setOpenDialog(v ? "render" : null)}
      />
      <ConnectRailwayDialog
        open={openDialog === "railway"}
        onOpenChange={(v) => setOpenDialog(v ? "railway" : null)}
      />
      <ConnectNeonDialog
        open={openDialog === "neon"}
        onOpenChange={(v) => setOpenDialog(v ? "neon" : null)}
      />
      <ConnectSupabaseDialog
        open={openDialog === "supabase"}
        onOpenChange={(v) => setOpenDialog(v ? "supabase" : null)}
      />
      <ConnectDockerDialog
        open={openDialog === "docker"}
        onOpenChange={(v) => setOpenDialog(v ? "docker" : null)}
      />
      <ConnectUptimeRobotDialog
        open={openDialog === "uptimerobot"}
        onOpenChange={(v) => setOpenDialog(v ? "uptimerobot" : null)}
      />
    </div>
  );
}
