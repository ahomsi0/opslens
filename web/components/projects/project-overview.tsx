"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LatencyChart } from "@/components/charts/latency-chart";
import { DeploymentTimeline } from "./deployment-timeline";
import {
  fetchProjectMetrics,
  type ProjectMetrics,
} from "@/lib/api";
import { formatMs } from "@/lib/format";
import type { Deployment, ProjectSummary } from "@/lib/types";
import { providerLabels } from "./provider-icon";

type Window = "24h" | "7d" | "30d";

export function ProjectOverview({
  project,
  deployments,
}: {
  project: ProjectSummary;
  deployments: Deployment[];
}) {
  const [window, setWindow] = useState<Window>("24h");
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchProjectMetrics(project.id, window).then((m) => {
      if (alive) {
        setMetrics(m);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [project.id, window]);

  // Re-fetch periodically so the page reflects new probe results.
  useEffect(() => {
    const id = setInterval(() => {
      fetchProjectMetrics(project.id, window).then((m) => {
        if (m) setMetrics(m);
      });
    }, 60_000);
    return () => clearInterval(id);
  }, [project.id, window]);

  const summary = metrics?.latency.summary;
  const series = metrics?.latency.series ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Health</h2>
        <WindowSwitcher value={window} onChange={setWindow} />
      </div>

      {/* Live summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile
          label="p50 latency"
          value={summary ? formatMs(summary.p50) : "—"}
          loading={loading}
        />
        <SummaryTile
          label="p95 latency"
          value={summary ? formatMs(summary.p95) : "—"}
          loading={loading}
        />
        <SummaryTile
          label="p99 latency"
          value={summary ? formatMs(summary.p99) : "—"}
          loading={loading}
        />
        <SummaryTile
          label="Probes"
          value={
            metrics?.uptime
              ? `${metrics.uptime.total - metrics.uptime.failed} / ${metrics.uptime.total}`
              : "—"
          }
          hint={
            metrics?.uptime && metrics.uptime.failed > 0
              ? `${metrics.uptime.failed} failed`
              : undefined
          }
          loading={loading}
        />
      </div>

      {/* Real latency chart */}
      <LatencyChart series={series} />

      {/* Honest panel about CPU / memory / network */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 mt-0.5 text-[var(--color-fg-muted)] shrink-0" />
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Live CPU, memory, and network are not available on this provider
            </div>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)] leading-relaxed">
              The {providerLabels[project.provider]} API doesn&apos;t expose
              per-second resource metrics on the tier this project is on.
              Latency above is measured by Opslens&apos; own uptime probes hitting{" "}
              <span className="font-mono">{project.domain}</span> from our
              Render region every 60 seconds — that data is real.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--color-fg-muted)]">
              {project.provider === "vercel" && (
                <ResourceHint label="Want resource metrics?" body="Upgrade to Vercel Pro and connect their Analytics; or move this service to Render Starter / a Docker host." />
              )}
              {project.provider === "render" && (
                <ResourceHint label="Want resource metrics?" body="Upgrade this Render service from Free to Starter ($7/mo). The Render metrics API is then exposed and we'll pull cpu / memory / http_request_count." />
              )}
              {(project.provider === "neon" ||
                project.provider === "supabase") && (
                <ResourceHint label="Database metrics" body={`${providerLabels[project.provider]} exposes some stats (active time, db size) on paid tiers — we'll surface them when you upgrade.`} />
              )}
              {project.provider === "railway" && (
                <ResourceHint label="Railway metrics" body="Railway's metrics API requires a paid plan. We'll pull CPU/memory once you upgrade." />
              )}
              {project.provider === "docker" && (
                <ResourceHint label="Already self-hosted" body="Our Docker agent does report container CPU/memory/network on every heartbeat — extending the dashboard to plot it is a future task." />
              )}
              <ResourceHint
                label="What we DO measure"
                body="Uptime % over rolling windows, response latency (p50/p95/p99), HTTP status, latency over time. All from real probes."
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Recent deploys */}
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

      {project.domain && (
        <div className="text-right">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <a
              href={`https://${project.domain.replace(/^https?:\/\//, "")}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Visit {project.domain}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-2xl tabular-nums " +
          (loading ? "opacity-50" : "")
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-[var(--color-fg-subtle)]">
          {hint}
        </div>
      )}
    </div>
  );
}

function WindowSwitcher({
  value,
  onChange,
}: {
  value: Window;
  onChange: (w: Window) => void;
}) {
  const opts: Window[] = ["24h", "7d", "30d"];
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={
            "px-2.5 py-1 rounded transition " +
            (value === o
              ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
              : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]")
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function ResourceHint({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5">
      <div className="font-semibold text-[var(--color-fg)]">{label}</div>
      <div className="mt-0.5 leading-relaxed">{body}</div>
    </div>
  );
}
