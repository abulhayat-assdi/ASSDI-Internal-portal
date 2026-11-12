import { describe, expect, it } from "vitest";
import { ALL_BATCHES, normalizeNoticeBatch, studentNoticeBatchFilter } from "./studentNoticeScope";

describe("normalizeNoticeBatch", () => {
    it("treats missing, blank and any-case 'all' as course-wide", () => {
        for (const v of [undefined, null, 42, "", "   ", "all", "ALL", " All "]) {
            expect(normalizeNoticeBatch(v)).toBe(ALL_BATCHES);
        }
    });

    it("trims a real batch name", () => {
        expect(normalizeNoticeBatch("  Batch 12 ")).toBe("Batch 12");
    });
});

describe("studentNoticeBatchFilter", () => {
    it("gives a batch its own notices plus course-wide ones", () => {
        expect(studentNoticeBatchFilter("Batch 12")).toEqual({ in: ["Batch 12", "all"] });
    });

    it("gives a student without a batch only course-wide notices", () => {
        expect(studentNoticeBatchFilter(undefined)).toBe("all");
        expect(studentNoticeBatchFilter(null)).toBe("all");
        expect(studentNoticeBatchFilter("all")).toBe("all");
    });
});
