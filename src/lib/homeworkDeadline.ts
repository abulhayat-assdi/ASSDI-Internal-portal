/**
 * Homework submission cut-off.
 *
 * A folder closes on `deadlineDate` (YYYY-MM-DD). `deadlineTime` (HH:mm, 24h)
 * is optional: when absent the folder stays open through the end of that day.
 * Both are wall-clock values in the portal's timezone (Bangladesh, UTC+6, no
 * DST), not in the viewer's or the server's.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns a clean "HH:mm", or null for empty / malformed input. */
export function normalizeDeadlineTime(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const v = value.trim();
    return TIME_RE.test(v) ? v : null;
}

/** Today's date in the portal timezone, as YYYY-MM-DD. */
export function todayInDhaka(now: Date = new Date()): string {
    return new Date(now.getTime() + DHAKA_OFFSET_MS).toISOString().split("T")[0];
}

/** The exact moment submissions close. NaN-safe: returns null for a bad date. */
export function getDeadlineInstant(deadlineDate: string, deadlineTime?: string | null): Date | null {
    if (!DATE_RE.test(deadlineDate)) return null;
    const time = normalizeDeadlineTime(deadlineTime);
    // With a time the cut-off is that minute; without one, the day's last instant.
    const iso = time ? `${deadlineDate}T${time}:00.000+06:00` : `${deadlineDate}T23:59:59.999+06:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function isHomeworkClosed(
    assignment: { deadlineDate: string; deadlineTime?: string | null },
    now: Date = new Date()
): boolean {
    const instant = getDeadlineInstant(assignment.deadlineDate, assignment.deadlineTime);
    return instant ? now.getTime() > instant.getTime() : false;
}

/** "2026-10-20" or "2026-10-20, 03:30 PM" for display. */
export function formatDeadline(deadlineDate: string, deadlineTime?: string | null): string {
    const time = normalizeDeadlineTime(deadlineTime);
    if (!time) return deadlineDate;
    const [h, m] = time.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${deadlineDate}, ${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}
