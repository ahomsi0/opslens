import { AppShell } from "@/components/app/app-shell";
import { ProjectTable } from "@/components/projects/project-table";
import { fetchProjects } from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import type { ProjectSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectsListPage() {
  let projects: ProjectSummary[] = [];
  let error: string | null = null;
  const user = await fetchMe();
  try {
    projects = await fetchProjects();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load projects";
  }

  return (
    <AppShell user={user} projects={projects} breadcrumbs={[{ label: "Projects" }]}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Every monitored service across all connected providers. Filter and
            sort to find what you need.
          </p>
        </div>

        <div className="mt-6">
          {error ? (
            <div className="rounded-xl border border-[oklch(0.69_0.22_25/0.5)] bg-[oklch(0.69_0.22_25/0.08)] p-5 text-sm">
              <div className="font-semibold text-[oklch(0.82_0.18_25)]">
                Couldn&apos;t reach the API
              </div>
              <p className="mt-1 text-[var(--color-fg-muted)]">{error}</p>
            </div>
          ) : (
            <ProjectTable projects={projects} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
