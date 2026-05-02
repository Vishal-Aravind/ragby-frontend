// app/chat/[projectId]/page.js

import PublicChatClient from "./PublicChatClient";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function PublicChatPage({ params }) {
  const { projectId } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, domain, chat_enabled, chat_password, brand_color, logo_url")
    .eq("id", projectId)
    .single();

  console.log("project:", project);

    if (!project || project.chat_enabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-gray-700">Chat not available</h1>
          <p className="text-sm text-gray-500">This chat link is inactive or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <PublicChatClient
      project={project}
      isPasswordProtected={!!project.chat_password}
    />
  );
}