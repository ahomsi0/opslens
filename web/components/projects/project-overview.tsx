"use client";

import { useLiveMetrics } from "@/hooks/use-live-metrics";
import { LiveChart } from "@/components/charts/live-chart";
import { ConnectionPill } from "@/components/charts/connection-pill";
import { DeploymentTimeline } from "./deployment-timeline";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Deployment, ProjectSummary } from "@/lib/types";
import { formatMs } from "@/lib/format";

export function ProjectOverview({
  project,
  deployments,
}: {
  project: ProjectSummary;
  deployments: Deployment[];
}) {
  const { frames, latest, status } = useLiveMetrics(project.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Live metrics</h2>
        <ConnectionPill status={status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveChart
          frames={frames}
          dataKey="cpu"
          label="CPU"
          unit="%"
          formatY={(v) => v.toFixed(0)}
        />
        <LiveChart
          frames={frames}
          dataKey="memory"
          label="Memory"
          unit="%"
          color="oklch(0.74 0.18 295)"
          formatY={(v) => v.toFixed(0)}
        />
        <LiveChart
          frames={frames}
          dataKey="latencyMs"
          label="Latency p95"
          formatY={formatMs}
        />
        <NetworkChart frames={frames} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Request rate
          </div>
          <div className="mt-1 font-mono text-3xl tabular-nums">
            {latest ? Math.round(latest.rps) : "—"}
            <span className="ml-1 text-sm text-[var(--color-fg-muted)]">
              rps
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <SmallStat
              label="2xx"
              value={`${Math.round((latest?.rps ?? 0) * 0.96)}`}
              tone="good"
            />
            <SmallStat
              label="5xx"
              value={`${Math.round((latest?.rps ?? 0) * 0.012)}`}
              tone={
                project.status === "down"
                  ? "bad"
                  : project.status === "degraded"
                    ? "warn"
                    : "default"
              }
            />
          </div>
        </Card>
        <Card className="p-4 col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Latest activity
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
            >
              <Link href={`/projects/${project.id}/logs`}>View all logs →</Link>
            </Button>
          </div>
          <div className="mt-2 space-y-1.5 font-mono text-[12px]">
            {(latest ? activityFromMetrics(latest, project) : []).map(
              (line, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-2 text-[var(--color-fg-muted)]"
                >
                  <span className="text-[var(--color-fg-subtle)]">
                    {new Date(latest!.ts).toLocaleTimeString("en-US", {
                      hour12: false,
                    })}
                  </span>
                  <span>{line}</span>
                </div>
              ),
            )}
            {!latest && (
              <div className="text-[var(--color-fg-subtle)]">
                Waiting for metrics…
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent deployments
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${project.id}/deployments`}>View all →</Link>
          </Button>
        </div>
        <DeploymentTimeline deployments={deployments.slice(0, 6)} />
      </div>
    </div>
  );
}

function NetworkChart({ frames }: { frames: Parameters<typeof LiveChart>[0]["frames"] }) {
  // Single-stat tile that compactly shows both directions
  const latest = frames[frames.length - 1];
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        Network
      </div>
      <div className="mt-1 flex items-baseline gap-4">
        <div>
          <div className="text-[10px] text-[var(--color-fg-subtle)]">in</div>
          <div className="font-mono text-xl tabular-nums">
            {latest ? Math.round(latest.netIn) : "—"}
            <span className="ml-1 text-xs text-[var(--color-fg-muted)]">
              Mb/s
            </span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-fg-subtle)]">out</div>
          <div className="font-mono text-xl tabular-nums">
            {latest ? Math.round(latest.netOut) : "—"}
            <span className="ml-1 text-xs text-[var(--color-fg-muted)]">
              Mb/s
            </span>
          </div>
        </div>
      </div>
      <DualLineMini frames={frames} />
    </div>
  );
}

function DualLineMini({
  frames,
}: {
  frames: Parameters<typeof LiveChart>[0]["frames"];
}) {
  const data = frames.slice(-80);
  if (data.length < 2)
    return <div className="mt-4 h-[120px] shimmer rounded" aria-hidden />;
  const max = Math.max(...data.flatMap((f) => [f.netIn, f.netOut]));
  const min = 0;
  const span = max - min || 1;
  const w = 400;
  const h = 120;
  const sx = w / (data.length - 1);

  const toPath = (key: "netIn" | "netOut") =>
    data
      .map(
        (f, i) =>
          `${i === 0 ? "M" : "L"}${(i * sx).toFixed(1)} ${(h - ((f[key] - min) / span) * (h - 10) - 5).toFixed(1)}`,
      )
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-4 w-full h-[120px]"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={toPath("netIn")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d={toPath("netOut")}
        fill="none"
        stroke="oklch(0.74 0.18 295)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

function SmallStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad" | "default";
}) {
  const color =
    tone === "good"
      ? "text-[oklch(0.85_0.14_155)]"
      : tone === "warn"
        ? "text-[oklch(0.88_0.14_80)]"
        : tone === "bad"
          ? "text-[oklch(0.82_0.18_25)]"
          : "text-[var(--color-fg)]";
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className={`mt-0.5 font-mono tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function activityFromMetrics(
  latest: NonNullable<ReturnType<typeof useLiveMetrics>["latest"]>,
  project: ProjectSummary,
) {
  const lines: string[] = [
    `GET /v1/${project.slug.replace(/-/g, "_")}  200  dur=${Math.round(latest.latencyMs * 0.6)}ms`,
    `POST /v1/events  202  dur=${Math.round(latest.latencyMs * 0.3)}ms`,
    `metric cpu.pct value=${latest.cpu.toFixed(1)}`,
  ];
  if (project.status === "degraded") {
    lines.unshift(
      `WARN slow query detected query_ms=${Math.round(latest.latencyMs * 4)} table=deployments`,
    );
  }
  if (project.status === "down") {
    lines.unshift(
      `ERROR 5xx returned from provider provider=${project.provider} code=502`,
    );
  }
  return lines.slice(0, 5);
}
