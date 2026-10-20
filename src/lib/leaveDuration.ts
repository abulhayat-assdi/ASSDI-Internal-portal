/**
 * Leave duration maths shared by the student form, the admin screens and the
 * API. Dates are "YYYY-MM-DD" and times "HH:mm", both wall-clock (the portal
 * runs on one timezone), so everything is computed on naive timestamps.
 *
 * Leaves saved before times existed have no time on either end; they keep the
 * old meaning of "whole days, both ends included".
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 24 * 60;

export type LeaveWindow = {
    startDate: string;
    startTime?: string | null;
    endDate: string;
    endTime?: string | null;
};

export function isValidLeaveTime(value: unknown): value is string {
    return typeof value === "string" && TIME_RE.test(value);
}

function dayNumber(date: string): number | null {
    const m = DATE_RE.exec(date);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const ms = Date.UTC(y, mo - 1, d);
    const check = new Date(ms);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
    return ms / 86_400_000;
}

function timeMinutes(time: string | null | undefined, fallback: number): number {
    const m = time ? TIME_RE.exec(time) : null;
    return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

/** Minutes from the start of day-zero to the given moment; null if the date is invalid. */
function toMinutes(date: string, time: string | null | undefined, fallback: number): number | null {
    const day = dayNumber(date);
    return day === null ? null : day * MINUTES_PER_DAY + timeMinutes(time, fallback);
}

/** Total minutes of leave, or null when the dates are unreadable or reversed. */
export function leaveMinutes(w: LeaveWindow): number | null {
    // No end time means "through the end of that day".
    const start = toMinutes(w.startDate, w.startTime, 0);
    const end = toMinutes(w.endDate, w.endTime, MINUTES_PER_DAY);
    if (start === null || end === null || end < start) return null;
    return end - start;
}

/** Human-readable error for a bad window, or null when it is acceptable. */
export function validateLeaveWindow(w: LeaveWindow, now = new Date()): string | null {
    if (dayNumber(w.startDate) === null || dayNumber(w.endDate) === null) {
        return "Please enter valid start and end dates.";
    }
    for (const t of [w.startTime, w.endTime]) {
        if (t && !isValidLeaveTime(t)) return "Please enter valid start and end times.";
    }
    // Catches typos like 1926 for 2026 that would otherwise count as 700k days.
    const year = now.getFullYear();
    for (const d of [w.startDate, w.endDate]) {
        const y = Number(d.slice(0, 4));
        if (y < year - 1 || y > year + 1) return `Leave dates must be within ${year - 1}-${year + 1}.`;
    }
    const minutes = leaveMinutes(w);
    if (minutes === null || minutes <= 0) return "The leave must end after it starts.";
    if (minutes > 366 * MINUTES_PER_DAY) return "A single leave request cannot be longer than a year.";
    return null;
}

/** "1 day 6 hrs", "6 hrs 30 min", "2 days" — every 24 hours counts as a day. */
export function formatLeaveDuration(minutes: number | null): string {
    if (minutes === null) return "-";
    const days = Math.floor(minutes / MINUTES_PER_DAY);
    const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
    const mins = minutes % 60;
    const parts: string[] = [];
    if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    if (hours) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
    if (mins) parts.push(`${mins} min`);
    return parts.length ? parts.join(" ") : "0 min";
}

/** Total hours as a number rounded to 2 places, for spreadsheets. */
export function leaveHours(minutes: number | null): number | string {
    return minutes === null ? "-" : Math.round((minutes / 60) * 100) / 100;
}

/** "02:30 PM" for display; empty when no time was recorded. */
export function formatLeaveTime(time: string | null | undefined): string {
    const m = time ? TIME_RE.exec(time) : null;
    if (!m) return "";
    const h = Number(m[1]);
    return `${String(h % 12 || 12).padStart(2, "0")}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}
