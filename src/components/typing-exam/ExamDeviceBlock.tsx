"use client";

import Link from "next/link";
import { ArrowLeft, Keyboard, Laptop } from "lucide-react";
import { GLASS_PANEL } from "@/components/typing-exam/ui";

/** Shown inline on the exam list: exams are visible on a phone, but cannot be started. */
export function ExamDeviceNotice() {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <Laptop className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" strokeWidth={2} />
            <p className="text-sm leading-relaxed">
                <strong className="font-semibold">টাইপিং পরীক্ষা মোবাইলে দেওয়া যায় না।</strong>{" "}
                পরীক্ষা দিতে কিবোর্ডসহ কম্পিউটার বা ল্যাপটপ থেকে লগইন করুন। এখানে শুধু তালিকা ও আগের ফলাফল দেখা যাবে।
            </p>
        </div>
    );
}

/**
 * Replaces the exam itself on a phone or tablet. A typing exam measures speed
 * on a physical keyboard; a touch keyboard would not give a comparable score.
 */
export default function ExamDeviceBlock() {
    return (
        <div className="max-w-md mx-auto py-6 sm:py-10">
            <div className={`${GLASS_PANEL} rounded-2xl px-5 py-8 sm:p-10 text-center`}>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Keyboard className="h-8 w-8" strokeWidth={1.75} />
                </div>
                <h1 className="no-gradient text-xl font-bold text-slate-800">মোবাইলে এই পরীক্ষা দেওয়া যাবে না</h1>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                    টাইপিং পরীক্ষায় কিবোর্ডে টাইপ করার গতি ও নির্ভুলতা মাপা হয়। তাই পরীক্ষাটি দিতে কিবোর্ডসহ কম্পিউটার বা
                    ল্যাপটপ থেকে লগইন করুন।
                </p>
                <Link
                    href="/student-dashboard/typing-exam"
                    className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-1.5 py-3 px-5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md shadow-brand-600/20"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
                    তালিকায় ফিরে যান
                </Link>
            </div>
        </div>
    );
}
