import { AppShell } from "@/components/app/app-shell";
import { IncidentList } from "@/components/incidents/incident-list";
import {
  fetchIncidents,
  fetchProjects,
  type Incident,
} from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import type { ProjectSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const user = await fetchMe();
  let projects: ProjectSummary[] = [];
  let incidents: Incident[] = [];
  try {
    [projects, incidents] = await Promise.all([
      fetchProjects(),
      fetchIncidents(),
    ]);
  } catch {
    /* show empty state */
  }

  const open = incidents.filter((i) => !i.endedAt);
  const closed = incidents.filter((i) => i.endedAt);

  return (
    <AppShell
      user={user}
      projects={projects}
      breadcrumbs={[{ label: "Incidents" }]}
    >
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Auto-opened when a project fails 3 probes in a row. Auto-closed
            after 3 consecutive recoveries.
          </p>
        </div>

        {open.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold tracking-tight mb-3 text-[oklch(0.82_0.18_25)]">
              Ongoing ({open.length})
            </h2>
            <IncidentList incidents={open} />
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold tracking-tight mb-3 text-[var(--color-fg-muted)]">
            {open.length > 0 ? `Resolved (${closed.length})` : "All incidents"}
          </h2>
          <IncidentList incidents={open.length > 0 ? closed : incidents} />
        </section>
      </div>
    </AppShell>
  );
}
