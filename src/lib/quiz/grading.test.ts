import { describe, it, expect } from "vitest";
import { gradeAnswer, computeAttemptTotals, type GradableQuestion, type GradedAnswer } from "./grading";

const singleChoice: GradableQuestion = {
    id: "q1",
    type: "SINGLE_CHOICE",
    marks: 2,
    options: [
        { id: "a", textHtml: "A", isCorrect: false },
        { id: "b", textHtml: "B", isCorrect: true },
        { id: "c", textHtml: "C", isCorrect: false },
    ],
};

const multiChoice: GradableQuestion = {
    id: "q2",
    type: "MULTI_CHOICE",
    marks: 4,
    options: [
        { id: "a", textHtml: "A", isCorrect: true },
        { id: "b", textHtml: "B", isCorrect: true },
        { id: "c", textHtml: "C", isCorrect: false },
    ],
};

const shortAnswer: GradableQuestion = {
    id: "q3",
    type: "SHORT_ANSWER",
    marks: 5,
    options: [],
};

describe("gradeAnswer — SINGLE_CHOICE", () => {
    it("awards full marks for the exact correct option", () => {
        expect(gradeAnswer(singleChoice, ["b"], 0)).toEqual({ isCorrect: true, marksAwarded: 2 });
    });

    it("awards zero for a wrong option when negative marking is off", () => {
        expect(gradeAnswer(singleChoice, ["a"], 0)).toEqual({ isCorrect: false, marksAwarded: 0 });
    });

    it("does not penalize an unanswered question even with negative marking on", () => {
        expect(gradeAnswer(singleChoice, [], 0.5)).toEqual({ isCorrect: false, marksAwarded: 0 });
    });

    it("applies the negative mark for an attempted wrong answer", () => {
        expect(gradeAnswer(singleChoice, ["a"], 0.5)).toEqual({ isCorrect: false, marksAwarded: -0.5 });
    });

    it("treats selecting more than one option as wrong", () => {
        expect(gradeAnswer(singleChoice, ["a", "b"], 0)).toEqual({ isCorrect: false, marksAwarded: 0 });
    });
});

describe("gradeAnswer — MULTI_CHOICE (all-or-nothing)", () => {
    it("awards full marks only when the selected set exactly matches the correct set", () => {
        expect(gradeAnswer(multiChoice, ["a", "b"], 0)).toEqual({ isCorrect: true, marksAwarded: 4 });
    });

    it("gives zero for a partially-correct selection — no partial credit", () => {
        expect(gradeAnswer(multiChoice, ["a"], 0)).toEqual({ isCorrect: false, marksAwarded: 0 });
    });

    it("gives zero when a correct option is missing", () => {
        expect(gradeAnswer(multiChoice, ["a", "c"], 0)).toEqual({ isCorrect: false, marksAwarded: 0 });
    });
});

describe("gradeAnswer — SHORT_ANSWER", () => {
    it("is never auto-graded, regardless of what was submitted", () => {
        expect(gradeAnswer(shortAnswer, [], 0)).toEqual({ isCorrect: null, marksAwarded: 0 });
    });
});

describe("computeAttemptTotals", () => {
    it("sums marks and computes percentage against total marks", () => {
        const answers = new Map<string, GradedAnswer>([
            ["q1", { isCorrect: true, marksAwarded: 2 }],
            ["q2", { isCorrect: false, marksAwarded: 0 }],
        ]);
        const totals = computeAttemptTotals([singleChoice, multiChoice], answers, 50);
        expect(totals.score).toBe(2);
        expect(totals.totalMarks).toBe(6);
        expect(totals.percentage).toBeCloseTo(33.33, 1);
        expect(totals.passed).toBe(false);
        expect(totals.hasUngraded).toBe(false);
    });

    it("clamps percentage to 0 when negative marking pushes the raw score below zero", () => {
        const answers = new Map<string, GradedAnswer>([["q1", { isCorrect: false, marksAwarded: -0.5 }]]);
        const totals = computeAttemptTotals([singleChoice], answers, 50);
        expect(totals.score).toBe(-0.5);
        expect(totals.percentage).toBe(0);
    });

    it("leaves passed as null while any short-answer question is ungraded", () => {
        const answers = new Map<string, GradedAnswer>([
            ["q1", { isCorrect: true, marksAwarded: 2 }],
            ["q3", { isCorrect: null, marksAwarded: 0 }],
        ]);
        const totals = computeAttemptTotals([singleChoice, shortAnswer], answers, 50);
        expect(totals.hasUngraded).toBe(true);
        expect(totals.passed).toBeNull();
    });

    it("leaves passed as null when the quiz has no pass threshold configured", () => {
        const answers = new Map<string, GradedAnswer>([["q1", { isCorrect: true, marksAwarded: 2 }]]);
        const totals = computeAttemptTotals([singleChoice], answers, null);
        expect(totals.passed).toBeNull();
    });

    it("does not penalize an unanswered question in the totals", () => {
        const totals = computeAttemptTotals([singleChoice, multiChoice], new Map(), 50);
        expect(totals.score).toBe(0);
        expect(totals.totalMarks).toBe(6);
        expect(totals.hasUngraded).toBe(false);
    });
});
