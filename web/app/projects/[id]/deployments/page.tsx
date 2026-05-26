import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { DeploymentTimeline } from "@/components/projects/deployment-timeline";
import { fetchDeployments, fetchProject, fetchProjects } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, deployments, allProjects] = await Promise.all([
    fetchProject(id),
    fetchDeployments(id),
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
        { label: "Deployments" },
      ]}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ProjectHeader project={project} />
        <div className="mt-6">
          <ProjectTabs projectId={project.id} />
        </div>
        <div className="mt-6">
          <DeploymentTimeline deployments={deployments} />
        </div>
      </div>
    </AppShell>
  );
}
