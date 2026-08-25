// Automatically shown by Next.js while a tab route's page.js is resolving
// (server-side data fetch, or just the permission check on Tier B tabs) —
// wraps everything under DashboardShell's {children}, so the header/nav
// stay put and only the content area shows this. One shared skeleton for
// all 13 tabs rather than a per-tab shape — deliberately generic, since
// building 13 accurate skeletons is real effort for a loading state that,
// on a prefetched link, most people will never see for more than a blink.
export default function DashboardTabLoading() {
  return (
    <div className="p-6 space-y-6" aria-hidden="true">
      <div className="skeleton h-6 w-40 rounded-md" />

      <div className="grid grid-cols-3 gap-4">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>

      <div className="space-y-3">
        <div className="skeleton h-10 rounded-lg" />
        <div className="skeleton h-10 rounded-lg" />
        <div className="skeleton h-10 rounded-lg w-5/6" />
        <div className="skeleton h-10 rounded-lg w-3/4" />
      </div>
    </div>
  );
}
