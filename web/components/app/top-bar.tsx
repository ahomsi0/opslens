"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function TopBar({
  breadcrumbs = [],
  onCommand,
}: {
  breadcrumbs?: BreadcrumbItem[];
  onCommand?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] glass px-5">
      <div className="flex items-center gap-3 min-w-0">
        <WorkspaceBadge />
        {breadcrumbs.length > 0 && (
          <>
            <span className="text-[var(--color-fg-subtle)]">/</span>
            <nav className="flex items-center gap-2 min-w-0">
              {breadcrumbs.map((b, i) => (
                <span
                  key={`${b.label}-${i}`}
                  className="text-sm text-[var(--color-fg-muted)] truncate"
                >
                  {i > 0 && (
                    <span className="mx-2 text-[var(--color-fg-subtle)]">
                      /
                    </span>
                  )}
                  {b.label}
                </span>
              ))}
            </nav>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCommand}
          className="gap-2 text-[var(--color-fg-muted)] min-w-[180px] justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            Search…
          </span>
          <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </Button>
      </div>
    </header>
  );
}

function WorkspaceBadge() {
  return (
    <span className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm">
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-accent)] text-[10px] font-bold text-black">
        P
      </span>
      <span className="font-medium">Opslens</span>
    </span>
  );
}
