# Business Incubation verification

Date: 2026-11-05, Asia/Dhaka. Branch: `feature/business-incubation`.

This is a local review record. Production credentials, existing students, production uploads and historical business data were not used. Android implementation remains deferred; its plan is in `ANDROID_PORTAL_APP_PLAN.md`.

## Automated checks

- Native PostgreSQL 16: **38 passed**, including the checked-in migration, runtime-role/RLS isolation, repeated deployment preserving financial records, mandatory vouchers, lead permissions, idempotent retries, chronological stock validation, atomic team handovers, corrections, field custody and public link revocation.
- In-memory PostgreSQL: **38 passed** through `npm run incubation:test`.
- Existing permissions, Competitions, file access and deployment-rule regression suites: **44 passed**. Includes rejecting generic reads/deletes of Incubation attachments even for an administrator.
- TypeScript and targeted ESLint: pass.
- HTTP checks: real program/team/catalog setup, funding, procurement and voucher, sales/expense/FGD/insight, pending handover/correction, public allowlist, actual XLSX/PDF generation, separate sheet exports and person filtering restricted to field/learning records.
- Browser checks: staff desktop, 390 px mobile layout, read-only original/correction comparison, atomic spreadsheet edit with preview, student sale form, actual browser geolocation check-in/out using mocked coordinates, public report, recovery from invalid date ranges and visible chart headings. No page errors or feature-level horizontal overflow.

`test/incubation-database.ts` only creates disposable fixture databases. Native mode uses a fixed localhost service and creates/drops a unique database per run. `scripts/incubation-preview.ts` uses an in-memory database; no legacy records are imported. The HTTP harness also supports `INCUBATION_CONTAINER_TEST=1` on fixed localhost port 3106 with separate ignored fixture credentials.

## Artifacts

The HTTP harness opens the generated workbook with ExcelJS, checks summary values and sheet names, and confirms user text is not stored as executable spreadsheet formulas. The final Linux-generated 16-page fixture PDF was rendered with MuPDF; summary, Bengali FGD, inventory, charts and history pages were reviewed. Bengali text remains readable, nested history values are serialized, and compact table headers repeat. Extracted text was checked for accidental `[object Object]` placeholders. Review screenshots and sample files are under ignored `.incubation-test/`; they are fixtures rather than production data.

## Deployment checks

The Docker startup runs the existing runtime-role preparation and `prisma migrate deploy`, followed by the Incubation schema/RLS readiness gate. An empty disposable database was bootstrapped through the actual container entrypoint: all 12 feature tables appeared, Incubation program/financial-record counts were both zero, and `/api/health` returned HTTP 200 with the database up.

The test identified Windows CRLF in `docker-entrypoint.sh`; the Dockerfile now normalizes it before execution and `.gitattributes` keeps shell scripts in LF. The Incubation student page explicitly permits same-origin geolocation while other pages keep their existing policy.

Final Linux build: **passed**, image `asm-incubation-review:release`, local image ID `sha256:9f33da7740299e9c72fbf2fbf1a5aa6588933cf742f71b211668442a54a486dc`.

The production image passed the HTTP workflow harness on the disposable PostgreSQL database. Replacing it with the final release image and a dedicated upload volume preserved all **7** fixture business records, the **BDT 4,800** team balance and authenticated access to the existing voucher. The readiness endpoint remained HTTP 200, repeated migrations did not reset records, and the final image produced valid Excel and the readable PDF described above. Only fixture services were used; no Coolify or production service was contacted.

## Review boundaries

Use `BUSINESS_INCUBATION_OPERATIONS.md` for setup, accounting, exports, retention and rollout/rollback instructions. No main merge, push, production migration or deployment has been performed. The feature began at `cf8f544`; subsequent main/CRM work has been left intact. Integrate current main changes and rerun release checks when the user explicitly authorizes the merge.
