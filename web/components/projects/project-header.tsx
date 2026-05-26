import { Github, Globe, MapPin } from "lucide-react";
import { StatusDot } from "./status-dot";
import { EnvChip } from "./env-chip";
import { ProviderIcon, providerLabels } from "./provider-icon";
import { formatMs, formatPercent } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";

export function ProjectHeader({ project }: { project: ProjectSummary }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <StatusDot status={project.status} size="lg" />
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {project.name}
          </h1>
          <EnvChip env={project.environment} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-fg-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <ProviderIcon provider={project.provider} />
            {providerLabels[project.provider]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            <span className="font-mono">{project.region}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            <span className="font-mono">{project.domain}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Github className="h-3 w-3" />
            <span className="font-mono truncate max-w-[280px]">
              {project.repoUrl}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Status" value={statusLabel(project.status)} tone={project.status} />
        <Stat
          label="Uptime · 30d"
          value={formatPercent(project.uptimePct, 2)}
          tone={
            project.uptimePct > 99.5
              ? "healthy"
              : project.uptimePct > 98
                ? "degraded"
                : "down"
          }
        />
        <Stat
          label="p95 latency"
          value={project.latencyP95Ms ? formatMs(project.latencyP95Ms) : "—"}
        />
        <Stat
          label="Active incidents"
          value={String(project.activeIncidents)}
          tone={project.activeIncidents === 0 ? "healthy" : "down"}
        />
      </div>
    </div>
  );
}

function statusLabel(s: ProjectSummary["status"]) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: ProjectSummary["status"];
}) {
  const color =
    tone === "down"
      ? "text-[oklch(0.82_0.18_25)]"
      : tone === "degraded"
        ? "text-[oklch(0.88_0.14_80)]"
        : tone === "healthy"
          ? "text-[oklch(0.85_0.14_155)]"
          : "text-[var(--color-fg)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 noise">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
