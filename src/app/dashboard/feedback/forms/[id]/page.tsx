"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import FeedbackBoard from "@/components/feedback/FeedbackBoard";
import * as feedbackService from "@/services/feedbackService";

export default function FeedbackFormReportPage() {
    const { id } = useParams<{ id: string }>();
    const [form, setForm] = useState<feedbackService.FeedbackForm | null>(null);

    useEffect(() => {
        feedbackService.getFeedbackForms().then((list) => setForm(list.find((f) => f.id === id) ?? null));
    }, [id]);

    return (
        <div className="space-y-6">
            <Link href="/dashboard/feedback/forms" className="text-sm text-[#6b7280] hover:text-[#1f2937]">
                ← All forms
            </Link>
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">{form?.title ?? "Feedback form"}</h1>
                    <p className="text-[#6b7280] mt-1">
                        {form?.description || "Only the answers submitted to this form are shown here."}
                    </p>
                </div>
            </div>

            <FeedbackBoard formId={id} exportName={form?.title ?? "Feedback_form"} />
        </div>
    );
}
