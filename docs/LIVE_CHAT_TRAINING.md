# Live Chat Training: implementation and operations

This extends the existing CRM. Portal identity remains in database 1. All chat operational data, transcripts, settings, training sessions, QA and audit records are in the separate CRM database. Existing student/admin chat is unchanged.

## Entry points and permissions

- Staff: `/dashboard/crm/live-chat`.
- Student agent: `/student-dashboard/crm/live-chat`.
- Customer: the generated `/live-chat/<workspace>.<secret>` URL on the course host.
- Both `crm` and the new `live_chat` course feature must be enabled. Live Chat defaults OFF.
- Existing `crm_admin` administrators configure the module; `crm_supervisor` staff also need the existing workspace assignment. Teachers do not gain access implicitly.
- Students require current eligible enrollment, a Running course status, a Running batch type, an active batch and active CRM membership. Completion revokes **only Live Chat access**. It does not change portal roles, CRM access or delete history. Streaming access is rechecked.
- Students see their own current and previously handled chats; supervisors see their assigned workspace. Public sessions see only their own customer-facing messages. Internal notes and coaching never go to customer endpoints.

## First-time setup

1. Apply reviewed CRM migrations and runtime grants before deploying/enabling the feature.
2. Enable the two course features through existing course configuration. Grant CRM staff permissions/assignments through Access Management and CRM Settings.
3. Open the CRM's **Live Chat Training** link, choose the batch workspace, open Settings and select **Initialize categories & training references**. This is repeatable and does not reset conversations.
4. Adjust capacity, timeouts, business hours, feedback and rubric weights. Rubric weights must total 100. Default pass mark is 70.
5. Start the background worker and confirm it has no cycle errors.
6. Agents sign in with their existing portal accounts, open the module and explicitly select Available. Initial status is Offline.
7. Create a public practice link or a link attached to a training session. Copy the URL immediately; only its hash is stored. Public links can be paused and expire. A paused link stops new chats while existing sessions can finish.

Customers must enter a name, choose an active category and enter their first message. Accounts, verified phone numbers and email are not required. Names are self-reported. Browser session cookies identify returning customers; shared IP addresses do not identify people. IP-based start limits and per-session mutation limits are stored in the CRM database. Use the trusted reverse proxy configuration already documented for the portal.

## Daily use

**Agent:** Select Available, accept assigned conversations, answer the customer, mark messages read, use references where allowed, add internal notes and document the outcome. Available means eligible for new work; Busy/Away stops new assignments while existing conversations continue. Selecting Offline returns owned active chats to the queue. Closing an unresolved chat never marks it Resolved.

**Teacher:** Watch Dashboard, Queue and Agents. Open a chat to monitor without taking ownership. Use Private coaching to guide its agent, manual assignment to redistribute work, or Take over after explicitly becoming Available. The teacher receives a separate handling segment after takeover. To show a chat to a class, create a Demonstration session and select it from the conversation tools. Demonstration omits customer/agent names and private messages from its payload; teachers must still choose suitable transcripts because a customer's message body may itself contain identifying text.

**Customer role play:** A session link displays the scenario to its customer participant. Teachers or other volunteers can play customers. Self-practice needs another person or an incoming public customer. There is no AI customer in this release.

**Assessment:** Create an Assessment session, choose participants or leave the selection empty for all eligible agents, set its duration and decide whether reference hints are permitted. The session captures its rubric, pass mark and policy. The server withholds hints from assessed agents when disabled. Review a handled transcript, select the actual agent, enter criterion scores and coaching, and release results individually or from the session. Private evaluator notes remain staff-only. Chat assessment results stay inside this module.

**CRM:** Search existing training customers and link a verified reference; names alone never auto-match a customer. Link an existing complaint by its ID, or choose Create CRM complaint. The existing CRM complaint form is used and the saved complaint is linked back to the conversation. Creating/escalating a complaint does not transfer the conversation. If linking fails after saving, the complaint remains saved and the interface tells the agent to link it manually.

## Assignment and lifecycle

The queue uses FIFO and longest-idle eligible Available agents, ordered by last assignment with a deterministic tie-break. The default capacity is 3 chats. Busy/Away/Offline, stale heartbeat, inactive membership, session eligibility and capacity affect routing. The workspace advisory transaction lock plus a unique open-assignment index prevent duplicate ownership under concurrent calls and workers.

Transfer invitations keep the old owner until accepted; capacity and availability are rechecked on acceptance. Invitations expire after the acceptance timeout. Manual supervisor assignment is immediate; it still checks the target's eligibility and capacity. Queue-entry time stays unchanged across transfers and requeues.

Defaults: 30 seconds to accept; 60 seconds for the first human reply and subsequent replies; 60 seconds disconnect grace; customer inactivity warning at 5 minutes and closure at 10 minutes; queue timeout at 15 minutes; reopen window 1 hour; service objective 80% within 60 seconds. These are configurable training policies, not a universal corporate standard. New sessions and conversations snapshot the policy so later edits do not alter their targets. Capacity and agent connectivity use current operational settings.

Accepted chats without a first reply are requeued after the configured period and the unresponsive agent becomes Busy. Customer silence only closes a conversation when the agent is not leaving an unanswered customer request. A missing customer heartbeat is first recorded as disconnection, not immediate abandonment; sustained absence eventually becomes Dropped (answered) or Abandoned (unanswered). Ending a training session/batch closes remaining conversations as unresolved. Reopening creates a linked lifecycle record and keeps the original transcript/KPI record intact.

## Reporting definitions

- Conversation volume uses a creation-date cohort; statuses are current, not a reconstructed historical snapshot.
- FRT: original queue entry to the first human agent message. Automatic messages and private notes do not count.
- Queue wait: original queue entry to the **earliest** recorded agent acceptance, including across transfers/requeue.
- ART: original queue entry to successful resolution; unresolved conversations are excluded.
- Agent reply time: first unanswered message of a consecutive customer message burst to the next human reply. Follow-up messages do not reset the starting clock.
- AHT: elapsed accepted handling time split equally across that agent's concurrent assignments, plus declared wrap-up. Completed, answered segments contribute to AHT. It is not keyboard-active time; open work is excluded from this average. The report describes this basis explicitly.
- Service level: chats answered within their saved FRT target divided by all chats in the selected cohort. Abandoned/unanswered entries remain in the denominator; no short-abandon exception is applied.
- Availability duration is integrated from status events inside the selected reporting period. This is session/presence time, not proof of attendance.
- Customer satisfaction and teacher QA are separate. No speed-only ranking is generated.

Filters: workspace/batch, dates, agent, training session and status. Date inputs currently select Asia/Dhaka calendar boundaries; timestamps are UTC in storage. Reports include generation time, timezone and filter metadata. Excel includes summary, conversations, agent metrics, daily totals and QA sheets. PDF includes summary, agent metrics, QA and conversation outcomes. Authorized transcript PDF includes internal material and is labelled Internal training; it is not a customer download.

Limits fail visibly rather than silently truncate reports: 20,000 conversations, 50,000 assignment segments, 100,000 events. PDF reports are limited to 1,000 conversations; use Excel or narrower dates above this. Transcript exports stop above 10,000 messages. The UI uses 50-conversation pages and 100-message pages with stable sequence/cursor ordering. Incremental updates retain previously loaded pages.

History is retained after batch completion; there is no automatic destructive purge. Backups and any exceptional deletion remain administrator operations with separate review.

## Coolify release

No production database or deployment is changed by local development/test scripts.

1. Back up the portal and CRM databases and verify restore procedures.
2. In a one-shot release job supply the CRM owner URL as `CUSTOMER_SERVICE_MIGRATION_DATABASE_URL` and the restricted CRM runtime URL as `CUSTOMER_SERVICE_DATABASE_URL`. Keep the owner URL out of both web and worker containers.
3. Run `npm run crm:migrate`, then `node scripts/customer-service-role.cjs`. These are additive migrations. The grants script preserves append-only audit/message restrictions.
4. Build/deploy the application normally. Docker generates both Prisma clients and copies the shared worker engine, generated client and bundled licensed Bengali font.
5. Add a worker service from the same application image, command `node scripts/live-chat-worker.cjs`, working directory `/app`, user `1001:1001`. It needs **restricted runtime** `DATABASE_URL` and `CUSTOMER_SERVICE_DATABASE_URL`, not owner URLs. Do not run the web bootstrap command in the worker.
6. `docker-compose.live-chat.yml` is an optional overlay showing that configuration. Its `LIVE_CHAT_PORTAL_DATABASE_URL` must point to the portal's restricted runtime account. Attach the worker to the same private networks as both databases. There is no public worker port.
7. Enable the course feature, initialize the workspace and run customer/agent smoke tests through HTTPS. Verify SSE responses are not proxy-buffered and have adequate proxy connection timeouts.
8. Review worker logs for cycle failures. Queue state/events are durable in the CRM database; the next worker cycle resumes processing after a restart. Multiple workers serialize workspace operations using database locks.

Rollback: disable `live_chat`, stop the worker, and roll back application code if necessary. Retain the additive tables and transcripts. Do not reset either database. The existing CRM and student/admin chat need no data migration for rollback.

## Local verification

Start with `npm ci` and `npm run generate:all` in the feature worktree. Dependencies, generated clients, ignored fixtures and build output belong to that worktree; no shared `node_modules` link or production `.env` is required.

`node scripts/live-chat-test.cjs` uses only `.crm-test/password` and fixed `127.0.0.1:55439` databases `portal_test` / `crm_test`; it never takes a production URL from `.env`. It applies migrations twice, applies runtime grants and runs policy/integration tests.

Add `--regression` to run the existing CRM tests together with Live Chat tests. Playwright is resolved from the lockfile-installed dev dependency rather than an ignored tools directory.

For browser checks: run it with `--browser-fixture`, start `node scripts/live-chat-dev.cjs`, then run `node scripts/live-chat-browser.cjs`. The isolated server listens on port 3118 and writes build output under ignored `.crm-test`. The browser script uses the installed Chrome through Playwright and creates only local fixtures. Do not publish its ignored cookie/environment files.

`node scripts/live-chat-build.cjs` runs the production compiler with isolated test URLs and a separate build directory. The ordinary production build command and config remain unchanged.

## Verification record (2026-11-05)

- 61 CRM + Live Chat automated tests passed (39 existing CRM checks and 22 Live Chat checks).
- Local 60-agent / 60-concurrent-customer assignment workload passed. This tests database routing concurrency; it is not a production-server capacity certification or a 60-browser soak test.
- Browser flow passed: mandatory entry fields, bidirectional SSE messages, private notes, refresh/reconnection, mobile width, close, customer rating, staff settings, current dashboard, Excel download, Bengali transcript PDF and report PDF.
- The standalone worker completed a local `--once` cycle successfully. Recovery/idempotency also has database integration coverage.
- TypeScript project checks passed earlier in implementation. At the final check, concurrently added Incubation code caused whole-project errors (missing Incubation Prisma models and `@electric-sql/pglite` / `@electric-sql/pglite-socket` dependencies). Those unrelated changes were left intact; a separate TypeScript check of Live Chat routes, UI, services and tests passed. The transcript and report were rendered for visual verification.
- Full optimized production build remains unverified on this Windows machine: Next.js globbing attempts `C:\Users\USER\**\*` and fails at the protected `Application Data` junction, including when rerun with filesystem access and explicit tracing root. A clean Linux/Coolify build is still required before release. No successful production build or deployment is claimed.

## Isolated worktree retest

The feature was initially implemented as uncommitted edits in the main checkout. At the user's request, those 46 feature files were backed up, copied with SHA-256 verification into `feature/live-chat-training`, and removed from main without removing unrelated documents. The final worktree is the sibling directory `../asm-portal-v2-live-chat`, based on main commit `6de1bc9`. Main has no Live Chat source changes and no merge/push/deployment has run.

The worktree uses its own clean `npm ci` installation and freshly generated portal/CRM Prisma clients. All 61 CRM + Live Chat tests pass there, including 60 concurrent customer starts, full 180-chat agent capacity and overflow queue checks. The complete project TypeScript check passes there as well: the earlier Incubation type/dependency errors are resolved by the clean dependency installation and client generation.

The public/agent browser flow, mobile width, reconnect, internal-note privacy, customer feedback, teacher settings/dashboard, Excel export, Bengali transcript PDF and report PDF all pass from the isolated worktree. The standalone worker's `--once` cycle also passes. The optimized production build was retried in that worktree and still fails at the Windows `Application Data` junction; it is the remaining build-verification blocker. The feature is not represented as release-ready until that check passes in a suitable environment.


## Dashboard entry and batch practice update (2026-11-06)

The original feature was merged into main at ab8a271. This follow-up is isolated on branch fix/live-chat-entry-practice; it has not been merged, pushed or deployed.

Staff now enter at /dashboard/live-chat and students at /student-dashboard/live-chat from the main portal sidebar, immediately above CRM. Existing CRM Live Chat bookmarks redirect with their query parameters intact. Existing CRM permissions and course/batch guards still apply. An administrator can select an unconfigured batch in the Live Chat workspace selector to provision its shared batch workspace directly.

Each active batch workspace receives 60 fictional pending conversations on its first state load. The loader also adds bilingual categories and default references without overwriting existing configuration. Ten scenarios cover payment, delivery, refund, account access, wrong product, interruption, sales, cancellation, scheduling and complaint follow-up. Each conversation includes a fictional reference and a practice brief. Students select Start practice; capacity and assignment permissions still apply. Unstarted examples remain pending and do not expire or consume live routing capacity. Timers begin at the first practice assignment. The optional practiceAutoAssign setting enables automatic assignment; it is disabled by default.

Customer replies follow four saved script steps, one per agent message. They are labelled scripted practice; they do not understand arbitrary replies or evaluate quality. Teachers assess the conversation. Public links and teacher role-play continue to provide human customer conversations. Cases and replies are stored in CRM database 2. Reloading or running Load 60 practice chats does not duplicate cases or reset completed work. A new batch gets a separate set; previous batch transcripts remain available to authorized staff.

### Diagnosing the deployed error

The screenshot's generic error alone does not establish the production cause. Missing chat tables/columns or runtime grants now return CHAT_DATABASE_SETUP_REQUIRED, connection failures return CHAT_DATABASE_CONNECTION, and server logs contain safe error codes. An empty message-preview query is skipped and nonempty preview IDs are explicitly cast to text[]. A failed initial load now shows a Retry action rather than an endless loading panel.

Run npm run chat:setup -- --check in a one-shot job using the portal runtime DATABASE_URL and CRM runtime CUSTOMER_SERVICE_DATABASE_URL. This is read-only and checks tables, columns, role restrictions and grants, including the message sequence. To apply additive migrations, grant runtime permissions and preload eligible batch workspaces, run npm run chat:setup -- --migrate --seed --course telesales in that job, additionally supplying CUSTOMER_SERVICE_MIGRATION_DATABASE_URL. Use the actual course slug. Keep the migration owner URL out of the web and worker services. This includes migration 202611060001_chat_practice; deploy the corresponding generated Prisma client to both services.

No production migration was executed during this fix. The Coolify log/error code and production setup status were unavailable, so the exact live failure remains to be confirmed by the setup check and post-deployment smoke test.


### Follow-up verification

- 69 CRM and Live Chat tests pass, including idempotent per-batch loading, protected practice claims, scripted reply deduplication, pending retention and cross-batch denial.
- Four dashboard permission tests pass, including registration of the standalone Live Chat path.
- Full project TypeScript validation passes.
- Browser checks pass for main Dashboard links for staff/students, legacy bookmark redirects, persisted scripted replies, simulated setup error and Retry recovery, public entry, human SSE replies, private-note privacy, reconnect, mobile width, closure/rating, staff settings, Excel and Bengali PDF exports.
- The database setup check, idempotent course seed and standalone worker --once pass against fixed disposable local databases.
- Production build remains unverified due to the Windows glob/junction issue recorded above. No merge, push or production database change is included in this follow-up.


## Desktop/tablet composer follow-up (2026-11-06)

Changes are isolated on fix/live-chat-workspace. No database migration or seed is needed for this UI fix.

The agent/supervisor workspace uses the available viewport height at widths of 768px and above, with independent scroll areas for the queue, transcript and conversation tools. The composer stays visible without page scrolling. At tablet widths below 1180px, conversation tools are a toggleable side panel so the transcript retains usable width. Other tabs scroll within the workspace. Existing public customer layout remains available.

A conversation-selection effect previously reset the message kind to MESSAGE even when a non-owner supervisor had only the COACH option. The dropdown displayed coaching while the controlled state and disabled Send condition still referenced MESSAGE. The selection now stays synchronized with valid options and its customer/private visibility label. Customer-facing replies still require an accepted active assignment; queued practice uses Start practice, and other supervisors use the existing availability/Take over flow. Coaching remains private and server-side permissions remain enforced.

The composer focuses when a selected chat becomes writable and returns focus after Send if the user has not moved to another control. Enter sends; Shift+Enter inserts a new line; IME composition Enter does not send. A failed send retains its draft and request identity. Repeated key presses are guarded while sending; typing the next draft during a pending request does not let the previous response erase it. Incoming updates scroll only the transcript when following the latest messages, preserving intentional review of older messages.

Verification: full project TypeScript and all 69 CRM/Live Chat regression tests pass. Expanded browser checks cover teacher coaching across two queued conversations, teacher customer replies after claiming practice, student replies, repeated Enter/button sending, focus restoration, failed-send retry, multiline and IME handling, and viewport containment at 1920x1080, 1366x768, 1280x720, 1024x768, 768x1024 and 1024x600. Existing public chat, private-note isolation, reconnect, exports and staff settings checks also pass. The Linux production build and deployment are not claimed by these local checks.


## Helpdesk design and local themes (2026-11-06)

The reference-inspired redesign is isolated to the internal Live Chat workspace on feature/live-chat-helpdesk-design, based on the earlier tested composer/layout fix af324b2. It does not change the customer CRM, the portal-wide theme or the anonymous public chat design. No new dependencies, schema changes or migrations are needed.

The sidebar contains the existing permission-aware Dashboard, Live Chat, Queue (staff), History, Agents, Sessions, Reports and Settings (staff). A searchable Knowledge Base exposes the reference materials already returned by the authorized API; assessment restrictions continue to be enforced by that API. Saved replies/reference text can be copied, with a visible fallback message if clipboard access fails. Tablet navigation uses an icon rail with accessible names and tooltips. Conversation tools open in a separate panel at narrower widths; the composer and independently scrolling transcript remain inside the viewport.

The header offers a dark/light toggle. The preference is stored only in the current browser under asm-live-chat-theme; dark is the initial default. Theme CSS variables are scoped to .lc-workspace. Both themes cover navigation, dashboard cards, tables, forms, chat bubbles, status badges, private coaching, internal notes and errors. Theme changes do not animate colors through unreadable intermediate states.

Dashboard cards and the status-distribution chart use actual scoped API counts. Agent presence uses heartbeat freshness and availability, with online agents shown first. Queue previews and response alerts clearly describe their current-page scope. There are no invented uptime/SLA percentages, historical trends or sample dashboard metrics. Student status totals retain their existing assigned-conversation scope. Public role-play and teacher coaching behavior remain unchanged.

Verification: all 69 CRM/Live Chat regression tests and whole-project TypeScript checks pass. Browser tests pass for the sidebar, Knowledge Base search/empty state, dark/light persistence after reload, measured 4.5:1-or-better contrast on representative dashboard text, teacher and student messages, private coaching across conversation switches, focus/draft preservation, keyboard/IME behavior, viewport containment at six desktop/tablet sizes, public messaging, exports and settings. Screenshots of both dashboard themes and both chat themes were reviewed locally. No merge, push or production deployment was performed for this redesign; the previously documented Windows production-build limitation remains.
