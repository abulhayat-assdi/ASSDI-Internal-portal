import { describe, it, expect } from "vitest";
import { leaveMinutes, validateLeaveWindow, formatLeaveDuration, formatLeaveTime } from "./leaveDuration";

const now = new Date("2026-10-20T10:00:00");

describe("leaveMinutes", () => {
    it("counts hours between two moments", () => {
        expect(leaveMinutes({ startDate: "2026-10-21", startTime: "09:00", endDate: "2026-10-21", endTime: "15:30" })).toBe(390);
    });

    it("rolls 24 hours into a day across dates", () => {
        expect(leaveMinutes({ startDate: "2026-10-21", startTime: "10:00", endDate: "2026-10-22", endTime: "16:00" })).toBe(30 * 60);
    });

    it("treats legacy rows without times as whole inclusive days", () => {
        expect(leaveMinutes({ startDate: "2026-10-21", endDate: "2026-10-22" })).toBe(2 * 24 * 60);
        expect(leaveMinutes({ startDate: "2026-10-21", endDate: "2026-10-21" })).toBe(24 * 60);
    });

    it("rejects reversed or unreadable windows", () => {
        expect(leaveMinutes({ startDate: "2026-10-22", endDate: "2026-10-21" })).toBeNull();
        expect(leaveMinutes({ startDate: "nope", endDate: "2026-10-21" })).toBeNull();
    });
});

describe("formatLeaveDuration", () => {
    it("shows days then hours then minutes", () => {
        expect(formatLeaveDuration(24 * 60)).toBe("1 day");
        expect(formatLeaveDuration(30 * 60)).toBe("1 day 6 hrs");
        expect(formatLeaveDuration(6 * 60 + 30)).toBe("6 hrs 30 min");
        expect(formatLeaveDuration(60)).toBe("1 hr");
        expect(formatLeaveDuration(null)).toBe("-");
    });
});

describe("validateLeaveWindow", () => {
    it("accepts a normal request", () => {
        expect(validateLeaveWindow({ startDate: "2026-10-21", startTime: "09:00", endDate: "2026-10-22", endTime: "09:00" }, now)).toBeNull();
    });

    it("rejects the 1926 typo", () => {
        expect(validateLeaveWindow({ startDate: "1926-10-20", endDate: "2026-10-22" }, now)).toMatch(/within/);
    });

    it("rejects an end before the start on the same day", () => {
        expect(validateLeaveWindow({ startDate: "2026-10-21", startTime: "15:00", endDate: "2026-10-21", endTime: "09:00" }, now)).toMatch(/after/);
    });

    it("rejects malformed times", () => {
        expect(validateLeaveWindow({ startDate: "2026-10-21", startTime: "25:00", endDate: "2026-10-22" }, now)).toMatch(/times/);
    });
});

describe("formatLeaveTime", () => {
    it("formats 12-hour clock", () => {
        expect(formatLeaveTime("00:05")).toBe("12:05 AM");
        expect(formatLeaveTime("14:30")).toBe("02:30 PM");
        expect(formatLeaveTime(null)).toBe("");
    });
});
