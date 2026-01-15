import { headers } from "next/headers"; // Import headers
import ProjectClient from "./ProjectClient";
import Navbar from "@/components/Navbar";

export default async function ProjectPage({ params }) {
  const { projectId } = await params;
  
  // Get headers from the incoming request to forward cookies/auth
  const headerList = await headers(); 

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ;

  const res = await fetch(
    `${baseUrl}/api/projects/${projectId}`,
    {
      cache: "no-store",
      // Forward headers so the API knows who is logged in
      headers: {
        cookie: headerList.get("cookie") || "",
      },
    }
  );

  if (!res.ok) {
    // Log the error to your terminal to see why it's failing (401, 404, 500?)
    console.error(`Fetch failed with status: ${res.status}`);
    
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="p-6">Project not found (Error: {res.status})</div>
      </div>
    );
  }

  const project = await res.json();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-6">
        <ProjectClient project={project} />
      </div>
    </div>
  );
}