"use client";

import { useState } from "react";
import * as feedbackService from "@/services/feedbackService";
import type { FeedbackCategory } from "@/services/feedbackService";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
    { value: "CourseContent", label: "Course Content" },
    { value: "Teacher", label: "Teacher" },
    { value: "Facilities", label: "Facilities" },
    { value: "Administration", label: "Administration" },
    { value: "Other", label: "Other" },
];

export default function StudentFeedbackPage() {
    const [category, setCategory] = useState<FeedbackCategory>("CourseContent");
    const [rating, setRating] = useState(5);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            setError("অনুগ্রহ করে আপনার মতামত লিখুন।");
            return;
        }
        setError("");
        setSubmitting(true);
        try {
            await feedbackService.submitFeedback(category, message.trim(), rating);
            setSubmitted(true);
            setMessage("");
            setRating(5);
            setCategory("CourseContent");
        } catch (err) {
            setError(err instanceof Error ? err.message : "ফিডব্যাক পাঠাতে ব্যর্থ হয়েছে।");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ফিডব্যাক দিন</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        আপনার মতামত সম্পূর্ণ গোপন থাকবে — শুধুমাত্র আপনার ব্যাচ দেখা যাবে, নাম বা রোল কোনো টিচার বা এডমিন দেখতে পারবে না।
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                {submitted ? (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">ধন্যবাদ!</h3>
                        <p className="text-gray-500 text-sm mt-1">আপনার ফিডব্যাক গ্রহণ করা হয়েছে।</p>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="mt-6 px-5 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors"
                        >
                            আরেকটি ফিডব্যাক দিন
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">বিষয়</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setCategory(opt.value)}
                                        className={`px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                                            category === opt.value
                                                ? "bg-[#059669] text-white border-[#059669]"
                                                : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#059669]"
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">রেটিং</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        aria-label={`${star} star`}
                                        className="p-1"
                                    >
                                        <svg
                                            className={`w-8 h-8 ${star <= rating ? "text-yellow-400" : "text-gray-200"}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">আপনার মতামত</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                placeholder="কোর্স, ক্লাস, টিচার বা সুবিধা নিয়ে আপনার মতামত লিখুন..."
                                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#059669] bg-gray-50 text-sm"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3 bg-[#059669] text-white font-bold rounded-xl hover:bg-[#047857] transition-colors shadow-sm disabled:opacity-60"
                        >
                            {submitting ? "পাঠানো হচ্ছে..." : "ফিডব্যাক জমা দিন"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
