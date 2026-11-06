import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
// Every run gets fresh stock and money; repeated browser checks never exhaust a prior fixture.
execFileSync(process.execPath, ["test/incubation-http.mjs"], {
  stdio: "inherit",
});
execFileSync(process.execPath, ["test/incubation-access-http.mjs"], {
  stdio: "inherit",
});
const container = process.env.INCUBATION_CONTAINER_TEST === "1";
const c = JSON.parse(
  fs.readFileSync(
    ".incubation-test/" +
      (container ? "container-preview" : "preview") +
      ".json",
    "utf8",
  ),
);
assert.equal(
  c.origin,
  "http://incubation.localhost:" + (container ? 3106 : 3105),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.INCUBATION_BROWSER_CHANNEL
    ? { channel: process.env.INCUBATION_BROWSER_CHANNEL }
    : {}),
});
const errors = [];
async function account(token, mobile = false) {
  const ctx = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1080 },
  });
  await ctx.addCookies([
    {
      name: "__session",
      value: token,
      domain: "incubation.localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return { ctx, p };
}
const admin = await account(c.adminToken);
await admin.p.goto(c.origin + "/dashboard/competitions");
await admin.p
  .getByRole("heading", { name: "Competitions", exact: true })
  .waitFor();
await admin.p
  .getByRole("heading", {
    name: "Business Incubation — Market Lab",
    exact: true,
  })
  .first()
  .waitFor();
assert.equal(
  await admin.p
    .locator("aside")
    .getByRole("link", { name: "Business Incubation", exact: true })
    .count(),
  0,
);
await admin.p.screenshot({
  path: ".incubation-test/competition-hub.png",
  fullPage: true,
});
await admin.p.goto(c.origin + "/dashboard/competitions/" + c.competitionId);
await admin.p.getByRole("button", { name: "সেটআপ", exact: true }).waitFor();
await admin.p.screenshot({
  path: ".incubation-test/admin-workspace.png",
  fullPage: true,
});
await admin.p.getByRole("button", { name: "হিসাব যাচাই", exact: true }).click();
await admin.p
  .getByRole("heading", { name: "Reconciliation ও করণীয়" })
  .waitFor();
await admin.ctx.close();

const member = await account(c.memberToken, true);
await member.ctx.grantPermissions(["geolocation"], { origin: c.origin });
await member.ctx.setGeolocation({
  latitude: 23.8,
  longitude: 90.4,
  accuracy: 12,
});
await member.p.goto(c.origin + "/student-dashboard/competitions");
await member.p
  .getByRole("heading", { name: "Competitions", exact: true })
  .waitFor();
await member.p.goto(
  c.origin + "/student-dashboard/competitions/" + c.competitionId,
);
await member.p
  .getByRole("heading", { name: "আমার কাজ", exact: true })
  .waitFor();
assert.equal(
  await member.p
    .getByRole("button", { name: "বিক্রি এন্ট্রি", exact: true })
    .count(),
  0,
);
assert.equal(
  await member.p.getByRole("button", { name: "সেটআপ", exact: true }).count(),
  0,
);
await member.p.screenshot({
  path: ".incubation-test/member-home.png",
  fullPage: true,
});
assert.equal(
  await member.p
    .locator(".inc")
    .evaluate((e) => e.scrollWidth > e.clientWidth + 2),
  false,
);
await member.p
  .getByRole("button", { name: "আমার মাঠের কাজ", exact: true })
  .click();
await member.p
  .getByLabel("কাজের ব্রড এরিয়া", { exact: true })
  .selectOption(c.areaId);
if (
  await member.p
    .getByRole("button", { name: "Check-out করুন", exact: true })
    .count()
) {
  await member.p
    .getByRole("button", { name: "Check-out করুন", exact: true })
    .click();
  await member.p
    .getByRole("heading", { name: "মাঠে কাজ শুরু করুন", exact: true })
    .waitFor();
}
await member.p
  .getByRole("button", { name: "GPS দিয়ে Check-in করুন", exact: true })
  .click();
await member.p
  .getByRole("heading", { name: "আপনার মাঠ সেশন চলছে", exact: true })
  .waitFor();
await member.p.getByLabel("হাঁটার স্টেপ", { exact: true }).fill("3456");
const proofResponse = member.p.waitForResponse(
  (r) =>
    r.url().includes("/api/incubation/files") &&
    r.request().method() === "POST",
);
await member.p.getByLabel("Pedometer proof", { exact: true }).setInputFiles({
  name: "pedometer.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOEsAAAAASUVORK5CYII=",
    "base64",
  ),
});
const proofResult = await proofResponse;
assert.equal(proofResult.status(), 200, await proofResult.text());
await member.p
  .getByRole("button", { name: "Check-out করুন", exact: true })
  .click();
await member.p
  .getByRole("heading", { name: "মাঠে কাজ শুরু করুন", exact: true })
  .waitFor();
await member.p.screenshot({
  path: ".incubation-test/member-field.png",
  fullPage: true,
});
await member.ctx.close();

const lead = await account(c.studentToken, true);
await lead.p.goto(
  c.origin + "/student-dashboard/competitions/" + c.competitionId,
);
await lead.p
  .getByRole("heading", { name: "আমাদের টিম পরিচালনা", exact: true })
  .waitFor();
await lead.p.screenshot({
  path: ".incubation-test/leader-home.png",
  fullPage: true,
});
await lead.p
  .getByRole("button", { name: "বিক্রি এন্ট্রি", exact: true })
  .click();
const sale = lead.p.locator("form.inc-modal");
await sale
  .getByLabel("পণ্য / ভ্যারিয়েন্ট", { exact: true })
  .selectOption(c.productId);
await sale.getByLabel("পরিমাণ", { exact: true }).fill("1");
await sale.getByLabel("বিক্রয় মূল্য / একক", { exact: true }).fill("150");
await sale.getByLabel("ব্রড এরিয়া", { exact: true }).selectOption(c.areaId);
if (
  (await sale
    .getByLabel("বিক্রির session", { exact: true })
    .locator("option")
    .count()) > 1
)
  await sale
    .getByLabel("বিক্রির session", { exact: true })
    .selectOption({ index: 1 });
await lead.p.screenshot({
  path: ".incubation-test/leader-sale.png",
  fullPage: true,
});
const submitted = lead.p.waitForResponse(
  (r) => r.url().endsWith("/api/incubation") && r.request().method() === "POST",
);
await sale.getByRole("button", { name: "সংরক্ষণ করুন", exact: true }).click();
assert.equal((await submitted).status(), 200);
await sale.waitFor({ state: "hidden" });
await lead.p.getByRole("button", { name: "মাঠ ও টিম", exact: true }).click();
const memberRow = lead.p
  .getByRole("row")
  .filter({ hasText: "Team Member" })
  .first();
await memberRow.waitFor();
await memberRow
  .getByRole("button", { name: "GPS ইতিহাস", exact: true })
  .click();
await lead.p
  .getByRole("link", { name: "মানচিত্রে দেখুন", exact: true })
  .first()
  .waitFor();
assert.ok(
  await memberRow.getByRole("link", { name: "Proof", exact: true }).count(),
);
await lead.p.screenshot({
  path: ".incubation-test/leader-team-field.png",
  fullPage: true,
});
assert.equal(
  await lead.p
    .locator(".inc")
    .evaluate((e) => e.scrollWidth > e.clientWidth + 2),
  false,
);
await lead.ctx.close();

const teacher = await account(c.teacherToken);
await teacher.p.goto(c.origin + "/dashboard/competitions/" + c.competitionId);
await teacher.p.getByRole("button", { name: "সেটআপ", exact: true }).waitFor();
await teacher.p.getByRole("button", { name: "সেটআপ", exact: true }).click();
await teacher.p.screenshot({
  path: ".incubation-test/teacher-setup.png",
  fullPage: true,
});
await teacher.p.goto(c.origin + "/dashboard/competitions/create");
await teacher.p
  .getByRole("button", { name: "Incubation তৈরি করুন", exact: true })
  .click();
const setup = teacher.p.locator("form.inc-modal");
await setup
  .getByLabel("প্রোগ্রামের নাম", { exact: true })
  .fill("Browser verified teacher draft");
await setup
  .getByRole("checkbox", { name: "Sales Batch 12", exact: true })
  .check();
await setup.getByLabel("স্প্রিন্টের দিন (নিজে দিন)", { exact: true }).fill("3");
await setup.getByRole("button", { name: "সংরক্ষণ করুন", exact: true }).click();
await teacher.p.waitForURL(/\/dashboard\/competitions\/[a-f0-9-]+$/);
await teacher.p
  .getByRole("heading", { name: "Browser verified teacher draft", exact: true })
  .waitFor();
await teacher.p.getByRole("button", { name: "সেটআপ", exact: true }).click();
await teacher.p.getByRole("button", { name: "টিম", exact: true }).click();
const teamEditor = teacher.p.locator("form.inc-modal");
await teamEditor
  .getByLabel("ব্যাচ", { exact: true })
  .selectOption("Sales Batch 12");
await teamEditor
  .getByLabel("আগের Competition গ্রুপ থেকে কপি (ঐচ্ছিক)", { exact: true })
  .selectOption({ index: 1 });
assert.equal(
  await teamEditor.getByLabel("টিম লিডার", { exact: true }).inputValue(),
  "student-1",
);
assert.equal(
  await teamEditor.getByRole("checkbox", { checked: true }).count(),
  3,
);
const teamSaved = teacher.p.waitForResponse(
  (r) => r.url().endsWith("/api/incubation") && r.request().method() === "POST",
);
await teamEditor
  .getByRole("button", { name: "সংরক্ষণ করুন", exact: true })
  .click();
assert.equal((await teamSaved).status(), 200);
await teamEditor.waitFor({ state: "hidden" });
await teacher.ctx.close();

const pub = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
pub.on("pageerror", (e) => errors.push(e.message));
await pub.goto(c.origin + "/incubation/report/" + c.publicToken);
await pub
  .getByRole("heading", { name: "টিমভিত্তিক ফলাফল", exact: true })
  .waitFor();
for (const name of ["সেটআপ", "এডিট", "সংরক্ষণ করুন", "সংশোধন অনুরোধ"])
  assert.equal(await pub.getByRole("button", { name, exact: true }).count(), 0);
await pub.screenshot({
  path: ".incubation-test/public-read-only.png",
  fullPage: true,
});
await browser.close();
assert.deepEqual(errors, []);
console.log(
  "Four distinct role workflows passed: member GPS/proof, leader sales and team GPS/proof, teacher setup/create, admin reconciliation and public read-only report.",
);
