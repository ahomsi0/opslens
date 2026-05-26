"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, Plug, Sparkles } from "lucide-react";
import { OpslensLogo } from "@/components/landing/opslens-logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/dashboard",
    label: "Projects",
    icon: Boxes,
    prefix: "/projects",
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Plug,
    prefix: "/integrations",
  },
];

export function Sidebar() {
  const pathname = usePathname();
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
        {items.map((it) => {
          const active = it.prefix
            ? pathname.startsWith(it.prefix)
            : pathname === it.href;
          return (
            <Link
              key={it.label}
              href={it.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-[var(--color-surface-2)] text-[var(--color-fg)] border border-[var(--color-border)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
              )}
            >
              <it.icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 mt-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)]">
          <Sparkles className="h-3.5 w-3.5 text-[oklch(0.85_0.14_295)]" />
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
