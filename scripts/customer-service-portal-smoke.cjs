const fs = require("fs"),
  assert = require("assert"),
  { chromium } = require("../.crm-test/tools/node_modules/playwright");
(async () => {
  const f = JSON.parse(fs.readFileSync(".crm-test/browser.json", "utf8")),
    credentials = JSON.parse(fs.readFileSync(".crm-test/login.json", "utf8")),
    b = await chromium.launch(),
    c = await b.newContext(),
    base = "http://" + f.host + ":3107";
  const p = await c.newPage();
  await p.goto(base + "/student-login");
  const request = async (url, options = {}) =>
    p.evaluate(
      async ({ url, options }) => {
        const r = await fetch(url, {
          method: options.data ? "POST" : options.method || "GET",
          headers: { "Content-Type": "application/json" },
          body: options.data ? JSON.stringify(options.data) : undefined,
        });
        return { ok: r.ok, status: r.status };
      },
      { url, options },
    );
  const login = await request(base + "/api/auth/login", {
    data: { email: credentials.agent, password: credentials.password },
  });
  assert(login.ok, "Portal login failed " + login.status);
  await p.goto(base + "/student-dashboard");
  await p.locator(".student-portal").waitFor({ timeout: 60000 });
  const link = p.getByRole("link", { name: /Customer Service CRM/ });
  await link.waitFor();
  assert.equal(await link.getAttribute("target"), "_blank");
  const popupEvent = p.waitForEvent("popup");
  await link.click();
  const crm = await popupEvent;
  await crm.getByRole("heading", { name: "Operations workspace" }).waitFor();
  assert.equal(await crm.locator(".student-portal").count(), 0);
  assert(p.url().endsWith("/student-dashboard"));
  await crm.close();
  for (const path of [
    "/student-dashboard/homework",
    "/student-dashboard/contact-admin",
  ]) {
    const r = await p.goto(base + path);
    assert(r.status() < 400, path + " failed");
    await p.locator(".student-portal").waitFor();
  }
  const logout = await request(base + "/api/auth/logout", { method: "POST" });
  assert(logout.ok);
  const denied = await request(base + "/api/crm");
  assert([401, 403].includes(denied.status));
  const staffLogin = await request(base + "/api/auth/login", {
    data: { email: credentials.admin, password: credentials.password },
  });
  assert(staffLogin.ok);
  const r = await p.goto(base + "/dashboard");
  assert(r.status() < 400);
  await p.goto(base + "/dashboard/crm/settings");
  await p.getByRole("heading", { name: "SLA policies", exact: true }).waitFor();
  console.log(
    "PASS: real portal login/logout, student dashboard, CRM new-tab link, existing homework and chat pages, staff dashboard and CRM settings.",
  );
  await b.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
