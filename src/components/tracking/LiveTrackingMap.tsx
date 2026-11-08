"use client";
// Staff live map of students in the field (OpenStreetMap via Leaflet, loaded on the client only).
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as Leaflet from "leaflet";
import { Battery, Crosshair, Layers, MapPin, Navigation, RefreshCw, Route, Satellite } from "lucide-react";
import { timeAgo } from "@/lib/tracking/client";
import { cleanTrail, type RawFix } from "@/lib/tracking/trail";

type LiveTrack = {
  id: string;
  userName: string;
  batchName: string | null;
  label: string | null;
  source: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  intervalSeconds: number;
  lastPosition: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string | null } | null;
  receivedAt: string | null;
  battery: number | null;
  stale: boolean;
  status: "fresh" | "stale" | "ended";
};
type LiveData = {
  competition: { id: string; title: string; kind: string; trackingEnabled: boolean; intervalSeconds: number };
  now: string;
  tracks: LiveTrack[];
};

const REFRESH_MS = 30000;
const COLORS: Record<LiveTrack["status"], string> = { fresh: "#059669", stale: "#d97706", ended: "#64748b" };
const LABELS: Record<LiveTrack["status"], string> = {
  fresh: "Live · চালু",
  stale: "No signal · সিগন্যাল নেই",
  ended: "Ended · শেষ",
};
const ORDER: Record<LiveTrack["status"], number> = { fresh: 0, stale: 1, ended: 2 };
const DHAKA: [number, number] = [23.8103, 90.4125];
/** Zoom at which OpenStreetMap shows street, market and place names around a point. */
const LABEL_ZOOM = 16;
/** Closest zoom used when focusing one student (names still visible, more detail). */
const FOCUS_ZOOM = 17;

type BaseLayer = "map" | "satellite";
const BASE_LAYER_KEY = "asm.liveMap.baseLayer";
const readBaseLayer = (): BaseLayer => {
  try {
    return localStorage.getItem(BASE_LAYER_KEY) === "satellite" ? "satellite" : "map";
  } catch {
    return "map";
  }
};

type TrailInfo = {
  trackId: string;
  name: string;
  rawCount: number;
  keptCount: number;
  droppedInaccurate: number;
  distanceMeters: number;
  stops: number;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export const directionUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function LiveTrackingMap({ competitionId }: { competitionId: string }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const trailLayer = useRef<Leaflet.LayerGroup | null>(null);
  const rawLayer = useRef<Leaflet.LayerGroup | null>(null);
  const baseLayers = useRef<Record<BaseLayer, Leaflet.Layer> | null>(null);
  const markerById = useRef(new Map<string, Leaflet.CircleMarker>());
  const fittedFor = useRef("");
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<TrailInfo | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("map");
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/tracking/live?competitionId=${encodeURIComponent(competitionId)}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Could not load the live map.");
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  // Leaflet touches window, so it is imported only in the browser.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !mapEl.current || map.current) return;
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as typeof Leaflet);
      L.current = lib;
      const m = lib.map(mapEl.current, { zoomControl: true, maxZoom: 19 }).setView(DHAKA, 12);
      // Street map: OpenStreetMap (roads, markets, mosques, schools with names).
      const street = lib.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: "abc",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      });
      // Satellite: Esri World Imagery with road and place-name overlays (public tiles, no API key).
      const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
      const satellite = lib.layerGroup([
        lib.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
          attribution:
            'Imagery &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
        }),
        lib.tileLayer(`${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
        }),
        lib.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, {
          maxZoom: 19,
          maxNativeZoom: 18,
        }),
      ]);
      baseLayers.current = { map: street, satellite };
      const initial = readBaseLayer();
      baseLayers.current[initial].addTo(m);
      setBaseLayer(initial);
      rawLayer.current = lib.layerGroup().addTo(m);
      trailLayer.current = lib.layerGroup().addTo(m);
      markers.current = lib.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
      tick((n) => n + 1);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const located = useMemo(() => (data?.tracks || []).filter((t) => t.lastPosition), [data]);

  const fitAll = useCallback(() => {
    const lib = L.current,
      m = map.current;
    if (!lib || !m || !located.length) return;
    const bounds = lib.latLngBounds(located.map((t) => [t.lastPosition!.latitude, t.lastPosition!.longitude]));
    // Never closer than LABEL_ZOOM, so streets and markets around a student keep their names.
    m.fitBounds(bounds.pad(0.2), { maxZoom: LABEL_ZOOM });
  }, [located]);

  const switchBase = useCallback((next: BaseLayer) => {
    const m = map.current,
      layers = baseLayers.current;
    if (!m || !layers) return;
    for (const key of Object.keys(layers) as BaseLayer[])
      if (key !== next && m.hasLayer(layers[key])) m.removeLayer(layers[key]);
    if (!m.hasLayer(layers[next])) layers[next].addTo(m);
    setBaseLayer(next);
    try {
      localStorage.setItem(BASE_LAYER_KEY, next);
    } catch {
      /* private mode: the choice just is not remembered */
    }
  }, []);

  const showTrail = useCallback(async (track: LiveTrack) => {
    const lib = L.current,
      m = map.current;
    if (!lib || !m || !trailLayer.current || !rawLayer.current) return;
    try {
      const r = await fetch(`/api/tracking/positions?trackId=${encodeURIComponent(track.id)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Could not load the trail.");
      const raw: RawFix[] = d.positions;
      const clean = cleanTrail(raw);
      trailLayer.current.clearLayers();
      rawLayer.current.clearLayers();
      setTrail({
        trackId: track.id,
        name: track.userName,
        rawCount: clean.rawCount,
        keptCount: clean.keptCount,
        droppedInaccurate: clean.droppedInaccurate,
        distanceMeters: clean.distanceMeters,
        stops: clean.stops.length,
      });
      if (!clean.path.length || !clean.start) return;

      // Raw fixes (hidden unless "raw points" is on) — for checking what the phone actually sent.
      for (const p of raw)
        lib
          .circleMarker([Number(p.latitude), Number(p.longitude)], {
            radius: 3,
            color: "#94a3b8",
            weight: 1,
            fillColor: "#94a3b8",
            fillOpacity: 0.7,
          })
          .bindTooltip(`${clock(String(p.capturedAt))}${p.accuracy != null ? ` · ±${Math.round(Number(p.accuracy))} m` : ""}`)
          .addTo(rawLayer.current);

      // Cleaned path: white casing under a blue line, readable on both street and satellite.
      if (clean.path.length > 1) {
        lib.polyline(clean.path, { color: "#fff", weight: 8, opacity: 0.9 }).addTo(trailLayer.current);
        lib.polyline(clean.path, { color: "#2563eb", weight: 4, opacity: 0.95 }).addTo(trailLayer.current);
      }
      // Places the student stayed for 5+ minutes.
      for (const s of clean.stops)
        lib
          .circleMarker([s.latitude, s.longitude], {
            radius: 9,
            color: "#fff",
            weight: 2,
            fillColor: "#f59e0b",
            fillOpacity: 0.95,
          })
          .bindTooltip(`এখানে ছিল ${s.minutes} মিনিট (${clock(s.from)}–${clock(s.to)})`, { direction: "top" })
          .addTo(trailLayer.current);
      lib
        .circleMarker([clean.start.latitude, clean.start.longitude], {
          radius: 6,
          color: "#2563eb",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 3,
        })
        .bindTooltip(`শুরু · Start ${clock(clean.start.at)}`, { direction: "top" })
        .addTo(trailLayer.current);

      // Students' live markers stay on top of the trail.
      markers.current?.eachLayer((l) => (l as Leaflet.CircleMarker).bringToFront());

      const bounds = lib.latLngBounds(clean.path);
      if (track.lastPosition) bounds.extend([track.lastPosition.latitude, track.lastPosition.longitude]);
      m.fitBounds(bounds.pad(0.25), { maxZoom: LABEL_ZOOM });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const hideTrail = () => {
    trailLayer.current?.clearLayers();
    rawLayer.current?.clearLayers();
    setTrail(null);
  };

  // Raw fixes are drawn with the trail but only shown on request.
  useEffect(() => {
    const m = map.current,
      layer = rawLayer.current;
    if (!m || !layer) return;
    if (showRaw && trail) {
      if (!m.hasLayer(layer)) layer.addTo(m);
    } else if (m.hasLayer(layer)) m.removeLayer(layer);
  }, [showRaw, trail]);

  // Redraw markers whenever new data arrives.
  useEffect(() => {
    const lib = L.current;
    if (!ready || !lib || !markers.current) return;
    markers.current.clearLayers();
    markerById.current.clear();
    for (const t of located) {
      const { latitude, longitude } = t.lastPosition!;
      const marker = lib.circleMarker([latitude, longitude], {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: COLORS[t.status],
        fillOpacity: 0.95,
      });
      marker.bindTooltip(t.userName, { direction: "top", offset: [0, -8] });
      marker.bindPopup(() => popupContent(t, () => void showTrail(t)));
      marker.addTo(markers.current);
      markerById.current.set(t.id, marker);
    }
    const key = located.map((t) => t.id).sort().join(",");
    if (key && key !== fittedFor.current) {
      fittedFor.current = key;
      fitAll();
    }
  }, [ready, located, fitAll, showTrail]);

  const focus = (t: LiveTrack) => {
    const marker = markerById.current.get(t.id);
    if (!marker || !map.current) return;
    // Close enough to see the street, never so close that the names disappear.
    map.current.setView(marker.getLatLng(), Math.min(Math.max(map.current.getZoom(), LABEL_ZOOM), FOCUS_ZOOM));
    marker.openPopup();
  };

  const sorted = useMemo(
    () =>
      [...(data?.tracks || [])].sort(
        (a, b) => ORDER[a.status] - ORDER[b.status] || a.userName.localeCompare(b.userName),
      ),
    [data],
  );
  const counts = useMemo(() => {
    const c = { fresh: 0, stale: 0, ended: 0 };
    for (const t of data?.tracks || []) c[t.status]++;
    return c;
  }, [data]);
  const isIncubation = data?.competition.kind === "business_incubation";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6">
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase mb-2">
            <MapPin size={14} /> Live map · লাইভ ম্যাপ
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{data?.competition.title || "Field tracking"}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Students in the field now and in the last 12 hours. Refreshes every 30 seconds
            {data ? ` · location every ${data.competition.intervalSeconds}s` : ""}.
          </p>
          {data && !data.competition.trackingEnabled && !isIncubation && (
            <p className="text-sm text-amber-700 mt-1">Tracking is turned off for this competition.</p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href={isIncubation ? `/dashboard/competitions/${competitionId}` : `/dashboard/competitions/${competitionId}/report`}
            className="border border-slate-300 bg-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50"
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            onClick={fitAll}
            disabled={!located.length}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            <Crosshair size={16} /> Fit all
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          <div ref={mapEl} className="h-[60vh] lg:h-[75vh] w-full" style={{ zIndex: 0 }} />
          <div
            role="group"
            aria-label="Map type"
            className="absolute bottom-6 left-3 z-[1000] flex overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow text-xs font-bold"
          >
            <button
              type="button"
              onClick={() => switchBase("map")}
              aria-pressed={baseLayer === "map"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 ${baseLayer === "map" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <Layers size={14} /> ম্যাপ
            </button>
            <button
              type="button"
              onClick={() => switchBase("satellite")}
              aria-pressed={baseLayer === "satellite"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 ${baseLayer === "satellite" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <Satellite size={14} /> স্যাটেলাইট
            </button>
          </div>
          {trail && (
            <div className="absolute top-3 right-3 z-[1000] max-w-[calc(100%-5rem)] rounded-xl bg-white/95 border border-slate-200 shadow px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Route size={16} className="shrink-0 text-blue-600" />
                <span className="truncate">
                  Trail: <b>{trail.name}</b>
                </span>
                <button type="button" onClick={hideTrail} className="ml-auto text-xs font-bold text-slate-600 underline">
                  Hide
                </button>
              </div>
              {trail.rawCount === 0 ? (
                <p className="mt-1 text-xs text-slate-500">No locations recorded yet.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-600">
                    {km(trail.distanceMeters)} চলেছে · {trail.stops} বার থেমেছে · {trail.rawCount} টি লোকেশন থেকে{" "}
                    {trail.keptCount} টি বিন্দু
                    {trail.droppedInaccurate > 0 ? ` · ${trail.droppedInaccurate} টি অস্পষ্ট বাদ` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" /> শুরু
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> থেমেছে (৫+ মিনিট)
                    </span>
                    <label className="inline-flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={showRaw}
                        onChange={(e) => setShowRaw(e.target.checked)}
                        className="h-3 w-3"
                      />
                      কাঁচা লোকেশন দেখুন
                    </label>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 text-xs font-bold">
            {(Object.keys(COLORS) as LiveTrack["status"][]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[s] }} />
                {LABELS[s]}: {counts[s]}
              </span>
            ))}
          </div>
          <ul className="overflow-y-auto divide-y divide-slate-100">
            {data && !sorted.length && (
              <li className="p-6 text-center text-sm text-slate-500">
                No one is in the field right now. (এখন কেউ ফিল্ডে নেই।)
              </li>
            )}
            {sorted.map((t) => (
              <li key={t.id} className="p-3 hover:bg-slate-50">
                <button type="button" className="w-full text-left" onClick={() => focus(t)} disabled={!t.lastPosition}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 truncate">{t.userName}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[t.status] }} title={LABELS[t.status]} />
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[t.batchName, t.label].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                    <span>
                      {t.lastPosition ? `Seen ${timeAgo(t.lastPosition.capturedAt)}` : "No location yet"}
                    </span>
                    {t.lastPosition?.accuracy != null && <span>±{Math.round(t.lastPosition.accuracy)} m</span>}
                    {t.battery != null && (
                      <span className="inline-flex items-center gap-0.5">
                        <Battery size={12} /> {t.battery}%
                      </span>
                    )}
                    {t.endedAt && <span>Ended {timeAgo(t.endedAt)}</span>}
                  </div>
                </button>
                <div className="mt-2 flex gap-2">
                  {t.lastPosition && (
                    <a
                      href={directionUrl(t.lastPosition.latitude, t.lastPosition.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <Navigation size={12} /> Direction
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void showTrail(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Route size={12} /> Trail
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

/** Popup built from DOM nodes (names are set with textContent, never as HTML). */
function popupContent(t: LiveTrack, onTrail: () => void): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "180px";
  const name = document.createElement("div");
  name.style.fontWeight = "700";
  name.textContent = t.userName;
  const meta = document.createElement("div");
  meta.style.fontSize = "12px";
  meta.style.color = "#64748b";
  meta.textContent = [t.batchName, t.label].filter(Boolean).join(" · ");
  const seen = document.createElement("div");
  seen.style.fontSize = "12px";
  seen.style.margin = "4px 0 8px";
  const parts = [
    LABELS[t.status],
    t.lastPosition?.capturedAt ? `seen ${timeAgo(t.lastPosition.capturedAt)}` : "",
    t.lastPosition?.accuracy != null ? `±${Math.round(t.lastPosition.accuracy)} m` : "",
    t.battery != null ? `battery ${t.battery}%` : "",
  ].filter(Boolean);
  seen.textContent = parts.join(" · ");
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "6px";
  if (t.lastPosition) {
    const dir = document.createElement("a");
    dir.href = directionUrl(t.lastPosition.latitude, t.lastPosition.longitude);
    dir.target = "_blank";
    dir.rel = "noopener noreferrer";
    dir.textContent = "Direction";
    dir.style.cssText =
      "background:#059669;color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none";
    row.appendChild(dir);
  }
  const trail = document.createElement("button");
  trail.type = "button";
  trail.textContent = "Trail";
  trail.style.cssText =
    "border:1px solid #cbd5e1;background:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer";
  trail.addEventListener("click", onTrail);
  row.appendChild(trail);
  root.append(name, meta, seen, row);
  return root;
}
