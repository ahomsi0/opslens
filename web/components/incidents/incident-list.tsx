"use client";

import Link from "next/link";
import { AlertOctagon, CheckCircle2, ChevronRight } from "lucide-react";
import type { Incident } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";

export function IncidentList({
  incidents,
  showProject = true,
}: {
  incidents: Incident[];
  showProject?: boolean;
}) {
  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
        <CheckCircle2 className="h-6 w-6 mx-auto text-[oklch(0.78_0.16_155)]" />
        <h3 className="mt-3 text-sm font-semibold">All clear</h3>
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
          No incidents recorded yet. We open one when a probe fails three
          times in a row, and close it after three recoveries.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {incidents.map((i) => {
        const open = !i.endedAt;
        const durMin = Math.max(1, Math.round(i.durationMs / 60000));
        return (
          <li key={i.id}>
            <Link
              href={`/projects/${i.projectId}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)] transition group"
            >
              <div className="flex items-start gap-3">
                <span
                  className={
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border " +
                    (open
                      ? "border-[oklch(0.69_0.22_25/0.5)] bg-[oklch(0.69_0.22_25/0.12)] text-[oklch(0.82_0.18_25)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)]")
                  }
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {showProject && (
                      <span className="text-sm font-medium text-[var(--color-fg)] group-hover:text-[var(--color-accent)] transition">
                        {i.projectName}
                      </span>
                    )}
                    <span
                      className={
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                        (open
                          ? "border-[oklch(0.69_0.22_25/0.45)] bg-[oklch(0.69_0.22_25/0.1)] text-[oklch(0.82_0.18_25)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)]")
                      }
                    >
                      {open ? "ongoing" : "resolved"}
                    </span>
                    <span className="text-xs text-[var(--color-fg-muted)]">
                      {open
                        ? `started ${timeAgo(i.startedAt)}`
                        : `${durMin}m duration`}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-[var(--color-fg-muted)] font-mono">
                    {i.firstStatus ? `HTTP ${i.firstStatus}` : "—"}
                    {i.firstError && (
                      <>
                        <span className="mx-1.5 text-[var(--color-fg-subtle)]">
                          ·
                        </span>
                        <span className="truncate">{i.firstError}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-fg-subtle)]">
                    {formatDateTime(i.startedAt)}
                    {i.endedAt && (
                      <>
                        {" → "}
                        {formatDateTime(i.endedAt)}
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-fg-subtle)] shrink-0 mt-1" />
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
