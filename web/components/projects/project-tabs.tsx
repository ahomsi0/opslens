"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tabs = [
    { label: "Overview", href: `/projects/${projectId}` },
    { label: "Deployments", href: `/projects/${projectId}/deployments` },
    { label: "Logs", href: `/projects/${projectId}/logs` },
  ];
  return (
    <div className="border-b border-[var(--color-border)]">
      <nav className="flex gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative px-3 py-2.5 text-sm transition",
                active
                  ? "text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-px bg-[var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
