# Business Incubation v3 — পরিবর্তন, ব্যবহার ও যাচাই

অবস্থা: main-এ merge হয়েছে (`cb2b8ce`, ২০২৬-১১-০৭)। পরের অডিট-সংশোধন `fix/incubation-audit` branch-এ (নিচে §৭)। Push ও production deployment ব্যবহারকারী করবেন।

ব্যবহারকারীর সিদ্ধান্ত (২০২৬-১১-০৭): Application/Screening/Judge/Mentor (Track B) এখন নয়; Form competition grid সংশোধন P0; ranking-এর মানদণ্ড Revenue; রিমাইন্ডার In-app + Email।

## ১. কী বদলেছে

### Form competition (Battle of Cups ইত্যাদি) — Manage Responses grid
- সেভ এখন **সব-অথবা-কিছুই-না**। একটি row-এ ভুল থাকলে কিছুই সেভ হয় না; কোন sheet-এর কোন row-এ কী ভুল তা লাল করে দেখায়। আগে ভুল চাপা পড়ে "success" দেখাত।
- ফর্মের নিজের নিয়মে যাচাই: সংখ্যা, তারিখ, বাধ্যতামূলক উত্তর, BD mobile।
- স্বয়ংক্রিয় normalisation: `01`→`1`, `00`→`0`, `1,200`→`1200`, বাংলা অঙ্ক→ইংরেজি, `11/10/2026`→`2026-10-11`।
- শুধু বদলানো row পাঠানো হয়; বদলানো ঘর হলুদ, অসংরক্ষিত পরিবর্তনের সংখ্যা দেখায়, বন্ধ করার আগে সতর্ক করে।
- একই টিমের (বা একই শিক্ষার্থীর) একই দিনের দ্বিতীয় রিপোর্ট আটকানো হয়।
- Grid খোলার পর অন্য কেউ row বদলালে সেই row সেভ হয় না (409)।
- Repeater-এর ৫টির বেশি item আর হারায় না।
- প্রতিটি তৈরি/বদল/মোছা `competition_submission_revisions`-এ আগে-পরের মানসহ থাকে।
- পুরোনো ডাটা বদলানো হয়নি; নিয়ম শুধু নতুন বা বদলানো row-এ প্রযোজ্য।
- Hub-এ form competition-এর অবস্থা এখন তারিখ থেকে (Asia/Dhaka): শেষ তারিখ পেরোলে "সময় শেষ"।

### Business Incubation — lifecycle
| থেকে | যেতে পারে | কারণ লাগবে |
|---|---|---|
| খসড়া | সক্রিয়, বাতিল | বাতিলে |
| সক্রিয় | হিসাব মেলানো, বন্ধ, খসড়া*, বাতিল | খসড়া/বাতিলে |
| হিসাব মেলানো | সক্রিয়, বন্ধ | সক্রিয়তে ফেরাতে |
| বন্ধ | হিসাব মেলানো, আর্কাইভ | হিসাব মেলানোয় ফেরাতে |
| আর্কাইভ | বন্ধ | হ্যাঁ |
| বাতিল | খসড়া, আর্কাইভ | খসড়ায় |

\* এন্ট্রি থাকলে খসড়ায় ফেরানো যায় না। "চলমান / আসন্ন / সময় শেষ" তারিখ থেকে স্বয়ংক্রিয়ভাবে হিসাব হয়।

- **বন্ধ, আর্কাইভ ও বাতিল প্রোগ্রাম সার্ভারে read-only**: এন্ট্রি, সংশোধন, bulk edit, অনুমোদন, টিম, catalog, sprint, শেয়ার, মাঠের সংশোধন ও upload — সব বন্ধ। খোলা মাঠ সেশনের check-out করা যায়। খুলতে হলে কারণসহ অবস্থা বদলাতে হয়; audit-এ `program.status.<আগে>><পরে>` থাকে।
- টিম আবার সেভ করলে সদস্যের রেকর্ড মুছে নতুন বানানো হয় না (ID অপরিবর্তিত)। স্টক, ক্যাশ বা ফেরতযোগ্য ফান্ড থাকা টিম নিষ্ক্রিয় করা যায় না।
- Audit-এ নতুন: সংশোধন প্রত্যাখ্যান, check-in, মাঠ-সংশোধনের অনুরোধ/প্রত্যাখ্যান, file upload, ফলাফল প্রকাশ/প্রত্যাহার।

### আজকের করণীয় ও রিমাইন্ডার
- Staff ড্যাশবোর্ডের শুরুতে **"আজকের করণীয়"**: লিডার নেই, আজ sprint নেই, গতকালের বিক্রি নেই, FGD বাকি (চালু থাকলে), check-out বাকি, দেরির এন্ট্রি/হস্তান্তর/সংশোধন অপেক্ষায়।
- লিডার/সদস্যের home-এ শুধু নিজের জরুরি কাজ। সদস্য টিমের বিক্রির রিমাইন্ডার পান না।
- প্রতিদিন একবার রিমাইন্ডার: লিডার/সদস্য প্রতি বিষয়ে একটি, staff প্রতি প্রোগ্রামে একটি digest। একই দিনে দ্বিতীয়বার চললেও নতুন কিছু তৈরি হয় না। ঘণ্টার (🔔) বোতামে দেখা যায়।
- Course-এ `email_notifications` চালু ও SMTP থাকলে প্রত্যেকে দিনে একটি email পান।
- Setup-এ: "আগের দিনের বিক্রির রিমাইন্ডার" (ডিফল্ট চালু), "FGD রিমাইন্ডার: প্রতি কত দিনে" (ডিফল্ট বন্ধ)।
- Staff প্রাপক: প্রোগ্রামের staff তালিকা; তালিকা ফাঁকা হলে course-এর সব admin ও teacher।

### Ranking ও ফলাফল (Revenue)
- মানদণ্ড: বিক্রির আয় (গ্রাহক refund বাদে); অন্য টিমে হস্তান্তর বিক্রি নয়। আয় সমান হলে নিট লাভ বেশি যার সে আগে; দুটোই সমান হলে একই স্থান।
- রিপোর্ট ট্যাবে চলমান র‍্যাংকিং; **"ফলাফল প্রকাশ করুন"** একটি স্থির snapshot রাখে (নোটসহ, যেমন "সপ্তাহ ১")। নতুন করে প্রকাশ করলে আগেরটি প্রতিস্থাপিত হয়; প্রত্যাহারও করা যায়। বন্ধ প্রোগ্রামেও প্রকাশ করা যায়।
- শিক্ষার্থীর home ও public link-এ শুধু প্রকাশিত ফলাফল (স্থান, টিম, আয়, নিট লাভ)।

### ডাটা শিট এডিটর
- টিম, ধরন, জমাদাতা ও record ID কলাম; খোঁজার ঘর; বদলানো row হাইলাইট।

### UI redesign ও ইংরেজি (২০২৬-১১-০৭, ব্যবহারকারীর review-এর পরে)
- পুরো Business Incubation (admin, teacher, student), Competitions hub, Battle of Cups grid, public report, server error, রিমাইন্ডার ও PDF/Excel লেবেল এখন ইংরেজিতে। শুধু ডাটা (যেমন পণ্য/এলাকার নাম) যেমন লেখা হয়েছে তেমনই থাকে।
- Glass ধাঁচের পরিষ্কার নকশা (`incubation-glass.css`): হালকা gradient পটভূমি, frosted card, স্পষ্ট pill-tab, বড় ও পড়ার মতো লেখা; filter এখন "Filters" বোতামের ভেতরে।
- সংখ্যার ঘরে (পরিমাণ, দাম, টাকা, steps, settings) শুধু সংখ্যা লেখা যায় — অক্ষর টাইপ বা paste হয় না; বাংলা অঙ্ক ইংরেজি হয়ে যায়।
- **Manage data** (নতুন, পুরোনো শিট এডিটরের জায়গায়): Battle of Cups-এর মতো full-screen শিট — "Team-wise data" (Sales, Purchases, Expenses, Supplier returns, Damage, Customer refunds, Transfers, Funding, Principal repayments, Cash counts) ও "Individual data" (FGD, Market insights)। Cell এডিট, Add row / Add 5 rows, row মুছে ফেলা (history-তে void হিসেবে থাকে), Excel paste, খোঁজা ও টিম filter। সেভ একসাথে (`sheet_save`): একটিও ভুল হলে কিছুই সেভ হয় না, ভুল row লাল হয়ে "Sales, row 1: …" দেখায়। নতুন Purchase (voucher লাগে), Customer refund ও Transfer (অন্য এন্ট্রির সঙ্গে যুক্ত) entry form থেকে যোগ করতে হয়; এগুলোর বিদ্যমান row শিটে এডিট করা যায়।

### তারিখ, entry-র সময়সীমা ও মুছে ফেলা
- **শুরু ও শেষের তারিখ:** Setup → "Edit dates & rules" থেকে যেকোনো সময় বদলানো যায় (প্রোগ্রাম বন্ধ/আর্কাইভ না থাকলে)। শুরুর তারিখের আগে "Upcoming", শুরুর দিন থেকে নিজে থেকেই "Running", শেষ তারিখ পেরোলে নিজে থেকেই **"Closing"** দেখায়।
- **শেষ তারিখের পরে:** শিক্ষার্থী (লিডার/সদস্য) নতুন এন্ট্রি, সংশোধন অনুরোধ, হস্তান্তর গ্রহণ, মাঠ-সংশোধন বা ফাইল আপলোড করতে পারে না (খোলা মাঠ সেশনের check-out ছাড়া)। Admin/teacher সব এন্ট্রি, Manage data শিট, সংশোধন ও অনুমোদন চালিয়ে যেতে পারেন। পুরো হিসাব শেষে "Closed" করলে সবার জন্য বন্ধ; প্রয়োজনে কারণসহ আবার খোলা যায়।
- **মুছে ফেলা:** Competitions পাতার কার্ডে "Delete", অথবা Setup-এ "Delete program"। নিশ্চিত করতে প্রোগ্রামের নাম হুবহু লিখতে হয় ও কারণ দিতে হয়। প্রোগ্রাম সবার কাছ থেকে (শিক্ষার্থী, staff, public link, রিমাইন্ডার) সরে যায়; ভুলে মুছলে উদ্ধারের জন্য record ও audit database-এ রেখে দেওয়া হয় (soft delete, `program.deleted` audit)।

## ২. Database migration (সবই additive)
| Migration | কাজ |
|---|---|
| `202611070001_competition_submission_revisions` | Form grid-এর পরিবর্তনের ইতিহাস (RLS) |
| `202611070002_incubation_program_cancelled` | status CHECK-এ `cancelled` যোগ |
| `202611070003_incubation_notifications_results` | `incubation_notifications`, `incubation_results` (RLS) |
| `202611070004_incubation_program_soft_delete` | প্রোগ্রাম মুছে ফেলার জন্য `deleted_at`, `deleted_by`, `delete_reason` |

কোনো table drop, ডাটা reset বা পুরোনো row পরিবর্তন নেই। বিদ্যমান startup (`ensure-app-role` → `prisma migrate deploy` → `incubation-check-schema`) এগুলো চালাবে; readiness gate নতুন দুই table-এর RLS-ও যাচাই করে।

## ৩. চালু করার আগে (প্রশাসক)
1. Deploy-এর আগে database ও `/app/storage` backup।
2. `CRON_SECRET` (১৬+ অক্ষর) সেট থাকতে হবে, নইলে দৈনিক রিমাইন্ডার চলবে না। একাধিক instance হলে `DISABLE_INTERNAL_CRON=1` দিয়ে external scheduler থেকে `POST /api/cron/incubation-reminders` (`x-cron-secret` header) ডাকুন।
3. **সময়:** Business Incubation রিমাইন্ডার এখন container-এর ঘড়ি যা-ই হোক, বাংলাদেশ সময় সকাল ৭টার পরে চলে (অডিট-সংশোধন)। Server চালুর ১ মিনিট পরেই প্রথম যাচাই হয়। অন্য দৈনিক কাজ (attendance alert ইত্যাদি) আগের মতো container-এর ঘড়িতে চলে; `TZ` বদলানোর দরকার নেই।
4. Email চাইলে course settings-এ email notifications চালু রাখুন এবং SMTP env দিন: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`। Email-এর লিংকের জন্য `BASE_DOMAIN` (যেমন `tasm-skill.asf.bd`) সঠিক থাকতে হবে।
5. প্রোগ্রাম setup-এ রিমাইন্ডার settings দেখে নিন; প্রতিটি টিমে লিডার ও sprint আছে কিনা "আজকের করণীয়"-তে দেখুন।

## ৪. Rollback
আগের application release-এ ফেরা যায়; নতুন table/column রেখে দিন (পুরোনো code এগুলো ব্যবহার করে না)। ব্যতিক্রম: কোনো প্রোগ্রাম `cancelled` অবস্থায় থাকলে পুরোনো code সেটি বুঝবে না — rollback-এর আগে সেটি `draft`/`archived` করুন। Database restore সাধারণ rollback নয়।

## ৫. যাচাইয়ের ফলাফল (স্থানীয়, ২০২৬-১১-০৭)
| পরীক্ষা | ফল |
|---|---|
| Incubation Vitest (PGlite-এ আসল migration) — lifecycle, lock, টিম ID, রিমাইন্ডার, ranking, audit সহ | ৫৭/৫৭ পাস |
| Form grid unit (`competitionBulk`), competitions | পাস (মোট ৮১/৮১ লক্ষ্যভিত্তিক) |
| পুরো `src/lib` Vitest | ৪০৩ পাস, ১টি ব্যর্থ — `leaveDuration.test.ts` (এই কাজে স্পর্শ করা হয়নি; আগে থেকেই ব্যর্থ) |
| TypeScript (পুরো প্রজেক্ট) | পাস |
| `test/incubation-http.mjs` (disposable preview) | পাস |
| `test/incubation-access-http.mjs` (role/টিম/প্রোগ্রাম isolation, form regression) | পাস |
| `test/form-grid-http.mjs` (নতুন: atomic, normalise, duplicate দিন, stale edit, update/delete, student 403) | পাস |
| `test/incubation-browser.mjs` — member/leader/teacher/admin/public, Chrome | পাস |
| Screenshot পর্যালোচনা (ignored `.incubation-test/v3/`) — dashboard, ranking, bell, lead mobile, form grid error, sheet editor | কোনো page error নেই |
| Linux production Docker build (`asm-incubation-v3:review`) | পাস |
| Populated upgrade: main-এর migration + নমুনা ডাটা → নতুন image চালু | ৩টি migration প্রয়োগ, readiness gate পাস, `/api/health` ok, ডাটার fingerprint আগে-পরে হুবহু এক |
| নতুন table-এ RLS (forced) ও `cancelled` CHECK | পাস |
| Production image-এ রিমাইন্ডার cron | admin-এর একটি digest; দ্বিতীয়বার ০; ভুল secret → 401 |
| Container restart (repeat deploy) | "No pending migrations", ডাটা অপরিবর্তিত, duplicate competition নেই |

## ৬. এখনো করা হয়নি (পরবর্তী ধাপ)
- Track B: registration/application, screening, rubric/judge, mentor।
- TanStack-ভিত্তিক shared DataSheet (column customization, CSV import)।
- Milestone/deadline table, সাপ্তাহিক/মাসিক রিপোর্ট preset, audit history-তে field diff।
- `IncubationApp.tsx` / `server.ts` বিভাজন (refactor)।
- Overview/export-এ pagination এবং ledger caching (record হাজার ছাড়ালে)।

## ৭. প্রি-লঞ্চ অডিট ও সংশোধন (২০২৬-১১-০৭, branch `fix/incubation-audit`)
তিনটি স্বাধীন review (server যুক্তি, UI, deploy/performance) — প্রতিটি ফলাফল কোডে যাচাই করে সংশোধন:

| গুরুত্ব | সমস্যা | সমাধান |
|---|---|---|
| উচ্চ | Student dashboard থেকে লিংকে ক্লিক করে workspace-এ গেলে GPS check-in কাজ করত না (Permissions-Policy শুধু direct load-এ) | পুরো `/student-dashboard`-এ location অনুমতি; browser-এ click-through করে যাচাই |
| উচ্চ | Manage data শিট খোলা থাকলে ৬০ সেকেন্ডের auto-refresh অসংরক্ষিত এডিট মুছে দিত | শিট/ফর্ম খোলা থাকলে refresh বন্ধ; ৭০ সেকেন্ড অপেক্ষা করে যাচাই |
| উচ্চ | লিডার sale-এ অন্য টিম (`targetTeamId`) জুড়ে দিলে সেই টিমের রিপোর্ট ভেঙে যেত | শুধু transfer-এ receiving team থাকে |
| উচ্চ | Battle of Cups grid-এ row এডিট করলে `absentRolls` (অনুপস্থিতি) মুছে যেত; filter অবস্থায় paste লুকানো row-এ পড়ত | লুকানো ডাটা রক্ষা; paste শুধু দৃশ্যমান row-এ; dropdown/multi-select যাচাই |
| মাঝারি | তারিখ বদলালে পুরোনো এন্ট্রি আর সংশোধন করা যেত না; ভুলে যাওয়া check-out আটকে থাকত; বন্ধ প্রোগ্রামের public link বন্ধ করা যেত না; pending কাজ রেখে close করা যেত | তারিখ-সীমা যাচাই; staff "Force check-out"; link সবসময় বন্ধ করা যায়; close-এর আগে pending গণনা |
| মাঝারি | শিট: অপরিবর্তিত লেখা "changed" দেখাত; ভুলের row চিহ্নিত হতো না; দুবার Save-এ duplicate | সব ঠিক করা হয়েছে |
| নিম্ন | রিমাইন্ডার UTC দুপুর ১টায়; check-out রিমাইন্ডার একবারই; deleted প্রোগ্রামের রিমাইন্ডার bell-এ | বাংলাদেশ সময় সকাল ৭টা; প্রতিদিন; লুকানো |
| নিম্ন | Readiness gate runtime role-এর অনুমতি দেখত না; dashboard সব audit history লোড করত | Gate-এ অনুমতি যাচাই; screen-এ সর্বশেষ ৫০০ (export-এ সব) |

**জেনে রাখুন (নকশাগত সিদ্ধান্ত, বদলানো হয়নি):** course-এর প্রত্যেক শিক্ষক সব Business Incubation পরিচালনা করতে পারেন (আগের অনুমোদিত নীতি); প্রোগ্রামের "staff" তালিকা শুধু কে দৈনিক রিমাইন্ডার পাবেন তা ঠিক করে। SMTP email একে একে যায় — অনেক প্রাপক হলে রিমাইন্ডার পাঠাতে কয়েক মিনিট লাগতে পারে।

