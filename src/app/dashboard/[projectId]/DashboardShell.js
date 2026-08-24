"use client";

import { useEffect, useMemo, useState } from "react";
import { Joyride, STATUS } from "react-joyride";
import { Button } from "@/components/ui/button";
import { hasProjectTabAccess } from "@/lib/project-access";
import TabNav from "./TabNav";
import {
  FileText, Plug, GitBranch, ShoppingBag, Inbox, BarChart2, PartyPopper,
  Sparkles, X, ArrowRight,
} from "lucide-react";

// Guided tour copy — kept short and benefit-oriented on purpose (covers the
// tabs needed to get a bot live, not every tab) rather than a step per tab.
// Praised onboarding tours (Linear, Notion) teach a handful of high-value
// things at high attention; touring all 13 tabs on first login reads as
// "features dumped on users," which the research consistently flags as the
// difference between a tour people finish and one they skip.
const TOUR_STEPS = [
  {
    target: "body",
    placement: "center",
    icon: Sparkles,
    title: "Welcome to Zavo",
    content: "Let's take a 60-second look around your dashboard.",
    access: null,
  },
  {
    target: '[data-tour="tab-documents"]',
    tourId: "documents",
    icon: FileText,
    title: "Documents",
    content: "This is where your bot learns — connect a website, PDF, spreadsheet, or your Shopify catalog.",
    access: "documents",
  },
  {
    target: '[data-tour="tab-integrations"]',
    tourId: "integrations",
    icon: Plug,
    title: "Integrations",
    content: "Go live by connecting WhatsApp, Slack, Telegram, or Shopify here.",
    access: "integrations",
  },
  {
    target: '[data-tour="tab-flows"]',
    tourId: "flows",
    icon: GitBranch,
    title: "Flows",
    content: "Build automated conversation flows — no code needed.",
    access: "flows",
  },
  {
    target: '[data-tour="tab-shop"]',
    tourId: "shop",
    icon: ShoppingBag,
    title: "Shop",
    content: "Sell products and take orders directly inside chat.",
    access: "shop",
  },
  {
    target: '[data-tour="tab-conversations"]',
    tourId: "conversations",
    icon: Inbox,
    title: "Conversations",
    content: "Every real customer conversation lands here — reply anytime.",
    access: null,
  },
  {
    target: '[data-tour="tab-analytics"]',
    tourId: "analytics",
    icon: BarChart2,
    title: "Analytics",
    content: "Track usage and see what your bot couldn't answer.",
    access: "analytics",
  },
  {
    target: "body",
    placement: "center",
    icon: PartyPopper,
    title: "That's the tour!",
    content: "Click Tour anytime to see it again.",
    access: null,
  },
];

// Custom tooltip — react-joyride's default card is plain (system font,
// square corners, generic buttons). This reuses the app's own Button
// component and icon set so the tour reads as part of Zavo's own design
// system rather than a bolted-on library widget.
function TourTooltip({ index, size, step, isLastStep, backProps, closeProps, primaryProps, skipProps }) {
  const Icon = step.icon || Sparkles;
  return (
    <div className="w-[340px] rounded-2xl border bg-white p-5 shadow-2xl shadow-black/10">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 text-white">
          <Icon size={17} />
        </div>
        <button
          {...closeProps}
          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-neutral-100 hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold text-foreground">{step.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step.content}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: size }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-neutral-900" : "w-1.5 bg-neutral-200"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {index > 0 && (
            <button {...backProps} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
              Back
            </button>
          )}
          {!isLastStep && (
            <button {...skipProps} className="text-[13px] font-medium text-muted-foreground/70 hover:text-foreground">
              Skip
            </button>
          )}
          <Button {...primaryProps} size="sm" className="gap-1.5">
            {isLastStep ? "Done" : "Next"}
            {!isLastStep && <ArrowRight size={13} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TOUR_STYLES = {
  options: {
    overlayColor: "rgba(15, 15, 15, 0.55)",
    zIndex: 10000,
  },
  overlay: {
    backdropFilter: "blur(1.5px)",
  },
};

const DOMAINS = [
  "Healthcare",
  "Insurance",
  "Sales",
  "Finance",
  "Legal",
  "Education",
  "Other",
];

export default function DashboardShell({ project, children }) {
  // --------------------------------------------------
  // GUIDED TOUR
  // --------------------------------------------------
  // Steps are filtered by hasProjectTabAccess so an agent with only
  // Conversations+Leads gets a short tour, not one pointing at tabs they
  // can't see. All targets are on TabNav's own buttons, never on tab
  // content, so this stays correct across route navigations.
  const tourSteps = useMemo(
    () => TOUR_STEPS.filter((s) => !s.access || hasProjectTabAccess(project, s.access)),
    [project]
  );
  const [runTour, setRunTour] = useState(false);
  // Remounts <Joyride> on replay (see restartTour) so its internal step
  // cursor resets cleanly — deliberately NOT passing a controlled
  // `stepIndex` prop alongside `continuous`. That combination is a known
  // react-joyride footgun: manually advancing stepIndex from the callback
  // can double-advance or desync from Joyride's own internal state,
  // leaving the dark overlay stuck on screen with no tooltip and blocking
  // all further clicks (reproduced this exact failure while testing).
  const [tourKey, setTourKey] = useState(0);
  // Which tab is currently spotlighted, if any — used below to lift that
  // one tab above Joyride's blurred overlay. react-joyride's overlay div
  // covers the full page and applies backdrop-filter to itself; the
  // spotlight "hole" only cuts a transparent gap in the dark tint's SVG
  // fill, which doesn't stop the blur (a CSS filter on the overlay div)
  // from still sampling whatever's behind it, including the "revealed"
  // area. Raising the actual target element's z-index above the overlay's
  // is what makes it paint crisp — the blur simply can't affect something
  // rendered on top of it.
  const [activeTourTargetId, setActiveTourTargetId] = useState(null);
  const tourSeenKey = `zavo_tour_seen_${project.id}_${project.myRole || "owner"}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(tourSeenKey)) return;
    // Short delay so the tab panel has actually rendered before the first
    // spotlight target is measured — an instant tour on mount can spotlight
    // the wrong position if layout hasn't settled yet.
    const timer = setTimeout(() => setRunTour(true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourSeenKey]);

  const handleTourCallback = (data) => {
    const { status, step } = data;
    setActiveTourTargetId(step?.tourId || null);
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setActiveTourTargetId(null);
      window.localStorage.setItem(tourSeenKey, "1");
    }
  };

  const restartTour = () => {
    setTourKey((k) => k + 1);
    setRunTour(true);
  };

  const isOwnerOrAdmin = (project.myRole || "owner") === "owner" || (project.myRole || "owner") === "admin";

  // --------------------------------------------------
  // DOMAIN — auto-saves on change
  // --------------------------------------------------
  const [domain, setDomain] = useState(project.domain || "");
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);

  const handleDomainChange = async (value) => {
    setDomain(value);
    setSavingDomain(true);
    setDomainSaved(false);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      setDomainSaved(true);
      setTimeout(() => setDomainSaved(false), 2000);
    } finally {
      setSavingDomain(false);
    }
  };

  return (
    <div className="space-y-6">
      <Joyride
        key={tourKey}
        steps={tourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        disableScrolling={false}
        onEvent={handleTourCallback}
        tooltipComponent={TourTooltip}
        styles={TOUR_STYLES}
      />
      {activeTourTargetId && (
        <style>{`[data-tour="tab-${activeTourTargetId}"]{position:relative;z-index:100000;}`}</style>
      )}

      {/* Project header */}
      <div className="flex items-center gap-3">
        {project.logo_url && (
          <img
            src={project.logo_url}
            alt={project.name}
            className="h-10 w-10 object-contain rounded-lg border p-0.5"
          />
        )}
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={restartTour}>
          <Sparkles size={13} />Tour
        </Button>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Vertical tab sidebar ── */}
        <nav className="w-56 shrink-0 space-y-4">
          {/* Domain selector — auto-saves on change. Settings, owner/admin only. */}
          {isOwnerOrAdmin && (
            <div className="space-y-1">
              <select
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                disabled={savingDomain}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-700 disabled:opacity-60 cursor-pointer"
              >
                <option value="">No domain</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {savingDomain && <span className="text-xs text-muted-foreground">Saving...</span>}
              {domainSaved && <span className="text-xs text-emerald-600 font-medium">✓ Saved</span>}
            </div>
          )}

          <TabNav project={project} />
        </nav>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
