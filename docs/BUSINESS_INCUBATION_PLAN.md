# Business Incubation — approved specification and delivery scope

Date: approved specification 2026-11-04; web verification 2026-11-05, Asia/Dhaka.
Status: web implementation complete and verified for review; merge/push/deployment await the user's instruction. Android implementation remains deferred, with its plan in `ANDROID_PORTAL_APP_PLAN.md`.
Branch: `feature/business-incubation`.
Worktree: a separate checkout named `asm-portal-v2-incubation` beside the development repository (initial development used `.worktrees/business-incubation`).

This plan replaces the initial drafts. The web feature is implemented in the isolated feature branch with database migrations, public/internal reporting, editable sheet views, Excel/PDF downloads and correction history. See `BUSINESS_INCUBATION_VERIFICATION.md` for the checks and `BUSINESS_INCUBATION_OPERATIONS.md` for setup. No production migration, merge, push or deployment is authorized at this stage. Android APK delivery and locked-screen tracking are a later stage; the web UI identifies its foreground-only GPS limitation explicitly.

## Confirmed requirements

1. Business Incubation is a course-level optional feature. Any course may enable it.
2. A course supports multiple independent programs, each targeting one or multiple existing batches, with its own teams, funds, settings and accounts.
3. Students come from existing All Batch Info records and use existing student portal accounts. No duplicate student onboarding or separate credentials.
4. Student and staff portals each receive a Business Incubation entry and workspace. Staff includes administrators and permitted teachers.
5. Team creation follows the existing Competitions/Battle of Cups interaction: select batch, select existing students, name team, select lead, edit membership. Use separate incubation records so changing a competition does not change incubation history.
6. Only the selected team lead posts financial entries. Members record their own field activity, FGD and insights. Authorized staff manage programs, catalog, funding, teams and corrections. No deputy financial access is inherited from Competitions.
7. Teams remain intact during rotation. Only their assigned product category changes. Staff explicitly select which category each team receives and the sprint duration, which can be three, four, five or another chosen number of days.
8. Do not assign selling territories or require a fixed selling zone. Staff maintain a broad-area reference list, similar to category management; students select the broad area where they actually work/sell.
9. Unsold products can be returned to the supplier or given to another team. The source team records this as a return, with quantity and actual money received. Destination and accounting reconciliation must be traceable.
10. No dedicated credit-sales/debt-collection workflow is requested. Students record sales revenue and actual cash separately; a difference requires a reason. Customer returns/refunds have a separate form.
11. Institution funding must be returned and reconciled at program end. Profit remains with the team.
12. Every procurement requires an uploaded voucher. This is mandatory, not an optional inherited default.
13. Program rules are manually configured. Do not silently copy legacy start dates, four-day sprint defaults, two-day limits, sixteen-hour caps, or historical settings.
14. A maximum field-session duration is optional: if staff configure it, enforce it; otherwise no duration cap. A day's sales may be submitted on that day or the following day in Asia/Dhaka. Older submissions require staff approval before posting.
15. Android app tracking is required while a student has an active field session, including while the screen is locked. No iPhone application is in the approved scope. A browser-only workaround is not a substitute.
16. The staff dashboard must provide useful business insights with program, batch, date/range, sprint, category, product, team and broad-area filters. Individual filters apply to field activity, FGD/insights and audit actors; there is no person-level sales or profit report.
17. Extend the current PostgreSQL database with empty feature tables. Import no legacy users, passwords, products, teams, transactions, locations or GPS data. Do not seed business data or configuration from the legacy project.
18. All new work is isolated in this worktree. Do not merge to main unless the user explicitly instructs it after review. Approval to implement does not imply approval to merge or deploy.
19. Students can browse dated submission history, select an incorrect entry and request a correction. Existing values appear read-only beside proposed new values. Authorized administrators/teachers review in a dedicated Correction Requests section. Approval replaces the visible effective record and recalculates reports; immutable history preserves who changed what, when, why, before/after values and correction counts.
20. Reports have a portal view and a public view comparable to Competitions. Report pages also contain separate sheet-style data tabs; administrators can edit records directly with validation and history. Reports download as real `.xlsx` workbooks and `.pdf` files.

## Evidence and integration findings

- Legacy ZIP is named `V2.zip`, but code/README identify Incubator V3.0. Relevant files include `Schema.gs`, `ApiTeam.gs`, `ApiAdmin.gs`, `Inventory.gs`, `Data.gs`, `Auth.gs`, and client scripts.
- CSV has exactly eight configuration rows, not a complete historical sheet export. `Migration.gs` and `FinalData.gs` are legacy import/data sources; do not execute them.
- Existing portal uses Next.js/React, Prisma/PostgreSQL, course-scoped database transactions with RLS, course feature toggles, page permissions, existing student/batch identity and persistent upload storage.
- Competition team screen reads existing batches/students and selects members/lead. Competition code additionally supports deputy posting, which is explicitly excluded from incubation finance.
- Live infrastructure has not been inspected. Repository deployment files alone do not verify the current production configuration.

## Approval scope and implementation choices

All requested operational questions have been answered. The following concrete choices are included in this plan for review; no additional response is needed for each item if the plan is approved.

- An inter-team handover is one linked source return/destination procurement, with agreed quantity/amount, destination-lead acceptance and mandatory handover evidence. It posts both stock and money sides atomically once, with no dedicated debt-collection lifecycle.
- A late sales submission includes the intended historical date, complete proposed data and reason. It stays pending and does not change posted stock/cash/reports until an authorized administrator/teacher approves it. Approvals are scoped to the specific submission, not a permanent backdating bypass. Apply the same guarded history workflow to other financial forms as an implementation choice.
- Pending corrections leave the current record effective. Staff approval revalidates current version, chronological stock, attachments and all related financial records; rejection leaves the original unchanged. Direct admin edits use the same posting engine without requiring a separate self-approval.
- Public reports are explicitly published/unpublished by staff. Proposed public scope is team-level aggregate business results and approved charts, without GPS trails, personal field details, vouchers, private notes, correction history or editable raw sheets. Use an opaque revocable share link and a dedicated public API projection. This boundary applies to downloads too.
- Proposed Android design is a Kotlin tracking component plus a portal WebView, so students keep using the same portal forms. Native session-scoped authorization and a restricted bridge connect the existing authenticated portal to location updates. Select final SDK versions at implementation using supported official tooling.
- Tracking cadence and retention are program setup fields, with last-seen/accuracy/stale state on the dashboard. No silent indefinite retention or tracking outside a field session.
- Startup prerequisites: Android SDK/JDK/build/signing tooling must be installed or provided through build infrastructure, and at least one physical Android phone must be available for locked-screen acceptance. The current local command lookup did not find Java, Gradle or adb; it does not prove tools are absent elsewhere. Build/signing/distribution readiness and device testing are explicit delivery gates.

## Workspaces and complete workflow coverage

### Staff workspace

- Program setup wizard: name, dates, target batches, assigned staff, manually entered rules and draft/active/closing/closed/archive state.
- Teams: batch roster picker, member selection, leader selection, membership history and prevention of duplicate active program memberships.
- Catalog: categories, products, variants, units and broad areas; prevent destructive deletion of referenced items.
- Rotation calendar/matrix: staff assign category per team per sprint; preview schedule; reject overlapping assignments; preserve history when later settings change. No territory-assignment calendar.
- Funding: disbursement by round, team cash reconciliation, principal return and final settlement receipts.
- Records: procurement, sales, supplier/other-team returns, damage, expenses, customer refunds, vouchers, correction requests and audit history.
- Field operations: active sessions, last reported position/time/accuracy, students' selected broad areas, carried goods, returned unsold goods, steps and evidence.
- Learning: FGD findings/actions and market insights; filter by team/person/date/category.
- Preserve the legacy learning fields: FGD's three findings and three next actions; insights' best customer segment, top objections, why customers bought and best broad area, with date/team/submitter. Field records retain steps and optional pedometer proof, carried-item quantities, check-in/out positions and session history.
- Reports: business overview, cash flow, stock, gross/net operating profit, return/damage rates, category/product performance, broad-area results, field hours, student participation and missing submissions.

### Student workspace

- Program selector and today's assigned category/sprint, with team and permitted reports.
- Lead forms: multi-line procurement with voucher, team sales, expenses, supplier/other-team return, customer return/refund, damage, correction/late-entry requests and dated submission history. No selling-member picker or individual-sales leaderboard.
- Member forms: GPS check-in/out, actual broad area, carried goods and return to team custody, steps/evidence, FGD and market insights.
- Clear pending/saved/error states, Bengali validation, mobile layouts, searchable selectors, photo compression/preview and safe retry behavior.

### Reporting attribution

Sales and profit belong to the team. Record the financial submitter for accountability, not as personal sales performance. Personal reporting covers field/FGD/insight participation. Clearly mark incomplete current-day reports. Team comparisons disclose their metric and do not replace the business dashboard.

Filters compose and apply consistently to tables, totals, charts and exports. Money/stock balances require opening balances before the selected period, rather than simply summing only visible transactions. Show sales revenue, collected money, stock at cost, expenses, returns, damage, institution funding outstanding and settlement discrepancies separately.

## Data sheets, corrections and exports

The internal report page provides Dashboard, Data Sheets, Corrections, Late Submissions and History sections. Data Sheets has separate tabs for Procurement, Sales, Supplier/Team Returns, Customer Refunds, Damage, Expenses, Funds/Settlements, Inventory, Field Sessions/Carried Goods, FGD, Insights and Tracking History (restricted staff access).

Each sheet supports date/program/batch/team filters, search, sort, pagination, source-record links and appropriate totals. Admins can edit source fields through cells/row editors with dropdowns, validation, save/cancel and reason. Derived totals/stock/profit are read-only and recomputed. Paste/multiple-row changes show a validation preview and explicit commit; no partial silent saves or undocumented row limits that truncate data. No inline editor is exposed on public reports.

Students see their team's history by business date and actual submission timestamp, including purchased quantities, sales, expenses, returns and status. A Correction Request opens the immutable old values alongside new inputs, reason and evidence. Reviewer tools show the field differences and expected stock/money effects. When applied, current reports show the corrected version while before/after revisions remain in History; the previous record is superseded, not physically destroyed.

Financial correction requests remain lead-only. Members may request correction of their own individual field/learning records, subject to the same authorized review and history. Replacing a lead never hides earlier team entries from the new lead or reattributes their original author.

Linked inter-team records cannot be independently changed in a way that breaks the other side. Their correction reverses/replaces both sides atomically and observes both teams' current stock. Admin edits of closed-period records remain available through an explicit audited correction/reopening action; ordinary student submissions do not reopen a closed program.

Excel export produces a formatted `.xlsx` workbook with summary, filter metadata, team results and separate operational sheets for the selected scope. Provide current-sheet/current-filter export and full authorized program export; export must include all matching rows, not only the current pagination page. Preserve number/date types, headers, totals, BDT units and neutralize spreadsheet formulas in user-entered text.

PDF export produces a downloadable `.pdf`, not only a browser print instruction. Include program/title, selected filters, reporting/generated timestamps in Asia/Dhaka, KPI summary, charts, team tables and requested details with repeating headers, page numbers, Bengali font embedding and readable multipage layout. Public exports use only the public projection.

Dashboard, sheet totals, public results and downloads derive from the same posting/reporting model. A committed correction invalidates/reloads affected views; pending/rejected work never changes official totals. Verify returned data and rendered visuals together, including empty, zero, negative-profit and long-name cases.

## Locked-phone tracking architecture — retained for the later Android stage

This section records the future mobile design. It is not a deliverable of the currently authorized web implementation; see `ANDROID_PORTAL_APP_PLAN.md`.

Web geolocation is tied to an active document and visibility. A web page or PWA alone cannot satisfy a reliable locked-screen tracking requirement. Include a native mobile location component with the portal backend, rather than claiming foreground updates satisfy this requirement.

- Student starts an explicit field session; authorized native component sends authenticated, session-bound samples. Check-out stops collection. Staff cannot silently start another person's tracking.
- Android uses supported native location APIs and a visible location foreground-service flow, with explicit permissions and in-app session state. No iPhone build is required.
- An Android portal wrapper uses only trusted HTTPS course origins, restricted navigation and a narrowly scoped native bridge. Use device/session-bound tokens with revocation instead of embedding credentials or exposing broad account tokens to arbitrary pages. Sign-out, revoked membership and ended sessions stop further tracking authorization.
- Store captured-at and received-at timestamps, accuracy, session/device identity and deduplication key. Buffer location samples during network loss and sync in sequence. Do not treat stale or delayed points as live.
- Validate permissions, expired/revoked sessions, active program membership, device clock anomalies, duplicate uploads and unreasonable coordinates. Location is evidence, not proof against spoofing.
- Test actual locked screens, low-power/battery restrictions, permission revocation, intermittent network, app termination and sign-out. No promise of uninterrupted tracking when the OS kills the app, the user force-stops it or location is disabled.
- Implement session-only collection, admin-set retention and permitted staff viewing; show a clear tracking indicator and stop state. A student can see their own session state. Public reports never include individual coordinates.
- Deliver a signed installable APK, source, repeatable build steps, signing/upgrade procedure and concise student install/permission instructions. Keep signing secrets outside the repository. Play Store publication is not assumed by the APK delivery plan.

Primary references checked on 2026-11-04:
- [W3C Geolocation](https://www.w3.org/TR/geolocation/)
- [Android background location](https://developer.android.com/develop/sensors-and-location/location/background)
- [Android FusedLocationProviderClient](https://developers.google.com/android/reference/com/google/android/gms/location/FusedLocationProviderClient)
- [Apple background location](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)

## Database and correctness design

Use the existing main Prisma schema with `incubation_` tables and reviewed migrations. Proposed entity groups:

| Group | Entities |
| --- | --- |
| Setup | Program, ProgramBatch, ProgramStaff, Settings/version |
| Teams | Team, TeamMember/effective dates, LeadAssignment |
| Catalog/schedule | Category, Product, BroadArea, Sprint, TeamCategoryAssignment |
| Business documents | Purchase/lines, Sale/lines, Expense, SupplierReturn/lines, Damage, CustomerReturn/lines |
| Accounting | FundMovement, Settlement, stock/money movements linked to source documents |
| Handover | Linked team return/receipt and acceptance |
| Field | FieldSession, CarriedItem/CustodyMovement, LocationSample/device binding |
| Learning/control | FgdLog, MarketInsight, Attachment, CorrectionRequest, RecordRevision, LateSubmission, AuditEvent, durable SubmissionKey, PublicReportShare |

All records carry appropriate course/program references. Use composite constraints to prevent references to another course/program, database-enforced active team/lead/session invariants, RLS with the existing course context and runtime-role grants. Check program/team authorization within a course. New attachment access checks must protect every available serving/deletion path.

Use fixed-precision decimal money and permitted fractional quantities by unit. Distinguish effective business date from actual submission time; use Asia/Dhaka for reporting. Keep historical actor/product/team snapshots without losing stable references.

Post documents, stock movements, money movements and audit in a single transaction. Aggregate repeated product lines, atomically protect stock under concurrent requests, maintain durable idempotency with payload fingerprints and reject stale correction approvals. Verify historical stock availability for backdated changes.

Field-carried goods move custody within team ownership; prevent simultaneous members each taking the entire same stock. Record unsold goods coming back and connect sales to custody without reducing stock twice. An inter-team handover changes ownership only through the approved documented flow.

Use reversals/replacements for posted financial corrections, with reason and reviewer. Do not erase financial history. Category rotation alone never moves goods or money. Active/closed program state and explicit configured rules apply server-side. Admins can correct any period through an audited override/reopening; there is no unlogged direct database editing UI.

Proposed inventory valuation is moving weighted average; document historical replay/revaluation for approved backdated changes. Cash and operating profit are distinct. Funding/return of principal affects capital/cash, not revenue/expense. Display sale amount minus actual received money as an explained/unexplained cash variance, without creating an implied debt-collection module or silently writing it off. Do not present uncollected revenue as distributable cash.

Customer refunds reference the original sale and cannot exceed remaining sold quantity/refundable amount without an explicit audited staff adjustment. Record actual refund, condition and whether goods return to saleable stock or damage. Supplier returns record actual refund and quantity; differences from stock carrying cost appear transparently in return gain/loss. Internal transfer value is recorded consistently on both teams; eliminate internal gains from institution-wide consolidated external results rather than treating a team handover as an external customer sale.

Fund settlement tracks disbursed principal, acknowledged principal repayments, remaining principal, counted cash, stock and variances separately. Authorized staff acknowledge institution receipts. Profit stays with the team. A loss or cash shortage does not automatically waive institution principal; unresolved amounts remain visible until staff explicitly resolve them with an audit reason.

## Worked accounting acceptance example

Illustrative specification only; never insert these examples into production.

Team receives BDT 5,000, buys ten units at BDT 100 each, sells six at BDT 150 for cash and spends BDT 100 on transport.

| Measure | Expected |
| --- | --- |
| Remaining stock/value | 4 units / BDT 400 |
| Revenue / cost of goods sold | BDT 900 / BDT 600 |
| Gross / net operating profit | BDT 300 / BDT 200 |
| Team cash | BDT 4,800 |

Returning two unsold units to the supplier for BDT 200 leaves two units valued at BDT 200 and BDT 5,000 cash; profit stays BDT 200. A linked handover at cost to another team must produce the same source result plus two units and BDT 200 cash outflow in the receiving team, with no institution-wide artificial sales profit.

Alternatively, selling the four remaining units for BDT 600 leaves BDT 5,400 cash, no stock and BDT 400 net profit. Returning BDT 5,000 principal leaves BDT 400 cash and does not reduce profit. This BDT 400 remains with the team.

If the original BDT 900 sale reports only BDT 700 received, show BDT 200 cash variance with its reason and BDT 4,600 actual team cash; do not invent a later collection record or silently reduce reported sales. Closure identifies and resolves this variance explicitly.

A sale for 2026-11-04 may be filed on November 4 or 5 (Asia/Dhaka). On November 6 it becomes a pending late submission; approval posts it once on the effective business date and retains the actual submission/review timestamps. A correction from quantity 6 to 5 stays pending with original quantity 6 still effective; approval replaces the visible quantity, recalculates inventory/money, and preserves both versions and correction count.

## Authorized web implementation phases

1. Freeze this specification, role matrix, screen map and accounting acceptance examples; prepare isolated development/test database settings. Retain Android prerequisites in the separate future plan.
2. Add schema, RLS/grants, feature toggle default off, permissions, roster integration and empty setup. No seed/import.
3. Build teams/catalog/broad areas/program settings and manual category rotation.
4. Build transactional stock/finance engine, lead forms, returns/handover, funding/settlement, evidence, dated history, side-by-side corrections and late-submission approvals.
5. Build member web field workflow, custody, FGD/insights and foreground GPS updates. Native locked-phone tracking and synchronization are deferred to the Android stage.
6. Build business dashboard, public/internal reporting, editable data sheets, all applicable filters, real Excel/PDF downloads and program closure.
7. Run automated domain/integration checks and desktop/mobile web acceptance tests; provide review build and operating guide. Real Android device testing belongs to the later app stage.
8. Only when the user explicitly instructs: merge to main. Then use the authorized release process with database/storage backup, staging migration verification, production migration checks, selected-course enablement and post-release reconciliation.

Portal boundaries: `src/lib/incubation/`, `src/components/incubation/`, `/dashboard/incubation`, `/student-dashboard/incubation`, `/api/incubation/...`. Android code/toolchain will be created in a later, separately authorized implementation stage.

## Acceptance gates

- Existing login/batch student records reused; no duplicate student registration or imported legacy data.
- New feature disabled by default and enforced at both UI/API; course/program/team and evidence isolation proven.
- Only current lead posts finance; replacing a lead immediately removes old access; teachers receive explicit permissions.
- Rotation follows manually selected categories/dates; no admin-assigned selling territories; broad-area entry works.
- Voucher mandatory for all procurement paths, including confirmed internal handover receipts.
- Concurrent/duplicate/repeated-line sales, field custody, backdated changes, return/damage and stale corrections maintain consistent balances.
- Institution principal returns reconcile to acknowledged receipts and physical stock/cash counts; profit remains with the team and variances are explicit.
- FGD/insights, steps/evidence, corrections, audit and all listed legacy operational functions covered.
- Team financial reports and individual field/FGD reports remain separate. Dashboard filters, sheets, charts and exports reconcile to source documents/opening balances across all pages.
- Today's/yesterday's sales post normally; older submissions remain pending until authorized approval. No totals change before approval, and duplicate approvals post at most once.
- Correction UI shows read-only old versus proposed new values; review/apply/reject, revision history, correction counts and direct admin sheet editing work with chronological stock validation. Closed-record edits and linked-transfer edits remain audited and consistent.
- Public publication/revocation works; public API and Excel/PDF exports omit private coordinates/evidence/notes/history and have no edit endpoint access.
- Excel opens as a real workbook with separate sheets and all matching rows. PDF renders Bengali, charts, long tables, negative/zero values and page headers correctly. Export totals match the same-filter screen.
- Web GPS active-session/permission checks pass; foreground-only behavior and stale states remain explicit.
- Deferred Android acceptance: signed APK installs/upgrades, tracking stops on checkout/signout, offline samples sync without duplication, and permission/battery/force-stop states are shown correctly. Real-device lock-screen evidence will be required in that stage.
- Targeted Vitest/integration tests, TypeScript checks, production build and manual mobile review pass; relevant existing competitions/storage/course-routing regressions checked.
- No merge without explicit user instruction. No production seed/import or silent destructive reset.

Production readiness requires verified deployment access, database role/migration state, backup/restore procedure and upload storage. Feature-disable plus prior application release is the preferred rollback while preserving new records. Database restore is a separate recovery decision because it may discard later writes.

## Review and approval boundaries

The user has authorized the web implementation in `feature/business-incubation`, with isolated development and review builds. Current deliverables are portal source, database migrations, the retained Android plan, automated/manual verification evidence, Excel/PDF examples from isolated test fixtures, operating guide and deployment/rollback instructions. Android source/signed APK and locked-screen tracking are later deliverables.

Do not import historical business data, apply migrations to production, publish Android binaries externally or merge main during development. When the working result is ready, present it for review. Merge occurs only after the user explicitly says to merge; production release follows the user's release instruction. The ultimate objective remains a verified live feature, not merely a local build.
