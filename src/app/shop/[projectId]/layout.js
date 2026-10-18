// The shop page can be opened with a customer token in its URL (stripped on
// load). no-referrer keeps any URL of this page out of Referer headers sent to
// image hosts, maps tiles and the payment page.
export const metadata = { referrer: "no-referrer" };

// Lets the fixed bottom bar pad itself with env(safe-area-inset-bottom).
export const viewport = { viewportFit: "cover" };

export default function ShopLayout({ children }) {
  return children;
}
