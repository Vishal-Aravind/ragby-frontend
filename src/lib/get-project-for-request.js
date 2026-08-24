import { headers } from "next/headers";

// Same fetch [projectId]/page.js has always done — pulled into one place so
// layout.js and every tab route call the same logic instead of duplicating
// it 14 times. Next.js request memoization collapses identical same-request
// fetch calls automatically, so layout + page both calling this per request
// costs one network round trip, not two.
export async function getProjectForRequest(projectId) {
  const headerList = await headers();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const res = await fetch(`${baseUrl}/api/projects/${projectId}`, {
    cache: "no-store",
    headers: {
      cookie: headerList.get("cookie") || "",
    },
  });

  if (!res.ok) return { project: null, status: res.status };
  return { project: await res.json(), status: res.status };
}
