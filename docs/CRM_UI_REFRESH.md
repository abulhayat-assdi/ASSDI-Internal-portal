# CRM UI refresh

Date: 2026-11-03. Branch: `feature/crm-ui-refresh`.

The staff CRM previously nested its own navigation inside the normal portal sidebar, and both CRM dashboards constrained content to a narrow centered column. This redesign provides a single full-height CRM sidebar, compact topbar, full-width content and a blue accent selected by the user from the supplied reference.

## Changes

- Staff and student CRM share the same desktop shell. Normal portal pages retain their existing chrome; staff permission checks, server CRM access checks and announcement/impersonation banners remain.
- Collapsible desktop sidebar and mobile drawer with Escape dismissal, focus containment and an inert hidden sidebar.
- Four primary KPI cards, daily resolution activity for the last seven days of the selected range, tethered/untethered resolution mix, top issue types, secondary metrics and recent resolutions. All charts use the existing report response; no sample values or invented trends.
- Compact collapsible dashboard filters; report filters are expanded. Existing metrics/cohorts, exports and actions remain available.
- Consistent blue controls, status badges, table headers, forms, settings panels and workspace empty state. Existing user identity and portal return links remain.
- CSS is scoped to `.crm-root`. No database migrations or API/business-rule changes.

## Verification

- TypeScript, changed-file ESLint and all 10 CRM domain tests passed.
- Full real Chromium CRM workflow passed against isolated local PostgreSQL: Fetch Data, create, L2 claim/revert, Agent edit/resubmit, L3 handoff/resolve, resolution edit lock, CSV export and staff settings.
- Portal smoke passed: login/logout, normal dashboard, CRM new-tab navigation, homework/chat and staff settings.
- Responsive smoke passed at 1920, 1440, 1024 and 390 px: no horizontal page overflow, one sidebar, desktop collapse, mobile navigation, Escape and complaint form.
- Staff dashboard, complaints, reports, follow-ups, activity, profile and settings rendered. Unassigned-workspace screenshot uses a simulated empty bootstrap response; workflow tests use real database responses.
- Screenshots in `crm-ui-preview/` show local fixture data, not production data.
- Linux production image built successfully: `asm-crm-ui-review:local`; compilation, type validation and all 124 static pages passed. Final changes after the build snapshot were source formatting and small CSS refinements to contact-button sizing, table text wrapping and breadcrumbs; these were checked in Chromium and by the final TypeScript/ESLint runs.

Reproduce: start the isolated fixtures with the existing CRM test instructions, refresh browser sessions, run `node scripts/customer-service-browser.cjs`, `node scripts/customer-service-ui-smoke.cjs`, and the portal smoke script. Run the portal login/logout smoke last because it changes fixture sessions.

No push, merge or production deployment is included in this UI change. Production remains on the previously deployed CRM revision until the UI branch is reviewed and released.
