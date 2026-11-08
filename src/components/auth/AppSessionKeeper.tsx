"use client";
// Keeps a logged-in user logged in while they keep using the Android app:
// at most twice a day it asks the server to slide the 30-day session forward
// (POST /api/auth/refresh). Does nothing in a normal browser, where sessions
// keep their fixed 30-day lifetime (shared lab computers).
import { useEffect } from "react";
import { isAsmApp } from "@/lib/tracking/client";

const KEY = "asm.session.refreshedAt";
const EVERY_MS = 12 * 60 * 60 * 1000;

function lastRefresh(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

function remember(at: number) {
  try {
    localStorage.setItem(KEY, String(at));
  } catch {
    /* storage unavailable: we simply ask again next time */
  }
}

async function refreshIfDue() {
  if (!isAsmApp() || Date.now() - lastRefresh() < EVERY_MS) return;
  try {
    const r = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store", credentials: "same-origin" });
    // 200 covers both "renewed" and "too recent / not renewable": either way, wait for the next window.
    if (r.ok) remember(Date.now());
  } catch {
    /* offline: try again on the next open */
  }
}

export default function AppSessionKeeper() {
  useEffect(() => {
    void refreshIfDue();
    // The app can sit in the background for days without reloading the page.
    const onVisible = () => {
      if (!document.hidden) void refreshIfDue();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
