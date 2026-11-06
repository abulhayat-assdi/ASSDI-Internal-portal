const fs = require("fs"),
  assert = require("assert"),
  { chromium } = require("playwright");
let runningBrowser;
(async () => {
  const fixture = JSON.parse(
    fs.readFileSync(".crm-test/live-chat-browser.json", "utf8"),
  );
  assert(fixture.host.endsWith(".localhost"));
  const dbEnv = JSON.parse(
    fs.readFileSync(".crm-test/live-chat-env.json", "utf8"),
  );
  const local = new URL(dbEnv.CUSTOMER_SERVICE_DATABASE_URL);
  assert(
    local.hostname === "127.0.0.1" &&
      local.port === "55439" &&
      local.pathname === "/crm_test",
  );
  const { PrismaClient } = require("../generated/customer-service");
  const db = new PrismaClient({
    datasources: { db: { url: dbEnv.CUSTOMER_SERVICE_DATABASE_URL } },
  });
  await db.$transaction(async (tx) => {
    const [workspaceId] = fixture.token.split(".");
    const workspaceCourse = fixture.host.replace(".localhost", "");
    await tx.$executeRaw`SELECT set_config('crm.course',${workspaceCourse},true),set_config('crm.workspace',${workspaceId},true)`;
    await require("./lib/live-chat-engine.cjs").lock(tx, workspaceId);
    await tx.chatConversation.updateMany({
      where: {
        workspaceId,
        status: { in: ["QUEUED", "ASSIGNED", "ACTIVE"] },
        OR: [{ practiceKey: null }, { practiceStartedAt: { not: null } }],
      },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await tx.chatConversation.updateMany({
      where: {
        workspaceId,
        practiceKey: { not: null },
        practiceStartedAt: null,
      },
      data: { status: "QUEUED", closedAt: null },
    });
    await tx.chatAssignment.updateMany({
      where: { workspaceId, endedAt: null },
      data: { endedAt: new Date() },
    });
    await tx.chatAgentState.updateMany({
      where: { workspaceId },
      data: { status: "OFFLINE" },
    });
  });
  await db.$disconnect();
  const browser = (runningBrowser = await chromium.launch({
      channel: "chrome",
    })),
    origin = "http://" + fixture.host + ":3118";
  const errors = [];
  const agentContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await agentContext.addCookies([
    {
      name: "__session",
      value: fixture.sessions.agent,
      domain: fixture.host,
      path: "/",
    },
  ]);
  const agent = await agentContext.newPage();
  agent.on("pageerror", (e) => errors.push(e.message));
  await agent.goto(
    origin +
      "/student-dashboard/crm/live-chat?workspaceId=" +
      fixture.workspaceId,
    { timeout: 90000, waitUntil: "domcontentloaded" },
  );
  await agent.waitForURL("**/student-dashboard/live-chat?**", {
    timeout: 60000,
  });
  assert(new URL(agent.url()).pathname === "/student-dashboard/live-chat");
  await agent
    .getByRole("button")
    .filter({
      has: agent.locator(".lc-badge").filter({ hasText: "Scripted practice" }),
    })
    .first()
    .click({ timeout: 60000 });
  await agent
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await agent
    .getByLabel("Message", { exact: true })
    .fill("Hello, please share your training reference.");
  await agent.getByRole("button", { name: "Send", exact: true }).click();
  await agent
    .locator(".lc-messages")
    .getByText("Hello, please share your training reference.", { exact: true })
    .waitFor({ timeout: 30000 });
  await agent
    .locator(".lc-messages")
    .getByText(/My training reference is|আমার অনুশীলনের রেফারেন্স/)
    .waitFor({ timeout: 30000 });
  async function focused(page) {
    await page.waitForFunction(
      () =>
        document.activeElement ===
        document.querySelector('textarea[aria-label="Message"]'),
    );
  }
  async function fits(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => {
      const t = document.querySelector(".lc-compose textarea"),
        b = document.querySelector(".lc-compose button");
      if (!t || !b) return false;
      const a = t.getBoundingClientRect(),
        r = b.getBoundingClientRect();
      return a.top >= 0 && a.bottom <= innerHeight && r.bottom <= innerHeight;
    });
    const sizes = await page.evaluate(() => ({
      body: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      height: innerHeight,
      vw: innerWidth,
    }));
    assert(
      sizes.body <= height + 2,
      JSON.stringify({ width, height, ...sizes }),
    );
    assert(sizes.width <= width + 2, JSON.stringify(sizes));
  }
  await focused(agent);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [1024, 600],
  ])
    await fits(agent, width, height);
  await agent
    .getByRole("button", { name: "Conversation tools", exact: true })
    .click();
  await agent.locator("#lc-conversation-tools").waitFor({ state: "visible" });
  await agent.getByRole("button", { name: "Close tools", exact: true }).click();
  await agent.setViewportSize({ width: 1366, height: 768 });
  await agent.getByLabel("Message", { exact: true }).focus();
  await agent.keyboard.type("Second message without clicking the composer");
  await agent.keyboard.press("Enter");
  await agent
    .locator(".lc-messages")
    .getByText("Second message without clicking the composer", { exact: true })
    .waitFor();
  await focused(agent);
  await agent.keyboard.type("A line");
  await agent.keyboard.press("Shift+Enter");
  await agent.keyboard.type("Another line");
  assert.equal(
    await agent.getByLabel("Message", { exact: true }).inputValue(),
    "A line\nAnother line",
  );
  await agent.getByLabel("Message", { exact: true }).dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    isComposing: true,
  });
  assert.equal(
    await agent.getByLabel("Message", { exact: true }).inputValue(),
    "A line\nAnother line",
  );
  await agent
    .getByLabel("Message", { exact: true })
    .fill("Retry this message once");
  let rejectOnce = true;
  await agent.route("**/api/live-chat?*", async (route) => {
    const b = route.request().postDataJSON();
    if (b?.action === "message" && rejectOnce) {
      rejectOnce = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated connection interruption" }),
      });
    }
    return route.continue();
  });
  await agent.keyboard.press("Enter");
  await agent
    .getByRole("alert")
    .getByText("Simulated connection interruption")
    .waitFor();
  assert.equal(
    await agent.getByLabel("Message", { exact: true }).inputValue(),
    "Retry this message once",
  );
  await agent.unroute("**/api/live-chat?*");
  await focused(agent);
  await agent.keyboard.press("Enter");
  await agent
    .locator(".lc-messages")
    .getByText("Retry this message once", { exact: true })
    .waitFor();
  assert.equal(
    await agent
      .locator(".lc-messages")
      .getByText("Retry this message once", { exact: true })
      .count(),
    1,
  );
  await focused(agent);
  let releaseSend, notifySend;
  const sendGate = new Promise((resolve) => (releaseSend = resolve)),
    arrived = new Promise((resolve) => (notifySend = resolve));
  await agent.route("**/api/live-chat?*", async (route) => {
    const b = route.request().postDataJSON();
    if (b?.action === "message") {
      notifySend();
      await sendGate;
    }
    return route.continue();
  });
  await agent
    .getByLabel("Message", { exact: true })
    .fill("Delayed message for draft test");
  await agent
    .getByRole("button", { name: "Send", exact: true })
    .waitFor({ state: "visible" });
  await agent.waitForFunction(
    () => !document.querySelector(".lc-compose button")?.disabled,
  );
  await agent.keyboard.press("Enter");
  await arrived;
  await agent
    .getByLabel("Message", { exact: true })
    .fill("Keep this next draft");
  await agent.getByLabel("Search conversations", { exact: true }).focus();
  releaseSend();
  await agent
    .locator(".lc-messages")
    .getByText("Delayed message for draft test", { exact: true })
    .waitFor();
  assert.equal(
    await agent.getByLabel("Message", { exact: true }).inputValue(),
    "Keep this next draft",
  );
  assert(
    await agent
      .getByLabel("Search conversations", { exact: true })
      .evaluate((el) => document.activeElement === el),
  );
  await agent.unroute("**/api/live-chat?*");
  await agent.getByLabel("Message", { exact: true }).fill("");
  await agent.screenshot({
    path: ".crm-test/live-chat-practice.png",
    fullPage: true,
  });
  const fixtureDb = new PrismaClient({
    datasources: { db: { url: dbEnv.CUSTOMER_SERVICE_DATABASE_URL } },
  });
  await fixtureDb.$transaction(async (tx) => {
    const course = fixture.host.replace(".localhost", ""),
      workspaceId = fixture.workspaceId;
    await tx.$executeRawUnsafe(
      "SELECT set_config('crm.course',$1,true),set_config('crm.workspace',$2,true)",
      course,
      workspaceId,
    );
    await require("./lib/live-chat-engine.cjs").lock(tx, workspaceId);
    await tx.chatConversation.updateMany({
      where: { workspaceId, practiceKey: { not: null } },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await tx.chatAssignment.updateMany({
      where: { workspaceId, endedAt: null },
      data: { endedAt: new Date() },
    });
  });
  await fixtureDb.$disconnect();
  await agent
    .getByLabel("Your availability", { exact: true })
    .selectOption("AVAILABLE", { timeout: 60000 });
  const customerContext = await browser.newContext({
      viewport: { width: 800, height: 1000 },
    }),
    customer = await customerContext.newPage();
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.goto(origin + "/live-chat/" + fixture.token, {
    timeout: 90000,
  });
  await customer
    .getByLabel("Your name (required)", { exact: true })
    .fill("Browser Customer");
  await customer
    .getByLabel("Category (required)", { exact: true })
    .selectOption(fixture.categoryId);
  await customer
    .getByLabel("How can we help?", { exact: true })
    .fill("আমার পেমেন্ট দুইবার হয়েছে। Please help with a duplicate payment.");
  await customer
    .getByRole("button", { name: "Start chat", exact: true })
    .click();
  await agent
    .getByRole("button")
    .filter({ has: agent.getByText("Browser Customer", { exact: true }) })
    .click({ timeout: 60000 });
  await agent
    .getByRole("button", { name: "Accept chat", exact: true })
    .click({ timeout: 30000 });
  await agent
    .getByLabel("Message", { exact: true })
    .fill("স্বাগতম! I will check your payment reference.");
  await agent.getByRole("button", { name: "Send", exact: true }).click();
  await customer
    .getByText("স্বাগতম! I will check your payment reference.", { exact: true })
    .waitFor({ timeout: 30000 });
  await customer
    .getByLabel("Message", { exact: true })
    .fill("Thank you. Reference TEST-100.");
  await customer.getByRole("button", { name: "Send", exact: true }).click();
  await agent
    .locator(".lc-messages")
    .getByText("Thank you. Reference TEST-100.", { exact: true })
    .waitFor({ timeout: 30000 });
  await agent.getByLabel("Message type").selectOption("NOTE");
  await agent
    .getByLabel("Message", { exact: true })
    .fill("Internal verification completed; hidden from customer.");
  await agent.getByRole("button", { name: "Send", exact: true }).click();
  await agent
    .getByText("Internal verification completed; hidden from customer.", {
      exact: true,
    })
    .waitFor();
  assert(
    !(await customer
      .getByText("Internal verification completed; hidden from customer.", {
        exact: true,
      })
      .count()),
  );
  await customer.reload();
  await customer
    .getByText("Thank you. Reference TEST-100.", { exact: true })
    .waitFor({ timeout: 30000 });
  await agent.screenshot({
    path: ".crm-test/live-chat-agent.png",
    fullPage: true,
  });
  await customer.screenshot({
    path: ".crm-test/live-chat-customer.png",
    fullPage: true,
  });
  await customer.setViewportSize({ width: 390, height: 844 });
  await customer.screenshot({
    path: ".crm-test/live-chat-mobile.png",
    fullPage: true,
  });
  assert(
    await customer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const get = (path) =>
    agent.request.get(path.replace(origin, "http://127.0.0.1:3118"), {
      timeout: 90000,
      headers: {
        host: fixture.host,
        cookie: "__session=" + fixture.sessions.agent,
      },
    });
  const transcript = await get(
    origin +
      "/api/live-chat?" +
      new URLSearchParams({ workspaceId: fixture.workspaceId }),
  );
  assert.equal(transcript.status(), 200);
  const chat = (await transcript.json()).chats.find(
    (c) => c.customerName === "Browser Customer",
  );
  assert(chat);
  const pdf = await get(
    origin +
      "/api/live-chat/export?" +
      new URLSearchParams({
        workspaceId: fixture.workspaceId,
        id: chat.id,
        format: "pdf",
      }),
  );
  assert.equal(pdf.status(), 200, await pdf.text());
  assert((await pdf.body()).subarray(0, 4).toString() === "%PDF");
  fs.writeFileSync(".crm-test/live-chat-transcript.pdf", await pdf.body());
  const xlsx = await get(
    origin +
      "/api/live-chat/export?" +
      new URLSearchParams({
        workspaceId: fixture.workspaceId,
        format: "xlsx",
        from: "2026-01-01",
        to: "2027-01-01",
      }),
  );
  assert.equal(xlsx.status(), 200, await xlsx.text());
  assert((await xlsx.body()).subarray(0, 2).toString() === "PK");
  fs.writeFileSync(".crm-test/live-chat-report.xlsx", await xlsx.body());
  const reportPdf = await get(
    origin +
      "/api/live-chat/export?" +
      new URLSearchParams({
        workspaceId: fixture.workspaceId,
        format: "pdf",
        from: "2026-01-01",
        to: "2027-01-01",
      }),
  );
  assert.equal(reportPdf.status(), 200, await reportPdf.text());
  assert((await reportPdf.body()).subarray(0, 4).toString() === "%PDF");
  fs.writeFileSync(".crm-test/live-chat-report.pdf", await reportPdf.body());
  const toolsButton = agent.getByRole("button", {
    name: "Conversation tools",
    exact: true,
  });
  if (await toolsButton.isVisible()) await toolsButton.click();
  await agent
    .locator("summary")
    .filter({ hasText: "Close & document" })
    .click();
  await agent
    .getByLabel("Closing notes", { exact: true })
    .fill("Logged a payment complaint and explained the follow-up.");
  await agent
    .getByRole("button", { name: "Close conversation", exact: true })
    .click();
  await customer
    .getByText("This conversation has ended.", { exact: true })
    .waitFor({ timeout: 30000 });
  await customer.getByLabel("Rate 5 out of 5", { exact: true }).click();
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await adminContext.addCookies([
    {
      name: "__session",
      value: fixture.sessions.admin,
      domain: fixture.host,
      path: "/",
    },
  ]);
  const admin = await adminContext.newPage();
  await admin.goto(
    origin + "/dashboard/live-chat?workspaceId=" + fixture.workspaceId,
    { timeout: 90000 },
  );
  await admin
    .getByRole("button", { name: "Settings", exact: true })
    .waitFor({ timeout: 60000 });
  const staffDb = new PrismaClient({
    datasources: { db: { url: dbEnv.CUSTOMER_SERVICE_DATABASE_URL } },
  });
  await staffDb.$transaction(async (tx) => {
    const workspaceId = fixture.workspaceId;
    await tx.$executeRawUnsafe(
      "SELECT set_config('crm.course',$1,true),set_config('crm.workspace',$2,true)",
      fixture.host.replace(".localhost", ""),
      workspaceId,
    );
    await require("./lib/live-chat-engine.cjs").lock(tx, workspaceId);
    await tx.chatConversation.updateMany({
      where: {
        workspaceId,
        practiceKey: { not: null },
        practiceStartedAt: null,
      },
      data: { status: "QUEUED", closedAt: null },
    });
  });
  await staffDb.$disconnect();
  await admin.reload({ timeout: 90000 });
  const examples = admin.locator("button.lc-chat-item").filter({
    has: admin.locator(".lc-badge").filter({ hasText: "Scripted practice" }),
  });
  for (let n = 0; n < 2; n++) {
    await examples.nth(n).click({ timeout: 60000 });
    await focused(admin);
    assert.equal(
      await admin.getByLabel("Message type", { exact: true }).inputValue(),
      "COACH",
    );
    await admin
      .getByText("Private — hidden from customer", { exact: true })
      .waitFor();
    await admin.keyboard.type("Teacher coaching example " + n);
    await admin.keyboard.press("Enter");
    await admin
      .locator(".lc-message.COACH")
      .getByText("Teacher coaching example " + n, { exact: true })
      .waitFor();
    await focused(admin);
  }
  await admin
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await admin.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Message type"]')?.value ===
      "MESSAGE",
  );
  await focused(admin);
  await admin.keyboard.type("Teacher customer-facing reply");
  await admin.keyboard.press("Enter");
  await admin
    .locator(".lc-messages")
    .getByText("Teacher customer-facing reply", { exact: true })
    .waitFor();
  await focused(admin);
  await admin.keyboard.type("Teacher second reply");
  await admin.getByRole("button", { name: "Send", exact: true }).click();
  await admin
    .locator(".lc-messages")
    .getByText("Teacher second reply", { exact: true })
    .waitFor();
  await focused(admin);
  for (const [width, height] of [
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [1024, 600],
  ])
    await fits(admin, width, height);
  await admin.screenshot({
    path: ".crm-test/live-chat-tablet-composer.png",
    fullPage: true,
  });
  await admin.setViewportSize({ width: 1366, height: 768 });
  await admin.screenshot({
    path: ".crm-test/live-chat-desktop-composer.png",
    fullPage: true,
  });
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await admin.getByRole("button", { name: "Dashboard", exact: true }).click();
  await admin
    .getByRole("heading", { name: "Current operations", exact: true })
    .waitFor();
  assert.equal(
    await admin.locator(".lc-workspace").getAttribute("data-theme"),
    "dark",
  );
  async function readable(page) {
    const result = await page.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (c) =>
        c
          .map((v) => {
            v /= 255;
            return v <= 0.04045
              ? v / 12.92
              : Math.pow((v + 0.055) / 1.055, 2.4);
          })
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const elements = [
        document.querySelector(".lc-overview-heading h2"),
        document.querySelector(".lc-overview-heading p"),
        document.querySelector(".lc-summary-card small"),
        document.querySelector(".lc-distribution-legend span"),
      ];
      return elements.map((el) => {
        const color = rgb(getComputedStyle(el).color);
        let node = el,
          bg;
        while (node) {
          const value = getComputedStyle(node).backgroundColor;
          if (value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
            bg = rgb(value);
            break;
          }
          node = node.parentElement;
        }
        const a = lum(color),
          b = lum(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
    });
    assert(
      result.every((r) => r >= 4.5),
      JSON.stringify(result),
    );
  }
  await readable(admin);
  await admin.screenshot({
    path: ".crm-test/live-chat-overview-dark.png",
    fullPage: true,
  });
  await admin
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  assert.equal(
    await admin.locator(".lc-workspace").getAttribute("data-theme"),
    "light",
  );
  await readable(admin);
  await admin.screenshot({
    path: ".crm-test/live-chat-overview-light.png",
    fullPage: true,
  });
  await admin.reload({ timeout: 90000 });
  await admin.waitForFunction(
    () => document.querySelector(".lc-workspace")?.dataset.theme === "light",
  );
  await admin
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await admin.reload({ timeout: 90000 });
  await admin.waitForFunction(
    () => document.querySelector(".lc-workspace")?.dataset.theme === "dark",
  );
  await admin
    .getByRole("button", { name: "Knowledge Base", exact: true })
    .click();
  await admin
    .getByLabel("Search reference materials", { exact: true })
    .fill("Greeting");
  await admin
    .locator(".lc-knowledge-grid article h3")
    .getByText("Greeting", { exact: true })
    .waitFor();
  await admin
    .getByLabel("Search reference materials", { exact: true })
    .fill("no-matching-reference-xyz");
  await admin
    .getByText("No reference materials are available for this view.", {
      exact: true,
    })
    .waitFor();
  await admin.getByRole("button", { name: "Live Chat", exact: true }).click();
  await examples.nth(1).click();
  await focused(admin);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [1024, 600],
  ])
    await fits(admin, width, height);
  await admin.setViewportSize({ width: 1440, height: 1000 });
  await admin.screenshot({
    path: ".crm-test/live-chat-redesign-dark.png",
    fullPage: true,
  });
  await admin
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await admin.screenshot({
    path: ".crm-test/live-chat-redesign-light.png",
    fullPage: true,
  });
  const statePattern = "**/api/live-chat?*";
  await admin.route(statePattern, async (route) => {
    const u = new URL(route.request().url());
    if (!u.searchParams.get("kind") || u.searchParams.get("kind") === "state")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Live Chat setup is incomplete.",
          code: "CHAT_DATABASE_SETUP_REQUIRED",
        }),
      });
    return route.continue();
  });
  await admin.reload({ timeout: 90000 });
  await admin
    .getByRole("heading", { name: "Chat workspace could not load" })
    .waitFor({ timeout: 60000 });
  await admin
    .getByText("Loading chat workspace…", { exact: true })
    .waitFor({ state: "hidden" });
  await admin.unroute(statePattern);
  await admin.getByRole("button", { name: "Retry", exact: true }).click();
  await admin
    .getByRole("button", { name: "Settings", exact: true })
    .click({ timeout: 60000 });
  await admin
    .getByRole("button", {
      name: "Initialize categories & training references",
      exact: true,
    })
    .waitFor();
  await admin.screenshot({
    path: ".crm-test/live-chat-settings.png",
    fullPage: true,
  });
  await admin.getByRole("button", { name: "Dashboard", exact: true }).click();
  await admin
    .getByRole("heading", { name: "Current operations", exact: true })
    .waitFor();
  await admin.screenshot({
    path: ".crm-test/live-chat-dashboard.png",
    fullPage: true,
  });
  await admin.goto(origin + "/dashboard", { timeout: 90000 });
  await admin
    .locator('a[href="/dashboard/live-chat"]')
    .first()
    .click({ timeout: 60000 });
  await admin
    .getByRole("heading", { name: "Live Chat Training", exact: true })
    .waitFor({ timeout: 60000 });
  await agent.goto(origin + "/student-dashboard", { timeout: 90000 });
  const studentLink = agent
    .locator('a[href="/student-dashboard/live-chat"]')
    .first();
  await studentLink.waitFor({ timeout: 60000 });
  const [practiceTab] = await Promise.all([
    agentContext.waitForEvent("page"),
    studentLink.click(),
  ]);
  await practiceTab
    .getByRole("heading", { name: "Live Chat Training", exact: true })
    .waitFor({ timeout: 60000 });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Browser passed: role-aware helpdesk navigation, dark/light contrast and theme persistence, searchable Knowledge Base, redesigned dashboard, desktop/tablet viewport fit, teacher coaching across chat switches, teacher customer replies, autofocus, repeated Enter/button sends, Shift+Enter/IME, failed-send retry, standalone staff/student dashboard links, legacy redirect, scripted practice replies, database error/retry, public entry, bidirectional SSE messages, private notes, reconnect, mobile width, Bengali PDF, Excel export, close, feedback, staff settings.",
  );
})().catch(async (e) => {
  console.error(e);
  if (runningBrowser) {
    for (const [i, page] of runningBrowser
      .contexts()
      .flatMap((c) => c.pages())
      .entries()) {
      await page
        .screenshot({
          path: ".crm-test/live-chat-failure-" + i + ".png",
          fullPage: true,
        })
        .catch(() => {});
      console.error((await page.locator("body").innerText()).slice(0, 1800));
    }
    await runningBrowser.close();
  }
  process.exitCode = 1;
});
