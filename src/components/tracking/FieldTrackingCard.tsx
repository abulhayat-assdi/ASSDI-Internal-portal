"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Navigation, ShieldAlert, Smartphone } from "lucide-react";
import {
  APP_DOWNLOAD_PAGE,
  asmApp,
  timeAgo,
  useAppTracking,
  type AppTrackingConfig,
} from "@/lib/tracking/client";

export type StudentTracking = {
  enabled: boolean;
  intervalSeconds: number;
  openTrack: { id: string; startedAt: string; intervalSeconds: number } | null;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || `Request failed (${r.status})`);
  return d as T;
}

type StartResponse = {
  track: { id: string; startedAt: string; intervalSeconds: number };
  token: string;
  ingestUrl: string;
  intervalSeconds: number;
  expiresAt: string;
  title?: string;
};

const toConfig = (r: StartResponse, title: string): AppTrackingConfig => ({
  trackId: r.track.id,
  token: r.token,
  ingestUrl: r.ingestUrl,
  intervalSeconds: r.intervalSeconds,
  expiresAt: r.expiresAt,
  title: r.title || title,
});

/** Start/Stop field location tracking for a normal (non-incubation) competition. */
export default function FieldTrackingCard({
  competitionId,
  title,
  running,
  tracking,
}: {
  competitionId: string;
  title: string;
  /** Whether the competition itself is active now. */
  running: boolean;
  tracking: StudentTracking;
}) {
  const { hasBridge, status, refresh } = useAppTracking();
  const [openTrack, setOpenTrack] = useState(tracking.openTrack),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [, tick] = useState(0);

  // Re-render every 30 s so "x min ago" stays current.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/student/competitions/" + competitionId, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setOpenTrack(d.tracking?.openTrack ?? null);
    } catch {
      /* keep what we have */
    }
  }, [competitionId]);

  // When the app reports it stopped (for example the server answered 410), re-read the server state.
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && status && !status.active) void reload();
    wasActive.current = !!status?.active;
  }, [status, reload]);

  const appRunsThis = !!openTrack && !!status?.active && status.trackId === openTrack.id;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const start = () =>
    run(async () => {
      const r = await post<StartResponse>("/api/tracking/start", { competitionId });
      setOpenTrack(r.track);
      asmApp.startTracking(toConfig(r, title));
    });

  const resume = () =>
    run(async () => {
      if (!openTrack) return;
      const r = await post<StartResponse>("/api/tracking/resume", { trackId: openTrack.id });
      asmApp.startTracking(toConfig(r, title));
    });

  const stop = () =>
    run(async () => {
      if (!openTrack) return;
      if (hasBridge) {
        asmApp.stopTracking(openTrack.id);
        // Give the app a moment to flush its queue before the token is revoked.
        await new Promise((r) => setTimeout(r, 1500));
      }
      await post("/api/tracking/stop", { trackId: openTrack.id });
      setOpenTrack(null);
    });

  const box = "bg-white border border-slate-200 rounded-2xl p-5 shadow-sm";

  if (!hasBridge)
    return (
      <section className={box} aria-label="Field tracking">
        <div className="flex items-start gap-3">
          <Smartphone className="text-emerald-600 shrink-0" size={22} />
          <div className="space-y-2">
            <h2 className="font-bold text-slate-800">ফিল্ড লোকেশন ট্র্যাকিং</h2>
            <p className="text-sm text-slate-600">
              লোকেশন ট্র্যাকিং শুধু মোবাইল অ্যাপে চলে। Location tracking only works in the ASSDI Portal Android app.
            </p>
            {openTrack && (
              <p className="text-sm text-amber-700">
                আপনার একটি ট্র্যাকিং সেশন চালু আছে ({timeAgo(openTrack.startedAt)} থেকে)।
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                href={APP_DOWNLOAD_PAGE}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                অ্যাপ ডাউনলোড করুন
              </Link>
              {openTrack && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={stop}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ফিরে এসেছি (Stop)
                </button>
              )}
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </section>
    );

  const warnings: { text: string; action?: "permissions" | "settings" }[] = [];
  if (status) {
    if (status.permission === "denied")
      warnings.push({ text: "লোকেশন permission দেওয়া হয়নি। Settings থেকে Location → \"Allow all the time\" দিন।", action: "settings" });
    else if (status.permission === "granted_foreground")
      warnings.push({ text: "স্ক্রিন লক থাকলেও ট্র্যাকিংয়ের জন্য Location → \"Allow all the time\" দিন।", action: "permissions" });
    if (!status.locationEnabled) warnings.push({ text: "ফোনের Location (GPS) বন্ধ আছে। চালু করুন।" });
    if (status.batteryOptimized)
      warnings.push({ text: "Battery optimization চালু আছে; ফোন ট্র্যাকিং বন্ধ করে দিতে পারে।", action: "permissions" });
    if (!status.notificationsAllowed)
      warnings.push({ text: "Notification permission দিন, না হলে ট্র্যাকিং notification দেখা যাবে না।", action: "permissions" });
  }

  return (
    <section className={box} aria-label="Field tracking">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="text-emerald-600" size={22} />
          <h2 className="font-bold text-slate-800">ফিল্ড লোকেশন ট্র্যাকিং</h2>
        </div>
        <span
          className={
            "rounded-full px-3 py-1 text-xs font-bold " +
            (appRunsThis ? "bg-emerald-100 text-emerald-800" : openTrack ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")
          }
        >
          {appRunsThis ? "চালু আছে · Active" : openTrack ? "অ্যাপে চালু নেই" : "বন্ধ · Off"}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        ফিল্ডে যাওয়ার সময় চালু করুন; প্রতি {openTrack?.intervalSeconds || tracking.intervalSeconds} সেকেন্ডে লোকেশন পাঠানো হবে, স্ক্রিন লক থাকলেও।
      </p>

      {status && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="font-semibold">শেষ লোকেশন</dt>
            <dd>{timeAgo(status.lastFixAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold">শেষ পাঠানো</dt>
            <dd>{timeAgo(status.lastSentAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold">পাঠানো বাকি</dt>
            <dd>{status.pending}</dd>
          </div>
          {status.lastError && (
            <div className="col-span-2 sm:col-span-1">
              <dt className="font-semibold">সমস্যা</dt>
              <dd className="text-red-600 break-words">{status.lastError}</dd>
            </div>
          )}
        </dl>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-2">
          {warnings.map((w) => (
            <li key={w.text} className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-sm text-amber-900">
              <ShieldAlert size={16} className="shrink-0" />
              <span className="flex-1">{w.text}</span>
              {w.action && (
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white"
                  onClick={() => {
                    if (w.action === "settings") asmApp.openAppSettings();
                    else asmApp.requestPermissions();
                    setTimeout(refresh, 1000);
                  }}
                >
                  {w.action === "settings" ? "Settings খুলুন" : "Permission দিন"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!openTrack && (
          <button
            type="button"
            disabled={busy || !running}
            onClick={start}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Navigation size={16} /> ফিল্ডে যাচ্ছি
          </button>
        )}
        {openTrack && !appRunsThis && (
          <button
            type="button"
            disabled={busy}
            onClick={resume}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Navigation size={16} /> আবার চালু করুন
          </button>
        )}
        {openTrack && (
          <button
            type="button"
            disabled={busy}
            onClick={stop}
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            ফিরে এসেছি
          </button>
        )}
      </div>
      {!running && !openTrack && (
        <p className="mt-2 text-xs text-slate-500">এই competition এখন চলছে না, তাই ট্র্যাকিং শুরু করা যাবে না।</p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
