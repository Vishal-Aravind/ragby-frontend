"use client";

// Printable GST invoice / receipt. Renders ONLY what the backend returned
// (built from the order row and its frozen seller snapshot); nothing here
// computes money. Used by the public invoice page and the dashboard.

import { Printer } from "lucide-react";

function money(currency, n) {
  const v = Number(n);
  return `${currency}${(Number.isFinite(v) ? v : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(r) {
  return r == null ? "—" : `${Number(r)}%`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
@media print {
  body * { visibility: hidden !important; }
  .zv-invoice, .zv-invoice * { visibility: visible !important; }
  .zv-invoice { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important;
    box-shadow: none !important; border: 0 !important; padding: 0 !important; }
  .zv-no-print { display: none !important; }
  .zv-invoice { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export default function InvoiceView({ invoice }) {
  const inv = invoice;
  const c = inv.currency || "₹";
  const s = inv.seller || {};
  const cust = inv.customer || {};
  const taxWord = inv.is_tax_invoice ? "GST" : "Tax";
  const deliveryNet = (Number(inv.delivery_fee) || 0) - (Number(inv.delivery_discount) || 0);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <style>{PRINT_CSS}</style>
      <div className="zv-no-print flex justify-end mb-3">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white text-sm font-semibold px-4 py-2"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="zv-invoice relative bg-white text-gray-900 border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8 text-[13px] leading-relaxed">
        {inv.cancelled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-6xl font-black tracking-widest text-red-600/20 -rotate-12 border-8 border-red-600/20 px-6 py-2">
              CANCELLED
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="min-w-0">
            <p className="text-lg font-bold break-words">{s.legal_name || "—"}</p>
            {s.branch_name && <p className="text-gray-600">{s.branch_name}</p>}
            {s.address && <p className="text-gray-600 whitespace-pre-line break-words">{s.address}</p>}
            {s.state && <p className="text-gray-600">State: {s.state}</p>}
            {s.gstin && <p className="font-semibold">GSTIN: {s.gstin}</p>}
          </div>
          <div className="sm:text-right shrink-0">
            <p className="text-xl font-bold uppercase tracking-wide">{inv.title}</p>
            {inv.cancelled && <p className="font-bold text-red-600">CANCELLED</p>}
            <p>Invoice no: <span className="font-semibold">{inv.invoice_number}</span></p>
            <p>Date: {formatDate(inv.invoice_date)}</p>
            <p>Order: <span className="font-mono">#{inv.short_id}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-gray-500">Billed to</p>
            <p className="font-semibold break-words">{cust.name || "Customer"}</p>
            {cust.phone && <p>{cust.phone}</p>}
            {cust.address && <p className="whitespace-pre-line break-words text-gray-600">{cust.address}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase text-gray-500">Place of supply</p>
            <p>{inv.place_of_supply || "—"}</p>
            <p className="text-gray-600">{inv.fulfilment === "delivery" ? "Delivery" : "Pickup"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full mt-4 border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-300 text-left text-[11px] uppercase text-gray-500">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 px-2 text-right">Qty</th>
                <th className="py-2 px-2 text-right">Rate</th>
                <th className="py-2 px-2 text-right">Amount</th>
                <th className="py-2 px-2 text-right">Taxable value</th>
                <th className="py-2 pl-2 text-right">{taxWord} %</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items || []).map((it, i) => (
                <tr key={i} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2 break-words">{it.name}</td>
                  <td className="py-2 px-2 text-right">{it.quantity}</td>
                  <td className="py-2 px-2 text-right">{money(c, it.rate)}</td>
                  <td className="py-2 px-2 text-right">{money(c, it.amount)}</td>
                  <td className="py-2 px-2 text-right">{money(c, it.taxable)}</td>
                  <td className="py-2 pl-2 text-right">{pct(it.gst_percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 mt-4">
          <div className="flex-1 min-w-0">
            {(inv.tax_rows || []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px] min-w-[300px]">
                  <thead>
                    <tr className="border-b border-gray-300 text-left text-[11px] uppercase text-gray-500">
                      <th className="py-1 pr-2">{taxWord} rate</th>
                      <th className="py-1 px-2 text-right">Taxable</th>
                      <th className="py-1 px-2 text-right">CGST</th>
                      <th className="py-1 px-2 text-right">SGST</th>
                      <th className="py-1 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.tax_rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1 pr-2">{pct(r.rate)}</td>
                        <td className="py-1 px-2 text-right">{money(c, r.taxable)}</td>
                        <td className="py-1 px-2 text-right">{money(c, r.cgst)}</td>
                        <td className="py-1 px-2 text-right">{money(c, r.sgst)}</td>
                        <td className="py-1 pl-2 text-right">{money(c, r.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {inv.tax_note && <p className="mt-2 text-[11px] text-gray-500">{inv.tax_note}</p>}
          </div>

          <div className="w-full sm:w-64 space-y-1">
            <Row label="Item total" value={money(c, inv.subtotal)} />
            {Number(inv.items_discount) > 0 && (
              <Row
                label={`Discount${inv.discount_label ? ` (${inv.discount_label})` : ""}`}
                value={`−${money(c, inv.items_discount)}`}
              />
            )}
            <Row label="Taxable value" value={money(c, inv.taxable_total)} />
            {Number(inv.tax_total) > 0 && (
              <>
                <Row label="CGST" value={money(c, inv.cgst_total)} />
                <Row label="SGST" value={money(c, inv.sgst_total)} />
              </>
            )}
            {inv.fulfilment === "delivery" && (
              <Row label="Delivery (not taxed)" value={deliveryNet > 0 ? money(c, deliveryNet) : "FREE"} />
            )}
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base font-bold">
              <span>Grand total</span>
              <span>{money(c, inv.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-gray-200 pt-3 space-y-1">
          <p><span className="text-gray-500">Amount in words:</span> <span className="font-semibold">{inv.amount_in_words}</span></p>
          <p><span className="text-gray-500">Payment:</span> <span className="font-semibold">{inv.payment_label}</span></p>
          {!inv.is_tax_invoice && (
            <p className="text-[11px] text-gray-500">The seller has not provided a GSTIN, so this is a receipt, not a tax invoice.</p>
          )}
          <p className="text-[11px] text-gray-500 pt-2">This is a computer-generated invoice.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-600">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
