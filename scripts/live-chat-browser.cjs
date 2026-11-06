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
    "Browser passed: standalone staff/student dashboard links, legacy redirect, scripted practice replies, database error/retry, public entry, bidirectional SSE messages, private notes, reconnect, mobile width, Bengali PDF, Excel export, close, feedback, staff settings.",
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
