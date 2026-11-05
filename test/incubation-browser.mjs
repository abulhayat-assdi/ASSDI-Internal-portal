import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const c = JSON.parse(readFileSync(".incubation-test/preview.json", "utf8"));
assert.equal(c.origin, "http://incubation.localhost:3105");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.INCUBATION_BROWSER_CHANNEL
    ? { channel: process.env.INCUBATION_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
});
await context.addCookies([
  {
    name: "__session",
    value: c.adminToken,
    domain: "incubation.localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${c.origin}/dashboard/incubation`);
await page
  .getByRole("button", { name: /Business Incubation — Market Lab/ })
  .first()
  .waitFor({ timeout: 60000 });
await page
  .getByRole("button", { name: /Business Incubation — Market Lab/ })
  .first()
  .click();
await page
  .getByRole("navigation", { name: "Business Incubation বিভাগ" })
  .waitFor();
await page.getByText("টিমের তুলনামূলক ফলাফল").waitFor();
assert.notEqual(
  await page
    .getByRole("heading", { name: "টিমের তুলনামূলক ফলাফল" })
    .evaluate((e) => getComputedStyle(e).color),
  "rgba(0, 0, 0, 0)",
);
await page.getByLabel("শুরুর তারিখ", { exact: true }).fill("2026-12-02");
await page.getByLabel("শেষ তারিখ", { exact: true }).fill("2026-12-01");
await page
  .getByRole("alert")
  .filter({ hasText: "রিপোর্টের তারিখের সীমা সঠিক নয়।" })
  .waitFor();
await page.getByLabel("শেষ তারিখ", { exact: true }).fill("");
await page.getByLabel("শুরুর তারিখ", { exact: true }).fill("");
await page.getByText("টিমের তুলনামূলক ফলাফল").waitFor();
await page.screenshot({
  path: ".incubation-test/desktop-dashboard.png",
  fullPage: true,
});
await page.getByRole("button", { name: "ডাটা শিট", exact: true }).click();
await page.getByRole("button", { name: "এডিট", exact: true }).first().waitFor();
await page.screenshot({
  path: ".incubation-test/data-sheets.png",
  fullPage: true,
});
await page.getByRole("button", { name: "এডিট", exact: true }).first().click();
await page.getByText("আগের তথ্য — অপরিবর্তনযোগ্য").waitFor();
await page.screenshot({
  path: ".incubation-test/correction.png",
  fullPage: true,
});
await page.getByRole("button", { name: "ফর্ম বন্ধ করুন" }).click();
await page.getByRole("button", { name: "শিটে একসঙ্গে এডিট" }).click();
const bulk = page.locator("form.inc-modal");
const batchNote = `Browser verified sheet edit ${Date.now()}`;
assert.equal(
  await bulk
    .getByRole("button", { name: "পরিবর্তন প্রিভিউ", exact: true })
    .isDisabled(),
  true,
);
await bulk.locator("tbody tr").first().locator("input").last().fill(batchNote);
await bulk.getByLabel("এডিটের কারণ").fill("Verified original receipt");
await bulk
  .getByRole("button", { name: "পরিবর্তন প্রিভিউ", exact: true })
  .click();
await bulk.getByText(batchNote).waitFor();
await bulk
  .getByRole("button", { name: "সব পরিবর্তন সংরক্ষণ", exact: true })
  .click();
await bulk.waitFor({ state: "hidden" });
await page.getByRole("button", { name: "সেটআপ", exact: true }).click();
await page.screenshot({ path: ".incubation-test/setup.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "ড্যাশবোর্ড", exact: true }).click();
await page.screenshot({
  path: ".incubation-test/mobile-dashboard.png",
  fullPage: true,
});
const overflow = await page
  .locator(".inc")
  .evaluate((e) => e.scrollWidth > e.clientWidth + 2);
assert.equal(overflow, false, "Feature layout overflows mobile viewport");
await context.close();
const student = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
await student.grantPermissions(["geolocation"], { origin: c.origin });
await student.setGeolocation({ latitude: 23.8, longitude: 90.4, accuracy: 12 });
await student.addCookies([
  {
    name: "__session",
    value: c.studentToken,
    domain: "incubation.localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  },
]);
const sp = await student.newPage();
sp.on("pageerror", (e) => errors.push(e.message));
await sp.goto(`${c.origin}/student-dashboard/incubation`);
await sp
  .getByRole("button", { name: /Business Incubation — Market Lab/ })
  .first()
  .click();
await sp.getByRole("button", { name: "মাঠ ও GPS", exact: true }).click();
await sp.getByText("মাঠে কাজ শুরু করুন").waitFor();
await sp.getByLabel("কাজের ব্রড এরিয়া", { exact: true }).selectOption(c.areaId);
await sp
  .getByRole("button", { name: "GPS দিয়ে Check-in করুন", exact: true })
  .click();
await sp.getByText("আপনার মাঠ সেশন চলছে", { exact: true }).waitFor();
await sp.getByLabel("হাঁটার স্টেপ", { exact: true }).fill("3456");
await sp.getByRole("button", { name: "Check-out করুন", exact: true }).click();
await sp.getByText("মাঠে কাজ শুরু করুন", { exact: true }).waitFor();
await sp.screenshot({
  path: ".incubation-test/student-field.png",
  fullPage: true,
});
await sp.getByRole("button", { name: "ডাটা শিট", exact: true }).click();
await sp.getByRole("button", { name: "নতুন এন্ট্রি", exact: true }).click();
await sp.getByRole("heading", { name: "বিক্রি", exact: true }).waitFor();
await sp.screenshot({
  path: ".incubation-test/student-sale.png",
  fullPage: true,
});
await student.close();
const pub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
pub.on("pageerror", (e) => errors.push(e.message));
await pub.goto(`${c.origin}/incubation/report/${c.publicToken}`);
await pub.getByRole("heading", { name: "টিমভিত্তিক ফলাফল" }).waitFor();
await pub.getByLabel("শুরু", { exact: true }).fill("2026-12-02");
await pub.getByLabel("শেষ", { exact: true }).fill("2026-12-01");
await pub
  .getByRole("alert")
  .filter({ hasText: "রিপোর্টের তারিখের সীমা সঠিক নয়।" })
  .waitFor();
await pub.getByLabel("শেষ", { exact: true }).fill("");
await pub.getByLabel("শুরু", { exact: true }).fill("");
await pub.getByRole("heading", { name: "টিমভিত্তিক ফলাফল" }).waitFor();
await pub.screenshot({
  path: ".incubation-test/public-report.png",
  fullPage: true,
});
await browser.close();
assert.deepEqual(errors, []);
console.log(
  "Desktop/mobile/student/public browser flows passed; screenshots saved in ignored test directory.",
);
