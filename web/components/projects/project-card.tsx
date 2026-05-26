"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GitCommit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusDot } from "./status-dot";
import { EnvChip } from "./env-chip";
import { ProviderIcon, providerLabels } from "./provider-icon";
import { formatMs, formatPercent, shortSha, timeAgo } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";

export function ProjectCard({
  project,
  index = 0,
}: {
  project: ProjectSummary;
  index?: number;
}) {
  const last = project.lastDeployment;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
    >
      <Link href={`/projects/${project.id}`} className="block group">
        <Card className="p-5 transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elevated)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusDot status={project.status} />
                <h3 className="font-semibold tracking-tight truncate group-hover:text-[var(--color-accent)] transition">
                  {project.name}
                </h3>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                <ProviderIcon provider={project.provider} />
                <span>{providerLabels[project.provider]}</span>
                <span className="text-[var(--color-fg-subtle)]">·</span>
                <span className="font-mono">{project.region}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {project.source === "demo" && (
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase tracking-wider"
                  title="Synthetic demo data"
                >
                  Demo
                </Badge>
              )}
              <EnvChip env={project.environment} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <Metric
              label="Uptime · 30d"
              value={formatPercent(project.uptimePct, 2)}
              tone={
                project.uptimePct > 99.5
                  ? "good"
                  : project.uptimePct > 98
                    ? "warn"
                    : "bad"
              }
            />
            <Metric
              label="p95 latency"
              value={project.latencyP95Ms ? formatMs(project.latencyP95Ms) : "—"}
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] mb-1.5">
              <span>Latency · last 5m</span>
              {project.activeIncidents > 0 && (
                <span className="text-[oklch(0.82_0.18_25)]">
                  {project.activeIncidents} incident
                  {project.activeIncidents > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <Sparkline
              data={project.latencySpark || []}
              width={300}
              height={36}
              className="w-full"
              stroke={
                project.status === "down"
                  ? "oklch(0.69 0.22 25)"
                  : project.status === "degraded"
                    ? "oklch(0.82 0.16 80)"
                    : "var(--color-accent)"
              }
              fill={
                project.status === "down"
                  ? "oklch(0.69 0.22 25 / 0.12)"
                  : project.status === "degraded"
                    ? "oklch(0.82 0.16 80 / 0.12)"
                    : "oklch(0.81 0.14 200 / 0.12)"
              }
            />
          </div>

          {last && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-fg-muted)] border-t border-[var(--color-border)] pt-3">
              <GitCommit className="h-3.5 w-3.5" />
              <span className="font-mono">{shortSha(last.commitSha)}</span>
              <span className="truncate flex-1">{last.commitMsg}</span>
              <span className="text-[var(--color-fg-subtle)] shrink-0">
                {timeAgo(last.createdAt)}
              </span>
            </div>
          )}
        </Card>
      </Link>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color =
    tone === "bad"
      ? "text-[oklch(0.82_0.18_25)]"
      : tone === "warn"
        ? "text-[oklch(0.88_0.14_80)]"
        : "text-[var(--color-fg)]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-base tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
