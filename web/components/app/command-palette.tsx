"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Activity,
  Boxes,
  LayoutDashboard,
  Search,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ProjectSummary } from "@/lib/types";

export function CommandPalette({
  projects,
  open,
  onOpenChange,
  onAskAI,
}: {
  projects: ProjectSummary[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAskAI?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-xl">
        <Command className="bg-transparent" label="Command palette">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--color-fg-muted)]" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search projects, deployments, actions…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-subtle)]"
            />
            <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--color-fg-muted)]">
              Nothing matches “{query}”.
            </Command.Empty>

            {onAskAI && (
              <Command.Group heading="AI assistant" className="cmdk-group">
                <CmdItem
                  icon={<Sparkles className="h-4 w-4 text-[oklch(0.85_0.14_295)]" />}
                  label={
                    query
                      ? `Ask AI: “${query}”`
                      : "Ask the assistant a question"
                  }
                  hint="↵ to open"
                  onSelect={() => {
                    onOpenChange(false);
                    onAskAI();
                  }}
                />
              </Command.Group>
            )}

            <Command.Group heading="Navigation" className="cmdk-group">
              <CmdItem
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="Go to Dashboard"
                onSelect={() => {
                  onOpenChange(false);
                  router.push("/dashboard");
                }}
              />
              <CmdItem
                icon={<Boxes className="h-4 w-4" />}
                label="All projects"
                onSelect={() => {
                  onOpenChange(false);
                  router.push("/dashboard");
                }}
              />
              {projects[0] && (
                <CmdItem
                  icon={<ScrollText className="h-4 w-4" />}
                  label={`Open logs · ${projects[0].name}`}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(`/projects/${projects[0].id}/logs`);
                  }}
                />
              )}
            </Command.Group>

            <Command.Group heading="Projects" className="cmdk-group">
              {projects.map((p) => (
                <CmdItem
                  key={p.id}
                  icon={<Activity className="h-4 w-4" />}
                  label={p.name}
                  hint={`${p.provider} · ${p.environment}`}
                  onSelect={() => {
                    onOpenChange(false);
                    router.push(`/projects/${p.id}`);
                  }}
                />
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CmdItem({
  icon,
  label,
  hint,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <Command.Item
      onSelect={disabled ? undefined : onSelect}
      disabled={disabled}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-[var(--color-fg-muted)] data-[selected=true]:bg-[var(--color-surface-2)] data-[selected=true]:text-[var(--color-fg)] cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
    >
      <span className="text-[var(--color-fg-muted)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {hint}
        </span>
      )}
    </Command.Item>
  );
}
