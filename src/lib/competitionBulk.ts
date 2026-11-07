// Validation and normalisation for the staff "Manage Responses" grid of a
// form competition. Pure functions: the bulk API route runs them inside its
// transaction, and the grid runs the same checks before sending.

import { getDateFieldId, isValidReportDate, toReportDate, validateField } from "./competitions";

export type BulkRowType = "team" | "individual";

export interface BulkRowInput {
  id?: string;
  type: BulkRowType;
  rollNumber: string;
  studentName?: string | null;
  teamName?: string | null;
  data: Record<string, unknown>;
  /** Stable JSON of the row's data as the grid loaded it (existing rows only). */
  expected?: string;
}

export interface BulkRowError {
  index: number;
  id?: string;
  type: BulkRowType;
  rollNumber: string;
  message: string;
}

export interface NormalisedRow {
  index: number;
  id?: string;
  type: BulkRowType;
  rollNumber: string;
  studentName: string;
  teamName: string | null;
  data: Record<string, unknown>;
  reportDate: string | null;
  expected?: string;
}

export interface ExistingSubmission {
  id: string;
  type: string;
  teamName: string | null;
  rollNumber: string;
  reportDate: string | null;
  submittedAt: Date | string;
  data: unknown;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bangla digits → ASCII, so "১২" typed on a Bangla keyboard is still a number. */
export function asciiDigits(v: string): string {
  return v.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Canonical number text: "01" → "1", "00" → "0", "1,200" → "1200", " 5 " → "5".
 * Returns null when the text is not a number.
 */
export function normaliseNumber(raw: unknown): string | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : null;
  const text = asciiDigits(String(raw ?? "")).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return String(Number(text));
}

/**
 * Accepts YYYY-MM-DD, and the day-first forms people paste from Excel in
 * Bangladesh (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY). Returns YYYY-MM-DD or null.
 */
export function normaliseDate(raw: unknown): string | null {
  const text = asciiDigits(String(raw ?? "")).trim();
  if (!text) return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  const out = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidReportDate(out) ? out : null;
}

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const isNumberField = (field: any) =>
  field?.type === "rating" || field?.type === "number" || field?.validation === "number";

/** JSON with sorted keys, so jsonb's reordering does not look like a change. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Normalises one field's answer; returns [value | undefined (drop), error | null]. */
function normaliseAnswer(field: any, value: unknown): [unknown, string | null] {
  if (field.type === "repeater") {
    if (!Array.isArray(value)) return [undefined, null];
    const items: Record<string, unknown>[] = [];
    for (let i = 0; i < value.length; i++) {
      const item: Record<string, unknown> = {};
      for (const sub of field.subFields || []) {
        const v = (value[i] as any)?.[sub.id];
        if (isBlank(v)) continue;
        if (isNumberField(sub)) {
          const n = normaliseNumber(v);
          if (n === null) return [undefined, `${field.label} [${i + 1}] - ${sub.label}: enter a number ("${v}" is not valid).`];
          item[sub.id] = n;
        } else {
          item[sub.id] = String(v).trim();
        }
      }
      if (Object.keys(item).length) items.push(item);
    }
    return [items.length ? items : undefined, null];
  }
  if (isBlank(value)) return [undefined, null];
  if (field.type === "date") {
    const d = normaliseDate(value);
    return d ? [d, null] : [undefined, `${field.label}: enter the date as YYYY-MM-DD or DD/MM/YYYY ("${value}" is not valid).`];
  }
  if (isNumberField(field)) {
    const n = normaliseNumber(value);
    if (n === null) return [undefined, `${field.label}: enter a number ("${value}" is not valid).`];
    return [field.type === "rating" ? Number(n) : n, null];
  }
  return [typeof value === "string" ? value.trim() : value, null];
}

/** Validates and normalises the rows the grid changed or added. */
export function normaliseBulkRows(
  schema: unknown,
  rows: BulkRowInput[],
): { rows: NormalisedRow[]; errors: BulkRowError[] } {
  const fields: any[] = Array.isArray(schema) ? schema : [];
  const dateField = getDateFieldId(schema);
  const out: NormalisedRow[] = [];
  const errors: BulkRowError[] = [];

  rows.forEach((row, index) => {
    const type: BulkRowType = row?.type === "team" ? "team" : "individual";
    const rollNumber = asciiDigits(String(row?.rollNumber ?? "")).trim();
    const fail = (message: string) => errors.push({ index, id: row?.id, type, rollNumber, message });

    if (row?.type !== "team" && row?.type !== "individual") return fail("Row type (team/individual) is missing.");
    if (!rollNumber) return fail("Enter a roll number.");
    const teamName = type === "team" ? String(row.teamName ?? "").trim() : "";
    if (type === "team" && !teamName) return fail("Team name is required on the team-wise sheet.");

    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const [value, error] = normaliseAnswer(field, row.data?.[field.id]);
      if (error) return fail(error);
      if (value !== undefined) data[field.id] = value;
      const requiredError = validateField(field, data[field.id]);
      if (requiredError) return fail(requiredError);
    }

    out.push({
      index,
      id: row.id || undefined,
      type,
      rollNumber,
      studentName: String(row.studentName ?? "").trim() || "N/A",
      teamName: type === "team" ? teamName : null,
      data,
      reportDate: dateField && typeof data[dateField] === "string" ? (data[dateField] as string) : null,
      expected: row.expected,
    });
  });

  return { rows: out, errors };
}

const teamKey = (name: string | null | undefined) => (name || "").trim().toLowerCase().replace(/\s+/g, " ");

/** One report per team per day, and one per student per day on the individual sheet. */
export function dayKey(row: { type: string; teamName: string | null; rollNumber: string }, date: string): string {
  return row.type === "team" ? `team|${teamKey(row.teamName)}|${date}` : `ind|${row.rollNumber.trim()}|${date}`;
}

/**
 * Finds the changed rows that would leave two reports for the same team (or
 * student) on the same day once saved. Duplicates that already existed and
 * that this save does not touch are not reported.
 */
export function findDuplicateDays(
  schema: unknown,
  existing: ExistingSubmission[],
  changed: NormalisedRow[],
  deletedIds: string[],
): BulkRowError[] {
  const changedById = new Map(changed.filter((r) => r.id).map((r) => [r.id!, r]));
  const deleted = new Set(deletedIds);
  const owners = new Map<string, { changed?: NormalisedRow }[]>();
  const add = (key: string, entry: { changed?: NormalisedRow }) => {
    const list = owners.get(key) ?? [];
    list.push(entry);
    owners.set(key, list);
  };

  const dateField = getDateFieldId(schema);
  for (const sub of existing) {
    if (deleted.has(sub.id) || changedById.has(sub.id)) continue;
    const answered = dateField ? (sub.data as any)?.[dateField] : null;
    const date = isValidReportDate(sub.reportDate)
      ? sub.reportDate
      : isValidReportDate(answered)
        ? answered
        : toReportDate(sub.submittedAt);
    const type = sub.type === "team" || (sub.teamName || "").trim() ? "team" : "individual";
    add(dayKey({ type, teamName: sub.teamName, rollNumber: sub.rollNumber }, date), {});
  }
  for (const row of changed) {
    if (!row.reportDate) continue;
    add(dayKey(row, row.reportDate), { changed: row });
  }

  const errors: BulkRowError[] = [];
  for (const list of owners.values()) {
    if (list.length < 2) continue;
    for (const entry of list) {
      const row = entry.changed;
      if (!row) continue;
      errors.push({
        index: row.index,
        id: row.id,
        type: row.type,
        rollNumber: row.rollNumber,
        message:
          row.type === "team"
            ? `${row.teamName} already has a report for ${row.reportDate}. Only one row per day is allowed.`
            : `Roll ${row.rollNumber} already has a report for ${row.reportDate}. Only one row per day is allowed.`,
      });
    }
  }
  return errors;
}
