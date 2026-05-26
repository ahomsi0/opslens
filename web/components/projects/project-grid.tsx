"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/projects/project-card";
import type { ProjectSummary } from "@/lib/types";

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.name, p.provider, p.region, p.environment, p.domain]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [filter, projects]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, provider, region…"
            className="pl-8"
            aria-label="Filter projects"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs font-mono text-[var(--color-fg-subtle)]">
          {filtered.length} of {projects.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-12 text-center">
          <h3 className="text-base font-semibold">No projects match “{filter}”</h3>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Try a different name, provider, or region.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
