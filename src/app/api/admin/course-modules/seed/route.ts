export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { modulesData } from "@/data/modules";

const TEACHER_INFO: Record<string, { name: string; email: string }> = {
    "art-of-sales-marketing": { name: "Md Sakhawat Hossain", email: "" },
    "business-management-tools": { name: "Abul Hayat", email: "abul.hayat@skill.assunnahfoundation.org" },
};

const CARD_BULLETS: Record<string, string[]> = {
    "sales-mastery": [
        "Face-to-Face এবং অনলাইনে কনফিডেন্টলি প্রোডাক্ট সেল করার সাইকোলজি আয়ত্ত করা।",
        "কাস্টমারের যেকোনো অবজেকশন স্মার্টলি এবং পেশাদারিত্বের সাথে হ্যান্ডেল করা।",
        "কোনো বিরক্তিকর অ্যাপ্রোচ ছাড়াই B2B এবং B2C ডিল ক্র্যাক করার স্ট্র্যাটেজি।",
        "সেলসকে একটি 'আমানাহ' হিসেবে নিয়ে কাস্টমারের সাথে লং-টার্ম ট্রাস্ট বিল্ড করা।",
    ],
    "career-planning-branding": [
        "এমন একটি Winning CV তৈরি করা যা সহজেই ইন্টারভিউ কল নিয়ে আসবে।",
        "নিজেকে একটি পাওয়ারফুল Personal Brand হিসেবে এস্টাবলিশ করা।",
        "ইন্টারভিউ বোর্ডে 100% কনফিডেন্সের সাথে নিজেকে প্রেজেন্ট করার সিক্রেট হ্যাকস।",
        "নিজের ক্যারিয়ার বা অন্ট্রাপ্রেনিউরিয়াল জার্নির পুরো কন্ট্রোল নিজের হাতে নেওয়া।",
    ],
    "customer-service-excellence": [
        "শূন্য থেকে শুরু করে একজন সফল উদ্যোক্তার মানসিকতা, goal setting এবং execution framework আয়ত্ত করা।",
        "Market intelligence ও costing দিয়ে সঠিক pricing, packaging এবং positioning নির্ধারণ করা।",
        "Customer acquisition system ও lead generation দিয়ে ব্যবসায় নতুন কাস্টমার আনার সিস্টেম তৈরি করা।",
        "রাগান্বিত কাস্টমারকেও loyal ফ্যানে পরিণত করার psychology, complaint management ও closing techniques আয়ত্ত করা।",
    ],
    "ai-for-digital-marketers": [
        "লেটেস্ট AI Tools ব্যবহার করে কাজের স্পিড এবং প্রোডাক্টিভিটি 10x বাড়িয়ে ফেলা।",
        "Canva মাস্টার করে আইক্যাচি ব্র্যান্ডিং এবং সোশ্যাল মিডিয়া অ্যাড ডিজাইন করা।",
        "বোরিং মার্কেটিং ওয়ার্কফ্লো অটোমেট করে স্ট্র্যাটেজি এবং ব্রেইনস্টর্মিংয়ে ফোকাস করা।",
        "কোনো ফেক হাইপ বা ধোঁকা ছাড়াই রেসপন্সিবিলিটির সাথে টেকনোলজি ইউজ করা।",
    ],
    "digital-marketing": [
        "ম্যাক্সিমাম ROI-এর জন্য Meta Ads (Facebook & Instagram) এর নাড়িভুঁড়ি আয়ত্ত করা।",
        "বিজনেস গ্রোথের জন্য স্ক্র্যাচ থেকে পাওয়ারফুল সোশ্যাল মিডিয়া স্ট্র্যাটেজি দাঁড় করানো।",
        "কমিউনিটি বিল্ড-আপ এবং রেফারেলের মাধ্যমে জেনুইন অর্গানিক গ্রোথ আনা।",
        "এথিক্যাল প্রমোশন এবং প্রিসাইজ অডিয়েন্স টার্গেটিংয়ের মাধ্যমে রিয়েল সঞ্চয় জেনারেট করা।",
    ],
    "business-management-tools": [
        "ডেটা ট্র্যাকিং, সেলস রিপোর্ট এবং অ্যানালিটিক্সের জন্য MS Excel-এ প্রো হয়ে ওঠা।",
        "MS Word ব্যবহার করে ফ্ললেস কর্পোরেট ডকুমেন্টেশন এবং প্রপোজাল রেডি করা।",
        "ইনভেস্টর বা ক্লায়েন্টকে ইমপ্রেস করতে MS PowerPoint-এ কিলার পিচ ডেক বানানো।",
        "কর্পোরেট ওয়ার্কফ্লো এবং ডেইলি টাস্কগুলো এফিশিয়েন্টলি এবং দ্রুত ম্যানেজ করা।",
    ],
    "landing-page-content-marketing": [
        "High-Converting Landing Page ডিজাইন করা যা ভিজিটরকে পেইং কাস্টমারে রূপান্তর করবে।",
        "100% সত্যতা বজায় রেখে ম্যাগনেটিক Copywriting করা যা ইজিলি সেলস আনাবে।",
        "অডিয়েন্সকে রিয়েল ভ্যালু প্রোভাইড করে এমন কিলার কন্টেন্ট স্ট্র্যাটেজি ডেভেলপ করা।",
        "A/B টেস্টিং এবং পারফরম্যান্স ট্র্যাকিংয়ের মাধ্যমে মার্কেটিং ক্যাম্পেইন স্কেল করা।",
    ],
    "business-english": [
        "পাবলিক স্পিকিংয়ের ভয় কাটিয়ে সবার সামনে কনফিডেন্টলি কথা বলা।",
        "ক্লায়েন্ট মিটিং বা জব ইন্টারভিউতে প্রফেশনাল ইংলিশে স্মার্টলি কমিউনিকেট করা।",
        "কর্পোরেট লেভেলের প্রফেশনাল ইমেইল লেখা যা দ্রুত রিপ্লাই নিয়ে আসবে।",
        "সেলস, মার্কেটিং এবং কর্পোরেট দুনিয়ার হাই-ভ্যালু ভোকাবুলারি আয়ত্ত করা।",
    ],
    "dawah-business-ethics": [
        "মার্কেটিংকে শুধুমাত্র প্রমোশন নয়, বরং সত্য ও 'দাওয়াহ' হিসেবে প্রেজেন্ট করা।",
        "বিজনেসের প্রতিদিনের ডিসিশনে ইখলাস (Sincerity) এবং শতভাগ সততা অ্যাপ্লাই করা।",
        "কর্পোরেট দুনিয়ার ফেক শর্টকাট এবং হারাম প্র্যাকটিসগুলো থেকে 100% দূরে থাকা।",
        "প্রফেশনাল সাকসেস এবং ইসলামিক ক্যারেক্টারের মধ্যে একটি পারফেক্ট ব্যালেন্স তৈরি করা।",
    ],
    "art-of-sales-marketing": [
        "রিয়েল কনভার্সেশনের মাধ্যমে সেলস করার আর্ট আয়ত্ত করা — প্রোডাক্ট পিচ ছাড়াই কাস্টমারকে জয় করা।",
        "অ্যাক্টিভ লিসেনিং এবং সঠিক প্রশ্নের মাধ্যমে কাস্টমারের গভীর প্রয়োজন চিহ্নিত করা।",
        "রাপোর্ট বিল্ডিং, অবজেকশন হ্যান্ডলিং এবং স্মার্টলি ডিল ক্লোজ করার প্রফেশনাল টেকনিক।",
        "Key Account Management ও বডি ল্যাঙ্গুয়েজ মাস্টার করে B2B রিলেশনশিপ লং-টার্ম রাখা।",
    ],
    "code-free-commerce": [
        "কোনো কোডিং জ্ঞান ছাড়াই AI দিয়ে প্রফেশনাল E-Commerce ওয়েবসাইট তৈরি এবং পাবলিশ করা।",
        "Lovable ও Google AI Studio ব্যবহার করে কার্ট, চেকআউট ও ইনভেন্টরিসহ পূর্ণাঙ্গ অনলাইন শপ বিল্ড করা।",
        "Canva AI দিয়ে ব্র্যান্ড ভিজ্যুয়াল তৈরি এবং UI পলিশ করে ক্লায়েন্ট-রেডি ওয়েবসাইট ডেলিভার করা।",
        "Fiverr ও Upwork-এ Freelancing শুরু করা এবং বাংলাদেশের লোকাল মার্কেটে ক্লায়েন্ট খোঁজার স্ট্র্যাটেজি শেখা।",
    ],
    "dawah": [
        "ফিকহ, আকিদা ও ইসলামী জীবনব্যবস্থার মৌলিক বিষয়সমূহ গভীরভাবে আয়ত্ত করা (General track)।",
        "দাওয়াহর তত্ত্ব, পদ্ধতি ও আধুনিক যুগের বিশিষ্ট দায়ীদের কর্মপন্থা থেকে শিক্ষা নেওয়া (Alim track)।",
        "খ্রিষ্টবাদ, হিন্দুইজম, জুদাইজমসহ বিশ্বের প্রধান ধর্মসমূহের তুলনামূলক পরিচিতি অর্জন করা।",
        "Secularism, Atheism, LGBTQ+, Feminism-সহ সমকালীন ১৫টি মতবাদ ও বুদ্ধিবৃত্তিক চ্যালেঞ্জ মোকাবেলার যোগ্যতা তৈরি করা।",
    ],
};

const SLUG_ORDER = [
    "sales-mastery",
    "career-planning-branding",
    "customer-service-excellence",
    "ai-for-digital-marketers",
    "digital-marketing",
    "business-management-tools",
    "landing-page-content-marketing",
    "business-english",
    "dawah-business-ethics",
    "art-of-sales-marketing",
    "code-free-commerce",
    "dawah",
];

export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const results = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const out: string[] = [];

        for (let i = 0; i < SLUG_ORDER.length; i++) {
            const slug = SLUG_ORDER[i];
            const data = modulesData[slug];
            if (!data) continue;

            // Matched by seedKey — not slug — so a module the admin has since
            // renamed in this course is never re-imported as a duplicate.
            const existing = await tx.courseModule.findFirst({ where: { courseId, seedKey: slug } });
            if (existing) {
                out.push(`${slug}: skipped (already seeded)`);
                continue;
            }

            const bullets = CARD_BULLETS[slug] ?? [];
            const teacher = TEACHER_INFO[slug] ?? { name: "", email: "" };

            await tx.courseModule.create({
                data: {
                    courseId,
                    slug,
                    title: data.title,
                    description: data.description,
                    bullets,
                    curriculum: data.modules as unknown as Prisma.InputJsonValue,
                    isPublished: true,
                    order: i,
                    teacherName: teacher.name,
                    teacherEmail: teacher.email,
                    seedKey: slug,
                },
            });

            out.push(`${slug}: created`);
        }

        return out;
    });

    return NextResponse.json({ results });
}
