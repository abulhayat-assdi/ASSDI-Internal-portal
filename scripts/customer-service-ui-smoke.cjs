const fs = require("fs"),
  assert = require("assert"),
  { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8"));
  if (!f.host.endsWith(".localhost"))
    throw Error("Only local test fixtures are allowed");
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addCookies([
    { name: "__session", value: f.sessions.agent, domain: f.host, path: "/" },
  ]);
  const p = await c.newPage();
  await p.goto("http://" + f.host + ":3107/student-dashboard/crm");
  await p.getByRole("heading", { name: "Resolution activity" }).waitFor();
  for (const width of [1920, 1440, 1024, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await p.waitForTimeout(250);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "page overflow " + width,
    );
    assert.equal(await p.locator("aside").count(), 1);
    await p.screenshot({ path: ".crm-test/ui-" + width + ".png" });
  }
  await p.getByRole("button", { name: "Toggle navigation" }).click();
  await p.getByRole("button", { name: "New Complaint", exact: true }).click();
  await p.getByLabel("Calling number", { exact: true }).waitFor();
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({ path: ".crm-test/ui-mobile-form.png" });
  await p.getByRole("button", { name: "Toggle navigation" }).click();
  await p.keyboard.press("Escape");
  assert.equal(await p.locator(".crm-menu-open").count(), 0);
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.getByRole("button", { name: "Dashboard", exact: true }).click();
  await p.getByRole("button", { name: "Toggle navigation" }).click();
  await p.waitForTimeout(300);
  assert((await p.locator("aside").boundingBox()).width < 100);
  await p.getByRole("button", { name: "Toggle navigation" }).click();
  await p.getByRole("button", { name: "New Complaint", exact: true }).click();
  await p.screenshot({ path: ".crm-test/ui-form.png" });
  console.log(
    "PASS responsive widths 1920/1440/1024/390, one sidebar, mobile navigation, Escape, desktop collapse, complaint form",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
