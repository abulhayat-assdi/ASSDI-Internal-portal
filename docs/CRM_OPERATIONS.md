# Assignments, notifications and student progress

Staff with CRM administration or assigned supervisor access can open **Distribute Work** in the selected workspace. Choose eligible Agents, enter a case count and reason, then **Preview distribution**. The preview shows how many cases each Agent will receive. **Assign N complaints** distributes the oldest available cases evenly. Each operation supports up to 250 cases.

The pool contains Pending cases in the Agent queue, with normal return state, owned by staff or without an owner. Cases already assigned to students, cases in progress, closed cases and escalation cases stay outside the pool. This includes the preloaded practice cases initially owned by the administrator. Students without a CRM membership can be enrolled as Agents during assignment after their current batch eligibility is checked; inactive memberships and existing L2/L3 roles are preserved.

Every assignment records immutable complaint history and an audit entry. Bulk assignment uses an idempotency key, a workspace lock and complaint versions. A stale preview fails without partially assigning cases. Reload the pool and preview again after a conflict.

An explicit reassignment also transfers outstanding follow-ups held by the previous owner; completed callbacks retain their original attribution. L2 returns follow the last handling Agent recorded before escalation, rather than assuming the original creator is that Agent. If that Agent is inactive or no longer eligible, the original course administrator receives the return when available; otherwise it waits for staff reassignment and staff receive a notification. Original creator identity and SLA clocks remain unchanged.

The notification bell shows the signed-in user's recent 50 notifications and total unread count for the selected workspace. Assignments, returned complaints, escalation team arrivals and resolutions generate notices for relevant recipients. Administrators and assigned supervisors receive escalation notices. Users mark their own notices read or click a notice to open the complaint; the complaint's current access checks still apply.

Notifications poll every 15 seconds, complaint lists every 20 seconds and progress every 30 seconds while the browser page is visible. Focusing the window refreshes these views too. These updates do not replace an open complaint form or unsaved edits. This release adds in-app notifications; desktop push, sounds and email delivery are outside this feature.

**Student Progress** is available to CRM staff; students see **My Progress** containing only their own row. All values are workspace scoped. Current workload shows open ownership, Pending, In progress and overdue cases as of now, independent of the activity date filter. Period metrics use Asia/Dhaka dates: unique cases assigned in the period, cases created, unique worked cases, customer contacts, unique escalated cases, actual final resolutions, SLA success and average creation-to-resolution time. TAT is elapsed time, not active work time. Repeated assignment events for one case count once within the period.

**View current work** shows a paginated list of cases currently owned by the selected student, including closed cases, independently of the activity period. Click a code for the existing complaint details and history. The student filter, role and inactive membership status help staff distinguish workload from account eligibility. Older complaint ownership may not match historical assignment totals; this is intentional.

## Deployment

Back up the CRM database. Apply the additive `202611040001_operations` migration using the owner connection before deploying the application. The Notification table enforces course/workspace RLS and references the scoped complaint. Existing owner default grants provide runtime access; verify the restricted runtime role can use the new table. Keep all customer, complaint and history data intact. No assignment is applied automatically by this deployment; an authorized staff user reviews and applies each distribution.

Validation covers idempotent bulk assignment, stale previews, role and batch boundaries, personal inbox/read state, read-only marking, current workload versus period attribution, escalation notices and browser assignment-to-resolution flows.
