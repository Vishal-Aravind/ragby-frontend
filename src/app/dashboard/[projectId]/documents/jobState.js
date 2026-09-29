// Indexing runs as a background job (backend jobs.py / job_runner.py). The
// job records its progress on the row itself; these helpers turn that into
// the few states the Documents page shows.

// A job still "queued"/"syncing" this long after it started never finished
// (the worker died and every retry failed). Matches the backend's own
// cutoff in source_routes._is_indexing.
const ABANDONED_AFTER_MS = 45 * 60 * 1000;

// "queued" | "syncing" | "done" | "failed" | "incomplete"
export function sourceJobState(source) {
  const cfg = source?.config || {};
  const status = cfg.sync_status;
  if (status === "failed") return "failed";
  if (status !== "queued" && status !== "syncing") return "done";
  const started = Date.parse(cfg.sync_started_at || "");
  if (!started || Date.now() - started > ABANDONED_AFTER_MS) return "incomplete";
  return status;
}

export function isSourceBusy(source) {
  const state = sourceJobState(source);
  return state === "queued" || state === "syncing";
}

// DB file status -> what the file list shows. "error" is the list's
// existing name for a failure.
export function fileUiStatus(dbStatus) {
  if (dbStatus === "indexed") return "indexed";
  if (dbStatus === "failed") return "error";
  return "processing"; // uploaded / queued / processing
}
