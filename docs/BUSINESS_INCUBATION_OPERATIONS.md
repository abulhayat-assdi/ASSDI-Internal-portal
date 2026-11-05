# Business Incubation — ব্যবহার ও deployment নির্দেশিকা

## বর্তমান scope

এই release-এ Business Incubation-এর ওয়েব ফিচার রয়েছে। Android অ্যাপের পরিকল্পনা `ANDROID_PORTAL_APP_PLAN.md`-তে রাখা আছে; APK বা ফোন লক অবস্থার tracking এই release-এর অংশ নয়।

কাজের branch: `feature/business-incubation`। ব্যবহারকারীর স্পষ্ট নির্দেশ ছাড়া main-এ merge, push বা production deployment করা হবে না।

## কোর্সে চালু করা

1. Super Admin-এর course feature settings থেকে **Business Incubation** চালু করুন। নতুন ফিচার default off থাকে। বন্ধ করলে ডাটা মুছে যায় না এবং API-ও feature access বন্ধ করে।
2. Staff-এর জন্য **Business Incubation** permission এবং পরিচালকের জন্য **Incubation Administration** permission দিন। নির্দিষ্ট শিক্ষককে প্রোগ্রামের staff list-এও যুক্ত করুন। Existing explicit permission lists-এ নতুন permission প্রয়োজনে Access Management থেকে দিতে হবে।
3. Staff page: `/dashboard/incubation`; student page: `/student-dashboard/incubation`। Sidebar-এ একই নামে entry রয়েছে।

## প্রথম প্রোগ্রাম

1. নতুন প্রোগ্রামে নাম, শুরু/শেষ, বিদ্যমান ব্যাচ, তত্ত্বাবধায়ক ও নিয়ম দিন। স্প্রিন্টের দিন নিজে নির্ধারণ করুন। মাঠের সর্বোচ্চ সময় ঐচ্ছিক। GPS update interval ও retention period দিন।
2. All Batch Info-এর বিদ্যমান roster থেকে একই ব্যাচের সদস্য নিয়ে টিম তৈরি করুন এবং একজন লিডার বাছুন। একই প্রোগ্রামে একজন দুই টিমে থাকতে পারবেন না।
3. ক্যাটাগরি, পণ্য/ভ্যারিয়েন্ট, একক ও ব্রড এরিয়া তৈরি করুন। ভগ্নাংশ শুধু উপযুক্ত পণ্যে চালু করুন। লেনদেন থাকা পণ্যের একক/ক্যাটাগরি বদলানোর বদলে নতুন পণ্য তৈরি করুন; নাম ও সক্রিয়তা বদলানো যায়।
4. প্রতি টিমে স্প্রিন্টের শুরু/শেষ ও ক্যাটাগরি দিন। একই টিমের overlapping sprint গ্রহণযোগ্য নয়। বিক্রির নির্দিষ্ট এলাকা বরাদ্দ হয় না।
5. সব প্রস্তুত হলে প্রোগ্রাম active করুন এবং প্রতিষ্ঠানের ফান্ড প্রদান নথিভুক্ত করুন।

## শিক্ষার্থীর কাজ

- সবাই নিজস্ব student account ব্যবহার করবে; আলাদা username/password বা নতুন student registration নেই।
- শুধু বর্তমান লিডার টিমের আর্থিক এন্ট্রি দিতে পারবেন। নতুন লিডার নির্বাচিত হলে আগের লিডারের posting access সাথে সাথে বন্ধ হয়।
- Procurement-এ voucher বাধ্যতামূলক। ছবি browser-এ ছোট করা হয়; server গ্রহণ করে JPG/PNG/WebP/PDF, সর্বোচ্চ ৮ MB।
- Sales-এ পরিমাণ, মূল্য, পাওয়া টাকা ও ব্রড এরিয়া দিন। পাওয়া টাকা বিক্রির মূল্যের সমান না হলে কারণ দিন। বকেয়া আদায়ের আলাদা module নেই; পার্থক্য reconciliation-এ দৃশ্যমান থাকে।
- আজকের বিক্রি আজ বা আগামীকাল স্বাভাবিকভাবে জমা দেওয়া যায়। আরও পুরোনো এন্ট্রি নির্দিষ্ট submission-এর অনুমোদনের অপেক্ষায় থাকে। অননুমোদিত ডাটা হিসাব বা official report বদলায় না।
- মূল ফান্ড ফেরতের প্রস্তাব লিডার জমা দিতে পারেন; প্রতিষ্ঠান/অনুমোদিত staff গ্রহণ নিশ্চিত করলে ক্যাশ ও বাকি principal বদলাবে। লাভ টিমের কাছেই থাকবে।
- সদস্যরা নিজস্ব field session, steps/pedometer proof, FGD এবং market insight জমা দেবেন। আর্থিক ফলাফল শুধু টিমভিত্তিক; ব্যক্তিগত sales ranking নেই।

## ফেরত, ক্ষতি ও হস্তান্তর

- **সরবরাহকারীকে ফেরত:** পরিমাণ এবং ফেরত পাওয়া মূল্য দিন। স্টক কমবে, actual cash বাড়বে; cost-এর সঙ্গে পার্থক্য return gain/loss হিসেবে দেখা যাবে।
- **অন্য টিমে ফেরত:** গ্রহণকারী টিম ও মূল্য দিয়ে প্রস্তাব দিন। অপেক্ষায় থাকা পরিমাণ source stock-এ reserved থাকে। গ্রহণকারী লিডার voucher দিয়ে গ্রহণ নিশ্চিত করলে এক transaction-এ source return ও destination procurement/cash effect হবে।
- **ক্রেতার ফেরত/refund:** মূল বিক্রি বেছে পরিমাণ, actual refund এবং saleable/damaged অবস্থা দিন। মূল বিক্রির অবশিষ্ট quantity/refundable amount অতিক্রম করা যাবে না।
- **নষ্ট পণ্য:** কারণসহ স্টক থেকে বের হবে এবং তার cost ক্ষতিতে গণনা হবে।

## সংশোধন ও sheet editing

ডাটা শিটে তারিখ/দাখিলের সময়সহ আগের record দেখা যায়। শিক্ষার্থী record বেছে পুরোনো read-only তথ্যের পাশে প্রস্তাবিত নতুন তথ্য ও কারণ দেন। অনুমোদিত শিক্ষক/অ্যাডমিন Correction Requests থেকে তুলনা করে গ্রহণ/প্রত্যাখ্যান করেন। অনুমোদনের সময় পুরোনো version, chronological stock ও linked team effects পুনরায় যাচাই হয়।

Admin সরাসরি row editor বা একাধিক record-এর sheet editor ব্যবহার করতে পারেন। Sheet editor preview দেখায়; সব পরিবর্তন এক transaction-এ হয়। একটিও invalid/stale হলে পুরো পরিবর্তন বাতিল হয়। একবারে ২০০ record-এর সীমা স্পষ্টভাবে দেখায়; বড় scope হলে ফিল্টার ছোট করতে হবে। মূল history physically delete করা হয় না। Pending stale request প্রত্যাখ্যান করে নতুন request দেওয়া যায়।

মাঠের বন্ধ সেশনের সময়/ব্রড এরিয়া/স্টেপও একইভাবে সংশোধন করা যায়; captured GPS coordinates হাতে edit করা যায় না। Closing/closed period-এর admin correction-ও history-তে থাকে। অসম্পূর্ণ stock/principal/variance নিয়ে প্রোগ্রাম বন্ধ করতে ব্যাখ্যা দিতে হয়; principal নিজে থেকে মওকুফ হয় না।

## মাঠ ও GPS

ওয়েব check-in/out-এর সময় fresh GPS ও অনুমতি প্রয়োজন। একই ব্যক্তির একাধিক খোলা সেশন হয় না। বহন করা পণ্য team custody-তে reserve হয়; team sales FIFO নিয়মে field custody কমায়, এটি ব্যক্তিগত sales attribution নয়। Checkout-এ অবশিষ্ট custody টিমে ফেরত আসে।

পেজ সামনে থাকলে interval অনুযায়ী আপডেট যায়। Screen lock বা browser বন্ধ অবস্থায় continuous tracking-এর দাবি করা হয় না। Dashboard-এ last seen, accuracy এবং stale state দেখা যায়। নির্ধারিত duration অতিক্রম করলে checkout বন্ধ করে tracking চালিয়ে রাখার পরিবর্তে exception audit হয়, যা staff পর্যালোচনা করতে পারেন।

Retention cleanup পুরোনো pings ও endpoint coordinates সরায়; audit-এ coordinates কপি করা হয় না। Internal scheduler-এর জন্য বিদ্যমান `CRON_SECRET` (কমপক্ষে ১৬ অক্ষর) লাগবে। External scheduler ব্যবহার করলে `POST /api/cron/incubation-retention`-এ `x-cron-secret` দিন।

## রিপোর্ট ও শেয়ার

Date range, batch, team, sprint, category, product ও broad area দিয়ে প্রাসঙ্গিক ফলাফল দেখা যায়। Sprint selection সংশ্লিষ্ট team/category/date scope বেছে দেয়। Field/FGD-এর ব্যক্তিগত ফিল্টার financial sales-কে ব্যক্তির নামে ভাগ করে না।

- Stock/cash হলো নির্বাচিত শেষ তারিখের balance; date range-এর শুরুর আগের opening balance বজায় থাকে। Revenue/profit হলো নির্বাচিত সময়ের flow।
- Category/product ফিল্টারে product-বিহীন খরচ ও ফান্ড allocation করা হয় না। Area performance-এ সেই এলাকার নথিভুক্ত পণ্যের contribution দেখায়; team cash/stock balance আলাদা থাকে।
- Institution-wide consolidated net profit ও stock value থেকে অবিক্রীত internal handover markup বাদ দেওয়া হয়। Team statements নিজেদের agreed handover মূল্য অনুযায়ী থাকে।
- Excel-এ summary ও আলাদা operational sheets, pending/rejected submissions ও authorized history থাকে। PDF-এ বাংলা font, chart/table এবং page numbering থাকে। Pagination-এর প্রথম পৃষ্ঠা নয়, matching records export হয়।
- ডাটা শিট, মাঠ ও FGD পেজের Excel/PDF বোতাম বর্তমান শিট export করে। রিপোর্ট পেজের বোতাম পুরো নির্বাচিত scope export করে। ব্যক্তির ফিল্টার শুধু মাঠ, FGD ও Insights-এ প্রযোজ্য; টিমের আর্থিক হিসাবকে ব্যক্তিগত sales হিসেবে দেখায় না। দৈনিক নিট বিক্রির চার্টে refund তার কার্যকর তারিখে বাদ যায়।
- Public report স্পষ্টভাবে publish করতে হয়। নতুন link পুরোনো link revoke করে; unpublish-ও করা যায়। Public API/export-এ শুধু অনুমোদিত team aggregates থাকে—GPS, vouchers, private notes, raw records বা history নয়।

## Coolify-এ automatic migration

এই ফিচারের জন্য দ্বিতীয় PostgreSQL service/database তৈরি করতে হবে না। বর্তমান portal database-এ নতুন `incubation_*` tables তৈরি হবে।

বিদ্যমান Docker startup-এর ক্রম:

1. `scripts/ensure-app-role.js` runtime role এবং বর্তমান/ভবিষ্যৎ table/sequence permissions প্রস্তুত করে।
2. Bootstrap connection দিয়ে `prisma migrate deploy` নতুন migration চালায়।
3. `scripts/incubation-check-schema.cjs` দিয়ে সব ১২টি table এবং RLS readiness যাচাই হয়।
4. তারপর বিদ্যমান startup steps ও Next server চালু হয়। Migration/readiness ব্যর্থ হলে app launch হয় না।

Migration: `prisma/migrations/202611040001_business_incubation/migration.sql`। এটি schema-only; কোনো legacy import, sample program, product বা transaction seed করে না। Repeated startup আগের records reset করে না।

বিদ্যমান Coolify database credentials/`APP_DB_PASSWORD` বজায় রাখুন। Upload volume `/app/storage` persistent হতে হবে এবং `LOCAL_STORAGE_PATH=/app/storage` থাকতে হবে। GPS retention চালাতে `CRON_SECRET` বা external cron দরকার।

ব্যবহারকারী merge ও push বললে তবেই Git/Coolify release করুন। আগে database ও upload backup, পরে migration log-এ `[incubation] schema and course isolation ready; no data seeded` এবং `/api/health` যাচাই করুন। নতুন ফিচার default off থাকবে; নির্বাচিত কোর্সে enable করে খালি setup থেকে শুরু করুন।

## স্থানীয় যাচাই

`npm run incubation:test` isolated in-memory PostgreSQL-এ domain/integration checks চালায়। `npm run incubation:preview` disposable local fixture server চালায়; production credentials ব্যবহার করে না। `node test/incubation-http.mjs` এবং `INCUBATION_BROWSER_CHANNEL=chrome node test/incubation-browser.mjs` ওই preview-তে HTTP ও browser checks চালায়।

Native PostgreSQL checks-এর জন্য localhost-only disposable service port 55442 ব্যবহার করে `INCUBATION_NATIVE_TEST=1 npm run incubation:test` চালানো হয়। প্রতি run-এ আলাদা test database তৈরি/সরানো হয়। Linux production build: `docker build -t asm-incubation-review:local .`। Windows-এ বিদ্যমান custom CRM Prisma runtime-এর file tracing সমস্যা থাকায় release verification Linux Docker image-এ করা হয়।

## Rollback

প্রয়োজনে course feature বন্ধ করে আগের application release চালানো যায়; নতুন tables/records রেখে দিন। Database restore বা table drop সাধারণ rollback নয়, কারণ এতে পরের আসল এন্ট্রি হারাতে পারে। Android release-এর কাজ পরে আলাদা পরিকল্পনা অনুযায়ী হবে।
