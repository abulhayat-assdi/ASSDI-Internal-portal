const fs = require("fs"),
  assert = require("assert");
const { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8"));
  assert(f.host.endsWith(".localhost"));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
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
  const workspaceId = await page
    .getByLabel("Workspace", { exact: true })
    .inputValue();
  const pending = await page.evaluate(async (workspaceId) => {
    const pool = await (
      await fetch(
        "/api/crm?" +
          new URLSearchParams({ kind: "assignment_pool", workspaceId }),
      )
    ).json();
    const detail = await (
      await fetch(
        "/api/crm?" +
          new URLSearchParams({
            kind: "detail",
            workspaceId,
            id: pool.cases[0].id,
          }),
      )
    ).json();
    return detail.complaint;
  }, workspaceId);
  const reference = pending.description.match(/\[Practice (TRAIN-\d+)\]/)[1];
  await page
    .getByLabel("registeredNumber", { exact: true })
    .fill(pending.registeredNumber);
  await page
    .locator("main form")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  const row = page
    .locator("tbody tr")
    .filter({ hasText: pending.callingNumber });
  await row.waitFor();
  assert.match(await row.innerText(), /PENDING/);
  const code = await row.locator("button").first().innerText();
  await row.locator("button").first().click();
  await page.getByRole("heading", { name: code, exact: true }).waitFor();
  assert(
    (await page.locator("main").innerText()).includes("Practice " + reference),
  );
  await page.screenshot({
    path: ".crm-test/practice-pending-case.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Training Customers", exact: true })
    .click();
  await page
    .getByText("Page 1 · 250 training customers", { exact: true })
    .waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /250 starter customer complaints/,
  );
  assert.match(await page.locator("tbody tr").first().innerText(), /TRAIN-251/);
  await browser.close();
  console.log(
    "PASS: ready pending case appears in All Complaints with saved details; remaining 250 references start at TRAIN-251.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
