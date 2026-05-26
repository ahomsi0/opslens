"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  GitCommit,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/projects/status-dot";
import { EnvChip } from "@/components/projects/env-chip";
import {
  ProviderIcon,
  providerLabels,
} from "@/components/projects/provider-icon";
import { cn } from "@/lib/utils";
import {
  formatMs,
  formatPercent,
  shortSha,
  timeAgo,
} from "@/lib/format";
import type {
  Environment,
  ProjectStatus,
  ProjectSummary,
  Provider,
} from "@/lib/types";

type SortKey =
  | "name"
  | "status"
  | "provider"
  | "uptime"
  | "p95"
  | "lastDeploy";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const STATUS_ORDER: Record<ProjectStatus, number> = {
  down: 0,
  degraded: 1,
  healthy: 2,
};

export function ProjectTable({ projects }: { projects: ProjectSummary[] }) {
  const searchParams = useSearchParams();
  const initialProvider = searchParams.get("provider") as Provider | null;

  const [query, setQuery] = useState("");
  const [activeProviders, setActiveProviders] = useState<Set<Provider>>(
    () => (initialProvider ? new Set<Provider>([initialProvider]) : new Set()),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<ProjectStatus>>(
    new Set(),
  );
  const [activeEnvs, setActiveEnvs] = useState<Set<Environment>>(new Set());
  const [sort, setSort] = useState<SortState>({
    key: "status",
    dir: "asc",
  });

  // Re-apply provider filter when the URL param changes (e.g. user clicks
  // a different provider in the sidebar dropdown while already on /projects).
  useEffect(() => {
    if (initialProvider) {
      setActiveProviders(new Set<Provider>([initialProvider]));
    } else {
      setActiveProviders(new Set());
    }
  }, [initialProvider]);

  const providers = useMemo(
    () => Array.from(new Set(projects.map((p) => p.provider))).sort() as Provider[],
    [projects],
  );
  const statuses: ProjectStatus[] = ["healthy", "degraded", "down"];
  const envs = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.environment))).sort() as Environment[],
    [projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (q) {
        const hay = [p.name, p.provider, p.region, p.domain, p.environment]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (activeProviders.size > 0 && !activeProviders.has(p.provider))
        return false;
      if (activeStatuses.size > 0 && !activeStatuses.has(p.status))
        return false;
      if (activeEnvs.size > 0 && !activeEnvs.has(p.environment))
        return false;
      return true;
    });
  }, [projects, query, activeProviders, activeStatuses, activeEnvs]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "provider":
          cmp = a.provider.localeCompare(b.provider);
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case "uptime":
          cmp = a.uptimePct - b.uptimePct;
          break;
        case "p95":
          cmp = a.latencyP95Ms - b.latencyP95Ms;
          break;
        case "lastDeploy": {
          const at = a.lastDeployment?.createdAt ?? "";
          const bt = b.lastDeployment?.createdAt ?? "";
          cmp = at.localeCompare(bt);
          break;
        }
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const toggle = <T extends string>(
    set: Set<T>,
    setter: (s: Set<T>) => void,
    v: T,
  ) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setter(next);
  };

  const reset = () => {
    setQuery("");
    setActiveProviders(new Set());
    setActiveStatuses(new Set());
    setActiveEnvs(new Set());
  };

  const hasFilters =
    !!query ||
    activeProviders.size > 0 ||
    activeStatuses.size > 0 ||
    activeEnvs.size > 0;

  const onSort = (key: SortKey) => {
    if (sort.key === key) {
      setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      // sensible defaults per column
      const defaultDir: SortState["dir"] =
        key === "uptime" || key === "lastDeploy" ? "desc" : "asc";
      setSort({ key, dir: defaultDir });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, provider, region, domain…"
              className="pl-8"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="ml-auto text-xs font-mono text-[var(--color-fg-subtle)]">
            {sorted.length} of {projects.length}
          </div>
          {hasFilters && (
            <button
              onClick={reset}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <FilterGroup label="Status">
            {statuses.map((s) => (
              <Chip
                key={s}
                label={s}
                active={activeStatuses.has(s)}
                onClick={() => toggle(activeStatuses, setActiveStatuses, s)}
                indicator={<StatusDot status={s} size="sm" pulse={false} />}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Provider">
            {providers.map((p) => (
              <Chip
                key={p}
                label={providerLabels[p]}
                active={activeProviders.has(p)}
                onClick={() => toggle(activeProviders, setActiveProviders, p)}
                indicator={<ProviderIcon provider={p} />}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Environment">
            {envs.map((e) => (
              <Chip
                key={e}
                label={e}
                active={activeEnvs.has(e)}
                onClick={() => toggle(activeEnvs, setActiveEnvs, e)}
              />
            ))}
          </FilterGroup>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-sm font-semibold">No projects match your filters</h3>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              {projects.length === 0
                ? "Connect a provider to populate this view."
                : "Try clearing a filter or two."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] border-b border-[var(--color-border)]">
                  <Th sortKey="name" sort={sort} onSort={onSort}>
                    Project
                  </Th>
                  <Th sortKey="provider" sort={sort} onSort={onSort}>
                    Provider
                  </Th>
                  <th className="px-4 py-3 text-left font-medium">Region</th>
                  <th className="px-4 py-3 text-left font-medium">Env</th>
                  <Th sortKey="uptime" sort={sort} onSort={onSort} align="right">
                    Uptime
                  </Th>
                  <Th sortKey="p95" sort={sort} onSort={onSort} align="right">
                    p95
                  </Th>
                  <Th sortKey="lastDeploy" sort={sort} onSort={onSort}>
                    Last deploy
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--color-border)]/50 last:border-b-0 hover:bg-[var(--color-bg-elevated)] transition group"
                  >
                    <td className="px-4 py-3 min-w-[200px]">
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-2 group-hover:text-[var(--color-accent)] transition"
                      >
                        <StatusDot status={p.status} pulse={p.status !== "healthy"} />
                        <span className="font-medium truncate">{p.name}</span>
                      </Link>
                      <div className="mt-0.5 ml-4 text-[11px] font-mono text-[var(--color-fg-subtle)] truncate">
                        {p.domain}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
                        <ProviderIcon provider={p.provider} className="h-3.5 w-3.5" />
                        {providerLabels[p.provider]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-fg-muted)]">
                      {p.region}
                    </td>
                    <td className="px-4 py-3">
                      <EnvChip env={p.environment} />
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono tabular-nums",
                        p.uptimePct > 99.5
                          ? "text-[var(--color-fg)]"
                          : p.uptimePct > 98
                            ? "text-[oklch(0.88_0.14_80)]"
                            : "text-[oklch(0.82_0.18_25)]",
                      )}
                    >
                      {formatPercent(p.uptimePct, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-fg-muted)]">
                      {p.latencyP95Ms ? formatMs(p.latencyP95Ms) : "—"}
                    </td>
                    <td className="px-4 py-3 min-w-[260px]">
                      {p.lastDeployment ? (
                        <div className="flex items-center gap-2 text-xs">
                          <GitCommit className="h-3 w-3 shrink-0 text-[var(--color-fg-subtle)]" />
                          <span className="font-mono text-[var(--color-fg-muted)]">
                            {shortSha(p.lastDeployment.commitSha)}
                          </span>
                          <span className="truncate text-[var(--color-fg)] max-w-[180px]">
                            {p.lastDeployment.commitMsg}
                          </span>
                          <span className="ml-auto shrink-0 text-[var(--color-fg-subtle)]">
                            {timeAgo(p.lastDeployment.createdAt)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  indicator,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  indicator?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition capitalize",
        active
          ? "border-[var(--color-accent)] bg-[oklch(0.81_0.14_200/0.1)] text-[var(--color-fg)]"
          : "border-[var(--color-border)] bg-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]",
      )}
    >
      {indicator}
      {label}
    </button>
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-4 py-3 font-medium", align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-[var(--color-fg)] transition",
          align === "right" && "flex-row-reverse",
          active && "text-[var(--color-fg)]",
        )}
      >
        {children}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
