// Cleans a raw GPS trail for display on the staff live map.
//
// A phone that is standing still still reports positions that wander 10–30 m
// around the true spot, so drawing every fix makes a zig-zag "star" that looks
// like movement. This module:
//   1. drops fixes that are too inaccurate to place on a street map,
//   2. merges consecutive fixes that fall within their own error radius into a
//      single point (a "stay"), so standing still draws one dot, not a scribble,
//   3. removes single-fix spikes (a jump away and straight back),
//   4. reports stays of STOP_MIN_MS or longer as stops ("was here for 12 min").
// The raw data is never changed; this only shapes what is drawn.

export type RawFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string | Date;
};

export type TrailStop = {
  latitude: number;
  longitude: number;
  from: string;
  to: string;
  minutes: number;
  fixes: number;
};

export type CleanTrail = {
  path: [number, number][];
  stops: TrailStop[];
  rawCount: number;
  keptCount: number;
  droppedInaccurate: number;
  distanceMeters: number;
  start: { latitude: number; longitude: number; at: string } | null;
  end: { latitude: number; longitude: number; at: string } | null;
};

/** Fixes worse than this are not placed on the map (unless nothing better exists). */
export const MAX_ACCURACY_M = 50;
/** Smallest radius treated as "the same spot", whatever the reported accuracy. */
export const MIN_STAY_RADIUS_M = 25;
/** Largest radius treated as "the same spot". */
export const MAX_STAY_RADIUS_M = 60;
/** A stay at least this long is shown as a stop. */
export const STOP_MIN_MS = 5 * 60_000;
/** Faster than this between two kept points is a GPS error, not travel (~180 km/h). */
export const MAX_SPEED_MPS = 50;
/** Accuracy assumed when a fix does not report one. */
const DEFAULT_ACCURACY_M = 30;

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Fix = { latitude: number; longitude: number; accuracy: number; t: number };

type Stay = {
  latitude: number;
  longitude: number;
  accuracy: number;
  weight: number;
  from: number;
  to: number;
  fixes: number;
};

const iso = (t: number) => new Date(t).toISOString();

/**
 * Two fixes can be the same spot when they are within both error radii combined
 * (each reported accuracy is a ~68% radius, so jitter of 1–2× is normal).
 */
function stayRadius(a: number, b: number) {
  return Math.min(MAX_STAY_RADIUS_M, Math.max(MIN_STAY_RADIUS_M, a + b));
}

function startStay(f: Fix): Stay {
  const w = 1 / Math.max(1, f.accuracy) ** 2;
  return { latitude: f.latitude, longitude: f.longitude, accuracy: f.accuracy, weight: w, from: f.t, to: f.t, fixes: 1 };
}

/** Adds a fix to a stay, moving its centre by an accuracy-weighted average. */
function joinStay(s: Stay, f: Fix): Stay {
  const w = 1 / Math.max(1, f.accuracy) ** 2;
  const total = s.weight + w;
  return {
    latitude: (s.latitude * s.weight + f.latitude * w) / total,
    longitude: (s.longitude * s.weight + f.longitude * w) / total,
    accuracy: Math.min(s.accuracy, f.accuracy),
    weight: total,
    from: s.from,
    to: f.t,
    fixes: s.fixes + 1,
  };
}

export function cleanTrail(raw: RawFix[]): CleanTrail {
  const fixes: Fix[] = raw
    .map((p) => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      accuracy: p.accuracy == null || !Number.isFinite(Number(p.accuracy)) ? DEFAULT_ACCURACY_M : Number(p.accuracy),
      t: new Date(p.capturedAt).getTime(),
    }))
    .filter((f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude) && Number.isFinite(f.t))
    .sort((a, b) => a.t - b.t);

  const empty: CleanTrail = {
    path: [],
    stops: [],
    rawCount: raw.length,
    keptCount: 0,
    droppedInaccurate: 0,
    distanceMeters: 0,
    start: null,
    end: null,
  };
  if (!fixes.length) return empty;

  // 1. Accuracy filter, but never leave the trail empty.
  let usable = fixes.filter((f) => f.accuracy <= MAX_ACCURACY_M);
  if (!usable.length) usable = [fixes.reduce((best, f) => (f.accuracy < best.accuracy ? f : best))];
  const droppedInaccurate = fixes.length - usable.length;

  // 2. Merge fixes that stay within their error radius into one point.
  const stays: Stay[] = [];
  let current = startStay(usable[0]);
  for (const f of usable.slice(1)) {
    if (distanceMeters(current, f) <= stayRadius(current.accuracy, f.accuracy)) current = joinStay(current, f);
    else {
      stays.push(current);
      current = startStay(f);
    }
  }
  stays.push(current);

  // 3. Remove single-fix spikes and impossible jumps.
  const kept: Stay[] = [];
  for (let i = 0; i < stays.length; i++) {
    const s = stays[i];
    const prev = kept[kept.length - 1];
    const next = stays[i + 1];
    if (prev && s.fixes === 1) {
      // Out and straight back: prev and next are close, s is far from both.
      if (next) {
        const back = distanceMeters(prev, next);
        const out = distanceMeters(prev, s);
        if (back <= stayRadius(prev.accuracy, next.accuracy) && out > 2 * Math.max(back, MIN_STAY_RADIUS_M)) continue;
      }
      // Faster than any vehicle in town.
      const seconds = Math.max(1, (s.from - prev.to) / 1000);
      if (distanceMeters(prev, s) / seconds > MAX_SPEED_MPS) continue;
    }
    // A spike removed between two parts of the same stay: merge them back.
    if (prev && distanceMeters(prev, s) <= stayRadius(prev.accuracy, s.accuracy)) {
      const w = prev.weight + s.weight;
      kept[kept.length - 1] = {
        latitude: (prev.latitude * prev.weight + s.latitude * s.weight) / w,
        longitude: (prev.longitude * prev.weight + s.longitude * s.weight) / w,
        accuracy: Math.min(prev.accuracy, s.accuracy),
        weight: w,
        from: prev.from,
        to: s.to,
        fixes: prev.fixes + s.fixes,
      };
      continue;
    }
    kept.push(s);
  }

  const path = kept.map((s) => [s.latitude, s.longitude] as [number, number]);
  let distance = 0;
  for (let i = 1; i < kept.length; i++) distance += distanceMeters(kept[i - 1], kept[i]);

  const stops: TrailStop[] = kept
    .filter((s) => s.to - s.from >= STOP_MIN_MS)
    .map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
      from: iso(s.from),
      to: iso(s.to),
      minutes: Math.round((s.to - s.from) / 60_000),
      fixes: s.fixes,
    }));

  const first = kept[0];
  const last = kept[kept.length - 1];
  return {
    path,
    stops,
    rawCount: raw.length,
    keptCount: kept.length,
    droppedInaccurate,
    distanceMeters: Math.round(distance),
    start: { latitude: first.latitude, longitude: first.longitude, at: iso(first.from) },
    end: { latitude: last.latitude, longitude: last.longitude, at: iso(last.to) },
  };
}

export type TrailSummary = {
  distanceMeters: number;
  stopCount: number;
  stopMinutes: number;
  pointCount: number;
};

/** The numbers saved on a track: same cleaning as the map, so both always agree. */
export function summarizeTrail(raw: RawFix[]): TrailSummary {
  const clean = cleanTrail(raw);
  return {
    distanceMeters: clean.distanceMeters,
    stopCount: clean.stops.length,
    stopMinutes: clean.stops.reduce((sum, s) => sum + s.minutes, 0),
    pointCount: clean.rawCount,
  };
}
