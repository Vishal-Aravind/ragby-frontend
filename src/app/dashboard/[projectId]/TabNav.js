"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { hasProjectTabAccess } from "@/lib/project-access";
import { TAB_CONFIG } from "./tabs-config";

// Fixed-size + always-rendered (opacity toggle only) so it never shifts the
// label next to it — Next's own guidance for useLinkStatus, since a
// pop-in/pop-out element here would nudge the tab label sideways on click.
function PendingDot() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`pending-dot ${pending ? "is-pending" : ""}`} />;
}

export default function TabNav({ project }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1 border-r pr-3">
      {TAB_CONFIG.map((tab) => {
        if (!hasProjectTabAccess(project, tab.key)) return null;
        const href = `/dashboard/${project.id}/${tab.segment}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        const Icon = tab.icon;
        return (
          <Button
            key={tab.key}
            asChild
            variant={active ? "default" : "ghost"}
            size="sm"
            className="flex items-center gap-2 justify-start w-full"
          >
            <Link href={href} data-tour={tab.tourId ? `tab-${tab.tourId}` : undefined}>
              <Icon size={13} />
              {tab.label}
              <PendingDot />
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
