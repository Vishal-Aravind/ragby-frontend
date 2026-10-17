"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the real map only ever loads
// in the browser. The wrapper owns the fixed-height box so the page does not
// jump when the map chunk arrives.
const LocationPickerMapInner = dynamic(() => import("./LocationPickerMapInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-gray-100 rounded-xl" />,
});

/**
 * Props contract (frozen; the dashboard branch editor consumes it too):
 *   value            {lat, lng} | null   current pin
 *   onChange         ({lat, lng}) => void, rounded to 6 dp
 *   center           {lat, lng} | null   initial centre when there is no value
 *   zoom             default 15 when value/center, else 5 (India overview)
 *   height           px, default 320
 *   showLocateButton default true
 *   markers          [{id, lat, lng, label}] optional static markers
 *   readOnly         default false
 */
export default function LocationPickerMap({ height = 320, ...props }) {
  return (
    <div style={{ height }} className="relative w-full">
      <LocationPickerMapInner height={height} {...props} />
    </div>
  );
}
