import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { LogViewer } from "@/components/logs/log-viewer";
import { fetchLogs, fetchProject, fetchProjects } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, initialLogs, allProjects] = await Promise.all([
    fetchProject(id),
    fetchLogs(id, { limit: 200 }),
    fetchProjects(),
  ]);
  if (!data) notFound();
  const { project } = data;

  return (
    <AppShell
      projects={allProjects}
      breadcrumbs={[
        { label: "Projects" },
        { label: project.name },
        { label: "Logs" },
      ]}
      assistantContext={`Viewing logs for project "${project.name}". Status: ${project.status}.`}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ProjectHeader project={project} />
        <div className="mt-6">
          <ProjectTabs projectId={project.id} />
        </div>
        <div className="mt-6">
          <LogViewer projectId={project.id} initial={initialLogs} />
        </div>
      </div>
    </AppShell>
  );
}
