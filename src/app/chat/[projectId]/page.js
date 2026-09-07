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

  // Props of a client component are serialized into the page payload, so
  // passing `project` wholesale published chat_password to every
  // unauthenticated visitor — `curl /chat/<id> | grep chat_password` handed
  // over the password before the gate was even rendered. Only non-secret
  // branding fields cross the boundary; whether a password exists is a
  // boolean, never the value.
  const publicProject = {
    id: project.id,
    name: project.name,
    domain: project.domain,
    brand_color: project.brand_color,
    logo_url: project.logo_url,
  };

  return (
    <PublicChatClient
      project={publicProject}
      isPasswordProtected={!!project.chat_password}
    />
  );
}