# CRM practice customers

Each active workspace receives its own 100 fictional reference customers (TRAIN-001 through TRAIN-100). New workspace provisioning includes these references automatically. Existing customers and complaints are preserved. Loading again does not duplicate profiles or reset practice work.

Open **Training Customers**, search by name or either number, then choose **Use customer**. Calling numbers run from `00010000001` to `00010000100`; registered numbers run from `00020000001` to `00020000100`. These are fictional training identifiers, not numbers to dial. Profiles include ten scenario categories, contact details and transaction references.

The sidebar's **Workspace** selector controls every CRM page and remembers the last accessible selection for the signed-in account on this course host. Existing workspaces need no further provisioning. Administrators can select a batch marked **Set up workspace** in this same selector to create and select it, including its 100 references. Teachers/supervisors retain their assigned workspace permissions. Switching workspace clears unsaved complaint fields and stale results.

The staff portal has **Customer Service CRM** for daily operations and **CRM Settings** for administration. Both open the same permission-controlled application. Settings describes the selected workspace's members, teams, options and SLA policies. The browser URL and Back button follow the selected CRM page.

Both number fields have a **Fetch Data** button. Fetch uses the latest complaint visible to the current role in the current workspace, or the training reference when no visible complaint exists. It copies contact/category fields, preserving the trainee's issue description. Reference profiles are not complaints and do not inflate reports; trainees create and resolve real practice cases.

Customer IDs, complaints, history, options and policies are workspace scoped. The same reference numbers can be used independently by different batches. Students with valid current batch enrollment become Agents automatically when accessing their workspace. Existing inactive memberships and administrator-assigned roles are preserved. Administrators handle configuration and escalation; no student L2/L3 assignment is required.

The loader adds missing training dropdown options, Training L2/L3 teams and a fallback SLA of 60 minutes overall, 20 minutes L2 and 10 minutes L3. Existing policies, teams and options are not overwritten. Administrators can adjust these defaults in Settings.

## Release procedure

Back up both databases first. Apply the additive `202611030001_training_customers` migration with the CRM owner connection using `npm run crm:migrate`, keeping the portal connection separate. Deploy the generated CRM client and application together. CRM migrations are a separate release task, not the portal startup migration.

Run inside the deployed application:

```sh
node scripts/customer-service-training.cjs --course telesales --enroll-agents
```

This loads active CRM workspaces and enrolls existing eligible student accounts for active portal batches. Repeat safely to verify zero added customers/members. Future eligible students enroll through the application automatically; future workspaces receive references at provisioning. Settings also exposes an administrator-only **Load 100 training customers** action.

Validation: 27 CRM tests cover role access, batch isolation, idempotency, both phone lookups, prior complaint precedence, draft preservation boundaries, enrollment and inactive membership preservation. Browser checks cover the training directory, both fetch buttons, complaint creation and responsive width.
