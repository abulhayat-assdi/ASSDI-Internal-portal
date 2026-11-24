/**
 * Turns the module's English error messages into Bangla that says what went wrong
 * and what the user should do. Pure and dependency-free so both the API and the
 * browser can use it. The English text stays the source of truth (tests and
 * audit logs use it); this is only for display.
 */

const KIND_BN: Record<string, string> = {
  Purchase: "ক্রয় (Purchase)",
  Sale: "বিক্রয় (Sale)",
  "Supplier return": "সাপ্লায়ার রিটার্ন",
  "Transfer to team": "অন্য টিমে ট্রান্সফার",
  "Customer refund": "কাস্টমার রিফান্ড",
  Damage: "ড্যামেজ / নষ্ট",
  Expense: "খরচ (Expense)",
  Funding: "ফান্ড / বিনিয়োগ",
  "Principal repayment": "মূলধন ফেরত",
  "Cash count": "ক্যাশ গণনা",
};

const STATUS_BN: Record<string, string> = {
  Draft: "ড্রাফট",
  Active: "চালু",
  Upcoming: "শীঘ্রই শুরু",
  Running: "চলমান",
  Closing: "সমাপ্তির পথে",
  Closed: "বন্ধ",
  Archived: "আর্কাইভ",
  Cancelled: "বাতিল",
};

const REFRESH = "পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।";
const ASK_TEACHER = "সমস্যা থেকে গেলে শিক্ষক/অ্যাডমিনকে জানান।";

type Rule = [RegExp, (m: RegExpExecArray) => [string, string]];

/** Exact messages → [what happened, what to do]. */
const EXACT: Record<string, [string, string]> = {
  // Access and permissions
  "Business Incubation is not enabled for this course.": [
    "এই কোর্সে Business Incubation ফিচার চালু করা নেই।",
    "অ্যাডমিন কোর্স সেটিংস থেকে Business Incubation ফিচারটি চালু করুন।",
  ],
  "You do not have permission for this action.": [
    "এই কাজটি করার অনুমতি আপনার নেই।",
    "শিক্ষক বা অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন, অথবা অ্যাডমিনের কাছে অনুমতি চান।",
  ],
  "You do not have permission to supervise this program.": [
    "আপনি এই প্রোগ্রামের সুপারভাইজার হিসেবে যুক্ত নন।",
    "প্রোগ্রামের Setup থেকে আপনাকে স্টাফ হিসেবে যুক্ত করতে অ্যাডমিনকে বলুন।",
  ],
  "You have not been added to an active team in this program.": [
    "আপনাকে এই প্রোগ্রামের কোনো চালু টিমে যুক্ত করা হয়নি।",
    "শিক্ষককে বলুন আপনাকে একটি টিমে যুক্ত করতে (Setup → Teams and members)।",
  ],
  "This competition has not been published yet.": [
    "প্রোগ্রামটি এখনো প্রকাশ (Active) করা হয়নি।",
    "শিক্ষক প্রোগ্রামটি Active করলে তারপর এখানে কাজ করতে পারবেন।",
  ],
  "Permission denied.": ["অনুমতি নেই।", "সঠিক অ্যাকাউন্ট দিয়ে লগইন করুন।"],
  "Staff permission is required.": [
    "এই কাজটি শুধু শিক্ষক/অ্যাডমিন করতে পারেন।",
    "শিক্ষক বা অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করে আবার চেষ্টা করুন।",
  ],
  "Teacher or admin permission is required.": [
    "এই অনুরোধ রিভিউ করতে শিক্ষক বা অ্যাডমিনের অনুমতি লাগে।",
    "শিক্ষক/অ্যাডমিন অ্যাকাউন্ট দিয়ে রিভিউ করুন।",
  ],
  "Only staff can create or change programs.": [
    "প্রোগ্রাম তৈরি বা পরিবর্তন শুধু স্টাফ করতে পারেন।",
    "শিক্ষক/অ্যাডমিন অ্যাকাউন্ট ব্যবহার করুন।",
  ],
  "Only staff can delete a program.": [
    "প্রোগ্রাম ডিলিট শুধু স্টাফ করতে পারেন।",
    "শিক্ষক/অ্যাডমিন অ্যাকাউন্ট ব্যবহার করুন।",
  ],
  "Only staff can edit sheets.": [
    "শিট এডিট শুধু স্টাফ করতে পারেন।",
    "শিক্ষার্থীরা নিজের এন্ট্রিতে \"Correction\" অনুরোধ পাঠাতে পারে।",
  ],
  "Only staff can publish results.": [
    "ফলাফল প্রকাশ শুধু স্টাফ করতে পারেন।",
    "শিক্ষক/অ্যাডমিন অ্যাকাউন্ট ব্যবহার করুন।",
  ],
  "Only the team lead can submit financial entries.": [
    "টাকা-পয়সার এন্ট্রি (ক্রয়, বিক্রয়, খরচ ইত্যাদি) শুধু টিম লিডার দিতে পারে।",
    "আপনার টিম লিডারকে এন্ট্রি দিতে বলুন, অথবা লিডার পরিবর্তনের জন্য শিক্ষককে জানান।",
  ],
  "Only the team lead can download detailed financial reports.": [
    "বিস্তারিত আর্থিক রিপোর্ট শুধু টিম লিডার ডাউনলোড করতে পারে।",
    "টিম লিডারের কাছ থেকে রিপোর্টটি নিন।",
  ],
  "Funding is recorded by authorised staff only.": [
    "ফান্ড/বিনিয়োগের এন্ট্রি শুধু অনুমোদিত স্টাফ দিতে পারেন।",
    "টাকা পেলে শিক্ষককে জানান — শিক্ষক Data sheets → Funding থেকে এন্ট্রি দেবেন।",
  ],
  "You can only submit entries for your own team.": [
    "আপনি শুধু নিজের টিমের এন্ট্রি দিতে পারেন।",
    "টিম সিলেক্ট করার সময় নিজের টিম বেছে নিন।",
  ],
  "You can only correct your own entries.": [
    "আপনি শুধু নিজের দেওয়া এন্ট্রি সংশোধন করতে পারেন।",
    "যিনি এন্ট্রি দিয়েছেন তাকে সংশোধন অনুরোধ পাঠাতে বলুন।",
  ],
  "Only the receiving team lead can accept this.": [
    "এই ট্রান্সফার শুধু গ্রহণকারী টিমের লিডার গ্রহণ করতে পারে।",
    "গ্রহণকারী টিমের লিডারকে Requests থেকে এটি Accept করতে বলুন।",
  ],
  "You are not allowed to review this.": [
    "এটি রিভিউ করার অনুমতি আপনার নেই।",
    "শিক্ষক/অ্যাডমিনকে রিভিউ করতে বলুন।",
  ],
  "You can only correct your own field sessions.": [
    "আপনি শুধু নিজের ফিল্ড সেশন সংশোধন করতে পারেন।",
    "যার সেশন, তাকে অনুরোধ পাঠাতে বলুন।",
  ],
  "Only staff can close another person's field session.": [
    "অন্যের ফিল্ড সেশন শুধু স্টাফ বন্ধ করতে পারেন।",
    "যিনি চেক-ইন করেছেন তাকে চেক-আউট করতে বলুন, অথবা শিক্ষককে জানান।",
  ],
  "Field sessions must be started from the student's own account.": [
    "ফিল্ড সেশন শিক্ষার্থীকে নিজের অ্যাকাউন্ট থেকে শুরু করতে হয়।",
    "শিক্ষার্থীর নিজের মোবাইল/অ্যাকাউন্ট থেকে চেক-ইন করুন।",
  ],
  "You can only view your own location history.": [
    "আপনি শুধু নিজের লোকেশন হিস্ট্রি দেখতে পারেন।",
    "অন্যের হিস্ট্রি দেখতে শিক্ষককে জানান।",
  ],
  "Upload files for your own team only.": [
    "শুধু নিজের টিমের জন্য ফাইল আপলোড করা যায়।",
    "সঠিক টিম সিলেক্ট করে আবার আপলোড করুন।",
  ],
  "You do not have access to this file.": [
    "এই ফাইলটি দেখার অনুমতি আপনার নেই।",
    "যিনি আপলোড করেছেন বা শিক্ষকের কাছে চান।",
  ],
  Unauthorized: ["আপনি লগইন অবস্থায় নেই বা সেশন শেষ হয়ে গেছে।", "আবার লগইন করুন।"],

  // Programs
  "Program not found.": ["প্রোগ্রামটি পাওয়া যায়নি (ডিলিট হয়ে থাকতে পারে)।", REFRESH],
  "Select a program.": ["কোনো প্রোগ্রাম সিলেক্ট করা হয়নি।", "উপরের তালিকা থেকে একটি প্রোগ্রাম বেছে নিন।"],
  "Specify a program.": ["কোনো প্রোগ্রাম সিলেক্ট করা হয়নি।", "একটি প্রোগ্রাম বেছে নিন।"],
  "Competition not found.": ["প্রোগ্রাম/কম্পিটিশনটি পাওয়া যায়নি।", REFRESH],
  "The end date must be after the start date.": [
    "শেষের তারিখ শুরুর তারিখের আগে দেওয়া হয়েছে।",
    "শেষের তারিখ শুরুর তারিখের সমান বা পরে দিন।",
  ],
  "Select existing batches.": [
    "যে ব্যাচ সিলেক্ট করা হয়েছে তা এই কোর্সে নেই।",
    "তালিকা থেকে বিদ্যমান ব্যাচ বেছে নিন।",
  ],
  "Select valid teachers or admins from this course.": [
    "স্টাফ তালিকায় এমন কেউ আছেন যিনি এই কোর্সের শিক্ষক/অ্যাডমিন নন।",
    "তালিকা থেকে শুধু এই কোর্সের শিক্ষক/অ্যাডমিন বেছে নিন।",
  ],
  "Create a new program as Draft or Active.": [
    "নতুন প্রোগ্রাম শুধু Draft বা Active অবস্থায় তৈরি করা যায়।",
    "Status হিসেবে Draft বা Active বেছে নিন।",
  ],
  "A program with entries cannot go back to Draft. Use 'Closing' or 'Cancelled' instead.": [
    "যে প্রোগ্রামে এন্ট্রি আছে তাকে আর Draft-এ ফেরানো যায় না।",
    "এর বদলে 'Closing' বা 'Cancelled' ব্যবহার করুন।",
  ],
  "Stock, principal or cash is not fully settled. Enter a reason to close anyway.": [
    "কোনো টিমের কাছে এখনো স্টক, মূলধন বা ক্যাশের হিসাব বাকি আছে।",
    "Reconciliation দেখে হিসাব মিলিয়ে নিন, অথবা কারণ লিখে প্রোগ্রাম বন্ধ করুন।",
  ],
  "Type the program name exactly to confirm deletion.": [
    "নিশ্চিত করার জন্য লেখা প্রোগ্রামের নাম মেলেনি।",
    "প্রোগ্রামের নাম হুবহু (বানান ও স্পেসসহ) লিখুন।",
  ],
  "Entries for this program are closed. Contact your teacher if something needs to change.": [
    "এই প্রোগ্রামের এন্ট্রির সময় শেষ (বা এখনো শুরু হয়নি)।",
    "কিছু পরিবর্তন লাগলে শিক্ষককে জানান — শিক্ষক এন্ট্রি দিতে/ঠিক করতে পারবেন।",
  ],
  "Entries for this program are closed.": [
    "এই প্রোগ্রামের এন্ট্রির সময় শেষ।",
    "পরিবর্তন লাগলে শিক্ষককে জানান।",
  ],
  "The program must be running to accept entries.": [
    "প্রোগ্রাম চলমান না থাকায় এন্ট্রি নেওয়া যাচ্ছে না।",
    "প্রোগ্রামের তারিখ ও Status (Active) ঠিক আছে কি না শিক্ষককে দেখতে বলুন।",
  ],
  "The program is not running.": [
    "প্রোগ্রাম এখন চলমান নয়।",
    "প্রোগ্রামের তারিখের মধ্যে চেক-ইন করুন, অথবা শিক্ষককে জানান।",
  ],
  "There are no published results.": ["কোনো প্রকাশিত ফলাফল নেই।", "আগে ফলাফল প্রকাশ করুন।"],
  "There are no teams to rank.": [
    "র‍্যাংক করার মতো কোনো টিম নেই।",
    "আগে টিম তৈরি করুন এবং বিক্রয়ের এন্ট্রি দিন।",
  ],
  "Report not found.": ["রিপোর্ট পাওয়া যায়নি।", REFRESH],
  "Report not found or the link has been revoked.": [
    "রিপোর্টটি পাওয়া যায়নি বা লিংকটি বন্ধ করা হয়েছে।",
    "শিক্ষকের কাছ থেকে নতুন লিংক নিন।",
  ],
  "Open the report from the course's own address.": [
    "রিপোর্টটি ভুল ঠিকানা থেকে খোলা হয়েছে।",
    "কোর্সের নিজস্ব ওয়েবসাইট ঠিকানা থেকে লিংকটি খুলুন।",
  ],
  "The report date range is not valid.": [
    "রিপোর্টের তারিখের সীমা সঠিক নয়।",
    "ফিল্টারে 'From' তারিখ 'To' তারিখের আগে বা সমান দিন।",
  ],

  // Teams
  "Team not found.": ["টিমটি পাওয়া যায়নি।", REFRESH],
  "Select valid members and choose the lead from them.": [
    "টিম লিডার সিলেক্ট করা সদস্যদের মধ্য থেকে নেওয়া হয়নি, অথবা কোনো সদস্য সঠিক নয়।",
    "আগে সদস্যদের টিক দিন, তারপর তাদের মধ্য থেকে একজনকে টিম লিডার বেছে নিন।",
  ],
  "All members of a team must be from the same batch.": [
    "একটি টিমের সব সদস্যকে একই ব্যাচের হতে হবে।",
    "অন্য ব্যাচের সদস্যদের টিক তুলে দিন।",
  ],
  "A student cannot be in more than one team in the same program.": [
    "একজন শিক্ষার্থী একই প্রোগ্রামে একাধিক টিমে থাকতে পারে না।",
    "\"(in another team)\" লেখা শিক্ষার্থীদের আগে তাদের পুরোনো টিম থেকে সরান, তারপর এখানে যুক্ত করুন।",
  ],
  "This team still holds stock, cash or principal. Settle its accounts before deactivating it.": [
    "এই টিমের কাছে এখনো স্টক, ক্যাশ বা মূলধন রয়ে গেছে, তাই টিম বন্ধ করা যাচ্ছে না।",
    "আগে স্টক বিক্রি/ট্রান্সফার করুন, ক্যাশ ও মূলধন ফেরত (Principal repayment) এন্ট্রি দিন, তারপর টিম বন্ধ করুন।",
  ],
  "A team with transactions cannot change batch; create a new team instead.": [
    "যে টিমে লেনদেন আছে তার ব্যাচ পরিবর্তন করা যায় না।",
    "অন্য ব্যাচের জন্য নতুন টিম তৈরি করুন।",
  ],
  "Select an active team.": ["চালু (active) কোনো টিম সিলেক্ট করা হয়নি।", "তালিকা থেকে একটি চালু টিম বেছে নিন।"],
  "Select the receiving team.": [
    "ট্রান্সফারের জন্য গ্রহণকারী টিম সঠিক নয়।",
    "নিজের টিম ছাড়া অন্য একটি চালু টিম বেছে নিন।",
  ],
  "Invalid receiving team.": ["গ্রহণকারী টিম সঠিক নয়।", "নিজের টিম ছাড়া অন্য একটি টিম বেছে নিন।"],
  "Only a transfer can name a receiving team.": [
    "শুধু ট্রান্সফার এন্ট্রিতে গ্রহণকারী টিম দেওয়া যায়।",
    "গ্রহণকারী টিমের ঘর খালি রাখুন বা এন্ট্রির ধরন Transfer করুন।",
  ],
  "Choose a team for this row.": ["এই সারিতে টিম সিলেক্ট করা হয়নি।", "সারির Team কলামে একটি টিম বেছে নিন।"],

  // Sprints and catalog
  "The sprint dates are not valid.": [
    "স্প্রিন্টের তারিখ সঠিক নয়।",
    "শেষের তারিখ শুরুর তারিখের পরে দিন, এবং দুটোই প্রোগ্রামের তারিখের মধ্যে রাখুন।",
  ],
  "This team's sprints overlap.": [
    "এই টিমের দুটি স্প্রিন্টের তারিখ একটার সাথে আরেকটা মিলে যাচ্ছে।",
    "আগের স্প্রিন্ট শেষ হওয়ার পরের দিন থেকে নতুন স্প্রিন্ট শুরু করুন।",
  ],
  "Sprint not found.": ["স্প্রিন্টটি পাওয়া যায়নি।", REFRESH],
  "Category not found.": ["ক্যাটাগরিটি পাওয়া যায়নি।", "তালিকা থেকে একটি ক্যাটাগরি বেছে নিন।"],
  "Select a valid category.": ["ক্যাটাগরি সঠিক নয়।", "তালিকা থেকে একটি ক্যাটাগরি বেছে নিন।"],
  "Select the product category.": ["পণ্যের ক্যাটাগরি সিলেক্ট করা হয়নি।", "একটি ক্যাটাগরি বেছে নিন।"],
  "Catalog item not found.": ["আইটেমটি পাওয়া যায়নি।", REFRESH],
  "Item not found.": ["আইটেমটি পাওয়া যায়নি।", REFRESH],
  "Variant not found.": ["ভ্যারিয়েন্টটি পাওয়া যায়নি।", REFRESH],
  "Enter a name.": ["নাম দেওয়া হয়নি।", "নামের ঘরটি পূরণ করুন।"],
  "Enter the variant name.": ["ভ্যারিয়েন্টের নাম দেওয়া হয়নি।", "যেমন: 500ml, লাল, বড় — এমন একটি নাম লিখুন।"],
  "Create the product first, then add variants to it.": [
    "পণ্য তৈরি না করেই ভ্যারিয়েন্ট যোগ করার চেষ্টা হয়েছে।",
    "আগে পণ্যটি সেভ করুন, তারপর Edit করে ভ্যারিয়েন্ট যোগ করুন।",
  ],
  "A removed variant does not belong to this product.": [
    "যে ভ্যারিয়েন্ট সরানো হচ্ছে সেটি এই পণ্যের নয়।",
    REFRESH,
  ],
  "Choose a different product to move the transactions to.": [
    "লেনদেনগুলো একই পণ্যে সরানো যায় না।",
    "অন্য একটি পণ্য/ভ্যারিয়েন্ট বেছে নিন।",
  ],
  "Choose a different area.": ["একই এলাকায় সরানো যায় না।", "অন্য একটি এলাকা বেছে নিন।"],
  "Choose a different category.": ["একই ক্যাটাগরিতে সরানো যায় না।", "অন্য একটি ক্যাটাগরি বেছে নিন।"],
  "The replacement product must be in the same category.": [
    "বদলি পণ্যটি একই ক্যাটাগরির হতে হবে।",
    "একই ক্যাটাগরির একটি পণ্য বেছে নিন।",
  ],
  "Replacement area not found.": ["বদলি এলাকাটি পাওয়া যায়নি।", "তালিকা থেকে একটি এলাকা বেছে নিন।"],
  "Replacement category not found.": ["বদলি ক্যাটাগরিটি পাওয়া যায়নি।", "তালিকা থেকে একটি ক্যাটাগরি বেছে নিন।"],
  "This area is used by entries. Choose the area to move them to.": [
    "এই এলাকাটি কিছু এন্ট্রিতে ব্যবহার হয়েছে, তাই সরাসরি ডিলিট করা যাচ্ছে না।",
    "ঐ এন্ট্রিগুলো কোন এলাকায় সরানো হবে তা বেছে নিন, তারপর ডিলিট করুন।",
  ],
  "This category has products or entries. Choose the category to move them to.": [
    "এই ক্যাটাগরিতে পণ্য বা এন্ট্রি আছে।",
    "সেগুলো কোন ক্যাটাগরিতে সরানো হবে তা বেছে নিন, তারপর ডিলিট করুন।",
  ],
  "This item has transactions. Choose the product/variant to move them to.": [
    "এই পণ্যে লেনদেন আছে।",
    "লেনদেনগুলো কোন পণ্য/ভ্যারিয়েন্টে সরানো হবে তা বেছে নিন, তারপর ডিলিট করুন।",
  ],
  "Only products from the category assigned for that date can be purchased.": [
    "ঐ তারিখে টিমকে যে ক্যাটাগরি (স্প্রিন্ট) দেওয়া আছে, তার বাইরের পণ্য কেনা যায় না।",
    "Setup → Category rotation-এ ঐ তারিখের স্প্রিন্ট আছে কি না দেখুন, এবং সেই ক্যাটাগরির পণ্য বেছে নিন।",
  ],

  // Entries
  "Enter a valid date.": ["তারিখ সঠিক নয়।", "তারিখটি YYYY-MM-DD আকারে (যেমন 2026-11-15) দিন।"],
  "The date must be within the program period; future dates are not allowed.": [
    "তারিখটি প্রোগ্রামের সময়সীমার বাইরে, অথবা ভবিষ্যতের তারিখ।",
    "প্রোগ্রাম শুরুর পর থেকে আজ পর্যন্ত কোনো তারিখ দিন।",
  ],
  "A voucher upload is required for purchases.": [
    "ক্রয়ের এন্ট্রিতে ভাউচার/রশিদ দেওয়া হয়নি।",
    "ক্রয়ের রশিদের ছবি বা PDF আপলোড করে সিলেক্ট করুন, তারপর সেভ করুন।",
  ],
  "A voucher upload is required for supplier returns.": [
    "মার্চেন্ট/সাপ্লায়ারকে পণ্য ফেরতের এন্ট্রিতে ভাউচার দেওয়া হয়নি।",
    "মার্চেন্টের দেওয়া ফেরত রশিদ/ভাউচারের ছবি বা PDF আপলোড করুন, তারপর সেভ করুন।",
  ],
  "A correction can only change products already in this entry. To add a new product, submit a new entry.": [
    "সংশোধনে নতুন পণ্য যোগ করা যায় না — শুধু এই এন্ট্রিতে আগে থেকে থাকা পণ্যের পরিমাণ/দাম ঠিক করা যায়।",
    "নতুন পণ্যের জন্য আলাদা নতুন এন্ট্রি দিন।",
  ],
  "Select a valid voucher for this team.": [
    "যে ভাউচার সিলেক্ট করা হয়েছে সেটি এই টিমের নয়।",
    "এই টিমের জন্য আপলোড করা ভাউচার বেছে নিন বা নতুন করে আপলোড করুন।",
  ],
  "Enter a reason for the return, damage or refund.": [
    "রিটার্ন, ড্যামেজ বা রিফান্ডের কারণ লেখা হয়নি।",
    "Reason ঘরে অন্তত ৩ অক্ষরের একটি কারণ লিখুন।",
  ],
  "Add at least one product.": ["কোনো পণ্য যোগ করা হয়নি।", "অন্তত একটি পণ্যের লাইন যোগ করুন।"],
  "Add product lines (up to 100).": ["পণ্যের লাইন নেই বা ১০০টির বেশি।", "১ থেকে ১০০টি পণ্যের লাইন দিন।"],
  "Product not found.": [
    "পণ্যটি পাওয়া যায়নি (ডিলিট বা সরানো হয়ে থাকতে পারে)।",
    "পেজ রিফ্রেশ করে তালিকা থেকে পণ্যটি আবার বেছে নিন।",
  ],
  "Quantity must be greater than zero.": ["পরিমাণ শূন্য বা তার কম দেওয়া হয়েছে।", "পরিমাণ ০-এর বেশি দিন।"],
  "Select an area.": ["এলাকা (Area) সিলেক্ট করা হয়নি।", "কোন এলাকায় বিক্রি/কাজ হয়েছে তা বেছে নিন।"],
  "Select a valid area.": ["এলাকা সঠিক নয়।", "তালিকা থেকে একটি এলাকা বেছে নিন।"],
  "Select an expense type.": ["খরচের ধরন সিলেক্ট করা হয়নি।", "তালিকা থেকে খরচের ধরন (যেমন যাতায়াত) বেছে নিন।"],
  "Select the original sale from this team.": [
    "রিফান্ডের জন্য মূল বিক্রয়টি সিলেক্ট করা হয়নি বা সেটি এই টিমের নয়।",
    "যে বিক্রয়ের পণ্য ফেরত এসেছে, সেই বিক্রয়টি তালিকা থেকে বেছে নিন।",
  ],
  "Select a sales session.": ["বিক্রয়ের সেশন সিলেক্ট করা হয়নি।", "সেশন (যেমন সকাল/বিকাল) বেছে নিন।"],
  "Select a valid session.": ["সেশন সঠিক নয়।", "তালিকা থেকে সেশন বেছে নিন।"],
  "Fill in all market insight fields.": [
    "মার্কেট ইনসাইটের সব ঘর পূরণ করা হয়নি।",
    "কাস্টমার সেগমেন্ট, আপত্তি ও সেরা এলাকা — সব ঘর পূরণ করুন।",
  ],
  "Select a valid customer segment.": ["কাস্টমার সেগমেন্ট সঠিক নয়।", "তালিকা থেকে সেগমেন্ট বেছে নিন।"],
  "Select a valid objection.": ["আপত্তির ধরন সঠিক নয়।", "তালিকা থেকে বেছে নিন।"],
  "Enter a reason when cash received differs from the sale amount.": [
    "বিক্রয়ের মোট দাম আর হাতে পাওয়া টাকা মিলছে না, কিন্তু কারণ লেখা হয়নি।",
    "বাকি/ছাড় থাকলে Reason ঘরে কারণ লিখুন (অন্তত ৩ অক্ষর), নইলে পাওয়া টাকা ঠিক করুন।",
  ],
  "Enter a reason for submitting an earlier date.": [
    "আগের তারিখের এন্ট্রি দেওয়া হচ্ছে, কিন্তু কারণ লেখা হয়নি।",
    "Reason ঘরে লিখুন কেন দেরিতে এন্ট্রি দিচ্ছেন। এন্ট্রিটি শিক্ষকের অনুমোদনের পর হিসাবে যোগ হবে।",
  ],
  "Repayment cannot exceed the funding received.": [
    "যত টাকা ফান্ড পাওয়া গেছে, তার চেয়ে বেশি মূলধন ফেরত দেখানো হয়েছে।",
    "ফেরতের পরিমাণ কমান, অথবা আগে ফান্ডের এন্ট্রি ঠিক আছে কি না দেখুন।",
  ],
  "Cannot return more than the remaining quantity of the original sale.": [
    "মূল বিক্রয়ে যত পিস বিক্রি হয়েছিল, তার চেয়ে বেশি ফেরত দেখানো হয়েছে।",
    "ফেরতের পরিমাণ মূল বিক্রয়ের অবশিষ্ট পরিমাণের সমান বা কম দিন।",
  ],
  "Cannot refund more than the remaining amount of the original sale.": [
    "মূল বিক্রয়ের টাকার চেয়ে বেশি রিফান্ড দেখানো হয়েছে।",
    "রিফান্ডের দাম কমিয়ে মূল বিক্রয়ের দামের মধ্যে রাখুন।",
  ],
  "Keep enough stock for transfers that are waiting to be accepted.": [
    "অন্য টিমে পাঠানো (এখনো গ্রহণ হয়নি এমন) ট্রান্সফারের জন্য স্টক রাখা দরকার, কিন্তু এই এন্ট্রিতে স্টক কমে যাচ্ছে।",
    "আগে Requests থেকে ঝুলে থাকা ট্রান্সফার গ্রহণ/বাতিল করুন, অথবা পরিমাণ কমান।",
  ],
  "Not enough team stock after items held by other members or pending transfers.": [
    "টিমের স্টকে এত পণ্য নেই — কিছু পণ্য অন্য সদস্যের কাছে (ফিল্ডে) বা ট্রান্সফারে আটকে আছে।",
    "পরিমাণ কমান, অথবা অন্য সদস্যরা চেক-আউট করার পর আবার চেষ্টা করুন।",
  ],
  "Amount exceeds the allowed limit.": ["টাকার পরিমাণ সীমার চেয়ে অনেক বেশি।", "সঠিক পরিমাণ দিন।"],
  "Invalid amount.": ["টাকার পরিমাণ সঠিক নয়।", "শুধু সংখ্যা দিন (যেমন 250 বা 250.50)।"],
  "Number is out of range.": ["সংখ্যাটি অনেক বড়।", "সঠিক সংখ্যা দিন।"],
  "Invalid record type.": ["এন্ট্রির ধরন সঠিক নয়।", REFRESH],
  "Record not found.": ["এন্ট্রিটি পাওয়া যায়নি।", REFRESH],
  "Active record not found.": [
    "এন্ট্রিটি পাওয়া যায়নি বা এটি আর চালু নেই (বাতিল/সংশোধিত হয়ে থাকতে পারে)।",
    REFRESH,
  ],
  "This request was already used with different data.": [
    "একই অনুরোধ ভিন্ন তথ্যসহ দুবার পাঠানো হয়েছে।",
    "ফর্মটি বন্ধ করে নতুন করে খুলে আবার এন্ট্রি দিন।",
  ],
  "This record has changed. Refresh and try again.": [
    "আপনি দেখার পর এন্ট্রিটি অন্য কেউ পরিবর্তন করেছেন।",
    "পেজ রিফ্রেশ করে সর্বশেষ তথ্য দেখে আবার সংশোধন করুন।",
  ],
  "A correction request for this record is already pending.": [
    "এই এন্ট্রির একটি সংশোধন অনুরোধ আগে থেকেই অপেক্ষায় আছে।",
    "শিক্ষক আগের অনুরোধটি রিভিউ করা পর্যন্ত অপেক্ষা করুন।",
  ],
  "This request has already been reviewed.": [
    "এই অনুরোধটি ইতিমধ্যে রিভিউ করা হয়েছে।",
    "পেজ রিফ্রেশ করুন — সর্বশেষ অবস্থা দেখা যাবে।",
  ],
  "This transfer has already been reviewed.": [
    "এই ট্রান্সফারটি ইতিমধ্যে গ্রহণ/বাতিল করা হয়েছে।",
    "পেজ রিফ্রেশ করুন।",
  ],
  "Upload the transfer voucher or proof.": [
    "ট্রান্সফার গ্রহণের প্রমাণ/ভাউচার দেওয়া হয়নি।",
    "পণ্য বুঝে পাওয়ার রশিদ/ছবি আপলোড করে সিলেক্ট করুন, তারপর Accept করুন।",
  ],
  "The original record has changed; reject this request and submit a new one.": [
    "অনুরোধ পাঠানোর পর মূল এন্ট্রিটি আবার পরিবর্তন হয়েছে, তাই এই পুরোনো অনুরোধ আর প্রয়োগ করা যাবে না।",
    "এই অনুরোধটি Reject করুন এবং শিক্ষার্থীকে সর্বশেষ এন্ট্রি দেখে নতুন অনুরোধ পাঠাতে বলুন।",
  ],
  "Some records have changed since you opened the sheet; refresh it.": [
    "শিট খোলার পর কিছু এন্ট্রি অন্য কেউ পরিবর্তন করেছেন।",
    "শিটটি বন্ধ করে আবার খুলুন, তারপর পরিবর্তনগুলো দিন।",
  ],
  "The same record was sent more than once.": ["একই এন্ট্রি একাধিকবার পাঠানো হয়েছে।", REFRESH],
  "The same entry was sent more than once. Reopen the sheet and try again.": [
    "একই এন্ট্রি একাধিকবার পাঠানো হয়েছে।",
    "শিটটি বন্ধ করে আবার খুলে চেষ্টা করুন।",
  ],
  "This entry was changed by someone else. Reopen the sheet.": [
    "এই এন্ট্রিটি অন্য কেউ পরিবর্তন করেছেন।",
    "শিটটি বন্ধ করে আবার খুলুন।",
  ],
  "There are no changes to save.": ["সেভ করার মতো কোনো পরিবর্তন নেই।", "কিছু ঘর পরিবর্তন করে তারপর সেভ করুন।"],
  "Some values in this row are not valid.": ["এই সারির কিছু ঘরের তথ্য সঠিক নয়।", "লাল চিহ্নিত ঘরগুলো ঠিক করুন।"],
  "Select a valid sheet.": ["শিট সঠিক নয়।", REFRESH],
  "Choose a valid export format.": ["এক্সপোর্টের ফরম্যাট সঠিক নয়।", "Excel বা CSV বেছে নিন।"],

  // Field and GPS
  "Check out of your open session first.": [
    "আপনার একটি ফিল্ড সেশন এখনো খোলা আছে।",
    "আগে সেই সেশন থেকে চেক-আউট করুন, তারপর নতুন চেক-ইন করুন।",
  ],
  "Check out of the session first.": ["ফিল্ড সেশন এখনো খোলা আছে।", "আগে চেক-আউট করুন।"],
  "Your open session was not found.": [
    "আপনার কোনো খোলা ফিল্ড সেশন পাওয়া যায়নি (আগেই চেক-আউট হয়ে থাকতে পারে)।",
    REFRESH,
  ],
  "Open session not found.": ["খোলা ফিল্ড সেশন পাওয়া যায়নি।", REFRESH],
  "Session not found.": ["ফিল্ড সেশন পাওয়া যায়নি।", REFRESH],
  "The session has changed.": ["সেশনটি ইতিমধ্যে পরিবর্তন হয়েছে।", REFRESH],
  "The session has changed; submit a new request.": [
    "অনুরোধ পাঠানোর পর সেশনটি পরিবর্তন হয়েছে।",
    "এই অনুরোধ Reject করে নতুন অনুরোধ পাঠাতে বলুন।",
  ],
  "Select the area you are returning from.": ["কোন এলাকা থেকে ফিরছেন তা সিলেক্ট করা হয়নি।", "এলাকা বেছে নিয়ে চেক-আউট করুন।"],
  "Select your own proof file.": ["প্রমাণের ফাইলটি আপনার আপলোড করা নয়।", "নিজের আপলোড করা ছবি/ফাইল বেছে নিন।"],
  "Take a fresh GPS location; old locations are not accepted.": [
    "GPS লোকেশন পুরোনো (২ মিনিটের বেশি আগের)।",
    "লোকেশন চালু রেখে আবার চেষ্টা করুন — নতুন লোকেশন নেওয়া হবে।",
  ],
  "Invalid product or quantity.": ["পণ্য বা পরিমাণ সঠিক নয়।", "পণ্য বেছে নিন এবং ০-এর বেশি পরিমাণ দিন।"],
  "The check-in/check-out times are not valid.": [
    "চেক-ইন/চেক-আউটের সময় সঠিক নয়।",
    "চেক-আউটের সময় চেক-ইনের পরে এবং বর্তমান সময়ের আগে দিন।",
  ],
  "Configured field duration exceeded; tracking stopped and review required.": [
    "নির্ধারিত ফিল্ড সময়ের চেয়ে বেশি সময় হয়ে গেছে; ট্র্যাকিং বন্ধ হয়েছে।",
    "শিক্ষক এটি রিভিউ করবেন — প্রয়োজনে কারণসহ সংশোধন অনুরোধ পাঠান।",
  ],
  "This device has no GPS.": ["এই ডিভাইসে GPS নেই।", "GPS আছে এমন মোবাইল ব্যবহার করুন।"],
  "Could not get GPS. Turn on location and allow access.": [
    "GPS লোকেশন পাওয়া যায়নি।",
    "মোবাইলের Location চালু করুন এবং ব্রাউজার/অ্যাপকে লোকেশনের অনুমতি দিন।",
  ],

  // Files
  "Upload an image or PDF (max 8 MB).": ["ফাইলটি ছবি/PDF নয় বা ৮ MB-এর বেশি।", "৮ MB-এর ছোট JPG, PNG, WebP বা PDF আপলোড করুন।"],
  "Only JPG, PNG, WebP and PDF files are accepted.": ["এই ধরনের ফাইল গ্রহণযোগ্য নয়।", "JPG, PNG, WebP বা PDF আপলোড করুন।"],
  "The file type does not match its contents.": [
    "ফাইলের নামের এক্সটেনশন আর ভেতরের ধরন মিলছে না।",
    "মূল ছবি/PDF ফাইলটি আবার আপলোড করুন (নাম পরিবর্তন করা ফাইল নয়)।",
  ],
  "File not found.": ["ফাইলটি পাওয়া যায়নি।", "আবার আপলোড করুন।"],
  "Invalid file path.": ["ফাইলের ঠিকানা সঠিক নয়।", "আবার আপলোড করুন।"],

  // Generic
  "Unknown action.": ["অজানা কাজের অনুরোধ।", REFRESH],
  "Send valid JSON data.": ["পাঠানো তথ্য সঠিক আকারে নেই।", REFRESH],
  "This already exists. Refresh and check.": ["এটি আগে থেকেই আছে (ডুপ্লিকেট)।", "পেজ রিফ্রেশ করে তালিকায় দেখে নিন।"],
  "The request is too large.": ["পাঠানো তথ্য অনেক বড়।", "কম সারি/ছোট ফাইল দিয়ে কয়েক ধাপে চেষ্টা করুন।"],
  "The action could not be completed. Please try again.": [
    "সার্ভারে একটি অপ্রত্যাশিত সমস্যা হয়েছে, কাজটি সম্পন্ন হয়নি।",
    `কিছুক্ষণ পর আবার চেষ্টা করুন। ${ASK_TEACHER}`,
  ],
};

const STOCK_FIX_GENERAL =
  "এই স্প্রিন্টে (বা ঐ তারিখের আগে) পর্যাপ্ত ক্রয়ের এন্ট্রি আছে কি না দেখুন — স্প্রিন্ট চলাকালীন যেকোনো দিনের ক্রয় ঐ স্প্রিন্টের সব বিক্রয়ে গণনা হয়; বিক্রয়/ট্রান্সফার/ড্যামেজের পরিমাণ ঠিক করুন, অথবা সঠিক পণ্য/ভ্যারিয়েন্ট বেছে নিন। একই নামের একাধিক পণ্য বা ভ্যারিয়েন্ট থাকলে খেয়াল করুন সঠিকটি বাছাই হয়েছে কি না (Data sheets → Stock-এ টিমভিত্তিক স্টক দেখা যায়)।";
const STOCK_FIX_CORRECTION =
  "এই সংশোধনে ক্রয়ের পণ্য/ভ্যারিয়েন্ট বা পরিমাণ বদলানোয় ঐ পণ্যের স্টক কমে যায়, অথচ পরে ঐ পণ্য বিক্রি/ট্রান্সফার/ড্যামেজ দেখানো আছে। সমাধান: (১) প্রস্তাবিত সংশোধনের প্রতিটি লাইনের পণ্য ও ভ্যারিয়েন্ট মূল এন্ট্রির সাথে মিলিয়ে দেখুন — ভুল ভ্যারিয়েন্ট বাছাই হলে অনুরোধটি Reject করে সঠিক ভ্যারিয়েন্ট দিয়ে নতুন অনুরোধ পাঠাতে বলুন; অথবা (২) সংশোধনটি সঠিক হলে আগে পরের সেই বিক্রয়/ট্রান্সফার এন্ট্রিটি ঠিক করুন, তারপর এই অনুরোধ Approve করুন।";

const STOCK_FIX_LATER =
  "আপনি যে এন্ট্রি বদলাচ্ছেন/বাতিল করছেন, পরের ঐ এন্ট্রিটি তার স্টকের উপর নির্ভর করে। আগে পরের এন্ট্রিটি ঠিক বা বাতিল করুন, অথবা পরিবর্তনে এমন পরিমাণ/তারিখ দিন যাতে স্টক থাকে।";
const STOCK_FIX_LINES =
  "একই পণ্য একাধিক লাইনে দিলে সব লাইনের পরিমাণ যোগ হয় — লাইনগুলো মিলিয়ে দেখুন।";

const RULES: Rule[] = [
  [
    /^Team "(.+?)" — (.+?): not enough stock for transfers waiting to be accepted \(in stock: ([\d.]+), in transfers: ([\d.]+)\)\.$/,
    (m) => {
      const [, team, product, have, need] = m;
      return [
        `“${team}” টিমের “${product}” — ট্রান্সফারে মোট ${Number(need)} টি দেখানো হয়েছে, কিন্তু টিমের স্টকে আছে মাত্র ${Number(have)} টি।`,
        "ট্রান্সফারের লাইনগুলো দেখুন — একই পণ্য একাধিক লাইনে দিলে সব লাইনের পরিমাণ যোগ হয়। পরিমাণ ঠিক না থাকলে অনুরোধটি Reject করে সঠিক পরিমাণ দিয়ে আবার পাঠাতে বলুন, অথবা আগে ঝুলে থাকা অন্য ট্রান্সফার গ্রহণ/বাতিল করুন।",
      ];
    },
  ],
  [
    /^(Approving this correction would break stock: )?(?:Team "(.+?)" — )?(.+?): more than the available stock on (\S+) \(in stock: ([\d.]+)(?:, needed: ([\d.]+)(?: in total across (\d+) lines)?; (later )?entry: (.+?)(?: by (.+?))?)?\)\.$/,
    (m) => {
      const [, correction, team, product, date, have, need, lineCount, later, kind, by] = m;
      const who = team ? `“${team}” টিমের ` : "";
      const kindBn = kind ? KIND_BN[kind] ?? kind : "";
      const entry = kind
        ? later
          ? `পরের একটি ${kindBn} এন্ট্রিতে${by ? ` (এন্ট্রি দিয়েছেন: ${by})` : ""} `
          : `${kindBn} এন্ট্রিতে `
        : "";
      const needText = need
        ? `${lineCount ? `${lineCount}টি লাইনে মিলিয়ে মোট ` : ""}${Number(need)} টি লাগবে, কিন্তু `
        : "";
      const fix = [
        later ? STOCK_FIX_LATER : "",
        lineCount ? STOCK_FIX_LINES : "",
        correction ? STOCK_FIX_CORRECTION : STOCK_FIX_GENERAL,
      ]
        .filter(Boolean)
        .join(" ");
      return [
        `${correction ? "এই সংশোধন অনুমোদন করা যাচ্ছে না — " : ""}${later ? "এই পরিবর্তনের ফলে পরের একটি এন্ট্রিতে স্টক কম পড়ছে — " : ""}স্টকে পর্যাপ্ত পণ্য নেই: ${who}“${product}” — ${date} তারিখের ${entry}${needText}স্প্রিন্টের ক্রয়সহ স্টকে আছে মাত্র ${Number(have)} টি।`,
        fix,
      ];
    },
  ],
  [
    /^(?:Team "(.+?)" — )?(.+?): this sale has a customer refund on (\S+) — correct or void the refund first\.$/,
    (m) => {
      const [, team, product, date] = m;
      return [
        `${team ? `“${team}” টিমের ` : ""}“${product}” — এই বিক্রির বিপরীতে ${date} তারিখে কাস্টমার রিফান্ড আছে — আগে রিফান্ডটি ঠিক/বাতিল করুন।`,
        "বিক্রিটি বাতিল, সংশোধন বা তারিখ পরিবর্তন করার আগে ঐ কাস্টমার রিফান্ড এন্ট্রিটি ঠিক বা বাতিল করুন (রিফান্ডের তারিখ বিক্রির তারিখের পরে হতে হবে এবং পণ্যটি বিক্রিতে থাকতে হবে)।",
      ];
    },
  ],
  [
    /^(?:Team "(.+?)" — )?(.+?): cannot return more than the remaining quantity of the sale \(sold: ([\d.]+), already returned: ([\d.]+), refund on (\S+): ([\d.]+)\)\.$/,
    (m) => {
      const [, team, product, sold, returned, date, q] = m;
      return [
        `${team ? `“${team}” টিমের ` : ""}“${product}” — মূল বিক্রিতে ${Number(sold)} টি বিক্রি হয়েছিল, আগেই ${Number(returned)} টি ফেরত এসেছে; ${date} তারিখের রিফান্ডে ${Number(q)} টি ফেরত দেখানো হয়েছে, যা অবশিষ্টের চেয়ে বেশি।`,
        "রিফান্ডের পরিমাণ কমান। বিক্রির এন্ট্রি বদলানোর (পরিমাণ কমানো) কারণে এটি হলে আগে রিফান্ডটি ঠিক/বাতিল করুন, তারপর বিক্রি সংশোধন করুন।",
      ];
    },
  ],
  [
    /^Field sessions still open: (.+?)\. End the open field sessions before (deactivating the team|removing these members)\.$/,
    (m) => [
      `${m[1]} — এদের ফিল্ড সেশন (চেক-ইন) এখনো খোলা আছে, তাই ${m[2].startsWith("deactivating") ? "টিমটি বন্ধ করা" : "এদের টিম থেকে সরানো"} যাচ্ছে না।`,
      "আগে তাদের Field & GPS থেকে চেক-আউট করতে বলুন (অথবা স্টাফ হিসেবে Field & GPS → খোলা সেশন বন্ধ করুন), তারপর আবার সেভ করুন। শুধু টিম লিডার বা নাম পরিবর্তন করতে কোনো সেশন বন্ধ করতে হয় না।",
    ],
  ],
  [
    /^End the open field sessions before changing members\.$/,
    () => [
      "টিমের কারো ফিল্ড সেশন (চেক-ইন) খোলা আছে।",
      "Field & GPS থেকে খোলা সেশনগুলো চেক-আউট করুন, তারপর আবার সেভ করুন।",
    ],
  ],
  [
    /^(.+?): quantity must be greater than zero\.$/,
    (m) => [`“${m[1]}”-এর পরিমাণ শূন্য বা তার কম দেওয়া হয়েছে।`, "পরিমাণ ০-এর বেশি দিন।"],
  ],
  [
    /^(.+?): select a variant\.$/,
    (m) => [
      `“${m[1]}” পণ্যটির একাধিক ভ্যারিয়েন্ট আছে, কিন্তু কোনো ভ্যারিয়েন্ট বাছাই করা হয়নি।`,
      "পণ্যের তালিকা থেকে নির্দিষ্ট ভ্যারিয়েন্ট (যেমন “Water Bottle · 500ml”) বেছে নিন।",
    ],
  ],
  [
    /^Enter a valid number \(up to (\d) decimal places\)\.$/,
    (m) => [
      "সংখ্যার ঘরে সঠিক সংখ্যা দেওয়া হয়নি।",
      `শুধু সংখ্যা দিন, দশমিকের পর সর্বোচ্চ ${m[1]} ঘর (যেমন 250 বা 12.5)। কমা, টাকা চিহ্ন বা অক্ষর দেবেন না।`,
    ],
  ],
  [
    /^Enter at least (\d) finding\(s\) and action\(s\) for the FGD\.$/,
    (m) => [
      `FGD-তে অন্তত ${m[1]}টি ফাইন্ডিং ও ${m[1]}টি অ্যাকশন লেখা হয়নি।`,
      "প্রতিটি ফাইন্ডিং ও অ্যাকশন অন্তত ৩ অক্ষরে লিখুন।",
    ],
  ],
  [
    /^(\d+) item\(s\) still need action/,
    (m) => [
      `এখনো ${m[1]}টি বিষয় অমীমাংসিত (অনুমোদনের অপেক্ষা, সংশোধন অনুরোধ বা খোলা ফিল্ড সেশন)।`,
      "Requests ও Field & GPS থেকে সেগুলো মীমাংসা করুন, অথবা কারণ লিখে প্রোগ্রাম বন্ধ করুন।",
    ],
  ],
  [
    /^These dates would leave (\d+) entr(?:y|ies) and (\d+) sprint\(s\) outside the program/,
    (m) => [
      `নতুন তারিখ দিলে ${m[1]}টি এন্ট্রি ও ${m[2]}টি স্প্রিন্ট প্রোগ্রামের সময়ের বাইরে পড়ে যাবে।`,
      "এমন তারিখ দিন যার মধ্যে সব এন্ট্রি ও স্প্রিন্ট পড়ে, অথবা আগে সেগুলোর তারিখ ঠিক করুন।",
    ],
  ],
  [
    /^A program cannot move directly from "(.+?)" to "(.+?)"\.$/,
    (m) => [
      `প্রোগ্রামকে সরাসরি “${STATUS_BN[m[1]] ?? m[1]}” থেকে “${STATUS_BN[m[2]] ?? m[2]}” অবস্থায় নেওয়া যায় না।`,
      "মাঝের ধাপ দিয়ে যান (যেমন Active → Closing → Closed)।",
    ],
  ],
  [
    /^Enter a reason to move from "(.+?)" to "(.+?)"\.$/,
    (m) => [
      `“${STATUS_BN[m[1]] ?? m[1]}” থেকে “${STATUS_BN[m[2]] ?? m[2]}” করতে কারণ লাগবে।`,
      "Reason ঘরে অন্তত ৩ অক্ষরের কারণ লিখুন।",
    ],
  ],
  [
    /^This program is "(.+?)", so nothing can be changed/,
    (m) => [
      `প্রোগ্রামটি এখন “${STATUS_BN[m[1]] ?? m[1]}” অবস্থায় আছে, তাই কিছু পরিবর্তন করা যাবে না।`,
      "প্রয়োজনে স্টাফ Setup → Edit dates & rules থেকে কারণ লিখে প্রোগ্রামটি আবার খুলতে পারেন।",
    ],
  ],
  [
    /^A product named "(.+?)" already exists in this category\.$/,
    (m) => [`“${m[1]}” নামে একটি পণ্য এই ক্যাটাগরিতে আগে থেকেই আছে।`, "অন্য নাম দিন, অথবা আগের পণ্যে ভ্যারিয়েন্ট যোগ করুন।"],
  ],
  [
    /^Variant "(.+?)" (?:is listed twice|already exists for this product)\.$/,
    (m) => [`“${m[1]}” ভ্যারিয়েন্টটি একাধিকবার দেওয়া হয়েছে।`, "একই নামের ভ্যারিয়েন্ট একবারই রাখুন।"],
  ],
  [/^"(.+?)" already exists\.$/, (m) => [`“${m[1]}” আগে থেকেই আছে।`, "অন্য নাম দিন।"]],
  // Data-sheet checks done in the browser before saving.
  [
    /^(\d+) row\(s\) need attention\. Nothing was saved\.$/,
    (m) => [`${m[1]}টি সারিতে ভুল আছে, তাই কিছুই সেভ হয়নি।`, "লাল চিহ্নিত সারিগুলো ঠিক করে আবার সেভ করুন।"],
  ],
  [/^(.+?) is required\.$/, (m) => [`“${m[1]}” ঘরটি খালি।`, `“${m[1]}” ঘরটি পূরণ করুন।`]],
  [
    /^(.+?) must be a date \(YYYY-MM-DD\)\.$/,
    (m) => [`“${m[1]}” সঠিক তারিখ নয়।`, "তারিখ YYYY-MM-DD আকারে দিন (যেমন 2026-11-15)।"],
  ],
  [/^(.+?) is too long\.$/, (m) => [`“${m[1]}” ঘরে লেখা অনেক বড়।`, "লেখা ছোট করুন।"]],
  [/^(.+?) must be a number\.$/, (m) => [`“${m[1]}” ঘরে সংখ্যা দেওয়া হয়নি।`, "শুধু সংখ্যা দিন (কমা/অক্ষর ছাড়া)।"]],
  [/^Quantity must be more than 0\.$/, () => ["পরিমাণ ০ বা তার কম।", "পরিমাণ ০-এর বেশি দিন।"]],
  [
    /^Write a short reason for these changes/,
    () => ["পরিবর্তনের কারণ লেখা হয়নি।", "নিচের Reason ঘরে অন্তত ৩ অক্ষরের কারণ লিখুন।"],
  ],
  [
    /^(.+?) must be (a whole number )?between ([\d.]+) and ([\d.]+)\.$/,
    (m) => [
      `“${m[1]}” ঘরের সংখ্যা সীমার বাইরে।`,
      `${m[3]} থেকে ${m[4]}-এর মধ্যে ${m[2] ? "পূর্ণ " : ""}সংখ্যা দিন।`,
    ],
  ],
  [
    /^Variant "(.+?)" is already in the list\.$/,
    (m) => [`“${m[1]}” ভ্যারিয়েন্টটি তালিকায় আগে থেকেই আছে।`, "অন্য নাম দিন।"],
  ],
  [
    /^"(.+?)" has (\d+) entries\. Choose where to move them before saving\.$/,
    (m) => [
      `“${m[1]}”-এ ${m[2]}টি এন্ট্রি আছে, তাই সরাসরি মুছে ফেলা যাবে না।`,
      "সেভ করার আগে এন্ট্রিগুলো কোন ভ্যারিয়েন্টে সরানো হবে তা বেছে নিন।",
    ],
  ],
  [
    /^(Failed to fetch|NetworkError.*|Load failed)$/,
    () => ["সার্ভারের সাথে সংযোগ করা যায়নি।", "ইন্টারনেট সংযোগ দেখে পেজটি রিফ্রেশ করুন।"],
  ],
  [
    /^Unexpected token|is not valid JSON/,
    () => ["সার্ভার থেকে অপ্রত্যাশিত উত্তর এসেছে।", `কিছুক্ষণ পর পেজটি রিফ্রেশ করুন। ${ASK_TEACHER}`],
  ],
  [/^Choose where to move the existing data first\.$/, () => ["আগের তথ্য কোথায় সরানো হবে তা বাছাই করা হয়নি।", "ডিলিটের আগে বদলি পণ্য/ক্যাটাগরি/এলাকা বেছে নিন।"]],
  [
    /^A deleted entry \((.+?)\) was changed by someone else meanwhile/,
    () => ["যে এন্ট্রি ডিলিট করছেন সেটি এর মধ্যে অন্য কেউ পরিবর্তন করেছেন।", "শিটটি বন্ধ করে আবার খুলুন।"],
  ],
  [
    /^These changes would break the stock or cash rules: ([\s\S]+?) Check quantities and dates of the rows you changed\.$/,
    (m) => {
      const inner = translate(m[1]);
      return [
        `এই পরিবর্তনগুলো সেভ করলে স্টক বা ক্যাশের হিসাব ভেঙে যায়: ${inner.problem}`,
        `যে সারিগুলো পরিবর্তন করেছেন তার পরিমাণ ও তারিখ দেখুন। ${inner.fix}`,
      ];
    },
  ],
];

/** Zod field names → Bangla, for "field: message" validation errors. */
const FIELD_BN: Record<string, string> = {
  name: "নাম",
  reason: "কারণ (Reason)",
  date: "তারিখ",
  startDate: "শুরুর তারিখ",
  endDate: "শেষের তারিখ",
  studentIds: "সদস্য",
  leadId: "টিম লিডার",
  teamId: "টিম",
  categoryId: "ক্যাটাগরি",
  amount: "টাকার পরিমাণ",
  quantity: "পরিমাণ",
  unitPrice: "একক দাম",
  productId: "পণ্য",
  batchNames: "ব্যাচ",
  note: "নোট",
  description: "বিবরণ",
  confirmName: "প্রোগ্রামের নাম",
};

function zodLine(line: string): [string, string] | null {
  const m = /^([\w.]*): (.+)$/.exec(line.trim());
  if (!m) return null;
  const key = m[1].split(".").filter((x) => !/^\d+$/.test(x)).pop() || "";
  const field = FIELD_BN[key] || key || "একটি ঘর";
  const msg = m[2];
  if (/at least 1|>=1|Required|expected string, received undefined|Invalid input/i.test(msg))
    return [`“${field}” ঘরটি খালি রাখা হয়েছে বা সঠিক নয়।`, `“${field}” ঘরটি পূরণ করুন।`];
  if (/at least (\d+)/i.test(msg))
    return [
      `“${field}” ঘরে খুব কম লেখা হয়েছে।`,
      `অন্তত ${/at least (\d+)/i.exec(msg)![1]} অক্ষর/টি দিন।`,
    ];
  if (/at most (\d+)/i.test(msg))
    return [`“${field}” ঘরে সীমার চেয়ে বেশি লেখা হয়েছে।`, `সর্বোচ্চ ${/at most (\d+)/i.exec(msg)![1]} অক্ষর/টি দিন।`];
  if (/valid date/i.test(msg))
    return [`“${field}” সঠিক তারিখ নয়।`, "তারিখটি YYYY-MM-DD আকারে দিন।"];
  return [`“${field}” ঘরের তথ্য সঠিক নয় (${msg})।`, "ঘরটি ঠিক করে আবার সেভ করুন।"];
}

const BANGLA = /[ঀ-৿]/;

export function translate(message: string): { problem: string; fix: string } {
  const text = (message || "").trim();
  const exact = EXACT[text];
  if (exact) return { problem: exact[0], fix: exact[1] };
  for (const [re, fn] of RULES) {
    const m = re.exec(text);
    if (m) {
      const [problem, fix] = fn(m);
      return { problem, fix };
    }
  }
  // Zod-style "path: message; path: message"
  const parts = text.split("; ").map(zodLine);
  if (parts.length && parts.every(Boolean)) {
    const ok = parts as [string, string][];
    return {
      problem: ok.map((p) => p[0]).join(" "),
      fix: [...new Set(ok.map((p) => p[1]))].join(" "),
    };
  }
  return {
    problem: `কাজটি সম্পন্ন হয়নি। (${text})`,
    fix: `তথ্যগুলো আবার দেখে নিন এবং ${REFRESH} ${ASK_TEACHER}`,
  };
}

/**
 * Bangla display text: "<what happened>\nকী করবেন: <what to do>".
 * A "[[rowKey]] " prefix used by the data sheet is kept in front.
 */
export function toBangla(message: string): string {
  const raw = String(message || "");
  if (!raw || BANGLA.test(raw)) return raw;
  const prefix = /^\[\[(.+?)\]\]\s*/.exec(raw);
  const body = prefix ? raw.slice(prefix[0].length) : raw;
  // The sheet wraps a row's field error as "\"field\": message".
  const field = /^"([^"]+)": ([\s\S]+)$/.exec(body);
  const { problem, fix } = translate(field ? field[2] : body);
  const head = field ? `“${FIELD_BN[field[1]] || field[1]}” — ` : "";
  return `${prefix ? prefix[0] : ""}${head}${problem}\nকী করবেন: ${fix}`;
}
