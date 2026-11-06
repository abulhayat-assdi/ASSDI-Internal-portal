// Fixed localhost ports only: disposable dev preview or isolated Docker review.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const containerMode = process.env.INCUBATION_CONTAINER_TEST === "1";
const port = containerMode ? 3106 : 3105;
const configPath = `.incubation-test/${containerMode ? "container-preview" : "preview"}.json`;
const config = JSON.parse(readFileSync(configPath, "utf8"));
assert.equal(config.origin, `http://incubation.localhost:${port}`);
const base = `http://127.0.0.1:${port}`;
const headers = {
  host: `incubation.localhost:${port}`,
  "x-forwarded-host": `incubation.localhost:${port}`,
  cookie: `__session=${config.adminToken}`,
};
const request = async (url, options = {}) => {
  const r = await fetch(`${base}${url}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const d = await r.json();
  assert.ok(r.ok, `${url}: ${JSON.stringify(d)}`);
  return d;
};
const initial = await request("/api/incubation");
assert.equal(initial.manager, true);
assert.ok(initial.batches.length);
let programId = "";
const command = async (action, payload, token) =>
  request("/api/incubation", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `__session=${token}` } : {}),
    },
    body: JSON.stringify({
      action,
      programId: programId || undefined,
      payload,
    }),
  });
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
}).format(new Date());
programId = (
  await command("program", {
    name: "Business Incubation — Market Lab",
    description: "বাস্তব ব্যবসার অভিজ্ঞতা, সঠিক হিসাব ও শেখার ড্যাশবোর্ড",
    startDate: "2026-01-01",
    endDate: null,
    status: "active",
    batchNames: ["Sales Batch 12"],
    staffIds: [],
    settings: {
      sprintDays: 4,
      enforceCategory: false,
      maxFieldHours: null,
      trackingMinutes: 5,
      retentionDays: 30,
      expenseTypes: ["Transportation", "Packaging", "Marketing"],
    },
  })
).id;
const team = (
  await command("team", {
    name: "Team Horizon",
    studentIds: ["student-1", "student-2"],
    leadId: "student-1",
    active: true,
  })
).id;
const target = (
  await command("team", {
    name: "Team Momentum",
    studentIds: ["student-3"],
    leadId: "student-3",
    active: true,
  })
).id;
const category = (
  await command("catalog", {
    kind: "category",
    name: "Daily Essentials",
    parentId: null,
    unit: "piece",
    fractional: false,
    active: true,
  })
).id;
const area = (
  await command("catalog", {
    kind: "area",
    name: "উত্তর বাড্ডা",
    parentId: null,
    unit: "piece",
    fractional: false,
    active: true,
  })
).id;
const product = (
  await command("catalog", {
    kind: "product",
    name: "Notebook Set",
    parentId: category,
    unit: "set",
    fractional: false,
    active: true,
  })
).id;
await command("sprint", {
  teamId: team,
  categoryId: category,
  startDate: today,
  endDate: today,
});
const form = new FormData();
form.set("programId", programId);
form.set("teamId", team);
form.set(
  "file",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1sAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "fixture-voucher.png",
);
const voucher = (
  await request("/api/incubation/files", { method: "POST", body: form })
).id;
const privateFile = await fetch(`${base}/api/incubation/files/${voucher}`, {
  headers,
});
assert.equal(privateFile.status, 200);
assert.equal(privateFile.headers.get("cache-control"), "private, no-store");
const anonymousFile = await fetch(`${base}/api/incubation/files/${voucher}`, {
  headers: {
    host: headers.host,
    "x-forwarded-host": headers["x-forwarded-host"],
  },
});
assert.equal(anonymousFile.status, 401);
const entry = async (kind, data, extra = {}) =>
  command(
    "record",
    {
      teamId: team,
      kind,
      date: today,
      requestKey: crypto.randomUUID(),
      data,
      ...extra,
    },
    config.studentToken,
  );
await command("record", {
  teamId: team,
  kind: "fund",
  date: today,
  requestKey: crypto.randomUUID(),
  data: { amount: "5000" },
});
await entry("purchase", {
  lines: [{ productId: product, quantity: "10", unitPrice: "100" }],
  voucherId: voucher,
});
const sale = await entry("sale", {
  lines: [{ productId: product, quantity: "6", unitPrice: "150" }],
  areaId: area,
});
await entry("expense", {
  amount: "100",
  expenseType: "Transportation",
  note: "Field transport",
});
await entry("fgd", {
  findings: [
    "ক্রেতারা প্যাকেজিং দেখেন",
    "স্টুডেন্টদের চাহিদা বেশি",
    "দাম নিয়ে প্রশ্ন হয়",
  ],
  actions: ["প্যাকেজিং উন্নত করা", "নতুন সেগমেন্টে চেষ্টা", "মূল্য বোঝানো"],
});
await entry("insight", {
  segment: "Students",
  objections: "Price comparison",
  whyBought: "Useful bundle",
  bestArea: "উত্তর বাড্ডা",
  areaId: area,
});
await entry(
  "transfer",
  {
    lines: [{ productId: product, quantity: "1", unitPrice: "100" }],
    reason: "Sprint handover",
  },
  { targetTeamId: target },
);
const correction = await command(
  "correct",
  {
    recordId: sale.id,
    version: 1,
    date: today,
    data: {
      lines: [{ productId: product, quantity: "5", unitPrice: "150" }],
      areaId: area,
    },
    reason: "Recheck quantity from voucher",
    void: false,
  },
  config.studentToken,
);
const bundle = await request(`/api/incubation?programId=${programId}`);
assert.equal(
  bundle.ledger.summaries.find((s) => s.teamId === team).cash,
  480000,
);
assert.equal(bundle.corrections[0].status, "pending");
for (const format of ["xlsx", "pdf"]) {
  const r = await fetch(
    `${base}/api/incubation/export?programId=${programId}&format=${format}`,
    { headers },
  );
  if (!r.ok) throw Error(await r.text());
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.ok(bytes.length > 1000);
  assert.ok(
    format === "xlsx"
      ? bytes.slice(0, 2).toString() === "PK"
      : bytes.slice(0, 4).toString() === "%PDF",
  );
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    assert.ok(wb.getWorksheet("Audit History"));
    assert.ok(wb.getWorksheet("Overall Results"));
    assert.equal(
      wb.getWorksheet("Team Summary").getRow(2).getCell(2).value,
      900,
    );
    for (const ws of wb.worksheets)
      ws.eachRow((row) =>
        row.eachCell((cell) =>
          assert.notEqual(cell.type, ExcelJS.ValueType.Formula),
        ),
      );
  }
  writeFileSync(`.incubation-test/report.${format}`, bytes);
}
const share = await command("share", { enabled: true });
const publicData = await request(`/api/incubation/public/${share.token}`);
assert.ok(!JSON.stringify(publicData).includes(voucher));
assert.equal(
  publicData.areas.some((a) => a.id === area),
  true,
);
assert.ok(Array.isArray(publicData.sprints));
assert.equal(
  (await request(`/api/incubation/public/${share.token}?areaId=${area}`)).totals
    .revenue,
  90000,
);
for (const [scope, person] of [
  ["sale", ""],
  ["learning", bundle.records.find((r) => r.kind === "fgd").enteredBy],
  ["field", "missing-person"],
]) {
  const r = await fetch(
    `${base}/api/incubation/export?programId=${programId}&format=xlsx&sheet=${scope}&personId=${person}`,
    { headers },
  );
  assert.ok(r.ok, await r.clone().text());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  assert.equal(wb.getWorksheet("Overall Results"), undefined);
  assert.ok(
    wb.getWorksheet(
      scope === "learning"
        ? "fgd"
        : scope === "field"
          ? "Field Sessions"
          : "sale",
    ),
  );
  if (scope === "field")
    assert.equal(wb.getWorksheet("Field Sessions").rowCount, 1);
  if (scope === "learning") assert.equal(wb.getWorksheet("fgd").rowCount, 2);
}
config.competitionId = bundle.program.competitionId;
config.targetTeamId = target;
config.areaId = area;
config.programId = programId;
config.teamId = team;
config.productId = product;
config.publicToken = share.token;
config.correctionId = correction.id;
config.voucherId = voucher;
writeFileSync(configPath, JSON.stringify(config));
console.log(
  "HTTP workflows, filtered bundle, private evidence, public projection and real Excel/PDF downloads passed.",
);
