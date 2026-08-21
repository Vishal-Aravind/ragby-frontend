"use client";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

export default function BillingTab() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/billing")
      .then(r => r.json())
      .then(d => { setCustomers(d.customers || []); setLoading(false); });
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <div className="bg-white border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Customer</th>
            <th className="px-4 py-2.5 font-medium">Plan</th>
            <th className="px-4 py-2.5 font-medium">Since</th>
            <th className="px-4 py-2.5 font-medium">Razorpay</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No paying customers yet.</td></tr>
          ) : (
            customers.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900">{c.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium capitalize">{c.plan}</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  {c.razorpay_customer_id ? (
                    <a
                      href={`https://dashboard.razorpay.com/app/customers/${c.razorpay_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 w-fit"
                    >
                      View in Razorpay <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
