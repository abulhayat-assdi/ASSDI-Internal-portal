"use client";
// Browser-side helpers for the Android app bridge (window.AsmApp).
// Contract: docs/ANDROID_PORTAL_APP_PLAN.md. Every bridge argument and return is a JSON string.
import { useEffect, useState } from "react";

export const APP_UA_MARKER = "AsmPortalApp";
export const APP_DOWNLOAD_PAGE = "/app";

export type AppTrackingStatus = {
  active: boolean;
  trackId: string | null;
  permission: "granted_background" | "granted_foreground" | "denied";
  locationEnabled: boolean;
  batteryOptimized: boolean;
  notificationsAllowed: boolean;
  pending: number;
  lastFixAt: string | null;
  lastSentAt: string | null;
  lastError: string | null;
};

export type AppTrackingConfig = {
  trackId: string;
  token: string;
  ingestUrl: string;
  intervalSeconds: number;
  title?: string;
  expiresAt: string;
};

interface AsmAppBridge {
  getInfo(): string;
  startTracking(configJson: string): string;
  stopTracking(trackId: string): string;
  getTrackingStatus(): string;
  requestPermissions(): string;
  openAppSettings(): string;
}

declare global {
  interface Window {
    AsmApp?: AsmAppBridge;
  }
}

/** True inside the Android WebView (UA marker or the injected bridge). */
export function isAsmApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.AsmApp !== "undefined" ||
    navigator.userAgent.includes(APP_UA_MARKER)
  );
}

function bridge(): AsmAppBridge | null {
  return typeof window !== "undefined" && window.AsmApp ? window.AsmApp : null;
}

function parse<T>(raw: unknown): T | null {
  if (typeof raw !== "string") return (raw as T) ?? null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isStatus(v: unknown): v is AppTrackingStatus {
  return !!v && typeof v === "object" && "active" in v && !("error" in v);
}

function call<T>(fn: (b: AsmAppBridge) => unknown): T | null {
  const b = bridge();
  if (!b) return null;
  try {
    return parse<T>(fn(b));
  } catch {
    return null;
  }
}

export const asmApp = {
  available: () => !!bridge(),
  startTracking(cfg: AppTrackingConfig): AppTrackingStatus | null {
    const r = call<AppTrackingStatus>((b) => b.startTracking(JSON.stringify(cfg)));
    return isStatus(r) ? r : null;
  },
  stopTracking(trackId: string): AppTrackingStatus | null {
    const r = call<AppTrackingStatus>((b) => b.stopTracking(trackId));
    return isStatus(r) ? r : null;
  },
  status(): AppTrackingStatus | null {
    const r = call<AppTrackingStatus>((b) => b.getTrackingStatus());
    return isStatus(r) ? r : null;
  },
  requestPermissions(): void {
    call((b) => b.requestPermissions());
  },
  openAppSettings(): void {
    call((b) => b.openAppSettings());
  },
};

/** Re-renders with the app's tracking status (initial read + `asmapp:tracking` events). */
export function useAppTracking(): {
  isApp: boolean;
  hasBridge: boolean;
  status: AppTrackingStatus | null;
  refresh: () => void;
} {
  const [state, setState] = useState<{
    isApp: boolean;
    hasBridge: boolean;
    status: AppTrackingStatus | null;
  }>({ isApp: false, hasBridge: false, status: null });
  useEffect(() => {
    const read = () =>
      setState({
        isApp: isAsmApp(),
        hasBridge: asmApp.available(),
        status: asmApp.status(),
      });
    read();
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const status = parse<AppTrackingStatus>(detail);
      setState((s) => ({
        ...s,
        status: isStatus(status) ? status : asmApp.status(),
      }));
    };
    const onVisible = () => {
      if (!document.hidden) read();
    };
    window.addEventListener("asmapp:tracking", onEvent);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("asmapp:tracking", onEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return {
    ...state,
    refresh: () => setState((s) => ({ ...s, status: asmApp.status() })),
  };
}

/** True after mount when running inside the app (for hiding UI without a hydration mismatch). */
export function useIsAsmApp(): boolean {
  const [app, setApp] = useState(false);
  useEffect(() => setApp(isAsmApp()), []);
  return app;
}

export function timeAgo(iso: string | Date | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}
