import { describe, it, expect } from "vitest";
import {
    canTeacherEditLog,
    checkClassTiming,
    dhakaDate,
    durationMinutes,
    formatClock,
    formatDuration,
    rangesOverlap,
} from "./teacherClassLog";

describe("teacher class log helpers", () => {
    it("computes class length and rejects bad ranges", () => {
        expect(durationMinutes("09:00", "10:30")).toBe(90);
        expect(durationMinutes("10:00", "10:00")).toBeNull();
        expect(durationMinutes("23:00", "01:00")).toBeNull(); // no crossing midnight
        expect(durationMinutes("9:00", "10:00")).toBeNull(); // not HH:mm
        expect(durationMinutes("24:00", "25:00")).toBeNull();
    });

    it("treats touching classes as not overlapping", () => {
        expect(rangesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
        expect(rangesOverlap("09:00", "10:00", "09:59", "11:00")).toBe(true);
        expect(rangesOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
        expect(rangesOverlap("10:00", "11:00", "09:00", "09:30")).toBe(false);
    });

    it("formats durations and clock times", () => {
        expect(formatDuration(150)).toBe("2h 30m");
        expect(formatDuration(45)).toBe("45m");
        expect(formatDuration(120)).toBe("2h");
        expect(formatClock("00:05")).toBe("12:05 AM");
        expect(formatClock("14:30")).toBe("2:30 PM");
    });

    it("uses the Dhaka calendar day, not UTC", () => {
        // 19:00 UTC is already the next day in Dhaka (UTC+6).
        expect(dhakaDate(new Date("2026-10-16T19:00:00Z"))).toBe("2026-10-17");
        expect(dhakaDate(new Date("2026-10-16T17:00:00Z"))).toBe("2026-10-16");
    });

    it("lets a teacher edit only the day an entry was made", () => {
        const created = new Date("2026-10-16T05:00:00Z");
        expect(canTeacherEditLog(created, new Date("2026-10-16T17:00:00Z"))).toBe(true);
        expect(canTeacherEditLog(created, new Date("2026-10-16T18:30:00Z"))).toBe(false);
    });

    it("rejects future dates and inverted times", () => {
        expect(checkClassTiming("2999-01-01", "09:00", "10:00")).toHaveProperty("error");
        expect(checkClassTiming("2020-01-01", "10:00", "09:00")).toHaveProperty("error");
        expect(checkClassTiming("2020-01-01", "09:00", "10:15")).toEqual({ durationMin: 75 });
    });
});
