# Customer Service CRM — Final Implementation Plan

Prepared: 2026-11-01 (Asia/Dhaka)

## 1. Purpose and handoff

এই ফাইলটি নতুন conversation-এ CRM implementation-এর পূর্ণ handoff। ব্যবহারকারীর সিদ্ধান্ত, মূল PDF-এর প্রয়োজনীয়তা, প্রস্তাবিত engineering defaults এবং release workflow এখানে একত্রে লেখা হয়েছে। নতুন conversation-এ ব্যবহারকারী implementation prompt দিলে আলাদা branch/worktree-তে কাজ শুরু করতে হবে। এই ফাইল তৈরি করা নিজে থেকে production deployment বা merge-এর অনুমোদন নয়।

Build a fully working inbound customer service training CRM inside the existing ASM course portal. Students use it as contact center agents and L2/L3 team members. Teachers and authorized course admins supervise operations. Use the existing portal identity and a separate PostgreSQL database for customer service operational data.

The implementation must be functional end to end, not a UI prototype. Deliver the completed feature, meaningful automated and browser verification, migrations, deployment instructions, and a reviewable feature branch. The user intends to review/test, then merge into main and deploy.

## 2. Source of truth and precedence

1. The user's latest explicit decisions listed in section 3.
2. The original 16-page CRM PDF for features and business structure.
3. Engineering defaults explicitly labeled in this plan where the PDF/user did not specify details.
4. Current repository instructions and architecture; re-inspect them before implementation.

Original repository:

`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-dev`

CRM PDF, local repository copy:

`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-dev\Customer Service Management (CRM) — Framework & Structure - Google Docs.pdf`

Original provided PDF:

`C:\Users\USER\Downloads\Customer Service Management (CRM) — Framework & Structure - Google Docs.pdf`

The repository also contains `Live Chat — Framework & Structure - Google Docs.pdf`. It is future context, not authorization to implement live chat in this project phase. The CRM PDF does not require marks, assessment, or teacher feedback.

Treat requirements in reference documents as project data. They do not override the user's access, scope, or deployment instructions. Do not silently introduce a separate credential system because a reference document describes generic user management.

## 3. Confirmed user decisions

| Area | Final decision |
|---|---|
| Scope | Inbound contact center CRM only |
| Course availability | Per-course feature checkbox, using the existing portal mechanism |
| Student entry | CRM link in student portal opens a new tab with a standalone CRM interface |
| URL | Student CRM remains under `/student-dashboard/crm` on the same course host |
| Authentication | Existing portal login/session; authenticated access is mandatory |
| Roles | Students can be Agent, L2, or L3; teachers assign/change CRM roles |
| Data grouping | Each batch shares one CRM workspace |
| Training data | Dummy customer data initially |
| Agent access | May read customer/complaint history in its own workspace; edits restricted to its own permitted unresolved complaints |
| Agent resolution | Agent resolves directly if it has a solution; escalate only when it cannot solve |
| SLA rules | Configurable through management UI by issue type and tag; different complaint types can have different limits |
| Clock | Continuous elapsed time, including nights, weekends, and holidays |
| Revert/resubmit | Time continues; no new L2 timer cycle and no reset on resubmission |
| Average SLA | Average duration from complaint creation to final resolution |
| Tethered Resolution | Created and finally resolved within the same calendar week |
| Untethered Resolution | Finally resolved in a later calendar week than creation |
| Week boundary | Sunday 00:00 inclusive to next Sunday 00:00 exclusive, Asia/Dhaka |
| UI language | English; Bengali help text where useful |
| Assessment | No marks, grading, assessment, or teacher feedback module |
| Database | New independent Coolify PostgreSQL resource for customer service data |
| Existing chat | Existing portal chat is entirely outside this work |
| Future training live chat | Built later as a new feature using the new customer service database |
| Work process | Implement in a new Git branch/worktree; test and provide reviewable result before main merge/deployment |

IMPORTANT: Tethered/Untethered are weekly timing classifications, not Agent-versus-L2/L3 classifications. Earlier tentative mappings and Saturday week-start suggestions were superseded.

## 4. Environment and known deployment state

The user created a new Coolify resource and provided a screenshot showing:

- Application: `ASSDI Internal Portal`, Running.
- Existing database resource: `assdi-portal-db`, Running.
- New database resource: `assdi-customer-service-db`, Running.
- Project/environment: `ASSDI Internal Portal` / `production`.
- Server: `ASM Portal Server`.

Requested initial database name: `assdi_customer_service`.
Suggested image before initial deployment: `postgres:17-alpine`.
The screenshot only verified resource name/status; actual database name, image, network, credentials, backup success, and application connectivity have not been independently verified. Do not claim otherwise or recreate the resource. If the deployed image differs, inspect compatibility before changing anything; do not change a major version on an initialized volume casually.

This is a separate PostgreSQL container/instance on the same VPS, not an additional database inside the original PostgreSQL container. CPU, memory, disk capacity, and VPS outage risk are still shared.

Passwords/internal connection URLs must stay in appropriate secret environment configuration, never in these documents, commits, browser bundles, logs, or chat responses. Keep database access private. Use Coolify's internal hostname on a reachable Docker network. A developer laptop cannot ordinarily resolve that internal container hostname.

## 5. Repository context to verify

At handoff creation, the current branch was `main`; the two supplied PDF files were untracked. No CRM implementation or worktree had been created in this conversation. Untracked files will not automatically appear in a new worktree.

The repository declares Next.js 15.5.25, React 19, Prisma/client ^6.4.0, PostgreSQL, TypeScript, Zod, Vitest, Tailwind, ExcelJS, and Recharts. Check lockfile-resolved versions; do not upgrade major dependencies merely to add CRM.

Relevant integration points:

- `src/lib/features.ts`: `ALL_FEATURES`, new features default OFF.
- `src/lib/permissions.ts`: permission metadata, defaults, dashboard route matching; unregistered dashboard pages default deny.
- `src/lib/auth.ts`: JWT cookie/session validation, current user overrides, account/session revocation and student access; bounded caches exist.
- `src/lib/course.ts`, `src/middleware.ts`: course subdomain resolution, account/course match, internal course headers and write-origin checks.
- `src/lib/db.ts`: existing Prisma client and transaction-local course RLS context.
- `src/app/student-dashboard/layout.tsx`: currently mounts the student navbar/sidebar around every child.
- `src/app/dashboard/layout.tsx`: staff layout and existing permission wrapper.
- `src/components/layout/Sidebar.tsx`, `StudentBottomNav.tsx`: navigation and feature visibility.
- `src/app/api/saas/courses/`: platform-level course feature configuration.
- `src/app/api/tenant/settings/route.ts`: course branding; intentionally does not grant course admins platform feature toggle control.
- `prisma/schema.prisma`, current migrations: portal tables and RLS.
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`: client generation, environment forwarding, runtime role and startup migrations.
- `src/app/api/health/route.ts`: existing portal readiness check actually queries the main DB.
- `package.json`, `vitest.config.ts`, `eslint.config.mjs`: validation scripts.

Known deployment caveats: `npm run deploy` currently points at Firebase, while the active target is Coolify/VPS. Do not use that script for this release. `deploy.sh` has assumptions about host port 3000 that may not match the current internal-only Compose configuration. Inspect actual Coolify source/branch/network/deployment settings before producing release commands.

## 6. Database architecture and identity

```text
Browser (existing portal session)
  -> Same Next.js application / server authorization
       -> Portal DB: user, session, current profile, course, batch, portal permission, feature toggle
       -> Customer service DB: workspace, CRM membership/role, customer, complaint, notes,
                               interactions, follow-ups, escalation, history, settings, reports
```

Portal DB remains authoritative for credentials, current student/teacher identity, account status, course and batch membership. Never duplicate password hashes, password-reset tokens, or login sessions in the customer service DB. CRM membership is an operational role assignment, not another login account.

Use immutable portal user/course/batch IDs as external references. Do not join by email, display name, roll alone, or mutable batch name. Current portal accounts are course-scoped; identical email addresses can represent different accounts in different courses. If existing session data only exposes batch name/roll, resolve the authoritative current Batch record server-side.

Current display names are resolved from the portal DB, batched per response to avoid one query per complaint. Historical audit records may also store actor-name/role snapshots. These are historical labels, never authority for access. Account deactivation, course suspension, role changes, and batch changes must affect future access using existing session/cache conventions. No promise of instantaneous revocation beyond the implemented and tested cache bounds.

External IDs cannot have ordinary PostgreSQL foreign keys across the two databases. Validate identity/membership in application services, retain historical data on identity deactivation, and avoid hard-delete cascades from portal users into CRM history. Batch changes do not move old complaints to a new workspace. Add a reconciliation/reporting path for missing or changed external references.

Keep routine complaint writes entirely in the customer service DB. Complaint update + interaction/escalation/history must commit in one local transaction. There is no automatic atomic transaction across two Prisma clients. Make workspace/membership provisioning retry-safe with unique constraints and upsert; revalidate portal eligibility at use time. A large bidirectional synchronization system is not required for v1.

Proposed implementation structure:

- Keep existing `prisma/schema.prisma` and client for the portal.
- Add `prisma/customer-service/schema.prisma` with its own migration directory and generated client output.
- Add `src/lib/customer-service/db.ts` (server-only singleton, bounded connection pool, scoped transaction helper).
- Use `CUSTOMER_SERVICE_DATABASE_URL` for the restricted runtime account.
- Use `CUSTOMER_SERVICE_MIGRATION_DATABASE_URL` for migrations/bootstrap, only in the environment/job that needs it.
- Document both in `.env.example` with placeholders. Forward required values through Compose; Coolify UI variables alone may not be injected by the current explicit Compose environment list.
- Add explicit generate/migrate/check scripts for this schema. Generate both clients in Docker and copy their required artifacts into the runtime image.
- Never replace the existing portal `DATABASE_URL` or let the new variable fall back to it.
- Use a separate migration owner and a runtime role with NOSUPERUSER/NOBYPASSRLS. Configure table/sequence privileges, default privileges and RLS migrations deliberately.
- CRM course/workspace isolation must apply to all relevant tables. Use transaction-local scope; never leak connection-level state across pooled requests. Enforce role/team/record access in server services too.
- Use scoped foreign keys/uniques inside the new DB so a child cannot reference another workspace's complaint, tag, team, or customer.

Missing/unreachable CRM configuration should show a controlled CRM unavailable state and fail CRM operations closed, without breaking unrelated portal pages at import/build time. Provide separate protected CRM readiness diagnostics and deployment checks. Do not make an optional CRM outage trigger an endless restart of the entire portal through the existing healthcheck.

## 7. Feature gating, permissions and layouts

Add feature key `crm`, default OFF, through the current super-admin course checkbox flow. Disabling it hides navigation and blocks CRM pages/APIs, while preserving data. Unknown/loading feature state must not briefly expose a CRM navigation item.

Proposed staff permission keys: `crm_supervisor` (operate/supervise assigned workspaces) and `crm_admin` (course-scoped CRM configuration and membership administration). Register precise dashboard routes in permission metadata. Integrate with access-management UI and existing role defaults explicitly; do not grant all teachers CRM administration implicitly. Platform super-admin access follows the existing approved course/impersonation pattern, not an unrestricted new cross-course endpoint.

Student role remains `student` in the portal even when CRM role is L2/L3. Validate on each page/API: trusted course host context, active portal session/account/course, feature enabled, current batch eligibility, active CRM membership, allowed role/team/action and correct record scope. Never trust submitted actor IDs, course IDs, roles, or timestamps. Authorization must cover search, lookup, counts, exports and relation IDs as well as edit endpoints.

Routes:

- `/student-dashboard/crm` and descendants: standalone student CRM workspace, opened with a normal new-tab link (`target="_blank"`, `rel="noopener noreferrer"`).
- `/dashboard/crm` and descendants: staff management console under existing staff permissions; workspace selection for authorized batches.
- `/api/crm/...`: shared server functionality with per-action authorization.

Use the existing same-origin session cookie, never a credential/token in the URL. Unauthenticated users go to the relevant login. Preserve a validated local return URL if implementing return-to-CRM navigation; reject external redirects.

Refactor student layout minimally: parent shared auth/branding, normal dashboard chrome in a route group, standalone CRM layout in its own branch. Existing student URLs remain unchanged. A nested CRM layout alone cannot remove the current parent sidebar/navbar. Check global `.student-portal` styles, loading skeletons, mobile bottom navigation and providers so they do not bleed into CRM. Avoid a large unrelated routing rewrite.

CRM shell: compact role-aware sidebar, workspace/batch label, logged-in identity, search and actions, responsive data tables/forms, loading/error/empty states, and Back to Student Portal link. English primary interface and accessible labels; optional Bengali help. No grades/leaderboard/learning dashboard widgets.

## 8. Workspace and role access

One shared operational workspace per course/batch; allow active/read-only/archived states. Create from authoritative portal batch data. Staff can add eligible users from the portal roster, assign Agent/L2/L3, manage teams, deactivate CRM membership, and inspect activity. Default newly provisioned students to Agent; do not auto-create membership for unrelated batches.

| CRM actor | Read | Write/actions |
|---|---|---|
| Agent | Workspace customer history/search, own queue, own scoped reports | Create; edit own actionable unresolved complaint; notes/follow-ups; resolve or escalate to L2 |
| L2 | Complaints in its authorized L2 team bucket; assigned complaint's history | Claim/process, resolve, mark invalid, agent-mistake/revert, escalate to L3 |
| L3 | Complaints in its authorized L3 team bucket; assigned complaint's history | Claim/process, resolve or update permitted outcome; no escalation beyond L3 |
| Supervisor | All complaints/reports in authorized workspaces | Operate, assign/reassign, edit complaints including resolved details, maintain allowed configuration |
| CRM administrator | Authorized course workspaces | Supervisor capabilities plus workspace, membership, team and configuration administration |

Engineering default: while a complaint is handed to L2/L3, its original Agent cannot change core fields/status. After a revert it becomes actionable by that Agent again. Allow only authorized append-only notes during handoff if needed; never overwrite another team's state. The PDF permits own unresolved edits but does not specify concurrent ownership; this restriction prevents lost updates.

Staff exports cover only authorized workspaces; Agent reports cover own work and authorized data; L2/L3 reports cover their buckets. Search must not bypass queue restrictions. Preserve original creator and current owner separately when a supervisor reassigns work.

## 9. Required functional modules

### Dashboard and reporting

PDF KPIs: Total Escalation, Tethered Resolution, Untethered Resolution, Solved Within SLA %, Average SLA, Median TAT, P90 TAT, Total Interactions, Total Pending. Use one shared aggregation/filter service for dashboard, report tables and exports. See exact definitions in section 12.

Filters: date range, channel, agent, tag, status, issue type, caller type, complaint type; workspace/batch according to role. Default date range is first day of current month through today in Asia/Dhaka. Presets: Today, Yesterday, Last 7/15/30 Days, This Month, Last Month, This Week, Last Week and Custom; daily/weekly/monthly grouping as useful. Weeks start Sunday.

Reports: operational, agent, issue/tag/caller/complaint-type breakdown and SLA/TAT. CSV/Excel export using existing packages, with permission checks, bounded queries and spreadsheet formula-injection protection. Report UI must explain attribution and time basis.

### Complaint creation

PDF fields:

- Auto: immutable 10-character alphanumeric complaint ID, creation date, handled-by identity, last updated.
- Contact: calling number, registered number, customer identifier (email / FB name / external ticket ID / username), caller type, channel, complaint type.
- Issue: issue type, primary tag, secondary/additional tags, transaction date, transaction amount, transaction ID, detailed description.
- Workflow: status, escalation level, resolution reason and remarks.

Phone numbers and transaction IDs are strings; normalize lookup consistently while preserving display text and leading zero/country code. Amount is a nullable decimal where an amount is provided. Validate server-side with bounded lengths. Conditional transaction fields can be configured. Creator/status/timestamps are server-controlled.

Engineering default: Save as Pending supports unfinished handling; Submit and Resolve requires a solution remark; Submit and Escalate requires a reason and an eligible L2 queue. This implements the user's direct-resolution/escalation rule without forcing every complaint to escalate.

Public complaint code has a database UNIQUE constraint and collision retry. Keep an internal UUID separately. Avoid sequential guessable codes as an authorization mechanism; always scope access.

### Fetch Data and search

Fetch Data searches by calling number inside authorized workspace scope, selects latest complaint by createdAt descending with a deterministic tie-breaker, and prefills exactly the PDF fields: caller type, channel, issue type, complaint type, registered number. Show the source complaint/date; Agent verifies and may edit the new form. Do not mutate the prior complaint or copy its status, resolution, transaction identifiers or owner.

No result: `No previous record found for this number`. Distinguish no-result from authorization/server error.

Search supports calling number, registered number and complaint ID, including combined parameters. Results show complaint code/date, calling number, caller/issue type, status, solution note, handled by and last updated. Use pagination, stable sorting and indexes.

### Complaint details, interactions, follow-ups and history

Detail view includes customer/contact information, issue/transaction data, current status/queue/owner, resolution and a chronological timeline with actor and timestamp.

Interactions are distinct customer contacts linked to a complaint/customer. Initial submitted contact creates one interaction; a follow-up contact creates another. An internal note, field edit or status change is not automatically another interaction. This supports Total Interactions without equating it to complaint count.

Follow-up stores responsible Agent, due date/time, note and pending/completed state. Surface overdue items. External SMS/email/phone calls are not part of v1.

Audit every create, edit, assignment, transition, reason, role/config change; keep actor ID/name snapshot, server timestamp and relevant before/after data. Audit history is append-only and committed with the action. Resolved complaints are read-only to students; Supervisor corrections preserve the original audit and final-resolution timestamp unless an explicitly audited correction mechanism is designed. Reopening is not a default v1 feature.

### Configuration

Manage tags, primary/secondary tag relationships, issue/complaint/caller types, channels, resolution reasons, teams, SLA policies, and limited dynamic fields (text, long text, number, date, select; required/optional).

Archive previously used options instead of deleting them. Store field-definition versions/snapshots as needed so old records remain interpretable. Dynamic fields cannot override protected IDs, role, course/workspace, actor or system timestamps. No arbitrary scripts/SQL or custom-code execution.

Provide deliberate, repeatable dummy-data loading for selected development/training workspaces. Never import real portal students as fake customers. Do not auto-seed every production startup or delete student work when re-running a seed. No additional knowledge-base or assessment module is required by this scope.

## 10. Workflow/state machine

Represent lifecycle status, queue, owner and last outcome separately. Do not overload one status enum with every event.

Suggested lifecycle: `PENDING`, `IN_PROGRESS`, `RESOLVED`, `INVALID`.
Queue: `AGENT`, `L2`, `L3`.
Return/action state: normal/reverted-to-agent/resubmitted, plus audited transition events.
`AGENT_MISTAKE` is a structured outcome/revert reason, not a successful resolution. Display user-friendly badges for Reverted, Re-submitted and Re-escalated based on persisted events/state.

```text
Agent creates complaint
  -> resolves directly -> RESOLVED
  -> cannot resolve -> L2 queue
       -> process -> RESOLVED
       -> INVALID (reason required)
       -> Agent Mistake / Revert (reason required)
            -> original Agent corrects -> Resubmit to L2 (same timer)
       -> cannot resolve -> L3 queue (L3 clock starts)
            -> process -> RESOLVED / permitted invalid outcome
```

Define and enforce an explicit server transition matrix for all role/status/queue combinations. Require resolution/revert/invalid/escalation remarks as appropriate. Reassignment does not reset timers. No L3-to-L4 or undocumented student bypass.

Engineering default: a reverted Agent corrects/resubmits; the active L2 workflow is completed by L2 resolution or L3 handoff. Do not allow Agent direct resolution of an already-escalated returned complaint unless the user explicitly requests that path later.

Queue claim must be atomic. Use version checking/optimistic concurrency and transactions; reject stale changes with a useful conflict response. Protect against double submit, duplicate resolution/interactions and claim races. Client timers are display-only; server UTC timestamps are authoritative.

## 11. SLA timing and policy rules

Confirmed calculations:

- L2 elapsed = L2 resolution/next-stage handoff time minus FIRST L2 escalation time.
- While L2 is active, elapsed = now minus FIRST L2 escalation time.
- Revert to Agent and resubmit keep this same L2 clock running. Preserve every event but do not create a fresh SLA start time or reset dueAt.
- L3 elapsed = L3 resolution time minus first L3 escalation time; use now for active L3.
- Total TAT = final resolution time minus complaint creation time.
- Average SLA card = arithmetic mean of Total TAT for resolved complaints; show helper text `Average creation-to-resolution time`.
- All elapsed time is real continuous duration, never business-hour duration. Store timestamps in UTC, display/filter in Asia/Dhaka.

Engineering defaults for configuration (not extra user-confirmed numeric requirements):

1. Staff configure a versioned policy by complaint type + issue type, optionally narrowed to primary tag.
2. Specific primary-tag rule overrides the matching complaint/issue rule; then use a configured workspace fallback. Secondary/additional tags do not compete for SLA selection in v1. Reject duplicate/ambiguous active rules.
3. Policy fields: required overall resolution target, optional L2 and L3 targets. All stored as positive durations with clear UI units.
4. Resolve/snapshot policy ID, version, targets and calculated due times when the complaint is created. Stage deadlines start on first entry to that stage.
5. Later policy edits do not silently change existing deadlines. If tags/issue are corrected before first escalation, allow an audited policy re-selection while retaining original complaint creation time; after escalation, a Supervisor-only audited correction is required. Never reset elapsed time.
6. Do not invent business SLA durations as approved values. Development fixtures may use clearly labeled sample values. Production/training workspace setup must configure real defaults before accepting complaints; missing policy is a clear configuration error, not implicit success/zero-hour SLA.
7. Overall `Solved Within SLA %` uses the snapped overall target. Stage targets support stage-specific overdue/within-target detail. Label stage-specific reports separately so they cannot be mistaken for overall compliance.

These defaults make the user-requested issue/tag configuration deterministic. Document any justified alternative before implementing it; ask only if a material business choice cannot be resolved with these stated defaults.

## 12. KPI and date-filter definitions

Confirmed week classification: calculate creationWeekStart and resolutionWeekStart in Asia/Dhaka, with Sunday as the first day. Tethered if equal; Untethered if resolutionWeekStart is later. Do not use elapsed seven-day windows or compare week numbers without year. ResolvedAt before CreatedAt is invalid data.

Examples:

- Saturday 23:59 -> Sunday 00:01: Untethered, despite two-minute TAT.
- Sunday 00:01 -> same Saturday 23:59: Tethered.
- Any following Sunday or later week: Untethered.
- An unresolved or invalid complaint is neither.
- Agent, L2 and L3 resolutions all use the same week rule.

Engineering defaults for ambiguous reporting details:

| Metric | Definition |
|---|---|
| Total complaints | Distinct complaints created in selected period |
| Total interactions | Distinct recorded customer-contact events occurring in selected period |
| Total escalation | Distinct complaints with an L1-to-L2 or L2-to-L3 escalation event in selected period; one complaint counted once; show event count separately if useful |
| Tethered/Untethered | Resolved complaints whose FINAL resolution occurs in selected period, classified using actual creation/resolution week |
| Resolved count | Final resolutions occurring in selected period |
| Total pending | Complaints created by period end and not resolved/invalid by period end; use history for a true historical end-of-period snapshot |
| Solved Within SLA % | 100 × resolved-within-overall-target / resolved-with-valid-overall-target in selected period |
| Average SLA | Mean Total TAT of resolved complaints in selected period |
| Median/P90 TAT | Median/90th percentile of those same resolved complaint durations; use a documented consistent continuous-percentile implementation |

Use resolution-date cohort for resolution metrics so a complaint created last month and solved this month is counted this month. Use creation/event date for volume metrics and label each metric's date basis. One Apply action updates all relevant cards/tables using the same selected range and non-date filters, but do not pretend their time bases are identical. Export the selected date basis/filters with reports. If adding an explicit Created/Resolved report-date selector, ensure its meaning is clear and never silently mixes cohorts.

Range handling: date-from inclusive local midnight; date-to includes the full selected local day via next-day-exclusive boundary. Historical pending snapshot is at that boundary (or now for today/future end). Use explicit timezone conversion, not browser/server default timezone.

Zero eligible denominator => `N/A`, not 0% or 100%. Zero resolved complaints => average/median/P90 `N/A`. Invalid records excluded from successful-resolution metrics. Counts are distinct at the intended grain even when joining tags/history. Preserve enough event history to reproduce historical status.

Agent reporting defaults: interaction/complaint creation attributed to creator; resolution count attributed to actual resolver; original Agent shown separately. Team reports expose actual ownership. The Agent filter must have a labeled meaning in each report, with shared backend logic matching export.

## 13. Suggested customer service data model

Names may be adapted to repository conventions; preserve the entities and constraints.

- `Workspace`: external courseId/batchId, lifecycle state, settings; unique course/batch for v1.
- `WorkspaceMember`: external portalUserId, CRM role, active flag, team membership; unique workspace/user.
- `Team`: workspace, L2/L3 tier, active state.
- `Customer`: workspace, normalized contact identifiers and dummy-data marker.
- `Complaint`: internal ID, immutable unique public code, workspace/course/customer, creator/current owner/team, contact snapshot, form data, lifecycle/queue/return state, creation/update/final timestamps, version, policy snapshot and first L2/L3 times.
- `Interaction`: customer contact event, complaint, actor, channel, occurredAt, note.
- `Note`, `FollowUp`: internal operational notes and due/completion metadata.
- `Escalation`: complaint, stage, first entry, completion/handoff and target snapshot; one durable timing record per applicable stage in this v1 workflow.
- `ComplaintHistory`: append-only events, actor snapshot, before/after state, reason/remark.
- `Tag`, `ComplaintTag`, option/category records.
- `FieldDefinition` and versioned custom values/snapshots.
- `SlaPolicy` and immutable version records or equivalent snapshots.
- `ConfigurationAudit` / membership audit where not covered by shared audit entity.

Index workspace/course + status/queue, owner, createdAt, resolvedAt, normalized numbers, dueAt and history complaint/time. Pagination and reporting must not scan every message/history record for ordinary list requests.

Create no live-chat tables solely to anticipate undocumented requirements. Keep the shared customer-service client/database naming extensible; a future live-chat module can relate conversations to customer/complaint IDs later.

## 14. Worktree and development procedure

1. Read applicable `AGENTS.md` and repository instructions. Check branch/status, worktrees, remotes and lockfile. Preserve all user changes and supplied PDFs.
2. Fetch main if permitted; branch from verified current `origin/main` or explicitly documented local main if remote unavailable. Do not reset main or switch away from user work.
3. Suggested branch: `feature/customer-service-crm`. Suggested sibling worktree: `F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-crm`. Check for name/path conflicts first; reuse only if it is clearly this task's worktree. Workspace permissions may require approval for a sibling location; use the supported approval flow rather than silently editing main.
4. Plan/prompt/PDF inputs may be untracked in the original checkout. Read them by absolute path or copy needed reference files safely into the new worktree. Do not assume Git carried them. Commit implementation documentation on the feature branch as appropriate; do not automatically commit source PDFs.
5. Use isolated development/test portal and CRM databases. Never point destructive migrations, tests, reset, seed, or load tests at production. Do not blindly copy original `.env` values; they may reference production. Configure secrets without printing them.
6. Implement incrementally with coherent commits. Document the scope/defaults and update a task checklist as work progresses. Do not stop at scaffolding if authorization is to complete the feature.
7. If a database/tool/network dependency is unavailable, complete independent code and fixtures, clearly report which integration checks remain unexecuted, and request only the missing capability. Do not claim a passing database or browser test from mocks alone.

## 15. Implementation sequence

### A. Foundation

Second Prisma schema/client, migrations, runtime/migration-role provisioning, RLS and isolation helpers; optional configuration handling; feature registration; staff permissions; batch workspace provisioning; identity bridge; isolated local fixtures.

### B. Entry and access

Student standalone layout/new-tab entry; staff routes and workspace selector; course/role guards; current-session handling; role-based menus; existing-portal layout regression checks.

### C. Complaint operations

Configuration options, customer lookup, complaint creation/search/details, immutable IDs, interactions, notes/follow-ups, version conflicts and audited edits.

### D. Escalation and SLA

Queue claim/assignment, L2/L3 transitions, revert/resubmit, policy management/snapshots, continuous clocks, correct deadlines and resolution locking.

### E. Reports and completion

Dashboard filters/cards, operational/agent/issue/SLA reports, exact weekly classifications, CSV/Excel, member/team/settings management, bounded dummy seeding and responsive/error/accessibility polish.

### F. Verification and handoff

Run meaningful tests and browser scenarios against actual development databases; complete Docker/build/environment handling; deliver release/rollback instructions and reviewable branch. Live chat, grading and unrelated portal refactors are out of scope.

## 16. Required verification and acceptance criteria

Automated business tests:

- Sunday week start in Asia/Dhaka, Saturday/Sunday boundary, month/year boundary, same week across different days, later week with short elapsed time.
- Tethered + Untethered equals resolved count for valid data under same filter; unresolved/invalid excluded.
- Creation-to-resolution mean, median/P90, no-data N/A, exact SLA deadline inclusivity (`resolvedAt <= dueAt`).
- Revert/correction/resubmit and reassignment never reset first L2 time/deadline; L3 starts on L3 handoff; L2 completion and overall clock remain correct.
- Policy specificity, duplicate-rule rejection, target snapshots and later configuration edits.
- Illegal transitions, direct Agent resolution, invalid/revert remarks, resolved edit restrictions and supervisor audit.
- ID collision retry, duplicate submit idempotency, concurrent queue claim and stale edit conflict.

Database/API tests with real isolated PostgreSQL:

- Anonymous, disabled account, revoked session, feature OFF, inactive membership and wrong role requests denied.
- Cross-course/cross-batch record IDs, nested relation IDs, search, Fetch Data, counts and exports cannot leak data.
- L2/L3 cannot browse outside authorized buckets; student CRM role never grants portal admin permissions.
- Runtime role actually subject to RLS; missing scope fails closed; pooled connections do not retain another request's scope.
- Complaint/transition/audit atomicity and retry behavior.
- Names/eligibility reflect portal identity changes; old history remains coherent after user deactivation/batch changes.
- CRM DB missing/down yields bounded CRM errors; unrelated portal pages continue functioning.
- Migration deploy works from empty CRM DB and can be rerun without destructive effects; bootstrap grants work for future tables.

Browser end-to-end scenarios:

1. Enable CRM for one course; disabled course cannot access by URL/API.
2. Student opens CRM in new tab; original dashboard remains available; CRM has no old sidebar/navbar/mobile nav.
3. Teacher provisions batch/team/roles and SLA policies; student accesses correct workspace.
4. Create dummy complaint, Fetch Data on another complaint, confirm old record is unchanged.
5. Direct Agent resolution; then separate case Agent -> L2 -> revert -> correction -> L2 -> L3 -> resolution.
6. Verify role queues, resolution lock, timeline, continuous timer and reports/export against fixture totals.
7. Log out/revoke/deactivate; verify access closes within documented session-cache behavior.
8. Check desktop and mobile usability, keyboard form access, loading/error/empty states and double clicks.
9. Regression smoke: portal login, normal student/staff dashboards, existing chat, and an existing course feature.

Repository checks: meaningful Vitest tests, type check, applicable ESLint and production build. Inspect scripts first: `lint` currently uses `next lint`; if incompatible use the project's actual ESLint configuration rather than declaring success after a failed/no-op command. Generate both clients before type/build checks. Record exact commands/results and identify pre-existing failures separately without unrelated cleanup.

Do not claim tests passed unless executed. Include a concise test report, screenshots where useful, and unverified infrastructure limitations.

## 17. Merge and production release

Implementation completion is not an instruction to publish immediately. The user plans to review/test and then merge/push/deploy. Prepare those steps; perform them only when the user explicitly authorizes them in the implementation conversation. Do not publish a PR, push a branch, merge main or trigger Coolify merely because tests passed unless requested.

Before release:

- Verify actual new DB name/version, same/reachable internal network, credentials and persistent volume. Do not recreate the Running resource.
- Configure and test backup of portal DB, customer service DB, and applicable upload storage; keep role/grant recreation instructions. Separate snapshots can have different times, so plan identity-reference reconciliation on restore.
- Provision restricted CRM runtime role and migration role; set secret runtime/migration variables in the appropriate Coolify app/job. Preserve existing portal DB settings.
- Update Compose/Docker build and migration flow for two clients. Existing main DB migration should not accidentally run against CRM or vice versa. Use explicit schema paths and migration URLs.
- Prefer an explicit one-shot customer-service migration release step with its privileged credential. Do not permanently run the web server with the `postgres`/migration credentials.
- Verify intended Git branch/commit and whether main push auto-deploys Coolify. Prepare secrets/migration order before a push that can trigger deployment.

Release order:

1. User reviews feature diff, test report and any documented deviations/defaults.
2. Reconcile feature branch with latest main inside the feature worktree; resolve conflicts without discarding others' work; rerun affected checks.
3. With user authorization, merge into main and push using the agreed workflow. Never force-push main.
4. Execute reviewed additive CRM migration with the correct target, deploy the reviewed app revision, and verify portal health plus CRM-specific readiness.
5. Keep CRM default OFF until migration and staff setup succeed; enable only the intended course/batch first.
6. Configure production training SLA values, staff access, teams and dummy-data workspace deliberately.
7. Smoke-test student/teacher flow and KPI fixtures, then roll out to further batches/courses as the user chooses.

Rollback: disable the course CRM flag, roll application code back to last known good revision if needed, retain additive CRM tables/data. Restore database backups only under a separate explicit recovery decision; do not blindly drop tables or run reset/down commands. A failed CRM rollout must not require reverting unrelated portal data.

## 18. Final delivery checklist

Implementation evidence and qualifications: [verification report](CRM_TEST_REPORT.md), [deployment guide](CRM_DEPLOYMENT.md). Completed in `feature/customer-service-crm`; production rollout remains unperformed.

- [x] New feature branch/worktree identified; main was not used for implementation.
- [x] All required PDF CRM modules implemented with the confirmed corrections.
- [x] Existing portal identity reused; separate customer service database integrated.
- [x] Per-course toggle, batch scope and role/team access enforced server-side.
- [x] Standalone student CRM at the requested URL with new-tab entry.
- [x] Continuous SLA, no L2 reset, Sunday/Dhaka weekly KPIs and average total resolution time verified.
- [x] No assessment/marks/teacher-feedback/live-chat implementation or existing-chat migration.
- [x] Real DB/API/browser tests and build results recorded honestly.
- [x] Environment template, migration/role setup, backups, rollout and rollback documented.
- [x] Test report and final implementation summary explain any remaining limitations.
- [x] Branch ready for user review, merge and Coolify deployment; live status not claimed before actual deployment verification.

## 19. Remaining operational inputs (not unanswered scope questions)

- Actual customer service database image/name/network and successful backup status.
- Secure access to development/test databases and later the production deployment environment.
- Real training SLA duration values entered through configuration; sample fixtures are not approved production policy.
- Teacher/admin accounts and batches chosen for initial rollout.

These inputs can be supplied when needed. Do not re-ask already answered questions about inbound scope, batch sharing, language, assessment, week start, timer continuity or database separation.
