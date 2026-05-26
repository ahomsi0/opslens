"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Boxes,
  ChevronRight,
  LayoutDashboard,
  Plug,
  Sparkles,
} from "lucide-react";
import { OpslensLogo } from "@/components/landing/opslens-logo";
import {
  ProviderIcon,
  providerLabels,
} from "@/components/projects/provider-icon";
import { cn } from "@/lib/utils";
import type { ProjectSummary, Provider } from "@/lib/types";

export function Sidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onProjectsRoute =
    pathname === "/projects" || pathname.startsWith("/projects/");

  // Bucket projects by provider so we can show counts in the dropdown.
  const providerCounts = useMemo(() => {
    const m = new Map<Provider, number>();
    for (const p of projects) {
      m.set(p.provider, (m.get(p.provider) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const activeProvider = searchParams.get("provider") as Provider | null;

  // Open by default when on /projects routes, closed elsewhere. Manual
  // toggle still works for collapsing it.
  const [open, setOpen] = useState(onProjectsRoute);

  return (
    <aside className="hidden lg:flex h-screen sticky top-0 w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/60">
      <Link
        href="/"
        className="flex items-center gap-2 px-5 h-14 border-b border-[var(--color-border)]"
      >
        <OpslensLogo className="h-6 w-6 text-[var(--color-accent)]" />
        <span className="font-semibold tracking-tight">Opslens</span>
      </Link>

      <nav className="flex-1 p-3 space-y-0.5">
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon={<LayoutDashboard className="h-4 w-4" />}
          active={pathname === "/dashboard"}
        />

        {/* Projects with a provider-filter dropdown */}
        <div>
          <div
            className={cn(
              "flex items-center rounded-md",
              onProjectsRoute && !activeProvider
                ? "bg-[var(--color-surface-2)] border border-[var(--color-border)]"
                : "hover:bg-[var(--color-surface)]",
            )}
          >
            <Link
              href="/projects"
              className={cn(
                "flex flex-1 items-center gap-2.5 px-3 py-2 text-sm transition",
                onProjectsRoute
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              <Boxes className="h-4 w-4" />
              <span>Projects</span>
              {projects.length > 0 && (
                <span className="ml-auto text-[10px] font-mono text-[var(--color-fg-subtle)]">
                  {projects.length}
                </span>
              )}
            </Link>
            {providerCounts.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Collapse providers" : "Expand providers"}
                aria-expanded={open}
                className="flex h-8 w-7 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition"
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    open && "rotate-90",
                  )}
                />
              </button>
            )}
          </div>

          {open && providerCounts.length > 0 && (
            <ul className="mt-0.5 ml-3.5 border-l border-[var(--color-border)] pl-2 py-0.5 space-y-0.5">
              {providerCounts.map(([provider, count]) => {
                const isActive = activeProvider === provider;
                return (
                  <li key={provider}>
                    <Link
                      href={`/projects?provider=${provider}`}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
                        isActive
                          ? "bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)]"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
                      )}
                    >
                      <ProviderIcon provider={provider} className="h-3 w-3" />
                      <span className="flex-1 truncate">
                        {providerLabels[provider]}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <NavLink
          href="/integrations"
          label="Integrations"
          icon={<Plug className="h-4 w-4" />}
          active={pathname.startsWith("/integrations")}
        />
      </nav>

      <div className="m-3 mt-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)]">
          <Sparkles className="h-3.5 w-3.5 text-[oklch(0.78_0.16_350)]" />
          AI assistant
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          Ask why your app is slow, or what changed before downtime.
        </p>
        <kbd className="mt-3 inline-flex items-center gap-1 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
          ⌘ K
        </kbd>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
        active
          ? "bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
    </Link>
  );
}
