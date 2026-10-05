import { describe, it, expect } from "vitest";
import { remainingMs, effectiveStatus, canAnswer, speedScaledMarks, compareRank, generateJoinCode, ANSWER_GRACE_MS } from "./live";

const start = new Date("2026-10-05T10:00:00Z");
const q = { status: "QUESTION" as const, questionStartedAt: start, limitSeconds: 20 };
const at = (sec: number) => start.getTime() + sec * 1000;

describe("live clock", () => {
    it("counts down and bottoms out at zero", () => {
        expect(remainingMs(q, at(5))).toBe(15000);
        expect(remainingMs(q, at(25))).toBe(0);
    });
    it("is zero outside the QUESTION state", () => {
        expect(remainingMs({ ...q, status: "REVEAL" }, at(1))).toBe(0);
        expect(remainingMs({ ...q, questionStartedAt: null }, at(1))).toBe(0);
    });
    it("shows an expired question as REVEAL without a host action", () => {
        expect(effectiveStatus(q, at(10))).toBe("QUESTION");
        expect(effectiveStatus(q, at(21))).toBe("REVEAL");
        expect(effectiveStatus({ ...q, status: "LOBBY" }, at(99))).toBe("LOBBY");
    });
    it("accepts answers until the deadline plus grace", () => {
        expect(canAnswer(q, at(19))).toBe(true);
        expect(canAnswer(q, at(20) + ANSWER_GRACE_MS)).toBe(true);
        expect(canAnswer(q, at(20) + ANSWER_GRACE_MS + 1)).toBe(false);
        expect(canAnswer({ ...q, status: "REVEAL" }, at(1))).toBe(false);
    });
});

describe("speedScaledMarks", () => {
    it("gives full marks instantly and half at the buzzer", () => {
        expect(speedScaledMarks(10, 0, 20)).toBe(10);
        expect(speedScaledMarks(10, 20000, 20)).toBe(5);
        expect(speedScaledMarks(10, 10000, 20)).toBe(7.5);
    });
    it("clamps out-of-range response times", () => {
        expect(speedScaledMarks(10, -50, 20)).toBe(10);
        expect(speedScaledMarks(10, 99999, 20)).toBe(5);
    });
});

describe("compareRank / join code", () => {
    it("ranks by score then speed", () => {
        const rows = [
            { n: "slow", score: 10, totalResponseMs: 9000 },
            { n: "fast", score: 10, totalResponseMs: 3000 },
            { n: "top", score: 12, totalResponseMs: 20000 },
        ].sort(compareRank);
        expect(rows.map((r) => r.n)).toEqual(["top", "fast", "slow"]);
    });
    it("generates a 6-digit code", () => {
        for (let i = 0; i < 50; i++) expect(generateJoinCode()).toMatch(/^[1-9]\d{5}$/);
    });
});
