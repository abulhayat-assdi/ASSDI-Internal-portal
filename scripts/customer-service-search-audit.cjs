const fs = require("fs"),
  assert = require("assert");
const { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8"));
  assert(f.host.endsWith(".localhost"));
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    { name: "__session", value: f.sessions.admin, domain: f.host, path: "/" },
  ]);
  const page = await context.newPage();
  await page.goto(`http://${f.host}:3107/dashboard/crm`);
  await page
    .getByLabel("Workspace", { exact: true })
    .selectOption({ label: "Training" });
  await page
    .getByRole("button", { name: "All Complaints", exact: true })
    .click();
  await page.locator("tbody tr").first().waitFor();
  const code = await page.locator("tbody tr button").first().innerText();
  await page.getByLabel("code", { exact: true }).fill("UNSENT");
  const polled = page.waitForResponse(
    (r) => r.url().includes("kind=list") && r.request().method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const poll = await polled;
  assert.equal(new URL(poll.url()).searchParams.get("code"), "");
  const searched = page.waitForResponse(
    (r) =>
      r.url().includes("kind=list") &&
      new URL(r.url()).searchParams.get("code") === "UNSENT",
  );
  await page
    .locator("main form")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await searched;
  await page
    .getByText("No complaints match this view.", { exact: true })
    .waitFor();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let started;
  const held = new Promise((resolve) => {
    started = resolve;
  });
  await page.route("**/api/crm?**", async (route) => {
    const u = new URL(route.request().url());
    if (
      u.searchParams.get("kind") === "list" &&
      u.searchParams.get("code") === "OLDSLOW"
    ) {
      started();
      await gate;
      await route.fulfill({
        json: { rows: [], total: 0, page: 1, people: [] },
      });
    } else await route.continue();
  });
  await page.getByLabel("code", { exact: true }).fill("OLDSLOW");
  await page
    .locator("main form")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await held;
  await page.getByLabel("code", { exact: true }).fill(code);
  await page
    .locator("main form")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await page.getByRole("button", { name: code, exact: true }).waitFor();
  const stale = page.waitForResponse(
    (r) =>
      r.url().includes("kind=list") &&
      new URL(r.url()).searchParams.get("code") === "OLDSLOW",
  );
  release();
  await (await stale).finished();
  await page.waitForTimeout(250);
  assert.equal(
    await page.getByRole("button", { name: code, exact: true }).count(),
    1,
  );
  await page.goto(`http://${f.host}:3107/dashboard/crm/settings`);
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.goForward();
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
  await browser.close();
  console.log(
    "PASS: submitted search criteria, stale-response protection and Settings/Dashboard Back/Forward navigation.",
  );
})().catch((e) => {
  console.error(e.message.split("\n")[0]);
  process.exit(1);
});
