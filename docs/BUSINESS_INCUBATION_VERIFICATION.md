# Business Incubation — Competition integration verification

Date: 2026-11-06, Asia/Dhaka. Branch: `feature/incubation-competitions-v2`, started from main `ab8a271`; latest main `0619687` integrated into this feature branch. Worktree: `asm-portal-v2-incubation`.

Implementation and the web/native database checks below are complete. Final production-container startup/restart validation remains pending because the local Docker Desktop engine became unavailable during image unpacking. This revision has not been merged, pushed, migrated in production, or deployed.

## Confirmed behavior

- Competitions is the entry point for both form competitions and Business Incubation. Staff select the type on Create New; students see running items and their own assignment. Old standalone Incubation pages redirect to the hub.
- Members have a personal field/FGD/Insight workspace and read-only own-team summary. They cannot post financial entries or download detailed financial sheets/vouchers.
- Leaders have prominent sales, purchase, expense and return actions, their own team's detailed accounts, and all of their members' field/GPS/proof/learning activity. Other teams' private records remain inaccessible. Handover counterpart information is limited to the shared transfer.
- Teachers manage every Incubation program in their own course, including creation/setup, funding, entries, corrections and reports. Assignment to a program's staff list is not required. Admin management remains course scoped.
- Public links expose summary and team-wise results only. The public page has no edit controls, and its API accepts no writes. GPS, proof, vouchers, private notes and audit/correction details are excluded.
- Existing Competition groups can be copied into a new Incubation team. Batch/roll identities are resolved against the current roster, and the copied team is independent of future group changes.
- Structured product variants, configurable sales sessions, funding round, configurable FGD minimum, optional Insight purchase reason, reconciliation, reserved transfer stock and cash-count snapshots are included.

## Completed automated checks

- Incubation Vitest suites: **42 passed** in memory and **42 passed** on native PostgreSQL 16. These are the same tests run on two database engines, not 84 distinct tests.
- Existing permissions, Competitions, file-access, deployment-rule and CRM domain regression suites: **55 passed**. After integrating main `0619687`, the combined run passed **97 tests across 9 files**.
- Whole-project TypeScript: passed. Targeted ESLint: passed. `git diff --check`: passed.
- Additive populated-upgrade test: an existing program/team/fund retains its IDs and BDT 5,000 record while receiving its parent Competition link. Existing applied migration is unchanged.
- Native migration deploy, repeated deploy preserving records, runtime-role preparation and schema/RLS readiness: passed. The new required link/kind/variant columns are checked.
- Financial tests cover mandatory vouchers, lead replacement, retry deduplication, chronological and concurrent stock checks, paired transfers, pending stock reservation, old/new corrections, atomic bulk edits, immutable audit and course isolation.
- New lifecycle/access tests cover roles that differ by program, draft and ended programs, inactive teams, revoked batch eligibility and teachers' full course management.

## HTTP and real-browser checks

`test/incubation-http.mjs` passes real setup, funding, procurement/voucher, sale, expense, FGD/Insight, transfer, correction and actual Excel/PDF generation. The generated workbook is opened with ExcelJS and its totals, sheets and formula-escaping are checked.

`test/incubation-access-http.mjs` passes member/leader/teacher access tests, another team's private canary isolation, cross-program denial, member finance/export/file denial, other-team GPS denial, no-team disabled directory cards, teacher creation/funding, typed legacy API guards, public allowlisting/read-only methods, group-template visibility, and original form create/submit/report regression. The harness safely reuses its existing disposable Competition group across repeated runs.

`test/incubation-browser.mjs` first creates fresh disposable financial fixtures and runs the HTTP access suite. Its four accounts then pass:

1. Admin: Competition hub, no standalone sidebar entry, management workspace and reconciliation.
2. Member at 390 px: no sales/setup controls; actual browser GPS check-in/out with mocked coordinates, steps and image proof upload.
3. Leader at 390 px: actual sale submission, member GPS history and proof access, own-team workspace.
4. Teacher: setup, new draft Competition creation, copying a previous Competition group, checking selected members/leader, and saving the new team.
5. Unauthenticated public view: summary/team results and absence of edit/correction/setup controls.

No page errors or feature-level horizontal overflow were observed. The browser uncovered and verified a fix for compressed image uploads losing their filename; JPEG uploads now retain a valid File name/type.

## Visual artifacts

Ignored `.incubation-test/` contains desktop/mobile screenshots: `competition-hub.png`, `admin-workspace.png`, `member-home.png`, `member-field.png`, `leader-home.png`, `leader-sale.png`, `leader-team-field.png`, `teacher-setup.png` and `public-read-only.png`.

The generated 16-page fixture PDF was rendered with MuPDF. Summary and Bengali operational pages were inspected; text extraction contains no accidental `[object Object]` values. Excel and PDF fixture downloads are `report.xlsx` / `report.pdf`. These contain only test data, not actual student/business records.

## Linux build and remaining runtime gate

An earlier source snapshot of this revision completed Next compilation, TypeScript validation, static page generation, build tracing, runtime assembly and layer export through the checked-in Dockerfile. During final image unpacking the local Docker engine returned EOF/API 500 and Docker Desktop remained in `stopping` state. The CLI therefore did **not** report a successful final Docker build. Its tagged manifest was visible, but this is not evidence of a runnable image. The final personal-correction UI guard and latest main integration were checked again with whole-project TypeScript, regression and browser tests; the final source still requires a new successful image build.

The normal Docker Desktop restart timed out. Automatic approval review rejected `docker desktop stop --force --timeout 30` because it could abruptly terminate unrelated local containers. No workaround, forced process kill, WSL shutdown, database removal or volume removal was performed.

Remaining before release validation is complete:

1. Recover Docker Desktop with the user's approval or let the user restart it.
2. Rebuild `asm-incubation-review:competition-v2` from the final source and start it on localhost port 3106 with the isolated `incubation_competition_review` database and dedicated upload volume.
3. Confirm automatic fresh migration leaves Incubation programs/records empty, run the four-role HTTP/browser checks against that image, then restart it and compare all record versions, balances, the parent Competition link and an existing voucher.

The earlier release's successful container checks are historical; they are not claimed as this revision's completed runtime validation. Native PostgreSQL migration/readiness checks have passed for this revision independently of Docker image startup.

## Release boundary

No historical CSV/ZIP data import or production credential use occurred. Android remains a separate documented plan in `ANDROID_PORTAL_APP_PLAN.md`; this release provides web foreground GPS only. Use `BUSINESS_INCUBATION_OPERATIONS.md` for setup and the automatic Coolify migration path. Main merge, push and production deployment require the user's later instruction.
