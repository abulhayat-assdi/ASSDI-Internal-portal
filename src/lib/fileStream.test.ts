import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseRange } from "./fileStream";

describe("parseRange", () => {
    it("serves the whole file without a usable header", () => {
        expect(parseRange(null, 100)).toBeNull();
        expect(parseRange("bytes=0-1,5-9", 100)).toBeNull();
        expect(parseRange("items=0-1", 100)).toBeNull();
    });
    it("parses open, closed and suffix ranges", () => {
        expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
        expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
        expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
        expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    });
    it("flags ranges past the end", () => {
        expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
        expect(parseRange("bytes=50-10", 100)).toBe("unsatisfiable");
        expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
    });
});
