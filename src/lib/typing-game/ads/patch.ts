/** Validates an admin ad-settings update: keeps known keys with sane values, rejects malformed ids. */
import { AD_ACTIONS, AD_SLOTS } from "./settings";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Keeps only known keys with sane values; anything else is dropped. */
export function sanitizeAdPatch(body: unknown): Record<string, unknown> | null {
  if (!isObj(body)) return null;
  const out: Record<string, unknown> = {};
  for (const k of ["enabled", "display_enabled", "rewarded_enabled"]) if (typeof body[k] === "boolean") out[k] = body[k];
  if (body.provider === "mock" || body.provider === "google") out.provider = body.provider;
  if (typeof body.publisher_id === "string") {
    const id = body.publisher_id.trim();
    if (id && !/^ca-pub-\d{6,20}$/.test(id)) return null;
    out.publisher_id = id;
  }
  if (isObj(body.slots)) {
    const slots: Record<string, unknown> = {};
    for (const s of AD_SLOTS) {
      const v = body.slots[s.key];
      if (isObj(v)) {
        const slotId = typeof v.slotId === "string" ? v.slotId.trim() : "";
        if (slotId && !/^\d{4,20}$/.test(slotId)) return null;
        slots[s.key] = { enabled: v.enabled === true, slotId };
      }
    }
    out.slots = slots;
  }
  if (isObj(body.action_views)) {
    const views: Record<string, number> = {};
    for (const a of AD_ACTIONS) {
      const n = Number(body.action_views[a.key]);
      if (Number.isInteger(n) && n >= 0 && n <= 10) views[a.key] = n;
    }
    out.action_views = views;
  }
  const int = (k: string, lo: number, hi: number) => {
    const n = Number(body[k]);
    if (body[k] !== undefined && Number.isInteger(n) && n >= lo && n <= hi) out[k] = n;
  };
  int("rewarded_daily_limit", 0, 100);
  int("min_watch_seconds", 5, 120);
  if (body.no_fill === "allow" || body.no_fill === "block") out.no_fill = body.no_fill;
  if (Array.isArray(body.exempt_batch_ids)) {
    const ids = body.exempt_batch_ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));
    out.exempt_batch_ids = ids;
  }
  return out;
}

