# CRM deployment and operations

The CRM uses the existing portal identity and a separate PostgreSQL database. It is default OFF for every course. No production resource has been changed by implementation or testing.

## Credentials and roles

- `DATABASE_URL`: existing portal configuration; unchanged.
- `CUSTOMER_SERVICE_DATABASE_URL`: separate CRM runtime URL, restricted LOGIN/NOSUPERUSER/NOBYPASSRLS account. Compose forwards this to the app.
- `CUSTOMER_SERVICE_MIGRATION_DATABASE_URL`: privileged CRM migration owner URL, supplied only to a release job. Never forward it to the web server.

Use secret environment injection. Do not paste connection strings into tickets, logs or Git. Verify the actual Coolify resource `assdi-customer-service-db`, database name, PostgreSQL version, persistent volume and private Docker network. The originally requested database name was `assdi_customer_service`; it is not independently verified.

Generate both clients with `npm run generate:all`. Docker generates both clients and copies `generated/` to the runtime image. CRM migrations do not run on every web startup and never fall back to the portal database.

With both CRM URLs securely present in the migration job:

```sh
npm run crm:migrate
node scripts/customer-service-role.cjs
```

The role script grants current and future table/sequence privileges for the migration owner, revokes audit modifications and migration-table access, and requires distinct owner/runtime credentials. Keep all later migrations under that same owner. Audit triggers independently prevent modification even if future grants are broad. Validate the runtime role has no inherited privileged memberships and owns no CRM tables. Use the restricted URL in the web app.

## Release order

1. Review the feature diff and test report. Reconcile with latest main and rerun affected checks.
2. Back up both databases and uploaded storage. Verify restoration in isolation, not merely backup-job status. Preserve role/grant recreation instructions. Separate database snapshots may need reconciliation of portal IDs after restore.
3. Configure secrets/network and verify database identity/version. Do not recreate the existing Running resource.
4. Obtain the user's explicit merge/push/deployment instruction. Check whether a main push triggers Coolify automatically. Never use the repository's Firebase `npm run deploy` for this release.
5. Apply additive CRM migrations and runtime grants using the one-shot owner job before enabling CRM.
6. Deploy the reviewed application. Existing `/api/health` remains independent of optional CRM availability. An authenticated CRM administrator can check `/api/crm?kind=health` on the course host.
7. Enable the course CRM feature in the platform course configuration. Grant staff `crm_admin` and/or `crm_supervisor` through existing Access Management. Teachers receive neither implicitly. Administrators manage the course; supervisors additionally need explicit workspace assignment.
8. Provision the authoritative batch. Eligible students automatically join as Agents; administrators handle escalation. The training release adds 100 isolated reference customers per workspace, missing dropdown options, L2/L3 teams and a 60/20/10-minute fallback practice SLA without overwriting existing settings. See [CRM training data](CRM_TRAINING_DATA.md) for loading existing workspaces and changing defaults.
9. Smoke-test student new-tab entry, direct resolution, L2 revert/resubmit, L3 handoff, reports and export. Roll out to additional batches deliberately.

## Scope and operational rules

All CRM tables enforce course/workspace RLS using transaction-local settings. Application guards additionally validate course host, portal session, feature, current batch, CRM membership, team and record ownership. Agent/L2/L3 are operational roles; they never change portal roles. Current session revocation follows the portal's default 10-second override cache; course lookup/feature state can remain cached for up to 60 seconds. CRM membership is checked on each operation.

The student route group preserves existing public student URLs while removing portal chrome from `/student-dashboard/crm`. Normal student pages retain their existing layout. The shared parent checks sessions server-side to avoid showing a portal sidebar skeleton inside CRM.

L2 time starts once and continues through reverts/resubmission. Policy snapshots preserve old targets. Tethered/untethered uses Sunday boundaries in Asia/Dhaka. Reports use resolution cohorts for resolution metrics and creation/contact/event cohorts for volume. Historical pending uses final close timestamps; other filters use current attributes and are labeled accordingly. Percentiles use continuous linear interpolation. Reports cap at 10,000 complaints / 100,000 events; narrow filters beyond that limit.

The configuration audit and reconciliation diagnostics are available to authorized staff through `GET /api/crm?kind=audit&workspaceId=...` and `kind=reconcile`. Reconciliation flags members absent from the current portal batch roster; historical complaints remain in the original workspace.

## Rollback

Disable the course CRM flag, then roll back application code if needed. Retain additive CRM tables and history. Do not reset/drop the CRM database or restore backups without a separate explicit recovery decision. Existing portal data and chat need no migration or rollback for CRM.

## Local verification

`scripts/customer-service-test.cjs` reads only the ignored `.crm-test/password` file and targets fixed localhost port 55439 with `portal_test` and `crm_test`. It never reads the existing checkout's `.env`. It provisions the isolated portal schema, deploys CRM migrations twice, creates a restricted runtime role and runs CRM tests. Integration tests independently reject nonlocal/non-test database URLs.

The initial Windows dependency installation was missing optional native packages. Exact matching native binaries were installed under ignored `.crm-test/tools`, without changing the application dependency lockfile. Set `NODE_PATH` to that tools `node_modules` when using that repaired local environment. A normal clean platform-specific `npm ci` should supply native dependencies.
