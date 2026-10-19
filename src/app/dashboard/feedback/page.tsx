"use client";

import Link from "next/link";
import FeedbackBoard from "@/components/feedback/FeedbackBoard";

export default function FeedbackPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">Course Feedback</h1>
                    <p className="text-[#6b7280] mt-1">
                        Anonymous feedback from students — only batch and category are shown, never who wrote it.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                <span className="px-4 py-1.5 rounded-md text-sm font-semibold bg-white text-gray-900 shadow-sm">General</span>
                <Link href="/dashboard/feedback/forms" className="px-4 py-1.5 rounded-md text-sm font-semibold text-gray-500 hover:text-gray-700">
                    Forms
                </Link>
            </div>

            <FeedbackBoard />
        </div>
    );
}
