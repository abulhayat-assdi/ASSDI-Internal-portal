import { describe, it, expect } from "vitest";
import {
    formatDeadline,
    getDeadlineInstant,
    isHomeworkClosed,
    normalizeDeadlineTime,
    todayInDhaka,
} from "./homeworkDeadline";

// Dhaka is UTC+6, so 15:30 there is 09:30Z.
const at = (iso: string) => new Date(iso);

describe("normalizeDeadlineTime", () => {
    it("keeps valid HH:mm and drops everything else", () => {
        expect(normalizeDeadlineTime("15:30")).toBe("15:30");
        expect(normalizeDeadlineTime(" 00:00 ")).toBe("00:00");
        expect(normalizeDeadlineTime("")).toBeNull();
        expect(normalizeDeadlineTime("24:00")).toBeNull();
        expect(normalizeDeadlineTime("9:30")).toBeNull();
        expect(normalizeDeadlineTime(null)).toBeNull();
        expect(normalizeDeadlineTime(1530)).toBeNull();
    });
});

describe("isHomeworkClosed", () => {
    it("with no time, stays open through the whole deadline day (Dhaka)", () => {
        const a = { deadlineDate: "2026-10-20" };
        expect(isHomeworkClosed(a, at("2026-10-20T17:59:00Z"))).toBe(false); // 23:59 Dhaka
        expect(isHomeworkClosed(a, at("2026-10-20T18:00:01Z"))).toBe(true); // 00:00 next day Dhaka
    });

    it("with a time, closes at exactly that minute", () => {
        const a = { deadlineDate: "2026-10-20", deadlineTime: "15:30" };
        expect(isHomeworkClosed(a, at("2026-10-20T09:30:00Z"))).toBe(false); // 15:30:00
        expect(isHomeworkClosed(a, at("2026-10-20T09:30:01Z"))).toBe(true);
        expect(isHomeworkClosed(a, at("2026-10-19T09:30:01Z"))).toBe(false); // day before
    });

    it("treats a null or malformed time as no time", () => {
        expect(isHomeworkClosed({ deadlineDate: "2026-10-20", deadlineTime: null }, at("2026-10-20T12:00:00Z"))).toBe(false);
        expect(isHomeworkClosed({ deadlineDate: "2026-10-20", deadlineTime: "bogus" }, at("2026-10-20T12:00:00Z"))).toBe(false);
    });

    it("never closes on an unparseable date", () => {
        expect(getDeadlineInstant("not-a-date")).toBeNull();
        expect(isHomeworkClosed({ deadlineDate: "not-a-date" })).toBe(false);
    });
});

describe("todayInDhaka", () => {
    it("rolls the date over at 18:00 UTC", () => {
        expect(todayInDhaka(at("2026-10-19T17:59:00Z"))).toBe("2026-10-19");
        expect(todayInDhaka(at("2026-10-19T18:00:00Z"))).toBe("2026-10-20");
    });
});

describe("formatDeadline", () => {
    it("shows the date alone, or with a 12-hour time", () => {
        expect(formatDeadline("2026-10-20")).toBe("2026-10-20");
        expect(formatDeadline("2026-10-20", "15:30")).toBe("2026-10-20, 03:30 PM");
        expect(formatDeadline("2026-10-20", "00:05")).toBe("2026-10-20, 12:05 AM");
        expect(formatDeadline("2026-10-20", "12:00")).toBe("2026-10-20, 12:00 PM");
    });
});
