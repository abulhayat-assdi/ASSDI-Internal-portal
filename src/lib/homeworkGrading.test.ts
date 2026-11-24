import { describe, expect, it } from "vitest";
import {
    buildMarksExportRows,
    compareRoll,
    gradeStatus,
    hideUnreturnedGrade,
    officeViewerLimitBytes,
    parseMarks,
    parseTotalMarks,
    submissionsOverTotal,
    viewerKind,
} from "./homeworkGrading";

const sub = (over: Record<string, unknown> = {}) => ({
    id: "s1", studentName: "Abdus", studentRoll: "3", studentBatchName: "B1",
    marks: null as number | null, feedback: null as string | null, returnedAt: null as string | null,
    ...over,
});

describe("parseTotalMarks", () => {
    it("accepts any positive total such as 20 or 30", () => {
        expect(parseTotalMarks("20")).toEqual({ ok: true, value: 20 });
        expect(parseTotalMarks(30)).toEqual({ ok: true, value: 30 });
        expect(parseTotalMarks("12.5")).toEqual({ ok: true, value: 12.5 });
    });
    it("rejects zero, negatives, junk, huge and 3-decimal totals", () => {
        for (const v of ["0", -5, "abc", "", 1001, "10.555", null]) expect(parseTotalMarks(v).ok).toBe(false);
    });
});

describe("parseMarks", () => {
    it("allows 0..total and clearing", () => {
        expect(parseMarks("0", 20)).toEqual({ ok: true, value: 0 });
        expect(parseMarks("20", 20)).toEqual({ ok: true, value: 20 });
        expect(parseMarks("7.5", 20)).toEqual({ ok: true, value: 7.5 });
        expect(parseMarks("", 20)).toEqual({ ok: true, value: null });
        expect(parseMarks(null, 20)).toEqual({ ok: true, value: null });
    });
    it("rejects marks above the total or below zero", () => {
        expect(parseMarks("21", 20).ok).toBe(false);
        expect(parseMarks(-1, 20).ok).toBe(false);
        expect(parseMarks("x", 20).ok).toBe(false);
    });
});

describe("gradeStatus", () => {
    it("uses marks when marks are on, feedback when off", () => {
        expect(gradeStatus(sub(), true)).toBe("not_graded");
        expect(gradeStatus(sub({ marks: 0 }), true)).toBe("graded");
        expect(gradeStatus(sub({ feedback: "good" }), true)).toBe("not_graded");
        expect(gradeStatus(sub({ feedback: "good" }), false)).toBe("graded");
        expect(gradeStatus(sub({ returnedAt: "2026-01-01" }), true)).toBe("returned");
    });
});

describe("submissionsOverTotal", () => {
    it("names who would exceed a lowered total", () => {
        const list = [sub({ id: "a", marks: 15 }), sub({ id: "b", marks: 8 }), sub({ id: "c" })];
        expect(submissionsOverTotal(list, 10).map((s) => s.id)).toEqual(["a"]);
    });
});

describe("hideUnreturnedGrade", () => {
    it("hides marks and feedback until returned", () => {
        expect(hideUnreturnedGrade(sub({ marks: 9, feedback: "x" }))).toMatchObject({ marks: null, feedback: null });
        expect(hideUnreturnedGrade(sub({ marks: 9, feedback: "x", returnedAt: "now" }))).toMatchObject({ marks: 9, feedback: "x" });
    });
});

describe("buildMarksExportRows", () => {
    it("sorts by batch then numeric roll and carries title and total", () => {
        const rows = buildMarksExportRows("HW 1", 30, [
            sub({ id: "1", studentRoll: "10", studentName: "Ten", marks: 25, returnedAt: "x" }),
            sub({ id: "2", studentRoll: "2", studentName: "Two", marks: 18 }),
            sub({ id: "3", studentRoll: "5", studentName: "Five" }),
        ]);
        expect(rows.map((r) => r.Roll)).toEqual(["2", "5", "10"]);
        expect(rows[0]).toMatchObject({ Name: "Two", Homework: "HW 1", Marks: 18, Total: 30, Status: "Graded (not returned)" });
        expect(rows[1].Marks).toBe("");
        expect(rows[2].Status).toBe("Returned");
    });
    it("keeps one row per student, preferring the graded submission", () => {
        const rows = buildMarksExportRows("HW", 10, [
            sub({ id: "old", marks: 7, submittedAt: "2026-01-01" }),
            sub({ id: "new", submittedAt: "2026-01-02" }),
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].Marks).toBe(7);
    });
});

describe("compareRoll", () => {
    it("orders numerically", () => {
        expect(["10", "2", "1"].sort(compareRoll)).toEqual(["1", "2", "10"]);
    });
});

describe("viewerKind", () => {
    it("maps files to the inline viewer", () => {
        expect(viewerKind("a.PDF")).toBe("pdf");
        expect(viewerKind("photo.jpeg")).toBe("image");
        expect(viewerKind("clip.mp4")).toBe("video");
        expect(viewerKind("report.docx")).toBe("office");
        expect(viewerKind("sheet.xls")).toBe("office");
        expect(viewerKind("page.html")).toBe("html");
        expect(viewerKind("notes.md")).toBe("text");
        expect(viewerKind("bundle.zip")).toBe("other");
        expect(viewerKind("noext")).toBe("other");
    });
    it("applies Microsoft's size limits", () => {
        expect(officeViewerLimitBytes("a.xlsx")).toBe(5 * 1024 * 1024);
        expect(officeViewerLimitBytes("a.pptx")).toBe(10 * 1024 * 1024);
    });
});
