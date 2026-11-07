// HTTP check of the staff "Manage Responses" grid save against the disposable
// preview (npm run incubation:preview). Fixed localhost port; no production data.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const config = JSON.parse(readFileSync(".incubation-test/preview.json", "utf8"));
const base = "http://127.0.0.1:3105";
const call = async (url, token, body, method = body ? "POST" : "GET") => {
  const r = await fetch(base + url, {
    method,
    headers: {
      host: "incubation.localhost:3105",
      "x-forwarded-host": "incubation.localhost:3105",
      cookie: `__session=${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const admin = config.adminToken;
const schema = [
  { id: "field_date", type: "date", label: "Date", required: true, validation: "none" },
  { id: "field_day", type: "short_text", label: "Day Number", required: true, validation: "number" },
  { id: "field_sales", type: "short_text", label: "Total Sales (Tk)", required: true, validation: "number" },
];
const created = await call("/api/competitions", admin, {
  title: `Grid check ${Date.now()}`,
  batchName: "Sales Batch 12",
  schema,
});
assert.equal(created.status, 200, JSON.stringify(created.body));
const id = created.body.id;
const bulk = (payload) => call(`/api/competitions/${id}/submit/bulk`, admin, payload);
const report = async () => (await call(`/api/competitions/${id}/report`, admin)).body;
const subs = async () => {
  const r = await report();
  return r.submissions || r.competition?.submissions || [];
};
const team = (data, extra = {}) => ({
  type: "team",
  rollNumber: "1",
  studentName: "Team Leader",
  teamName: "Team-1",
  data,
  ...extra,
});

// 1. One bad row rejects the whole save, with a per-row error.
let r = await bulk({
  submissions: [
    team({ field_date: "2026-10-11", field_day: "01", field_sales: "250" }),
    team({ field_date: "2026-10-12", field_day: "2", field_sales: "many" }),
  ],
});
assert.equal(r.status, 400);
assert.equal(r.body.rowErrors.length, 1);
assert.equal(r.body.rowErrors[0].index, 1);
assert.equal((await subs()).length, 0, "nothing may be saved when one row is invalid");

// 2. Valid rows save, normalised ("01" -> "1", "1,200" -> "1200", DD/MM/YYYY -> ISO).
r = await bulk({
  submissions: [
    team({ field_date: "11/10/2026", field_day: "01", field_sales: "1,200" }),
    team({ field_date: "2026-10-12", field_day: "2", field_sales: "300" }, { teamName: "Team-2", rollNumber: "3" }),
  ],
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.equal(r.body.created, 2);
let rows = await subs();
const first = rows.find((s) => s.teamName === "Team-1");
assert.deepEqual(first.data, { field_date: "2026-10-11", field_day: "1", field_sales: "1200" });
assert.equal(first.reportDate, "2026-10-11");

// 3. A second report for the same team and day is refused.
r = await bulk({ submissions: [team({ field_date: "2026-10-11", field_day: "1", field_sales: "5" }, { teamName: " team-1 " })] });
assert.equal(r.status, 400);
assert.match(r.body.rowErrors[0].message, /already has a report/);

// 4. An edit based on stale data is refused with 409.
r = await bulk({
  submissions: [team({ field_date: "2026-10-11", field_day: "1", field_sales: "999" }, { id: first.id, expected: "{}" })],
});
assert.equal(r.status, 409);

// 5. Update with the correct baseline, and delete the other row.
const stable = (v) =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`
      : JSON.stringify(v ?? null);
const other = rows.find((s) => s.teamName === "Team-2");
r = await bulk({
  submissions: [team({ field_date: "2026-10-11", field_day: "1", field_sales: "1300" }, { id: first.id, expected: stable(first.data) })],
  deletedIds: [other.id],
});
assert.equal(r.status, 200, JSON.stringify(r.body));
assert.deepEqual([r.body.updated, r.body.deleted], [1, 1]);
rows = await subs();
assert.equal(rows.length, 1);
assert.equal(rows[0].data.field_sales, "1300");

// 6. Students cannot use the staff grid.
assert.equal((await call(`/api/competitions/${id}/submit/bulk`, config.studentToken, { submissions: [] })).status, 403);

console.log("Form grid: atomic validation, normalisation, duplicate-day, stale-edit, update/delete and access checks passed.");
