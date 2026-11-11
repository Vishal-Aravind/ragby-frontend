"use client";

import { useState } from "react";
import { MapPin, Navigation, Map as MapIcon, ChevronRight } from "lucide-react";
import MapModal from "./MapModal";
import { getCurrentPosition } from "../_lib/shopApi";

/**
 * "Find the branch near you". Each option hands a search to the page via
 * onSearch(body, label), which posts to /branches and resolves to an error
 * string (shown inline) or null on success.
 */
export default function LocationStep({ storeName, accent, initialPincode = "", onSearch }) {
  const [busy, setBusy] = useState(null); // "gps" | "pincode" | "pin" | "skip"
  const [error, setError] = useState("");
  const [pincode, setPincode] = useState(initialPincode);
  const [mapOpen, setMapOpen] = useState(false);

  const run = async (kind, body, label) => {
    setBusy(kind);
    setError("");
    const err = await onSearch(body, label);
    if (err) setError(err);
    setBusy(null);
  };

  const useGps = async () => {
    setBusy("gps");
    setError("");
    try {
      const p = await getCurrentPosition();
      await run("gps", { lat: p.lat, lng: p.lng, source: "gps" }, "Your location");
    } catch (e) {
      setBusy(null);
      setError(
        e.message === "denied"
          ? "Location blocked — enter your pincode or pick on the map"
          : "Couldn't get your location — enter your pincode or pick on the map"
      );
    }
  };

  const submitPincode = (e) => {
    e.preventDefault();
    const pc = pincode.trim();
    if (pc.length < 3) {
      setError("Enter a valid pincode");
      return;
    }
    run("pincode", { pincode: pc }, pc);
  };

  return (
    <div className="min-h-screen px-4 py-8 flex items-start sm:items-center justify-center" style={{ background: "#f8faf8" }}>
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          {storeName && <p className="text-sm font-semibold" style={{ color: accent }}>{storeName}</p>}
          <h1 className="text-2xl font-bold text-gray-900">Find the branch near you</h1>
          <p className="text-sm text-gray-500">We&apos;ll show the closest one first.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <button
            onClick={useGps}
            disabled={!!busy}
            className="w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: accent }}
          >
            {busy === "gps" ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Finding you…</>
            ) : (
              <><Navigation size={18} />Use my current location</>
            )}
          </button>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200" />or<div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={submitPincode} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                placeholder="Enter pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/[^0-9A-Za-z -]/g, ""))}
                className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-3 text-base outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={!!busy}
              className="px-5 rounded-xl font-semibold text-white disabled:opacity-70"
              style={{ background: "#111827" }}
            >
              {busy === "pincode" ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Go"}
            </button>
          </form>

          <button
            onClick={() => setMapOpen(true)}
            disabled={!!busy}
            className="w-full py-3 rounded-xl border border-gray-200 font-medium text-gray-800 flex items-center justify-center gap-2"
          >
            {busy === "pin" ? (
              <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            ) : (
              <MapIcon size={16} />
            )}
            Pick on map
          </button>

          {error && <p className="text-sm text-red-600 text-center" role="alert">{error}</p>}
        </div>

        <button
          onClick={() => run("skip", {}, null)}
          disabled={!!busy}
          className="w-full text-sm font-medium text-gray-500 flex items-center justify-center gap-1 py-2"
        >
          {busy === "skip" ? "Loading…" : <>Skip — show all branches <ChevronRight size={14} /></>}
        </button>
      </div>

      <MapModal
        open={mapOpen}
        title="Pick your location"
        accent={accent}
        onClose={() => setMapOpen(false)}
        onConfirm={(p) => {
          setMapOpen(false);
          run("pin", { lat: p.lat, lng: p.lng, source: "pin" }, "Pinned location");
        }}
      />
    </div>
  );
}
