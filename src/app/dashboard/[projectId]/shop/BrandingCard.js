"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ImageUploadField from "./ImageUploadField";

// Shop cover + logo. Each upload / remove is saved straight away through
// the backend branding endpoint (it validates the URL), separately from the
// "Save Settings" button.
export default function BrandingCard({ projectId, config, onBrandingSaved, isAdmin, hasActiveOffers }) {
  const save = async (patch) => {
    try {
      const res = await fetch(`/api/shop-config/${projectId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't update your branding.");
        return;
      }
      onBrandingSaved?.({
        cover_image_url: data.cover_image_url ?? null,
        logo_url: data.logo_url ?? null,
      });
      toast.success("Branding updated");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const termsSaysNoDiscount = hasActiveOffers && /discount/i.test(config?.terms_note || "");

  return (
    <Card className="md:col-span-2">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Shop branding</h3>
          <p className="text-xs text-gray-400 mt-0.5">Shown at the top of your menu page and on WhatsApp link previews later.</p>
        </div>

        {termsSaysNoDiscount && (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Your terms note says orders aren&apos;t eligible for discounts, but you have active offers. Update the note in Store Information and save.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
          <ImageUploadField
            label="Cover image"
            hint="Recommended 1200 × 400 (3:1). PNG, JPG or WEBP, up to 5 MB."
            value={config?.cover_image_url || ""}
            aspect="3 / 1"
            disabled={!isAdmin}
            onChange={(url) => save({ cover_image_url: url })}
          />
          <ImageUploadField
            label="Logo"
            hint="Square, at least 256 × 256."
            value={config?.logo_url || ""}
            aspect="1 / 1"
            round
            disabled={!isAdmin}
            onChange={(url) => save({ logo_url: url })}
          />
        </div>
        {!isAdmin && <p className="text-xs text-gray-400">Only project admins can change the branding.</p>}
      </CardContent>
    </Card>
  );
}
