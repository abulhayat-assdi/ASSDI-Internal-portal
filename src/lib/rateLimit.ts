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

/**
 * Reads an operator override for a limit, e.g. RATE_LIMIT_LOGIN_IP=500.
 *
 * These are deliberately tunable without a code change: this portal runs
 * behind school and office NATs where hundreds of legitimate users share one
 * address, and the right ceiling is something the operator discovers in
 * production, not something we can guess here. A rebuild to change a number
 * is too expensive on a small shared host.
 */
export function limitFromEnv(name: string, fallback: number): number {
    const raw = Number(process.env[`RATE_LIMIT_${name}`]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * True when `key` is already over `limit`, WITHOUT counting this call.
 *
 * Pair with recordAttempt() to count only the attempts that deserve it —
 * failed logins, say, rather than every login. Counting successes is what
 * makes a shared-IP limit lock out a whole classroom.
 */
export function isOverLimit(key: string, limit: number): boolean {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= Date.now()) return false;
    return bucket.count >= limit;
}

/** Counts one attempt against `key` without judging it. */
export function recordAttempt(key: string, windowMs: number): void {
    const now = Date.now();
    if (buckets.size > MAX_KEYS) sweep(now);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else {
        bucket.count++;
    }
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
