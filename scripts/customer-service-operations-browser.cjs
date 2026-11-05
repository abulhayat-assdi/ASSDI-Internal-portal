const fs = require("fs"),
  assert = require("assert");
const { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8"));
  assert(f.host.endsWith(".localhost"));
  const browser = await chromium.launch();
  async function login(role, path) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
      { name: "__session", value: f.sessions[role], domain: f.host, path: "/" },
    ]);
    const page = await context.newPage();
    await page.goto(`http://${f.host}:3107${path}`);
    return { context, page };
  }
  const admin = await login("admin", "/dashboard/crm");
  await admin.page
    .getByLabel("Workspace", { exact: true })
    .selectOption({ label: "Training" });
  await admin.page
    .getByRole("button", { name: "Distribute Work", exact: true })
    .click();
  await admin.page
    .getByRole("heading", {
      name: "Distribute practice complaints",
      exact: true,
    })
    .waitFor();
  const workspaceId = await admin.page
    .getByLabel("Workspace", { exact: true })
    .inputValue();
  const pool = await admin.page.evaluate(async (workspaceId) => {
    const response = await fetch(
      "/api/crm?" +
        new URLSearchParams({ kind: "assignment_pool", workspaceId }),
    );
    return response.json();
  }, workspaceId);
  const agent = pool.agents.find((a) => a.name.startsWith("agent-"));
  assert(agent);
  const student = await login("agent", "/student-dashboard/crm");
  await student.page
    .getByRole("button", { name: "My Complaints", exact: true })
    .click();
  await student.page
    .getByRole("heading", { name: "My Complaints", exact: true })
    .waitFor();
  await student.page.getByRole("button", { name: /^Notifications,/ }).click();
  const mark = student.page.getByRole("button", {
    name: "Mark all read",
    exact: true,
  });
  if (await mark.isEnabled()) await mark.click();
  await student.page
    .getByRole("button", { name: "Close notifications", exact: true })
    .click();
  await admin.page
    .getByLabel(agent.name + (agent.roll ? " · " + agent.roll : ""), {
      exact: true,
    })
    .check();
  await admin.page
    .getByLabel("Number of complaints", { exact: true })
    .fill("2");
  await admin.page
    .getByRole("button", { name: "Preview distribution", exact: true })
    .click();
  await admin.page
    .getByRole("heading", {
      name: "Assignment preview · 2 complaints",
      exact: true,
    })
    .waitFor();
  await admin.page
    .getByRole("button", { name: "Assign 2 complaints", exact: true })
    .click();
  await admin.page
    .getByRole("status")
    .filter({ hasText: "2 complaints assigned" })
    .waitFor();
  const code = pool.cases[0].code;
  await student.page
    .getByRole("button", { name: "Notifications, 2 unread", exact: true })
    .waitFor({ timeout: 35000 });
  await student.page
    .getByRole("button", { name: code, exact: true })
    .waitFor({ timeout: 35000 });
  await student.page
    .getByRole("button", { name: "Notifications, 2 unread", exact: true })
    .click();
  await student.page
    .getByRole("button", { name: new RegExp(code + ": a new complaint") })
    .click();
  await student.page
    .getByRole("heading", { name: code, exact: true })
    .waitFor();
  await student.page
    .getByRole("button", { name: "In progress", exact: true })
    .click();
  await student.page.getByText("Saved.", { exact: true }).waitFor();
  await student.page
    .getByLabel("Reason / solution / note")
    .fill("Training issue resolved after checking the scenario");
  await student.page
    .getByLabel("resolutionReason", { exact: true })
    .selectOption({ label: "Test resolutionReason" });
  await student.page
    .getByRole("button", { name: "Resolve", exact: true })
    .click();
  await student.page
    .getByText("RESOLVED · AGENT · NORMAL", { exact: true })
    .waitFor();
  await student.page
    .getByRole("button", { name: "My Progress", exact: true })
    .click();
  await student.page
    .getByRole("heading", { name: "Student progress", exact: true })
    .waitFor();
  await student.page
    .locator("tbody tr")
    .filter({ hasText: agent.name })
    .waitFor();
  assert.equal(await student.page.locator("tbody tr").count(), 1);
  await admin.page
    .getByRole("button", { name: "Student Progress", exact: true })
    .click();
  await admin.page
    .getByRole("heading", { name: "Student progress", exact: true })
    .waitFor();
  await admin.page
    .getByLabel("Progress student", { exact: true })
    .selectOption(agent.id);
  const row = admin.page.locator("tbody tr").filter({ hasText: agent.name });
  await row.waitFor();
  await row
    .getByRole("button", { name: "View current work", exact: true })
    .click();
  await admin.page
    .getByRole("region", { name: "Student work" })
    .getByRole("button", { name: code, exact: true })
    .waitFor();
  await admin.page.screenshot({
    path: ".crm-test/operations-progress.png",
    fullPage: true,
  });
  await admin.page.setViewportSize({ width: 390, height: 844 });
  assert(
    await admin.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Progress layout overflows mobile viewport",
  );
  await browser.close();
  console.log(
    "PASS: bulk preview/apply, student assignment notification, automatic My Complaints update, notification-to-case navigation, resolution, personal progress and admin student drilldown/mobile width.",
  );
})().catch((e) => {
  console.error(e.message.split("\n")[0]);
  process.exit(1);
});
