import { AppShell } from "@/components/app/app-shell";
import { IntegrationsList } from "@/components/integrations/integrations-list";
import { fetchConnections, fetchProjects } from "@/lib/api";
import type { Connection, ProjectSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let projects: ProjectSummary[] = [];
  let connections: Connection[] = [];
  let error: string | null = null;
  try {
    [projects, connections] = await Promise.all([
      fetchProjects(),
      fetchConnections(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  return (
    <AppShell
      projects={projects}
      breadcrumbs={[{ label: "Integrations" }]}
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Connect the platforms where your services run. Tokens are encrypted
            at rest and never logged.
          </p>
        </div>

        <div className="mt-8">
          {error ? (
            <div className="rounded-xl border border-[oklch(0.69_0.22_25/0.5)] bg-[oklch(0.69_0.22_25/0.08)] p-5 text-sm">
              <div className="font-semibold text-[oklch(0.82_0.18_25)]">
                Couldn&apos;t load integrations
              </div>
              <p className="mt-1 text-[var(--color-fg-muted)]">
                Make sure the backend is running on{" "}
                <code className="font-mono">localhost:8080</code>. Detail:{" "}
                {error}
              </p>
            </div>
          ) : (
            <IntegrationsList connections={connections} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
