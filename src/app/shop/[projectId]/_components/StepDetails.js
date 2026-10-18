"use client";

import { useState } from "react";
import { Navigation, MapPin, ExternalLink } from "lucide-react";
import LocationPickerMap from "@/components/shop/LocationPickerMap";
import { getCurrentPosition } from "../_lib/shopApi";

function Field({ label, required, hint, error, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-800">
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
      </span>
      {children}
      {error ? (
        <span className="block text-xs text-red-600 mt-1" role="alert">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls = (bad) =>
  `mt-1 w-full rounded-xl border px-3 py-3 text-base outline-none bg-white ${bad ? "border-red-400" : "border-gray-200 focus:border-gray-400"}`;

/**
 * Step 3. Pickup: branch card + name. Delivery: map with "Use current
 * location", structured address and name. `deliveryError` is the quote's
 * delivery/location problem, shown at the map.
 */
export default function StepDetails({
  branch, fulfilment, form, setForm, errors, deliveryError, india, accent, origin,
  canChangeBranch, onChangeBranch, onTryPickup,
}) {
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState("");
  const isDelivery = fulfilment === "delivery";
  const setAddr = (k, v) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));

  const branchPoint = branch?.lat != null && branch?.lng != null ? { lat: Number(branch.lat), lng: Number(branch.lng) } : null;
  const originPoint = origin && origin.lat != null && origin.lng != null ? { lat: Number(origin.lat), lng: Number(origin.lng) } : null;

  const useCurrent = async () => {
    setLocBusy(true);
    setLocErr("");
    try {
      const p = await getCurrentPosition();
      setForm((f) => ({ ...f, coords: p }));
    } catch (e) {
      setLocErr(e.message === "denied" ? "Location blocked — move the pin on the map" : "Couldn't get your location — move the pin on the map");
    }
    setLocBusy(false);
  };

  const nameField = (
    <Field label="Your name" required error={errors.name}>
      <input
        type="text"
        autoComplete="name"
        maxLength={80}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/[\r\n]/g, " ") }))}
        placeholder="Your name"
        className={inputCls(errors.name)}
      />
    </Field>
  );

  if (!isDelivery) {
    const mapsUrl = branchPoint ? `https://maps.google.com/?q=${branchPoint.lat},${branchPoint.lng}` : null;
    return (
      <div className="px-4 py-5 space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pickup from</p>
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-gray-900">{branch?.name}</p>
            {canChangeBranch && (
              <button onClick={onChangeBranch} className="text-sm font-semibold shrink-0" style={{ color: accent }}>
                Change
              </button>
            )}
          </div>
          {branch?.address && <p className="text-sm text-gray-600">{branch.address}</p>}
          {branch?.prep_minutes ? <p className="text-xs text-gray-500">Ready in ~{branch.prep_minutes} min</p> : null}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: accent }}>
              <ExternalLink size={13} /> Open in Maps
            </a>
          )}
        </div>
        {nameField}
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-800">
            Delivery location <span className="text-red-500">*</span>
          </p>
          <button
            onClick={useCurrent}
            disabled={locBusy}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold bg-white disabled:opacity-60"
            style={{ borderColor: accent, color: accent }}
          >
            {locBusy ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <Navigation size={14} />
            )}
            Use current location
          </button>
        </div>
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: errors.map || deliveryError ? "#f87171" : "#e5e7eb" }}>
          <LocationPickerMap
            value={form.coords}
            onChange={(p) => setForm((f) => ({ ...f, coords: p }))}
            center={form.coords || originPoint || branchPoint}
            markers={branchPoint ? [{ id: branch.id, lat: branchPoint.lat, lng: branchPoint.lng, label: branch.name }] : []}
            height={220}
            showLocateButton={false}
          />
        </div>
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <MapPin size={11} /> {form.coords ? "Drag the pin or tap the map to fine-tune." : "Tap the map to drop a pin at your door."}
        </p>
        {locErr && <p className="text-xs text-red-600" role="alert">{locErr}</p>}
        {errors.map && !deliveryError && <p className="text-xs text-red-600" role="alert">{errors.map}</p>}
        {deliveryError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 space-y-1.5" role="alert">
            <p>{deliveryError.text}</p>
            {deliveryError.code === "out_of_area" && (
              <div className="flex gap-4">
                {branch?.pickup_enabled && (
                  <button onClick={onTryPickup} className="text-xs font-semibold underline">Try pickup</button>
                )}
                {canChangeBranch && (
                  <button onClick={onChangeBranch} className="text-xs font-semibold underline">Change branch</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Field label="Address line 1" required hint="House / flat, building, street" error={errors.line1}>
        <input
          type="text"
          autoComplete="address-line1"
          maxLength={110}
          value={form.address.line1}
          onChange={(e) => setAddr("line1", e.target.value)}
          placeholder="Flat 3B, Lake View Apts, 2nd Main Rd"
          className={inputCls(errors.line1)}
        />
      </Field>
      <Field label="Address line 2" hint="Landmark" error={errors.line2}>
        <input
          type="text"
          autoComplete="address-line2"
          maxLength={110}
          value={form.address.line2}
          onChange={(e) => setAddr("line2", e.target.value)}
          placeholder="Near Indian Bank"
          className={inputCls(errors.line2)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" required error={errors.city}>
          <input
            type="text"
            autoComplete="address-level2"
            maxLength={50}
            value={form.address.city}
            onChange={(e) => setAddr("city", e.target.value)}
            placeholder="City"
            className={inputCls(errors.city)}
          />
        </Field>
        <Field label="Pincode" required error={errors.pincode}>
          <input
            type="text"
            inputMode={india ? "numeric" : "text"}
            autoComplete="postal-code"
            maxLength={india ? 6 : 10}
            value={form.address.pincode}
            onChange={(e) => setAddr("pincode", india ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^0-9A-Za-z -]/g, ""))}
            placeholder={india ? "600042" : "Postal code"}
            className={inputCls(errors.pincode)}
          />
        </Field>
      </div>
      {nameField}
    </div>
  );
}
