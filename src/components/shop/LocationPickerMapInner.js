"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";

const INDIA = { lat: 20.5937, lng: 78.9629 };

const round6 = (n) => Math.round(n * 1e6) / 1e6;

const isPoint = (p) =>
  p != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

const toPoint = (p) => ({ lat: Number(p.lat), lng: Number(p.lng) });

// divIcon instead of Leaflet's default image icon: the default resolves its
// PNGs relative to the CSS file, which bundlers break.
const PIN_ICON = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:42px;transform:translate(-15px,-40px)">
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="#dc2626" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5.5" fill="#fff"/>
    </svg></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const STORE_ICON = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;transform:translate(-13px,-13px);border-radius:9999px;background:#111827;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1">🏪</div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function ClickToPlace({ readOnly, onPick }) {
  useMapEvents({
    click(e) {
      if (!readOnly) onPick(e.latlng);
    },
  });
  return null;
}

// MapContainer's center/zoom are initial-only. This keeps the view in step
// when the parent sets a new pin (GPS, another input) or a new centre, and
// fixes the blank-tiles problem when the map mounts inside a modal/drawer
// that was still animating to its final size.
function ViewSync({ value, center, zoom }) {
  const map = useMap();

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);

  const vLat = value?.lat;
  const vLng = value?.lng;
  useEffect(() => {
    if (vLat == null || vLng == null) return;
    const ll = L.latLng(vLat, vLng);
    if (!map.getBounds().pad(-0.1).contains(ll)) {
      map.setView(ll, Math.max(map.getZoom(), zoom ?? 15));
    }
  }, [map, vLat, vLng, zoom]);

  const cLat = center?.lat;
  const cLng = center?.lng;
  const hasValue = vLat != null;
  useEffect(() => {
    if (hasValue || cLat == null || cLng == null) return;
    map.setView([cLat, cLng], zoom ?? 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cLat, cLng]);

  return null;
}

// Lives outside MapContainer on purpose: inside it, Leaflet sees the tap as
// a map click (moving the pin), and stopping propagation there would also
// stop React's root listener, so onClick would never fire.
function LocateButton({ map, onLocated }) {
  const [state, setState] = useState("idle"); // idle | busy | error

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("error");
      return;
    }
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (map) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
        onLocated(p);
        setState("idle");
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="absolute right-2 bottom-6 z-[1000]">
      <button
        type="button"
        onClick={locate}
        className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-md border border-gray-200 active:scale-95"
      >
        {state === "busy" ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        ) : (
          <span aria-hidden>📍</span>
        )}
        {state === "error" ? "Location unavailable" : state === "busy" ? "Locating…" : "My location"}
      </button>
    </div>
  );
}

export default function LocationPickerMapInner({
  value = null,
  onChange,
  center = null,
  zoom,
  height = 320,
  showLocateButton = true,
  markers = [],
  readOnly = false,
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const pin = isPoint(value) ? toPoint(value) : null;
  const ctr = isPoint(center) ? toPoint(center) : null;

  // Captured once: MapContainer ignores later changes to these anyway.
  const [initial] = useState(() => ({
    center: pin || ctr || INDIA,
    zoom: zoom ?? (pin || ctr ? 15 : 5),
  }));

  const emit = (latlng) => {
    onChangeRef.current?.({ lat: round6(latlng.lat), lng: round6(latlng.lng) });
  };

  const markerHandlers = useMemo(
    () => ({
      dragend(e) {
        const ll = e.target.getLatLng();
        onChangeRef.current?.({ lat: round6(ll.lat), lng: round6(ll.lng) });
      },
    }),
    []
  );

  const staticMarkers = (markers || []).filter(isPoint);
  const [map, setMap] = useState(null);

  return (
    <div className="relative isolate w-full overflow-hidden rounded-xl border border-gray-200" style={{ height }}>
      <MapContainer
        ref={setMap}
        center={[initial.center.lat, initial.center.lng]}
        zoom={initial.zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        attributionControl
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
          maxZoom={19}
        />
        <ViewSync value={pin} center={ctr} zoom={zoom} />
        <ClickToPlace readOnly={readOnly} onPick={emit} />
        {staticMarkers.map((m, i) => (
          <Marker key={m.id ?? i} position={[Number(m.lat), Number(m.lng)]} icon={STORE_ICON} interactive={!!m.label}>
            {m.label ? <Tooltip direction="top" offset={[0, -14]}>{m.label}</Tooltip> : null}
          </Marker>
        ))}
        {pin && (
          <Marker
            position={[pin.lat, pin.lng]}
            icon={PIN_ICON}
            draggable={!readOnly}
            eventHandlers={markerHandlers}
          />
        )}
      </MapContainer>
      {showLocateButton && !readOnly && <LocateButton map={map} onLocated={emit} />}
      {!readOnly && !pin && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-[1000] -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-gray-700 shadow">
          Tap the map to drop a pin
        </div>
      )}
    </div>
  );
}
