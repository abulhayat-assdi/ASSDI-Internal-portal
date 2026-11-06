# Business Incubation — Competitions integration ও access পুনর্বিন্যাস

তারিখ: ২০২৬-১১-০৬। অবস্থা: **Revision বাস্তবায়িত; web/native database পরীক্ষা পাস। স্থানীয় Docker engine recovery-এর পরে শেষ container startup/restart যাচাই বাকি।**

Branch: `feature/incubation-competitions-v2`, worktree: `asm-portal-v2-incubation`। বর্তমান main `ab8a271` থেকে শুরু; এই revision main-এ merge/push/deploy করা হয়নি।

এই revision-এর ভিত্তি main-এর `6de1bc9` এবং ব্যবহারকারীর deployed portal-এর দুইটি screenshot। আগের অনুমোদিত হিসাব ও operational requirements বহাল থাকবে; নিচের UI, ownership ও access design আগের একই-workspace design-কে প্রতিস্থাপন করবে। Android app আলাদা পরবর্তী কাজ।

## ১. কী বিশ্লেষণ করা হয়েছে

`Business Incubation/V2.zip`-এর পরিচয় code/README অনুযায়ী Incubator V3। Authentication, team/admin API, client navigation, schema, inventory ও ব্যবহার নির্দেশিকা পুনরায় পড়া হয়েছে। কোনো Apps Script, migration বা historical data loader চালানো হয়নি।

`Incubator V3 - Config.csv`-তে header ছাড়া আটটি configuration row আছে; এটি পূর্ণ transaction/student sheet export নয়। SprintDays, EnforceSprintCategory, LateEntryDays, MaxFieldHours ও VoucherSharing পুরোনো configuration-এর উদাহরণ—নতুন program-এ এগুলো import বা অন্ধভাবে প্রয়োগ করা হবে না।

### Legacy source-এ প্রমাণ

| Source                                                                                          | কার্যকর নিয়ম                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Auth.gs::run_`, `buildContext`                                                                 | ছাত্রের কার্যকর TeamID server নিজের user record থেকে নেয়; admin দল নির্বাচন করতে পারে। Lead নির্ধারিত হয় Teams.LeadUserID দিয়ে। |
| `ApiTeam.gs::apiSubmitProcurement`, `apiSubmitSales`, `apiSubmitAdjustment`, `apiSubmitExpense` | আর্থিক submission শুধু lead; admin প্রয়োজনে team-এর পক্ষে কাজ করতে পারে।                                                        |
| `ApiTeam.gs::apiListTeamRecords`, `apiRequestCorrection`                                        | Lead নিজের team-এর record বেছে correction পাঠায়।                                                                                |
| `ApiTeam.gs::apiFieldCheckIn/Out`, `apiSubmitFgd`, `apiSubmitInsight`                           | Member এবং lead ব্যক্তিগত মাঠের কাজ ও learning জমা দেয়।                                                                         |
| `Scripts.html::VIEWS`                                                                           | Member: dashboard/field/FGD; lead: অতিরিক্ত আলাদা procurement/sales/stock-return/correction মেনু।                               |
| `ScriptsAdmin.html::VIEWS`                                                                      | আলাদা overview, team view, people, products, sprint/fund, records, requests, reconciliation, live ও audit।                      |
| `ApiAdmin.gs`                                                                                   | Setup, lead selection, funding, direct record edit, review, reconciliation ও live monitoring admin API-তে সুরক্ষিত।             |
| `Schema.gs`, sales/learning forms                                                               | Product variant, sales session, funding round, cash-difference reason, outgoing goods, steps/proof, FGD/insight fields রয়েছে।   |

**Legacy-তে আলাদা teacher role ছিল না।** UI-তে “Teacher & Admin Portal” লেখা হলেও server-এর privileged role ছিল Admin। নতুন portal-এর পৃথক teacher policy তাই স্পষ্টভাবে নির্ধারণ করতে হবে। পুরোনো নিজস্ব login/password reset ও Drive link sharing বর্তমান portal-এ নকল করা হবে না।

## ২. Revision-এর আগে চিহ্নিত সমস্যা

1. Staff এবং student route একই `IncubationApp` component চালায়। `student` flag ও কয়েকটি permission condition ছাড়া একই tabs/filter/dashboard দেখায়। `Setup`-এর পার্থক্যই সবচেয়ে দৃশ্যমান।
2. Sales action আছে, কিন্তু `ডাটা শিট → বিক্রি → নতুন এন্ট্রি`-তে। Lead-এর প্রধান কাজ হিসেবে প্রথম পর্দায় নেই। Screenshot-এর student account-টি member হিসেবে চিহ্নিত; member-কে sales permission দিয়ে এই সমস্যা সমাধান করা যাবে না।
3. Server-এর `financialAccess` বর্তমানে student lead যাচাই করে; student overview-তেও নিজের team-এর record/stock/summary filter রয়েছে। একই UI দেখানোকে একা cross-team leak-এর প্রমাণ বলা যাবে না। প্রত্যেক read/export/file/history endpoint-এ negative test দিয়ে সীমাটি নতুন করে প্রমাণ করতে হবে।
4. Non-student supervisor-এর financial posting যথেষ্ট আলাদা নয়; শিক্ষকও অনুমোদিত program-এ সাধারণ financial form ব্যবহার করতে পারেন। Teacher monitoring/review এবং admin control আলাদা করতে হবে।
5. Student response-এ পূর্ণ program/catalog metadata, shared staff-style filters ও অপ্রাসঙ্গিক tabs বেশি আছে। Role অনুযায়ী server response ও screen ছোট করতে হবে।
6. Legacy-এর structured variant, session ও funding round অসম্পূর্ণ: session API field থাকলেও visible sales form/export-এ নেই; variant/round-এর পৃথক modelled field নেই।
7. Legacy FGD-তে প্রথম finding/action required, অন্য দুইটি optional; বর্তমান validator তিনটিই চায়। Insight-এর legacy dropdown ও optional “কেন কিনেছে”ও current required free-text-এর সঙ্গে মেলে না।
8. Legacy reconciliation-এর মতো কেন্দ্রীয় exception/work-completion view নেই। Cash count-ও count করার সময়ের expected cash-এর সঙ্গে মিলতে হবে—পরের লেনদেনের balance দিয়ে আগের count-কে নতুন discrepancy দেখানো যাবে না।
9. বর্তমান tests-এ চারটি পৃথক role-এর পূর্ণ screen/access acceptance coverage নেই। আগের সব tests পাস করাই প্রত্যাশিত user flow পূরণ হওয়ার যথেষ্ট প্রমাণ ছিল না।

## ৩. নতুন প্রবেশপথ: শুধু Competitions

Staff এবং student—দুই sidebar থেকে standalone Business Incubation entry সরবে।

**Staff flow:** Competitions → Create New → Competition Type → setup → teams → publish/start।

Type দুটি:

- **Form-based competition:** বর্তমান Battle of Cups/Corporate Sales/custom form templates।
- **Business Incubation:** stock, money, category rotation, field/FGD ও reconciliation engine। এটি generic form template হিসেবে বানানো হবে না।

Staff list-এ type, batch(es), status, date, assigned teachers, team/submission count ও pending requests থাকবে। Action role অনুযায়ী “পরিচালনা” অথবা “পর্যবেক্ষণ” হবে।

**Student flow:** Student Portal → Competitions → নিজের batch-এর published/running items → নিজের team/role অনুযায়ী workspace। Card-এ competition type, তারিখ, team ও role থাকবে। Team assignment না থাকলে opening আটকে “আপনাকে এখনো টিমে যুক্ত করা হয়নি” দেখাবে; private data আসবে না। Draft student list-এ আসবে না। Ended items কেবল নিজের অনুমোদিত history-তে read-only থাকবে।

এক শিক্ষার্থীর বিভিন্ন competition-এ দল/লিডার আলাদা হতে পারে। একটিমাত্র global batch-group-কে সব Incubation-এর team ধরে নেওয়া হবে না।

## ৪. অনুমোদিত access matrix

শিক্ষক নিজের course-এর সব Incubation program-এ পূর্ণ পরিচালনার ক্ষমতা পাবেন। Staff list কাজের সমন্বয়ের জন্য; teacher access ওই তালিকার ওপর নির্ভর করে না। অন্য course-এর access বন্ধ থাকবে।

| কাজ                                                  | সাধারণ সদস্য                      | টিম লিডার               | শিক্ষক / অ্যাডমিন                       |
| ---------------------------------------------------- | --------------------------------- | ----------------------- | --------------------------------------- |
| Program দেখা                                         | নিজের সক্রিয় assignment           | নিজের সক্রিয় assignment | নিজের course-এর সব                      |
| Field / FGD / Insight জমা                            | নিজের                             | নিজের                   | পর্যবেক্ষণ, review ও audited correction |
| ব্যক্তিগত field, GPS, proof, learning দেখা           | নিজের                             | নিজের team-এর সবার      | course-এর সব team                       |
| Team summary / stock                                 | নিজের team read-only              | নিজের team              | সব team                                 |
| Sales / purchase / expense / return / refund         | নয়                                | নিজের team              | সব team-এর পক্ষে entry ও correction     |
| Detailed financial ledger / voucher                  | নয়                                | নিজের team              | সব team                                 |
| Correction request                                   | নিজের field / learning            | নিজের team              | approve / reject / direct edit          |
| Program / team / lead / catalog / rotation setup     | নয়                                | নয়                      | হ্যাঁ                                   |
| Fund / principal receipt / bulk sheet edit / closure | নয়                                | ফেরতের প্রস্তাব         | পূর্ণ পরিচালনা                          |
| Public report                                        | summary ও team-wise ফল, view-only | একই                     | public link-এ একই view-only             |

সব write, review ও correction-এ প্রকৃত actor ও history রাখা হবে। Public view-তে authenticated শিক্ষক/অ্যাডমিনও edit করতে পারবেন না; সম্পাদনা করতে private portal খুলতে হবে।

Lead পরিবর্তনের সঙ্গে সঙ্গে পুরোনো lead-এর posting access বন্ধ হবে। Client dropdown, URL, teamId, localStorage বা UI mode দিয়ে নতুন ক্ষমতা পাওয়া যাবে না।

## ৫. চারটি আলাদা workspace

### সাধারণ সদস্য: “আমার কাজ”

- নিজের team, lead, বর্তমান category/sprint ও আজকের দায়িত্ব স্পষ্টভাবে দেখাবে।
- প্রধান actions: **মাঠে কাজ শুরু/শেষ**, **FGD জমা দিন**, **Market Insight দিন**।
- নিজের session, steps/proof, জমার history, নিজের correction-এর status।
- ছোট read-only “আমাদের টিমের অবস্থা” summary; সব team/batch selector বা staff comparison থাকবে না।
- আর্থিক entry/review/setup controls ও detailed ledger/voucher payload থাকবে না।

### লিডার: “আমাদের টিম পরিচালনা”

- প্রথম পর্দায় **বিক্রি এন্ট্রি**, **কেনা এন্ট্রি**, **খরচ**, **স্টক/ফেরত**।
- আলাদা Sales screen: কার্যকর তারিখ, computed day number, configured session, broad area, category → product → variant, available quantity, quantity/unit price, total ও collected cash; difference হলে কারণ।
- নিজের stock-এর বেশি sale/return/damage বন্ধ। Stock শূন্য হলে কারণ ও procurement-এর পথে নির্দেশনা থাকবে।
- Supplier return, অন্য team-কে handover, customer refund, cash count ও principal-return proposal আলাদা।
- নিজের team-এর ledger/vouchers, old/new correction request ও status।
- Member-এর মতো নিজের field ও learning actions-ও থাকবে। লিডার নিজের team-এর সবার field/GPS/proof, learning ও correction history দেখতে পারবেন।
- “লিডার নেই”, “আজকের sprint নেই”, “pending approval”, “cash mismatch” ধরনের অবস্থায় নির্দিষ্ট করণীয় দেখাবে।

### শিক্ষক: পূর্ণ পরিচালনা ও review

- নিজের course-এর সব Incubation competition create/setup/publish, team/lead নির্বাচন ও rotation পরিচালনা।
- Fund, principal receipt, financial entry, direct/bulk sheet edit ও correction/late review।
- সব team-এর dashboard, reconciliation, field/GPS/proof, FGD/Insight ও report।
- Public report link-এ শুধুই দেখার ব্যবস্থা; সব পরিবর্তন private portal-এ।

### অ্যাডমিন: “পরিচালনা”

- Competition create/publish/close, batches, staff, teams/leader, products/variants, broad areas, manual category rotation ও rules।
- Fund disbursement with round/reference, principal receipts, reconciliation, exceptions, corrections, reasoned direct/bulk editing ও audit।
- Student experience দেখার read-only preview থাকলে স্পষ্ট preview badge থাকবে; অন্য ব্যক্তির পরিচয়ে financial entry হবে না।

## ৬. Legacy coverage ও পূর্বের অনুমোদিত হিসাব

| অংশ                           | এই revision-এ কাজ                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Category/product/variant/unit | Structured variant/SKU, active/inactive, admin-managed picker ও ঐচ্ছিক bulk add। পুরোনো free-text product rename-এ historical entry নষ্ট হবে না।                        |
| Sales session                 | Admin-maintained session list; program চাইলে required। পুরোনো Session 1/2 শুধু উদাহরণ, auto-imported rule নয়।                                                           |
| Program/day/sprint            | Business date থেকে DayNumber; manual sprint duration/assignment; effective date-এ category যাচাই। আগের category-এর নিজের stock ফেরত/refund করার পথ থাকবে।               |
| Funding round                 | Disbursement-এ round/reference, amount, note, giver/receipt trail। Principal ফেরতের পর profit team-এর থাকবে।                                                            |
| Procurement/expense           | Procurement voucher mandatory; expense type/amount/note এবং configured evidence policy; active team/category/unit validation।                                           |
| Cash/sale mismatch            | Actual collected cash, line/entry reason ও discrepancy আলাদা। আলাদা credit-collection module যোগ নয়।                                                                    |
| Return/transfer/refund/damage | Supplier return cash, paired handover with destination-lead acceptance/proof, original-sale-linked refund ও damage; দুই পাশ একসঙ্গে হিসাব হবে।                          |
| FGD                           | ৩টি finding/action-এর জায়গা; legacy অনুযায়ী প্রথমটি required, বাকি optional—admin required count বাড়াতে পারবেন।                                                         |
| Insight                       | Configured segment/objection options, best broad area, “কেন কিনেছে” field; required/optional rule স্পষ্টভাবে program-এ থাকবে।                                           |
| Field/outgoing                | নিজের check-in/out, broad area, carried goods, hours, steps, proof, returned custody ও personal history। Personal sales ranking হবে না।                                 |
| Reconciliation                | Stock/money rules, missing voucher, pending/unposted entries, open checkout, lead/sprint missing, actual cash count ও principal outstanding-এর actionable list।         |
| Correction/history            | Original read-only, proposed values, reason, version check, approve/reject, effective recalculation, before/after/actor/count। Void history থাকবে; হিসাব মুছে লোপাট নয়। |

আজ/পরের দিন sales স্বাভাবিকভাবে, তারও আগে approval—আগের সম্মত Asia/Dhaka নিয়ম থাকবে। Max field duration optional। Cap অতিক্রম করলে checkout আটকে tracking চালু না রেখে exception নথিভুক্ত হবে। Fixed ৪ দিনের sprint/১৬ ঘণ্টার cap ফিরে আসবে না।

Web check-in/out ও foreground location updates বর্তমান scope। Screen-lock tracking-এর Android plan বহাল; এই redesign-কে native tracking delivery বলা হবে না।

## ৭. Team isolation: server থেকে screen/export পর্যন্ত

1. একটি access resolver course + competition type + program + current membership/lead + staff assignment থেকে capability নির্ধারণ করবে। চার role-এর response আলাদা allowlist হবে।
2. Student-এর effective team server নির্ধারণ করবে। অন্য teamId/recordId/query filter দিলে সংশ্লিষ্ট scope-এর বাইরের data পাওয়া যাবে না।
3. Dashboard, record details, raw sheets, correction before/after, audit, attachment, field/GPS, Excel ও PDF—সব একই scope মানবে। Client-এ লুকিয়েই নিরাপত্তা দাবি করা হবে না।
4. Staff course/role/feature gate লাগবে। শিক্ষক নিজ course-এ পূর্ণ ক্ষমতা পাবেন; generic form APIs Incubation হিসাব পরিবর্তন করতে পারবে না।
5. Shared catalog/broad-area reference data financial data নয়। Student picker-এ কাজের প্রাসঙ্গিক category/নিজের stock থাকবে। Handover picker-এ প্রয়োজনমতো অন্য team-এর নাম/ID; balance/ledger/member detail নয়।
6. Paired transfer-এর দুই পক্ষ শুধু ওই handover-এর agreed items/amount/status/evidence দেখবে; counterpart-এর বাকি হিসাব নয়।
7. Member নিজের summary ও ব্যক্তিগত কাজ দেখবেন; lead নিজের team-এর বিস্তারিত finance ও সবার GPS/proof/learning দেখবেন।
8. Cache/export key-তে user/course/competition/team/scope থাকবে; এক user-এর response অন্য user-কে দেওয়া যাবে না।

## ৮. Public/private report ও sheets

Internal admin/teacher report-এ অনুমোদিত scope-এ team comparison এবং date/batch/team/sprint/category/product/area filters থাকবে। Personal filter শুধু field/FGD/Insight; sales শুধু team-wise। Student-এর report নিজের team-এ বাঁধা থাকবে।

Public report-এ program summary এবং team-wise ফল থাকবে। এটি view-only; public payload/export-এ private ledger, voucher, GPS, member proof, note বা correction/audit details যাবে না।

নিজের/অনুমোদিত scope-এর separate response sheets, row editor, admin bulk preview/atomic save, search/sort/pagination ও actual matching-row export থাকবে। Computed stock/profit cell editable হবে না। XLSX/PDF-এ session, variant, round ও correction metadata যোগ করে screen-এর সঙ্গে মিলিয়ে দেখা হবে।

## ৯. Competitions integration ও বিদ্যমান data migration

প্রস্তাবিত technical design:

- Common `Competition.kind`: existing records default `form`, নতুনটির `business_incubation`।
- Incubation profile-এর সঙ্গে course-scoped unique `competitionId` link; money/stock/field/history নিজের typed tables-এই থাকবে।
- Common listing/create/open flow type অনুযায়ী engine dispatch করবে। সব data generic form answers-এ ঢোকানো হবে না।
- Incubation-এর multiple batches existing profile-এর batch list থেকে authoritative হবে। Legacy form-এর single-batch field form-এর জন্য required থাকবে; Incubation-এর জন্য nullable/typed handling করা হবে—প্রথম batch বসিয়ে বাকিগুলো আড়াল নয়।
- Common title/date/status edit-এর এক authoritative write path থাকবে; rollback compatibility-এর পুরোনো mirrored fields থাকলে একই transaction-এ sync হবে। Form competition-এর submission/procurement/group আচরণ অপরিবর্তিত থাকবে।
- Form-group picker-এর অভিজ্ঞতা পুনর্ব্যবহার করা যাবে। Existing group থেকে Incubation team তৈরি হলে explicit copy/snapshot; পরে Battle of Cups group বদলালে Incubation-এর team/history বদলাবে না।
- Parent Competition page-এর permission gate-ও বদলাবে: teacher-এর শুধু Incubation supervision পাওয়ার জন্য legacy form create/delete ক্ষমতা নিতে হবে না। Feature settings/sidebar gate-এ দুই type-এর enabled state সঠিকভাবে বিবেচিত হবে।
- Staff entry `/dashboard/competitions/[id]`, student entry `/student-dashboard/competitions/[id]`; child actions/details type অনুযায়ী। পুরোনো standalone routes নতুন hub/সংশ্লিষ্ট item-এ compatibility redirect হবে। পুরোনো API নাম থাকলেও একই কঠোর authorization ব্যবহার করবে।
- Generic/form submission/edit/procurement/report API Incubation ID পেলে নিজের handler চালাবে না। Parent-এর পুরোনো hard-delete action দিয়েও Incubation-এর হিসাব মুছে ফেলা যাবে না; data থাকা item archive/close হবে।
- নতুন student Competition route-এ geolocation Permissions-Policy-ও সঠিক করতে হবে; বর্তমানে কেবল পুরোনো Incubation path-এ অনুমতি আছে। বাস্তব browser check-in/out দিয়ে এটি যাচাই হবে।
- সময় ও status মিলিয়ে Running নির্ধারণ হবে; ended/closing item-এ নতুন check-in/submission বন্ধ থাকবে। আগে থেকে চলমান নিজের field session শেষ করার পথ বন্ধ করা হবে না।

**বর্তমানে তৈরি Test incubation, teams, leads এবং জমা data reset হবে না।** নতুন migration existing programs-কে একবার parent competition-এর সঙ্গে যুক্ত করবে। Already-applied migration পরিবর্তন করা হবে না। নতুন schema/backfill migration-এ constraints, course isolation, uniqueness ও rollback compatibility থাকবে। কোনো CSV/ZIP data import নয়।

আগে-পরে program/team/member/record/correction counts ও হিসাবের balances মিলতে হবে; repeated deploy-এ duplicate competition তৈরি হবে না। Existing share token/old route compatible থাকবে; public visibility নতুন অনুমোদিত policy অনুযায়ী প্রয়োগ হবে। Coolify startup migration/readiness gate বজায় থাকবে।

## ১০. বাস্তবায়নের ক্রম ও acceptance

অনুমোদনের পরে আলাদা revision branch/worktree-তে:

1. Final role matrix, public policy ও field visibility freeze; legacy-to-new coverage checklist।
2. Competition type/link ও non-destructive migration; existing-program backfill tests।
3. Access resolver ও role-specific DTO/API; তারপর চারটি আলাদা workspace।
4. Unified Competition create/list/open, membership/lead picker, old-route compatibility।
5. স্পষ্ট lead sales/procurement forms; session/variant/round/learning/reconciliation gaps পূরণ।
6. Scoped reports/sheets/Excel/PDF এবং legacy workflow regression।
7. Review build ও fixtures-সহ বাস্তব user-flow demonstration; নিচের gates pass।

অবশ্যই পরীক্ষা হবে:

- Member A: অন্য team বা financial posting নয়; নিজের field/FGD/Insight কাজ করে।
- Lead A: নিজের sales/purchase/correction করে; team B-এর API/record/file/export/GPS বা setup/fund নয়।
- Lead বদল: পুরোনো lead-এর permission তাৎক্ষণিক বন্ধ; নতুন lead-এর button ও server action কাজ করে।
- Teacher X: নিজের course-এর assigned/unassigned program create/setup/finance/review করতে পারেন; অন্য course বন্ধ।
- Admin: setup, fund, correction/bulk edits, closure ও audit কাজ করে।
- Member/lead/teacher/admin চার account-এর browser test ও পৃথক mobile/desktop screenshot; শুধু lead account test করে coverage দাবি নয়।
- সরাসরি URL/API calls, tampered IDs, exports ও old endpoints-এ cross-team/cross-program/cross-course negative tests।
- Same sales/session/date data থেকে dashboard, sheet, XLSX/PDF totals মেলে; empty/zero/negative result এবং stock/variance/transfer/refund examples মেলে।
- দুই batch-এর একই roll, একই student-এর দুই program-এ আলাদা role, no-team, no-lead, no-stock, no-sprint, ended competition ও stale session আলাদা test।
- Existing Battle of Cups/form competition create/submit/group/correction/report এবং public flow regression।
- Fresh + populated database migration, repeated startup, schema readiness, upload persistence এবং Linux production build।

সব শেষে ব্যবহারকারী বললে তবেই main merge। Push/deployment ব্যবহারকারী করবেন। বর্তমান main বা deployed configuration এখন বদলানো হবে না।

## ১১. চূড়ান্ত সিদ্ধান্ত ও release boundary

1. Teacher নিজের course-এর সব Incubation কাজ করতে পারবেন।
2. Public report-এ summary + team-wise ফল; কোনো editing নেই।
3. Lead নিজের team-এর সব সদস্যের Incubation data, GPS/proof ও learning দেখতে পারবেন।
4. Android app-এর আগের plan বহাল; এই release web-only।
5. ব্যবহারকারী পরে বললে main merge হবে। Push ও Coolify deployment ব্যবহারকারী করবেন।

অন্য কোনো policy decision অপেক্ষায় নেই। বিস্তারিত পরীক্ষার ফল `docs/BUSINESS_INCUBATION_VERIFICATION.md`-তে এবং চালানোর নিয়ম `docs/BUSINESS_INCUBATION_OPERATIONS.md`-তে থাকবে।
