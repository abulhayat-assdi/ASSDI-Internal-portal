"use client";
// Staff live map of students in the field (OpenStreetMap via Leaflet, loaded on the client only),
// plus the day report: how far each student walked and how long they stopped, for any tracked day.
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as Leaflet from "leaflet";
import {
  Battery,
  CalendarDays,
  Crosshair,
  Download,
  Footprints,
  Layers,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Satellite,
} from "lucide-react";
import { timeAgo } from "@/lib/tracking/client";
import { cleanTrail, type RawFix } from "@/lib/tracking/trail";

type LiveStatus = "fresh" | "stale";
type LiveTrack = {
  id: string;
  day: string;
  userId: string;
  userName: string;
  batchName: string | null;
  label: string | null;
  source: string;
  startedAt: string;
  endedAt: string | null;
  intervalSeconds: number;
  lastPosition: { latitude: number; longitude: number; accuracy: number | null; capturedAt: string | null } | null;
  receivedAt: string | null;
  battery: number | null;
  stale: boolean;
  status: LiveStatus | "ended";
};
type LiveData = {
  competition: { id: string; title: string; kind: string; trackingEnabled: boolean; intervalSeconds: number };
  now: string;
  today: string;
  tracks: LiveTrack[];
};
type DayRow = {
  userId: string;
  userName: string;
  batchName: string | null;
  label: string | null;
  status: "fresh" | "stale" | "ended";
  sessions: number;
  firstStartedAt: string;
  lastEndedAt: string | null;
  outMinutes: number;
  distanceMeters: number;
  stopCount: number;
  stopMinutes: number;
  pointCount: number;
};
type DayData = { today: string; day: string; days: string[]; rows: DayRow[] };

const REFRESH_MS = 30000;
const COLORS: Record<LiveStatus | "ended", string> = { fresh: "#059669", stale: "#d97706", ended: "#64748b" };
const LABELS: Record<LiveStatus | "ended", string> = {
  fresh: "Live · চালু",
  stale: "No signal · সিগন্যাল নেই",
  ended: "Finished · শেষ",
};
const ORDER: Record<LiveStatus, number> = { fresh: 0, stale: 1 };
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
  userId: string;
  day: string;
  name: string;
  sessions: number;
  rawCount: number;
  keptCount: number;
  droppedInaccurate: number;
  distanceMeters: number;
  stops: number;
  stopMinutes: number;
  truncated: boolean;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`);
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
const dayLabel = (day: string, today: string) => {
  const d = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return day === today ? `আজ · ${d}` : d;
};

export const directionUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

function downloadCsv(title: string, day: string, rows: DayRow[]) {
  const head = [
    "Name",
    "Batch",
    "Team",
    "Status",
    "Out from",
    "Back at",
    "Time out (min)",
    "Walked (km)",
    "Stops (5+ min)",
    "Stopped (min)",
    "Sessions",
  ];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.userName,
      r.batchName || "",
      r.label || "",
      r.status === "ended" ? "Finished" : r.status === "fresh" ? "Live" : "No signal",
      clock(r.firstStartedAt),
      r.lastEndedAt ? clock(r.lastEndedAt) : "still out",
      r.outMinutes,
      (r.distanceMeters / 1000).toFixed(2),
      r.stopCount,
      r.stopMinutes,
      r.sessions,
    ]
      .map(cell)
      .join(","),
  );
  // BOM so Excel opens Bangla names correctly.
  const blob = new Blob(["﻿" + [head.map(cell).join(","), ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "field"}-${day}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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
  const [dayData, setDayData] = useState<DayData | null>(null);
  /** null = today (whatever "today" is on the server). */
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<TrailInfo | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("map");
  const [, tick] = useState(0);

  const today = dayData?.today || data?.today || "";
  const viewingToday = !day || day === today;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = `competitionId=${encodeURIComponent(competitionId)}`;
      const [liveRes, dayRes] = await Promise.all([
        fetch(`/api/tracking/live?${q}`, { cache: "no-store" }),
        fetch(`/api/tracking/day?${q}${day ? `&date=${day}` : ""}`, { cache: "no-store" }),
      ]);
      const [l, d] = await Promise.all([liveRes.json(), dayRes.json()]);
      if (!liveRes.ok) throw Error(l.error || "Could not load the live map.");
      if (!dayRes.ok) throw Error(d.error || "Could not load the day report.");
      setData(l);
      setDayData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [competitionId, day]);

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

  // Today refreshes every 30 s; a past day does not change, so it loads once.
  useEffect(() => {
    void load();
    if (!viewingToday) return;
    const t = setInterval(() => {
      if (!document.hidden) void load();
      tick((n) => n + 1);
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load, viewingToday]);

  /** Students still out (live or no signal), only on today's view. */
  const live = useMemo(
    () =>
      viewingToday
        ? (data?.tracks || [])
            .filter((t): t is LiveTrack & { status: LiveStatus } => t.status !== "ended")
            .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.userName.localeCompare(b.userName))
        : [],
    [data, viewingToday],
  );
  const located = useMemo(() => live.filter((t) => t.lastPosition), [live]);
  const rowByUser = useMemo(() => new Map((dayData?.rows || []).map((r) => [r.userId, r])), [dayData]);

  const fitAll = useCallback(() => {
    const lib = L.current,
      m = map.current;
    if (!lib || !m) return;
    const points: [number, number][] = located.map((t) => [t.lastPosition!.latitude, t.lastPosition!.longitude]);
    trailLayer.current?.eachLayer((l) => {
      if ("getLatLng" in l) {
        const p = (l as Leaflet.CircleMarker).getLatLng();
        points.push([p.lat, p.lng]);
      }
    });
    if (!points.length) return;
    // Never closer than LABEL_ZOOM, so streets and markets around a student keep their names.
    m.fitBounds(lib.latLngBounds(points).pad(0.2), { maxZoom: LABEL_ZOOM });
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

  const hideTrail = useCallback(() => {
    trailLayer.current?.clearLayers();
    rawLayer.current?.clearLayers();
    setTrail(null);
  }, []);

  /** Draws every session a student started on `forDay`, with the day's total distance and stops. */
  const showTrail = useCallback(
    async (userId: string, name: string, forDay: string) => {
      const lib = L.current,
        m = map.current;
      if (!lib || !m || !trailLayer.current || !rawLayer.current) return;
      try {
        const r = await fetch(
          `/api/tracking/positions?competitionId=${encodeURIComponent(competitionId)}&userId=${encodeURIComponent(userId)}&date=${forDay}`,
          { cache: "no-store" },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Could not load the trail.");
        const sessions: { positions: RawFix[] }[] = d.tracks;
        trailLayer.current.clearLayers();
        rawLayer.current.clearLayers();
        const info: TrailInfo = {
          userId,
          day: forDay,
          name,
          sessions: sessions.length,
          rawCount: 0,
          keptCount: 0,
          droppedInaccurate: 0,
          distanceMeters: 0,
          stops: 0,
          stopMinutes: 0,
          truncated: !!d.truncated,
        };
        const bounds = lib.latLngBounds([]);
        // Each session is cleaned on its own: the gap between two sessions is not walking.
        for (const s of sessions) {
          const raw = s.positions;
          const clean = cleanTrail(raw);
          info.rawCount += clean.rawCount;
          info.keptCount += clean.keptCount;
          info.droppedInaccurate += clean.droppedInaccurate;
          info.distanceMeters += clean.distanceMeters;
          info.stops += clean.stops.length;
          info.stopMinutes += clean.stops.reduce((sum, x) => sum + x.minutes, 0);
          if (!clean.path.length || !clean.start || !clean.end) continue;

          // Raw fixes (hidden unless "raw points" is on), for checking what the phone actually sent.
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
          for (const st of clean.stops)
            lib
              .circleMarker([st.latitude, st.longitude], {
                radius: 9,
                color: "#fff",
                weight: 2,
                fillColor: "#f59e0b",
                fillOpacity: 0.95,
              })
              .bindTooltip(`এখানে ছিল ${st.minutes} মিনিট (${clock(st.from)}–${clock(st.to)})`, { direction: "top" })
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
          lib
            .circleMarker([clean.end.latitude, clean.end.longitude], {
              radius: 6,
              color: "#fff",
              fillColor: "#1e293b",
              fillOpacity: 1,
              weight: 2,
            })
            .bindTooltip(`শেষ লোকেশন · Last ${clock(clean.end.at)}`, { direction: "top" })
            .addTo(trailLayer.current);
          for (const p of clean.path) bounds.extend(p);
        }
        setTrail(info);

        // Students' live markers stay on top of the trail.
        markers.current?.eachLayer((l) => (l as Leaflet.CircleMarker).bringToFront());
        if (bounds.isValid()) m.fitBounds(bounds.pad(0.25), { maxZoom: LABEL_ZOOM });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [competitionId],
  );

  // Raw fixes are drawn with the trail but only shown on request.
  useEffect(() => {
    const m = map.current,
      layer = rawLayer.current;
    if (!m || !layer) return;
    if (showRaw && trail) {
      if (!m.hasLayer(layer)) layer.addTo(m);
    } else if (m.hasLayer(layer)) m.removeLayer(layer);
  }, [showRaw, trail]);

  // Redraw markers whenever new data arrives (none on a past day).
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
      marker.bindPopup(() =>
        popupContent(t, rowByUser.get(t.userId), () => void showTrail(t.userId, t.userName, t.day)),
      );
      marker.addTo(markers.current);
      markerById.current.set(t.id, marker);
    }
    const key = located.map((t) => t.id).sort().join(",");
    if (key && key !== fittedFor.current) {
      fittedFor.current = key;
      fitAll();
    }
  }, [ready, located, fitAll, showTrail, rowByUser]);

  const focus = (t: LiveTrack) => {
    const marker = markerById.current.get(t.id);
    if (!marker || !map.current) return;
    // Close enough to see the street, never so close that the names disappear.
    map.current.setView(marker.getLatLng(), Math.min(Math.max(map.current.getZoom(), LABEL_ZOOM), FOCUS_ZOOM));
    marker.openPopup();
  };

  const pickDay = (next: string) => {
    hideTrail();
    fittedFor.current = "";
    setDayData(null);
    setDay(next === today ? null : next);
  };

  const counts = useMemo(() => {
    const c = { fresh: 0, stale: 0 };
    for (const t of live) c[t.status]++;
    return c;
  }, [live]);
  const totals = useMemo(() => {
    const rows = dayData?.rows || [];
    return {
      people: rows.length,
      distance: rows.reduce((s, r) => s + r.distanceMeters, 0),
      stopMinutes: rows.reduce((s, r) => s + r.stopMinutes, 0),
    };
  }, [dayData]);
  const isIncubation = data?.competition.kind === "business_incubation";
  const title = data?.competition.title || "Field tracking";
  const shownDay = day || today;
  const dayOptions = dayData?.days || (shownDay ? [shownDay] : []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6">
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase mb-2">
            <MapPin size={14} /> Live map · লাইভ ম্যাপ
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {viewingToday
              ? `Map shows students who are out now (live or no signal). Refreshes every 30 seconds${data ? ` · location every ${data.competition.intervalSeconds}s` : ""}.`
              : "Past day: pick a student to see where they walked that day."}
          </p>
          {data && !data.competition.trackingEnabled && !isIncubation && (
            <p className="text-sm text-amber-700 mt-1">Tracking is turned off for this competition.</p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <label className="inline-flex items-center gap-2 border border-slate-300 bg-white pl-3 pr-1 py-1 rounded-xl text-sm font-bold">
            <CalendarDays size={16} className="text-slate-500" />
            <span className="sr-only">Date</span>
            <select
              value={shownDay}
              onChange={(e) => pickDay(e.target.value)}
              disabled={!dayOptions.length}
              className="bg-transparent py-1 pr-1 font-bold outline-none"
            >
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d, today)}
                </option>
              ))}
            </select>
          </label>
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
            disabled={!located.length && !trail}
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
                  Trail: <b>{trail.name}</b> · {dayLabel(trail.day, today)}
                </span>
                <button type="button" onClick={hideTrail} className="ml-auto text-xs font-bold text-slate-600 underline">
                  Hide
                </button>
              </div>
              {trail.rawCount === 0 ? (
                <p className="mt-1 text-xs text-slate-500">No locations recorded for this day.</p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-700">
                    <b>{km(trail.distanceMeters)}</b> হেঁটেছে · <b>{trail.stops}</b> বার থেমেছে
                    {trail.stopMinutes > 0 ? ` (মোট ${duration(trail.stopMinutes)})` : ""}
                    {trail.sessions > 1 ? ` · ${trail.sessions} টি সেশন` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {trail.rawCount} টি লোকেশন থেকে {trail.keptCount} টি বিন্দু
                    {trail.droppedInaccurate > 0 ? ` · ${trail.droppedInaccurate} টি অস্পষ্ট বাদ` : ""}
                    {trail.truncated ? " · অনেক লোকেশন, পুরোটা দেখানো হয়নি" : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" /> শুরু
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-800" /> শেষ
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
          {viewingToday ? (
            <>
              <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 text-xs font-bold">
                {(Object.keys(ORDER) as LiveStatus[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[s] }} />
                    {LABELS[s]}: {counts[s]}
                  </span>
                ))}
              </div>
              <ul className="overflow-y-auto divide-y divide-slate-100">
                {data && !live.length && (
                  <li className="p-6 text-center text-sm text-slate-500">
                    No one is in the field right now. (এখন কেউ ফিল্ডে নেই।)
                  </li>
                )}
                {live.map((t) => {
                  const row = rowByUser.get(t.userId);
                  return (
                    <li key={t.id} className="p-3 hover:bg-slate-50">
                      <button type="button" className="w-full text-left" onClick={() => focus(t)} disabled={!t.lastPosition}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 truncate">{t.userName}</span>
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: COLORS[t.status] }}
                            title={LABELS[t.status]}
                          />
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {[t.batchName, t.label].filter(Boolean).join(" · ") || "—"}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                          <span>{t.lastPosition ? `Seen ${timeAgo(t.lastPosition.capturedAt)}` : "No location yet"}</span>
                          {t.lastPosition?.accuracy != null && <span>±{Math.round(t.lastPosition.accuracy)} m</span>}
                          {t.battery != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <Battery size={12} /> {t.battery}%
                            </span>
                          )}
                          {row && (
                            <span className="inline-flex items-center gap-0.5 font-bold text-blue-700">
                              <Footprints size={12} /> আজ {km(row.distanceMeters)}
                            </span>
                          )}
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
                          onClick={() => void showTrail(t.userId, t.userName, t.day)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <Route size={12} /> Trail
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100 text-xs font-bold text-slate-600">
                {dayLabel(shownDay, today)} · {totals.people} জন · মোট {km(totals.distance)}
              </div>
              <ul className="overflow-y-auto divide-y divide-slate-100">
                {dayData && !dayData.rows.length && (
                  <li className="p-6 text-center text-sm text-slate-500">এই দিনে কোনো লোকেশন রেকর্ড নেই।</li>
                )}
                {(dayData?.rows || []).map((r) => (
                  <li key={r.userId} className="p-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 truncate">{r.userName}</span>
                      <span className="text-sm font-bold text-blue-700 shrink-0">{km(r.distanceMeters)}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {[r.batchName, r.label].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {clock(r.firstStartedAt)}–{r.lastEndedAt ? clock(r.lastEndedAt) : "…"} · থেমেছে {r.stopCount} বার
                      {r.stopMinutes ? ` (${duration(r.stopMinutes)})` : ""}
                    </div>
                    <button
                      type="button"
                      onClick={() => void showTrail(r.userId, r.userName, shownDay)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Route size={12} /> Trail
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 inline-flex items-center gap-2">
              <Footprints size={18} className="text-blue-600" /> দিনের হিসাব · Day report
            </h2>
            <p className="text-xs text-slate-500">
              {shownDay ? dayLabel(shownDay, today) : "…"} · {totals.people} জন · মোট হাঁটা {km(totals.distance)} · মোট থামা{" "}
              {duration(totals.stopMinutes)}। থামা = এক জায়গায় ৫ মিনিট বা বেশি। প্রতিটি সেশন শেষ হলে হিসাব সেভ হয়।
            </p>
          </div>
          <button
            type="button"
            onClick={() => dayData && downloadCsv(title, dayData.day, dayData.rows)}
            disabled={!dayData?.rows.length}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={16} /> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">নাম</th>
                <th className="px-3 py-2">অবস্থা</th>
                <th className="px-3 py-2">বের হয়েছে</th>
                <th className="px-3 py-2">ফিরেছে</th>
                <th className="px-3 py-2">মোট সময়</th>
                <th className="px-3 py-2 text-right">হেঁটেছে</th>
                <th className="px-3 py-2 text-right">থেমেছে</th>
                <th className="px-3 py-2 text-right">সেশন</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Trail</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dayData && !dayData.rows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                    এই দিনে কোনো লোকেশন রেকর্ড নেই।
                  </td>
                </tr>
              )}
              {(dayData?.rows || []).map((r) => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <div className="font-bold text-slate-800">{r.userName}</div>
                    <div className="text-xs text-slate-500">{[r.batchName, r.label].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[r.status] }} />
                      {LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{clock(r.firstStartedAt)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.lastEndedAt ? clock(r.lastEndedAt) : "এখনো বাইরে"}</td>
                  <td className="px-3 py-2 tabular-nums">{duration(r.outMinutes)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 tabular-nums">{km(r.distanceMeters)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {r.stopCount} বার{r.stopMinutes ? ` · ${duration(r.stopMinutes)}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.sessions}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        void showTrail(r.userId, r.userName, shownDay);
                        mapEl.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Route size={12} /> Trail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Popup built from DOM nodes (names are set with textContent, never as HTML). */
function popupContent(t: LiveTrack, row: DayRow | undefined, onTrail: () => void): HTMLElement {
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
    row ? `আজ ${km(row.distanceMeters)} হেঁটেছে` : "",
  ].filter(Boolean);
  seen.textContent = parts.join(" · ");
  const btns = document.createElement("div");
  btns.style.display = "flex";
  btns.style.gap = "6px";
  if (t.lastPosition) {
    const dir = document.createElement("a");
    dir.href = directionUrl(t.lastPosition.latitude, t.lastPosition.longitude);
    dir.target = "_blank";
    dir.rel = "noopener noreferrer";
    dir.textContent = "Direction";
    dir.style.cssText =
      "background:#059669;color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none";
    btns.appendChild(dir);
  }
  const trail = document.createElement("button");
  trail.type = "button";
  trail.textContent = "Trail";
  trail.style.cssText =
    "border:1px solid #cbd5e1;background:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer";
  trail.addEventListener("click", onTrail);
  btns.appendChild(trail);
  root.append(name, meta, seen, btns);
  return root;
}
