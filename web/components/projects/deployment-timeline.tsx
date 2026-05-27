"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  GitBranch,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Deployment } from "@/lib/types";
import { formatDateTime, shortSha, timeAgo } from "@/lib/format";

const statusConfig: Record<
  Deployment["status"],
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    label: "Deployed",
    color: "text-[oklch(0.85_0.14_155)] border-[oklch(0.78_0.16_155/0.45)] bg-[oklch(0.78_0.16_155/0.1)]",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-[oklch(0.82_0.18_25)] border-[oklch(0.69_0.22_25/0.45)] bg-[oklch(0.69_0.22_25/0.1)]",
    icon: XCircle,
  },
  "rolled-back": {
    label: "Rolled back",
    color: "text-[oklch(0.88_0.14_80)] border-[oklch(0.82_0.16_80/0.45)] bg-[oklch(0.82_0.16_80/0.1)]",
    icon: RotateCcw,
  },
  building: {
    label: "Building",
    color: "text-[oklch(0.78_0.13_200)] border-[oklch(0.62_0.13_200/0.45)] bg-[oklch(0.62_0.13_200/0.1)]",
    icon: GitBranch,
  },
  canceled: {
    label: "Canceled",
    color: "text-[var(--color-fg-muted)] border-[var(--color-border)] bg-[var(--color-surface-2)]",
    icon: XCircle,
  },
};

export function DeploymentTimeline({
  deployments,
}: {
  deployments: Deployment[];
}) {
  if (!deployments.length) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
        No deployments yet.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-[var(--color-border)]" />
      <ol className="space-y-3">
        {deployments.map((d, i) => {
          const s = statusConfig[d.status];
          const Icon = s.icon;
          return (
            <motion.li
              key={d.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.02 }}
              className="relative flex gap-4"
            >
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-[var(--color-bg-elevated)]">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${s.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="flex-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2.5 min-w-0 flex-1">
                    <span
                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${s.color}`}
                    >
                      {s.label}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-fg-muted)]">
                      {shortSha(d.commitSha)}
                    </span>
                    {/* Commit message wraps onto multiple lines instead of
                        truncating — some real commits are paragraph-length. */}
                    <span className="text-sm break-words whitespace-pre-wrap min-w-0">
                      {d.commitMsg}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-fg-subtle)] shrink-0">
                    {timeAgo(d.createdAt)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-fg-muted)] font-mono">
                  <span>{d.author}</span>
                  <span className="text-[var(--color-fg-subtle)]">·</span>
                  <span>{d.branch}</span>
                  <span className="text-[var(--color-fg-subtle)]">·</span>
                  <span>{(d.durationMs / 1000).toFixed(1)}s build</span>
                  <span className="text-[var(--color-fg-subtle)]">·</span>
                  <span>{formatDateTime(d.createdAt)}</span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
