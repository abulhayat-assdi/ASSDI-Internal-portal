import { describe, expect, it } from "vitest";
import {
  findDuplicateDays,
  normaliseBulkRows,
  normaliseDate,
  normaliseNumber,
  stableStringify,
} from "./competitionBulk";

const schema = [
  { id: "field_date", type: "date", label: "Date", required: true },
  { id: "field_day", type: "short_text", label: "Day Number", required: true, validation: "number" },
  { id: "field_cups", type: "short_text", label: "Total Cups Sold", required: true, validation: "number" },
  { id: "field_rating", type: "rating", label: "Overall Team Performance", required: false },
  { id: "field_summary", type: "long_text", label: "Summary", required: false },
  {
    id: "field_companies",
    type: "repeater",
    label: "Companies",
    required: false,
    subFields: [
      { id: "sub_name", label: "Company", required: true },
      { id: "sub_mobile", label: "Mobile", required: false, validation: "bd_mobile" },
    ],
  },
];

const team = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "team" as const,
  rollNumber: "1226",
  studentName: "Raqib",
  teamName: "Team-4",
  data,
  ...extra,
});

describe("normaliseNumber", () => {
  it("canonicalises padded, comma and Bangla digits", () => {
    expect(normaliseNumber("01")).toBe("1");
    expect(normaliseNumber("00")).toBe("0");
    expect(normaliseNumber(" 1,200 ")).toBe("1200");
    expect(normaliseNumber("১২")).toBe("12");
    expect(normaliseNumber("-250")).toBe("-250");
    expect(normaliseNumber("12.50")).toBe("12.5");
  });
  it("rejects text", () => {
    expect(normaliseNumber("abc")).toBeNull();
    expect(normaliseNumber("12a")).toBeNull();
    expect(normaliseNumber("")).toBeNull();
  });
});

describe("normaliseDate", () => {
  it("accepts ISO and day-first Excel dates", () => {
    expect(normaliseDate("2026-10-11")).toBe("2026-10-11");
    expect(normaliseDate("11/10/2026")).toBe("2026-10-11");
    expect(normaliseDate("1-9-2026")).toBe("2026-09-01");
  });
  it("rejects impossible dates", () => {
    expect(normaliseDate("31/02/2026")).toBeNull();
    expect(normaliseDate("2026-13-01")).toBeNull();
    expect(normaliseDate("yesterday")).toBeNull();
  });
});

describe("normaliseBulkRows", () => {
  it("normalises numbers and dates and drops blanks", () => {
    const { rows, errors } = normaliseBulkRows(schema, [
      team({ field_date: "11/10/2026", field_day: "01", field_cups: "00", field_rating: "4", field_summary: "  " }),
    ]);
    expect(errors).toEqual([]);
    expect(rows[0].data).toEqual({ field_date: "2026-10-11", field_day: "1", field_cups: "0", field_rating: 4 });
    expect(rows[0].reportDate).toBe("2026-10-11");
  });

  it("reports non-numbers, missing required answers and missing team names with the row index", () => {
    const { errors } = normaliseBulkRows(schema, [
      team({ field_date: "2026-10-11", field_day: "1", field_cups: "many" }),
      team({ field_date: "2026-10-11", field_day: "1" }),
      team({ field_date: "2026-10-11", field_day: "1", field_cups: "1" }, { teamName: " " }),
      team({ field_date: "2026-10-11", field_day: "1", field_cups: "1" }, { rollNumber: "" }),
    ]);
    expect(errors.map((e) => e.index)).toEqual([0, 1, 2, 3]);
    expect(errors[0].message).toContain("Total Cups Sold");
    expect(errors[1].message).toContain("Total Cups Sold is required");
    expect(errors[2].message).toContain("Team Name");
  });

  it("validates repeater sub-fields and keeps every item", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ sub_name: `C${i}`, sub_mobile: "01712345678" }));
    const ok = normaliseBulkRows(schema, [team({ field_date: "2026-10-11", field_day: "1", field_cups: "1", field_companies: items })]);
    expect(ok.errors).toEqual([]);
    expect((ok.rows[0].data.field_companies as unknown[]).length).toBe(7);
    const bad = normaliseBulkRows(schema, [
      team({ field_date: "2026-10-11", field_day: "1", field_cups: "1", field_companies: [{ sub_name: "X", sub_mobile: "123" }] }),
    ]);
    expect(bad.errors[0].message).toContain("Mobile");
  });

  it("individual rows never carry a team name", () => {
    const { rows } = normaliseBulkRows(schema, [
      { type: "individual", rollNumber: "1207", data: { field_date: "2026-10-11", field_day: "1", field_cups: "3" }, teamName: "Team-3" },
    ]);
    expect(rows[0].teamName).toBeNull();
  });
});

describe("findDuplicateDays", () => {
  const existing = [
    { id: "a", type: "team", teamName: "Team-4", rollNumber: "1226", reportDate: "2026-10-11", submittedAt: "2026-10-11T10:00:00Z", data: {} },
    { id: "b", type: "team", teamName: "Team-3", rollNumber: "1207", reportDate: "2026-10-11", submittedAt: "2026-10-11T10:00:00Z", data: {} },
  ];
  const row = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    normaliseBulkRows(schema, [team({ field_day: "1", field_cups: "1", ...data }, extra)]).rows;

  it("refuses a second report for the same team and day", () => {
    const errors = findDuplicateDays(schema, existing, row({ field_date: "2026-10-11" }, { teamName: " team-4 " }), []);
    expect(errors).toHaveLength(1);
  });

  it("allows it when the old row is deleted or is the row being edited", () => {
    expect(findDuplicateDays(schema, existing, row({ field_date: "2026-10-11" }), ["a"])).toEqual([]);
    expect(findDuplicateDays(schema, existing, row({ field_date: "2026-10-11" }, { id: "a" }), [])).toEqual([]);
  });

  it("ignores duplicates the save does not touch", () => {
    const dup = [...existing, { ...existing[0], id: "c" }];
    expect(findDuplicateDays(schema, dup, row({ field_date: "2026-10-12" }), [])).toEqual([]);
  });
});

describe("stableStringify", () => {
  it("ignores key order", () => {
    expect(stableStringify({ b: 1, a: [{ y: 2, x: 1 }] })).toBe(stableStringify({ a: [{ x: 1, y: 2 }], b: 1 }));
  });
});
