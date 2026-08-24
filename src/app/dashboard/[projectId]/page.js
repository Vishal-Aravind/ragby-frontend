// [projectId]/page.js — the bare project URL is a real, still-used
// navigation target (ProjectCard, the single-project dashboard
// auto-redirect, post-creation from dashboard/new, the Slack OAuth
// callback), so it stays alive as a redirect to whichever tab route the
// signed-in user actually lands on, instead of disappearing.

import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { getDefaultTabSegment } from "@/lib/project-access";

export default async function ProjectIndexPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);

  if (!project) redirect("/dashboard");

  redirect(`/dashboard/${projectId}/${getDefaultTabSegment(project)}`);
}
