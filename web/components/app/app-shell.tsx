"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { AssistantFab } from "@/components/ai/assistant-fab";
import type { ProjectSummary } from "@/lib/types";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function AppShell({
  children,
  projects,
  breadcrumbs,
  assistantContext,
}: {
  children: React.ReactNode;
  projects: ProjectSummary[];
  breadcrumbs?: BreadcrumbItem[];
  assistantContext?: string;
}) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          breadcrumbs={breadcrumbs}
          onCommand={() => setCmdOpen(true)}
        />
        <main className="flex-1">{children}</main>
      </div>
      <CommandPalette
        projects={projects}
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onAskAI={() => setAiOpen(true)}
      />
      <AssistantPanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        context={assistantContext}
      />
      <AssistantFab onClick={() => setAiOpen(true)} />
    </div>
  );
}
