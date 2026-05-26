import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { DeploymentTimeline } from "@/components/projects/deployment-timeline";
import { fetchDeployments, fetchProject, fetchProjects } from "@/lib/api";
import { fetchMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DeploymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, deployments, allProjects, user] = await Promise.all([
    fetchProject(id),
    fetchDeployments(id),
    fetchProjects(),
    fetchMe(),
  ]);
  if (!data) notFound();
  const { project } = data;

  return (
    <AppShell
      user={user}
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
