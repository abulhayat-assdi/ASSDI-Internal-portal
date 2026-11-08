"use client";
// Staff live map of students in the field (OpenStreetMap via Leaflet, loaded on the client only).
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as Leaflet from "leaflet";
import { Battery, Crosshair, MapPin, Navigation, RefreshCw, Route } from "lucide-react";
import { timeAgo } from "@/lib/tracking/client";

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

export const directionUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function LiveTrackingMap({ competitionId }: { competitionId: string }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const trailLayer = useRef<Leaflet.LayerGroup | null>(null);
  const markerById = useRef(new Map<string, Leaflet.CircleMarker>());
  const fittedFor = useRef("");
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<{ trackId: string; name: string; points: number } | null>(null);
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
      const m = lib.map(mapEl.current, { zoomControl: true }).setView(DHAKA, 12);
      lib
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          subdomains: "abc",
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        })
        .addTo(m);
      markers.current = lib.layerGroup().addTo(m);
      trailLayer.current = lib.layerGroup().addTo(m);
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
    m.fitBounds(bounds.pad(0.2), { maxZoom: 16 });
  }, [located]);

  const showTrail = useCallback(async (track: LiveTrack) => {
    const lib = L.current,
      m = map.current;
    if (!lib || !m || !trailLayer.current) return;
    try {
      const r = await fetch(`/api/tracking/positions?trackId=${encodeURIComponent(track.id)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Could not load the trail.");
      const pts: [number, number][] = d.positions.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude]);
      trailLayer.current.clearLayers();
      if (!pts.length) {
        setTrail({ trackId: track.id, name: track.userName, points: 0 });
        return;
      }
      const line = lib.polyline(pts, { color: "#2563eb", weight: 4, opacity: 0.8 }).addTo(trailLayer.current);
      lib.circleMarker(pts[0], { radius: 5, color: "#2563eb", fillColor: "#fff", fillOpacity: 1, weight: 2 })
        .bindTooltip("Start")
        .addTo(trailLayer.current);
      m.fitBounds(line.getBounds().pad(0.2), { maxZoom: 17 });
      setTrail({ trackId: track.id, name: track.userName, points: pts.length });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const hideTrail = () => {
    trailLayer.current?.clearLayers();
    setTrail(null);
  };

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
    map.current.setView(marker.getLatLng(), Math.max(map.current.getZoom(), 16));
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
          {trail && (
            <div className="absolute top-3 right-3 z-[1000] rounded-xl bg-white/95 border border-slate-200 shadow px-3 py-2 text-sm flex items-center gap-2">
              <Route size={16} className="text-blue-600" />
              <span>
                Trail: <b>{trail.name}</b> ({trail.points} points)
              </span>
              <button type="button" onClick={hideTrail} className="ml-1 text-xs font-bold text-slate-600 underline">
                Hide
              </button>
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
