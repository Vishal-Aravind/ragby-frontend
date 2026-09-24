import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import DashboardShell from "./DashboardShell";
import { getProjectForRequest } from "@/lib/get-project-for-request";

export default async function ProjectLayout({ children, params }) {
  const { projectId } = await params;
  const { project, status } = await getProjectForRequest(projectId);

  if (!project) {
    // 401 = not logged in at all — this is a session problem, not a
    // "this page doesn't exist" problem, so send them to sign in rather
    // than a dead end they'd have to notice a nav link to get out of.
    if (status === 401) {
      redirect(`/login?next=/dashboard/${projectId}`);
    }

    // A project that doesn't exist and one you have no access to return
    // the same 404 deliberately (see api/projects/[projectId]/route.js) —
    // distinguishing them would tell a logged-out-of-context visitor
    // whether a given project ID is real. This screen has to stay just as
    // uninformative while no longer being raw "Error: 404" text.
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center text-center px-6 py-24">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border flex items-center justify-center mb-5">
            <Search size={22} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Can't find that project</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-sm">
            It may not exist, or this account doesn't have access to it.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Back to your dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-6">
        <DashboardShell project={project}>{children}</DashboardShell>
      </div>
    </div>
  );
}
