// Mirrors the backend's personal-data column check (sheet_tables.py
// _PERSONAL_NAME_RE). Such columns start unticked everywhere the merchant
// chooses what the AI may use; they can tick them back on.
// Underscores count as separators so `user_email` / `dob_date` match.
const PERSONAL_NAME_RE =
  /e-?mail|phone|mobile|\bcell\b|whats\s*app|contact\s*(no|num)|\btel(ephone)?\b|\bdob\b|date of birth|birth\s*date|aadh?aa?r|\bpan\b|passport|\bssn\b/i;

export function looksPersonal(columnName) {
  return PERSONAL_NAME_RE.test(String(columnName).replace(/_/g, " "));
}

// {table: [cols]} -> {table: Set(cols)} with personal-looking columns left
// out (a table whose every column is personal starts fully unticked).
export function defaultAllowed(schema) {
  const out = {};
  for (const [table, cols] of Object.entries(schema || {})) {
    out[table] = new Set(cols.filter((c) => !looksPersonal(c)));
  }
  return out;
}
