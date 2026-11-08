# Prompt for the new CRM implementation conversation

Copy the text below into a new conversation opened on this repository. The linked plan is the implementation handoff; read it in full before making changes.

---

আমি আমার ASM Portal-এ inbound Customer Service CRM feature-এর implementation শুরু করতে চাই। নিচের final plan এবং মূল CRM PDF সম্পূর্ণ পড়ে সেই অনুযায়ী কাজ করো। এই prompt implementation শুরু করার অনুমোদন। শুধু নতুন পরিকল্পনা দিয়ে থেমে যাবে না; feature সম্পূর্ণ implement করে test এবং review-ready handoff পর্যন্ত নিয়ে যাবে।

Repository:
`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-dev`

Final plan:
`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-dev\docs\CRM_IMPLEMENTATION_PLAN.md`

Original CRM PDF:
`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-dev\Customer Service Management (CRM) — Framework & Structure - Google Docs.pdf`

Fallback PDF path:
`C:\Users\USER\Downloads\Customer Service Management (CRM) — Framework & Structure - Google Docs.pdf`

প্রথমে applicable AGENTS.md, git status/worktrees, current main ও repository architecture পরীক্ষা করো। এরপর latest verified main থেকে `feature/customer-service-crm` নামে নতুন branch এবং আলাদা worktree তৈরি করে সেখানেই implementation করো। প্রস্তাবিত worktree path:
`F:\Dev File\ASSDI Portal\ASM Portal V2\asm-portal-v2-crm`

Path/branch আগে থেকে থাকলে যাচাই করে নিরাপদে সমাধান করো; কোনো existing কাজ overwrite/reset করবে না। মূল checkout-এর untracked plan/PDF নতুন worktree-তে স্বয়ংক্রিয়ভাবে আসবে না—absolute path থেকে পড়ো বা প্রয়োজনীয় reference নিরাপদে কপি করো। Worktree তৈরিতে environment permission লাগলে তার নির্ধারিত approval flow ব্যবহার করো; main-এ feature coding শুরু করবে না।

ব্যবহারকারীর নিশ্চিত সিদ্ধান্ত:

- Inbound CRM; প্রতি batch-এর shared workspace; প্রথমে dummy customers।
- Portal-এর course feature checkbox দিয়ে CRM চালু হবে; default OFF।
- Student portal-এর CRM link নতুন tab-এ `/student-dashboard/crm` খুলবে। পুরোনো student sidebar/navbar ছাড়া স্বতন্ত্র CRM layout থাকবে।
- Portal-এর login, current user identity, course ও batch ব্যবহার করবে। আলাদা CRM password/login account তৈরি করবে না।
- শিক্ষকেরা ছাত্রদের Agent/L2/L3 role দেবেন; portal role বদলাবে না।
- Agent সমাধান করতে পারলে সরাসরি resolve; না পারলে escalate। Agent একই workspace-এর history দেখতে পারবে, কিন্তু অনুমোদিত নিজের unresolved কাজই edit করতে পারবে।
- Issue/complaint type ও tag অনুযায়ী SLA management UI থেকে configurable হবে। কোনো production duration অনুমান করে স্থায়ীভাবে hardcode করবে না।
- সময় ২৪ ঘণ্টা একটানা গণনা হবে। Revert/resubmit-এ L2 timer থামবে বা reset হবে না।
- Average SLA = complaint তৈরি থেকে final resolution পর্যন্ত সময়ের গড়।
- Tethered = একই calendar week-এ created ও resolved। Untethered = পরবর্তী সপ্তাহে resolved। Agent/L2/L3 কে resolve করেছে তার সঙ্গে এই classification-এর সম্পর্ক নেই।
- সপ্তাহ শুরু রবিবার 00:00, Asia/Dhaka; পরের রবিবার 00:00 exclusive। শনিবার থেকে সপ্তাহ শুরু বা rolling seven-day logic ব্যবহার করবে না।
- English UI, প্রয়োজনমতো বাংলা help text। Marks, assessment ও teacher feedback module নেই।

Database:

Coolify-তে `assdi-customer-service-db` নামে নতুন আলাদা PostgreSQL resource তৈরি হয়েছে এবং Running দেখিয়েছে। Requested initial database `assdi_customer_service`; actual name/version/network ও credentials যাচাই করতে হবে। Portal-এর আগের database থাকবে। CRM-এর operational data নতুন database-এ থাকবে; ভবিষ্যতের training live chat-ও পরে এখানে যোগ হবে। নতুন database recreate করবে না।

বর্তমান portal chat এই feature-এর অংশ নয়। সেটি migrate/refactor করবে না। Training live chat এখন implement করবে না; তার আলাদা PDF থাকলেও সেটি ভবিষ্যতের কাজ।

Final plan-এর engineering defaults অনুসরণ করো; confirmed requirements-এর সঙ্গে এগুলো গুলিয়ে ফেলবে না। Repository evidence অনুযায়ী implementation detail বদলাতে হলে কারণ লিখবে। ইতোমধ্যে উত্তর দেওয়া scope প্রশ্নগুলো আবার জিজ্ঞেস করবে না। কোনো সত্যিকারের অনির্ধারিত business decision বা প্রয়োজনীয় credential/infrastructure access ছাড়া কাজ এগোনো সম্ভব না হলে শুধু সেটি জিজ্ঞেস করো এবং independent কাজ চালিয়ে যাও।

নিরাপদ local/development/test database ব্যবহার করো। Production database-এ development migration, reset, seed বা test চালাবে না। Secrets চ্যাটে, log-এ, code-এ বা Git-এ প্রকাশ করবে না। Existing `.env` production-এর হতে পারে—অন্ধভাবে copy/use করবে না।

প্রয়োজনীয় schema/client/migrations, scoped authorization/RLS, student ও staff UI, complaint operations, L2/L3 queues, timer/policy logic, dashboard/reports/export এবং deployment configuration সম্পূর্ণ করো। Repository-এর বর্তমান conventions মানো, অপ্রয়োজনীয় dependency upgrade বা unrelated refactor করবে না।

তারপর final plan-এর acceptance tests অনুযায়ী real isolated PostgreSQL-এ integration tests, business tests, browser end-to-end checks, type/lint/build checks ও existing portal regression smoke tests করো। যা সত্যিই চালানো হয়েছে তার command ও result সংরক্ষণ করো। কোনো test বা environment verification করা না গেলে সেটা স্পষ্টভাবে বলবে; mock pass-কে real DB/browser pass বলবে না।

শেষে branch/worktree, কী তৈরি হয়েছে, tests-এর ফল, যেকোনো limitation, প্রয়োজনীয় Coolify secret variable/role/migration setup, backup, release order এবং rollback instructions দেবে। Feature branch-এ reviewable commits এবং test report প্রস্তুত রাখবে।

আমি ফল দেখে main-এ merge/push এবং Coolify deploy করব বা তোমাকে আলাদা নির্দেশ দেব। তার আগে নিজে main merge/push, PR publish বা production deploy করবে না। `npm run deploy` বর্তমানে Firebase-এর দিকে থাকতে পারে—সেটি এই Coolify release-এর জন্য ব্যবহার করবে না।

এখন plan ও PDF পড়ে নতুন worktree-তে কাজ শুরু করো এবং পূর্ণ implementation ও যাচাই পর্যন্ত এগিয়ে যাও।
