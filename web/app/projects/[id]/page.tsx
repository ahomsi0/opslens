import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectOverview } from "@/components/projects/project-overview";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { fetchProject, fetchProjects } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, allProjects] = await Promise.all([
    fetchProject(id),
    fetchProjects(),
  ]);
  if (!data) notFound();
  const { project, deployments } = data;

  return (
    <AppShell
      projects={allProjects}
      breadcrumbs={[
        { label: "Projects" },
        { label: project.name },
      ]}
      assistantContext={`Currently viewing project "${project.name}" (${project.provider}, ${project.environment}). Status: ${project.status}.`}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ProjectHeader project={project} />
        <div className="mt-6">
          <ProjectTabs projectId={project.id} />
        </div>
        <div className="mt-6">
          <ProjectOverview project={project} deployments={deployments} />
        </div>
      </div>
    </AppShell>
  );
}
