const fs = require("fs"),
  assert = require("assert"),
  { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8"));
  const browser = await chromium.launch({ headless: true });
  let context;
  const base = "http://" + f.host + ":3107";
  async function login(role) {
    console.log("ROLE", role);
    if (context) await context.close();
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: "__session", value: f.sessions[role], domain: f.host, path: "/" },
    ]);
    const p = await context.newPage();
    p.on("response", async (r) => {
      if (r.url().includes("/api/crm") && r.status() >= 400)
        console.log("CRM ERROR", r.status(), await r.text());
    });
    await p.goto(
      base +
        (role === "admin"
          ? "/dashboard/crm/settings"
          : "/student-dashboard/crm"),
    );
    await p.getByRole("heading", { name: "Operations workspace" }).waitFor();
    await p
      .locator(".crm-root")
      .getByRole("button", { name: "Profile", exact: true })
      .waitFor();
    await p
      .locator(".crm-root main span")
      .filter({ hasText: "ACTIVE" })
      .first()
      .waitFor();
    return p;
  }
  let p = await login("agent");
  assert.equal(await p.locator(".student-portal").count(), 0);
  await p.getByRole("button", { name: "New Complaint", exact: true }).click();
  await p.getByLabel("Calling number", { exact: true }).fill("00123456");
  await p.getByRole("button", { name: "Fetch Data by calling number", exact: true }).click();
  await p
    .getByRole("status")
    .filter({ hasText: "Copied contact fields" })
    .waitFor();
  await p
    .getByLabel("Issue details", { exact: true })
    .fill("Browser workflow verification");
  const saved = p.waitForResponse(
    (r) => r.url().includes("/api/crm") && r.request().method() === "POST",
  );
  await p.getByRole("button", { name: "Save as Pending", exact: true }).click();
  const c = await (await saved).json();
  assert(c.id, c.error);
  console.log("Opening complaint", c.code);
  await p.getByRole("heading", { name: c.code }).waitFor();
  await p.getByLabel("Reason / solution / note").fill("Please investigate");
  await p
    .getByLabel("Escalation destination")
    .selectOption({ label: "L2 (L2)" });
  await p.getByRole("button", { name: "Escalate", exact: true }).click();
  await p.getByText("PENDING · L2 · NORMAL", { exact: true }).waitFor();
  async function open(p) {
    await p
      .getByRole("button", { name: "Search", exact: true })
      .first()
      .click();
    await p.getByLabel("code", { exact: true }).fill(c.code);
    await p
      .locator("form")
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await p.getByRole("button", { name: c.code, exact: true }).click();
    await p.getByRole("heading", { name: c.code }).waitFor();
  }
  p = await login("l2");
  await open(p);
  await p.getByRole("button", { name: "Claim", exact: true }).click();
  await p
    .getByRole("button", { name: "Revert to Agent", exact: true })
    .waitFor();
  await p.getByLabel("Reason / solution / note").fill("Please correct details");
  await p.getByRole("button", { name: "Revert to Agent", exact: true }).click();
  await p.getByText("Saved.", { exact: true }).waitFor();
  p = await login("agent");
  await open(p);
  await p
    .getByRole("button", { name: "Edit complaint details", exact: true })
    .click();
  await p
    .getByLabel("Issue details", { exact: true })
    .fill("Corrected browser workflow");
  await p.getByRole("button", { name: "Save correction", exact: true }).click();
  await p.getByText("Saved.", { exact: true }).waitFor();
  await p.getByLabel("Reason / solution / note").fill("Corrected");
  await p
    .getByLabel("Escalation destination")
    .selectOption({ label: "L2 (L2)" });
  await p.getByRole("button", { name: "Resubmit to L2", exact: true }).click();
  await p.getByText(/PENDING.*L2.*RESUBMITTED/).waitFor();
  p = await login("l2");
  await open(p);
  await p.getByRole("button", { name: "Claim", exact: true }).click();
  await p.getByRole("button", { name: "Escalate", exact: true }).waitFor();
  await p.getByLabel("Reason / solution / note").fill("L3 required");
  await p
    .getByLabel("Escalation destination")
    .selectOption({ label: "L3 (L3)" });
  await p.getByRole("button", { name: "Escalate", exact: true }).click();
  await p.getByText("Saved.", { exact: true }).waitFor();
  p = await login("l3");
  await open(p);
  await p.getByRole("button", { name: "Claim", exact: true }).click();
  await p.getByRole("button", { name: "Resolve", exact: true }).waitFor();
  await p
    .getByLabel("Reason / solution / note")
    .fill("Resolved after investigation");
  await p
    .getByLabel("resolutionReason", { exact: true })
    .selectOption({ label: "Test resolutionReason" });
  await p.getByRole("button", { name: "Resolve", exact: true }).click();
  await p.getByText("RESOLVED · L3 · RE_ESCALATED", { exact: true }).waitFor();
  assert.equal(
    await p
      .getByRole("button", { name: "Edit complaint details", exact: true })
      .count(),
    0,
  );
  await p.screenshot({ path: ".crm-test/crm-resolved.png", fullPage: true });
  p = await login("agent");
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: ".crm-test/crm-mobile.png", fullPage: true });
  assert(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile page overflows",
  );
  await p.getByRole("button", { name: "Toggle navigation", exact: true }).click();
  await p.getByRole("button", { name: "Reports", exact: true }).click();
  const download = p.waitForEvent("download");
  await p.getByRole("link", { name: "Download CSV", exact: true }).click();
  assert.equal((await download).suggestedFilename(), "crm-report.csv");
  p = await login("admin");
  await p.getByRole("heading", { name: "SLA policies", exact: true }).waitFor();
  await p.screenshot({ path: ".crm-test/crm-settings.png", fullPage: true });
  console.log(
    "PASS: Chromium standalone layout, Fetch Data, create, L2 claim/revert, agent correction/resubmit, L3 resolution lock, mobile width, CSV download and staff settings.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
