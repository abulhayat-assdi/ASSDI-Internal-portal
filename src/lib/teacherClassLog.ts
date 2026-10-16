// Teacher class attendance — shared rules for the API routes and the screens.

import { z } from "zod";

const TIMEZONE = "Asia/Dhaka";

/** YYYY-MM-DD of an instant in Dhaka. `lib/attendance.today()` is UTC, which is a day behind just after midnight here. */
export function dhakaDate(d: Date | string = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(d));
}

export const isValidDateString = (v: unknown): v is string =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:mm" → minutes since midnight. */
export function toMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

/** Length of a class in minutes, or null when it does not end after it starts. */
export function durationMinutes(start: string, end: string): number | null {
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null;
    const d = toMinutes(end) - toMinutes(start);
    return d > 0 ? d : null;
}

/** Two classes clash when they share any time; back-to-back (09:00-10:00, 10:00-11:00) does not clash. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** 150 → "2h 30m", 45 → "45m", 120 → "2h". */
export function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

/** "14:30" → "2:30 PM", for display only. */
export function formatClock(time: string): string {
    if (!TIME_RE.test(time)) return time;
    const [h, m] = time.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** A teacher may correct an entry only on the Dhaka day it was entered; admins any time. */
export function canTeacherEditLog(createdAt: Date | string, now: Date = new Date()): boolean {
    return dhakaDate(createdAt) === dhakaDate(now);
}

/** Fields a teacher (or an admin on their behalf) fills in for one class. */
export const classLogFields = {
    batchName: z.string().min(1, "ব্যাচ সিলেক্ট করুন।"),
    date: z.string().refine(isValidDateString, "তারিখ সঠিক নয়।"),
    subjectId: z.string().min(1, "বিষয় সিলেক্ট করুন।"),
    topic: z.string().trim().min(1, "টপিক লিখুন।").max(300, "টপিক অনেক বড়।"),
    startTime: z.string().regex(TIME_RE, "শুরুর সময় সঠিক নয়।"),
    endTime: z.string().regex(TIME_RE, "শেষের সময় সঠিক নয়।"),
};

export const classLogSchema = z.object(classLogFields);
export type ClassLogInput = z.infer<typeof classLogSchema>;

/** Validation shared by create and update; returns the Bengali error or the duration. */
export function checkClassTiming(date: string, startTime: string, endTime: string): { error: string } | { durationMin: number } {
    if (date > dhakaDate()) return { error: "ভবিষ্যতের তারিখে ক্লাস সেভ করা যাবে না।" };
    const durationMin = durationMinutes(startTime, endTime);
    if (durationMin === null) return { error: "শেষের সময় শুরুর সময়ের পরে হতে হবে।" };
    return { durationMin };
}
