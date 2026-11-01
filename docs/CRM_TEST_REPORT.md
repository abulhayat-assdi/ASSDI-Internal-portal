# CRM implementation verification

Date: 2026-11-01 (Asia/Dhaka)
Branch: `feature/customer-service-crm`
Worktree: `F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-crm`
Base: fetched and verified `origin/main`, `3c05ef1`.

## Executed checks

| Check | Command / method | Result |
|---|---|---|
| Prisma clients | `npm run generate:all` equivalent explicit schema generation | Both generated, Prisma 6.19.3 |
| CRM migrations | `node scripts/customer-service-migrate.cjs` on isolated PostgreSQL 17, repeated | Applied from empty DB; repeat deploys have no pending migrations |
| CRM business + real DB integration | `node scripts/customer-service-test.cjs` | 23 tests passed |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --pretty false` | Passed |
| Changed-file ESLint | `node node_modules/eslint/bin/eslint.js src/lib/customer-service src/components/customer-service src/app/api/crm src/app/student-dashboard/layout.tsx "src/app/student-dashboard/(portal)/layout.tsx" src/app/dashboard/crm src/app/student-dashboard/crm src/components/layout/Sidebar.tsx src/lib/features.ts src/lib/permissions.ts` | Passed |
| Full repository suite, CRM integration enabled | `node node_modules/vitest/vitest.mjs run` with isolated test environment and `CRM_INTEGRATION=1` | 342 passed, 1 failed, 0 skipped |
| Baseline confirmation | Same leave-duration test on unchanged main | Same failure: reversed dates return 0 rather than null; unrelated to CRM |
| Browser CRM workflow | `node scripts/customer-service-browser.cjs` | Passed in real Chromium against isolated PostgreSQL |
| Portal smoke | `node scripts/customer-service-portal-smoke.cjs` | Passed |
| Linux Docker production image | `docker build --tag asm-crm-review:local .` | Passed, including final reviewed application revision `953dc1d`; 124 static pages generated and image exported |
| Native Windows production build | `next build` with isolated configuration | Failed: Webpack glob scans protected `C:\Users\USER\Application Data` / `Cookies`; reproduced with clean worktree dependencies |
| Diff whitespace | `git diff --check` | Passed |

The standard `npm run lint` is the repository's obsolete `next lint`; verification used the actual ESLint CLI/configuration instead. Next's production build skips lint by existing configuration, so the separate ESLint check is material.

The final Linux image manifest is `sha256:40f217638bb982cc38ab0dffd539c245062df64b7273adcc5c8c866328f87ec8` (`asm-crm-review:local`). Subsequent changes are verification-script waiting/formatting and documentation only.

## Real database coverage

Tests use a dedicated Docker PostgreSQL 17 container exposed only at `127.0.0.1:55439`, with databases `crm_test` and `portal_test`. The CRM client uses `crm_runtime`, verified NOSUPERUSER/NOBYPASSRLS. Portal fixture schema uses `prisma db push`; CRM uses the actual committed migrations. No production DB, original `.env`, real customer data or real student data is used.

Covered: missing scope fails closed; cross-course/workspace reads denied; transaction-local scope does not persist; child/option FK scope; queue-filter override cannot bypass L2 access; idempotent creation; actual simultaneous claim race; stale version handling; transaction rollback; immutable complaint identity; append-only history; direct Agent resolution; student resolution lock; supervisor corrections retain final timestamp; L2 revert/correct/resubmit preserves first timestamp/deadline; L3 handoff; policy snapshots survive later edits; archived field snapshots remain editable; inactive membership; read-only workspace and reactivation; valid/anonymous/wrong-host/feature-off/deactivated/revoked sessions; report cohorts; no-data N/A; missing optional CRM configuration leaves portal queries functional; atomic initial resolve and invalid-submit rollback.

Business fixtures cover Sunday/Dhaka and year boundaries, two-minute cross-week classification, exact SLA deadline inclusivity, mean/continuous median/P90, illegal transitions, wrong team/owner, phone normalization and CSV formula protection.

## Browser coverage

Actual Chromium, not a mocked browser:

- Standalone student CRM has no `.student-portal` chrome.
- Fetch Data prefills allowed fields and preserves the source complaint.
- Create -> L2 escalation -> claim -> revert -> Agent correction -> resubmit -> L2 claim -> L3 handoff -> claim -> resolve.
- Resolved student complaint has no edit action.
- Mobile viewport 390 x 844 has no page-width overflow.
- CSV download and staff settings render.
- Real portal login/logout, normal student dashboard, CRM link `target=_blank` opens a separate tab while original dashboard remains, existing homework/chat pages render, staff dashboard and CRM settings render.

Selected screenshots from local fixtures are committed in `docs/crm-verification/`: `desktop.png`, `mobile.png`, and `resolved.png`. The mobile screenshot is captured after workspace data loads; the loaded page passes the width assertion. Additional captures remain in ignored `.crm-test`. These are local verification artifacts, not production screenshots.

## Limits and deliberate implementation choices

- Coolify actual database name/image/network, secrets, persistent volume, backup/restore success and production connectivity are not verified. No deployment, push, merge or PR publication was performed.
- Production training SLA durations and rollout course/batch/account selection must be configured by staff.
- Existing portal unit suite has the independently confirmed leave-duration failure. No unrelated fix was included.
- The Linux image's existing Node 20 base emits engine warnings for some lockfile dependencies requiring Node 22. Its build succeeded. A runtime upgrade is a separate repository-wide compatibility decision.
- Session/cache revocation uses existing bounds: default 10 seconds for user overrides, up to 60 seconds for course/feature lookup. Tests invalidate caches deliberately; they do not claim zero-delay cross-process revocation.
- Reports are bounded to 10,000 complaints and 100,000 events per selected scope; oversized requests require narrower filters. Detail timelines are bounded at 1,000 events; notes/contacts/follow-ups at 500. No large-scale load benchmark was run.
- Configuration is represented by typed, validated versioned option records (including field definitions), policy snapshots and complaint tag arrays with scoped SQL checks, rather than separate tables for every option kind.
- Search supports stable pagination and combined calling/registered/code filters. Resolution cohort exports include the same KPI service, creation cohort, agent operations and issue/tag breakdowns.
- Staff administration is course-scoped; supervisors additionally require workspace assignment. Neither CRM permission is automatically given to teachers. Existing administrators can grant them through Access Management.
- No live-chat, assessment, marks or feedback module was added. Existing portal chat was not migrated.

## Reproduce locally

Use a dedicated PostgreSQL 17 test container and a generated password stored only in `.crm-test/password`. The runner refuses remote/non-test database targets. Install dependencies with the lockfile, generate both clients, then run `node scripts/customer-service-test.cjs`.

For browser fixtures: install Playwright into `.crm-test/tools`, install Chromium, run `node scripts/customer-service-browser-seed.cjs` and `node scripts/customer-service-login-seed.cjs`, then start `node scripts/customer-service-dev.cjs`. Run the two browser scripts above. All fixture URLs and temporary session credentials stay under ignored `.crm-test`. Run browser tests sequentially; the login/logout smoke intentionally changes fixture sessions. Re-seed sessions before rerunning the CRM browser flow.
