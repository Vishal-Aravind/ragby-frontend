// lib/pricing.js
// Single source for plan prices — was previously duplicated (once in
// pricing/page.js for display, once hand-typed again in the old admin
// page's MRR estimate, which had silently drifted to ignore yearly
// billing entirely). Anything computing revenue or displaying a price
// should import from here instead of hardcoding a number.

export const PLAN_PRICES = {
  free: { monthlyUSD: 0, yearlyUSD: 0 },
  pro: { monthlyUSD: 14, yearlyUSD: 9 },
  business: { monthlyUSD: 27, yearlyUSD: 20 },
};

// Mirrors backend/config.py's PLAN_LIMITS. Can't be imported directly —
// separate repos (Next.js frontend vs. FastAPI backend) — so keep these in
// sync by hand if plan limits ever change.
export const PLAN_LIMITS = {
  free: { conversations: 300, seats: 1 },
  pro: { conversations: 5000, seats: 5 },
  business: { conversations: 25000, seats: null },
};
