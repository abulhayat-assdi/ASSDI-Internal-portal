import "server-only";
import type { NextRequest } from "next/server";

/**
 * Small in-process rate limiter.
 *
 * Deliberately not Redis: the portal runs as a single container, so a Map is
 * accurate and free. The trade-off is that counters reset on restart and
 * don't span replicas — if this app is ever scaled out, this module is the
 * one place that has to change.
 */

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound the map so a flood of distinct keys can't grow it without limit.
const MAX_KEYS = 20_000;

function sweep(now: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

/**
 * Reads the caller's IP from the proxy chain.
 *
 * X-Forwarded-For is client-controllable on its left: a request arriving with
 * its own XFF header gets the real IP *appended* by the reverse proxy, so the
 * leftmost entry is whatever the attacker wrote and the rightmost is the one
 * the proxy vouched for. Counting hops from the right is therefore the only
 * safe read. TRUSTED_PROXY_HOPS covers deployments with more than one proxy
 * in front (e.g. Cloudflare → Traefik → app).
 */
export function getClientIp(req: NextRequest): string {
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
    const forwarded = req.headers.get("x-forwarded-for");

    if (forwarded) {
        const chain = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
        const candidate = chain[chain.length - hops] ?? chain[0];
        if (candidate) return candidate;
    }

    return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
    ok: boolean;
    /** Seconds until the window resets; only meaningful when ok is false. */
    retryAfter: number;
}

/**
 * Counts one hit against `key`. Returns ok:false once `limit` is exceeded
 * inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();

    if (buckets.size > MAX_KEYS) sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfter: 0 };
    }

    bucket.count++;
    if (bucket.count > limit) {
        return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }
    return { ok: true, retryAfter: 0 };
}

/** Drops a key's counter — used to reset the budget after a success. */
export function clearRateLimit(key: string): void {
    buckets.delete(key);
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/**
 * Convenience wrapper: rate-limits `scope` by caller IP and returns a ready
 * 429 Response when the budget is spent, or null to continue.
 */
export function rateLimitByIp(
    req: NextRequest,
    scope: string,
    limit: number,
    windowMs: number,
    message = "অনেক বেশি অনুরোধ পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।"
): Response | null {
    const result = rateLimit(`${scope}:${getClientIp(req)}`, limit, windowMs);
    if (result.ok) return null;

    return new Response(JSON.stringify({ error: message }), {
        status: 429,
        headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter),
        },
    });
}
