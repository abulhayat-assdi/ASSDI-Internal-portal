"use client";

import { useState } from "react";
import * as feedbackService from "@/services/feedbackService";

const BATCH_OPTIONS = [
    "Batch_01",
    "Batch_02",
    "Batch_03",
    "Batch_04",
    "Batch_05",
    "Batch_06",
    "Batch_07",
    "Batch_08",
    "Batch_09",
    "Batch_10",
    "Batch_11",
    "Batch_12",
    "Batch_13",
    "Batch_14",
    "Batch_15",
    "Batch_16",
    "Batch_17",
    "Batch_18",
    "Batch_19",
    "Batch_20",
];

export default function StudentFeedbackPage() {
    const [studentName, setStudentName] = useState("");
    const [batch, setBatch] = useState("");
    const [role, setRole] = useState("");
    const [company, setCompany] = useState("");
    const [message, setMessage] = useState("");
    const [rating, setRating] = useState(5);

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!studentName.trim()) {
            setError("Please enter your name.");
            return;
        }
        if (!message.trim()) {
            setError("Please write your review.");
            return;
        }

        setSubmitting(true);
        try {
            await feedbackService.submitFeedback(
                studentName.trim(), 
                batch, 
                role.trim(), 
                company.trim(), 
                message.trim(), 
                rating
            );
            setSubmitted(true);
        } catch {
            setError("Failed to submit review. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <main className="min-h-screen bg-slate-50 flex flex-col">
                {/* Hero Section */}
                <div className="pt-10 pb-8 w-full max-w-3xl mx-auto px-6 text-center">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#059669] to-[#10b981] rounded-2xl shadow-lg mb-6">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-[#111827] mb-3 tracking-tight">
                        Student Review
                    </h1>
                    <p className="text-base md:text-lg text-[#4b5563] leading-relaxed max-w-xl mx-auto">
                        Your review is extremely important to us. Please share your experience regarding the course.
                    </p>
                </div>

                {/* Form Card */}
                <div className="w-full max-w-2xl mx-auto px-6 pb-16">
                    {submitted ? (
                        /* Success State */
                        <div className="bg-white rounded-3xl shadow-xl p-10 text-center border border-[#d1fae5]">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#d1fae5] rounded-full mb-6">
                                <svg className="w-10 h-10 text-[#059669]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-[#111827] mb-3">
                                Thank You! 🎉
                            </h2>
                            <p className="text-[#4b5563] leading-relaxed mb-2">
                                Your review has been successfully submitted.
                            </p>
                            <p className="text-[#6b7280] text-sm mb-8">
                                It will be published after our team reviews it.
                            </p>
                            <button
                                onClick={() => {
                                    setSubmitted(false);
                                    setStudentName("");
                                    setBatch("");
                                    setRole("");
                                    setCompany("");
                                    setMessage("");
                                    setRating(5);
                                }}
                                className="inline-flex items-center gap-2 px-8 py-3 bg-[#059669] text-white font-semibold rounded-full hover:bg-[#047857] transition-colors duration-200 shadow-md"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Submit another review
                            </button>
                        </div>
                    ) : (
                        /* Form */
                        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-[#059669] to-[#10b981] px-8 py-5 text-center">
                                <h2 className="text-white font-bold text-lg">Give your review</h2>
                                <p className="text-green-100 text-sm mt-0.5">All information will remain confidential</p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Student Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#374151] mb-2">
                                            Student Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={studentName}
                                            onChange={(e) => setStudentName(e.target.value)}
                                            placeholder="Your full name"
                                            className="w-full px-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all duration-200"
                                        />
                                    </div>

                                    {/* Batch Select */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#374151] mb-2">
                                            Batch
                                        </label>
                                    <div className="relative">
                                        <select
                                            value={batch}
                                            onChange={(e) => setBatch(e.target.value)}
                                            className="w-full appearance-none px-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all duration-200 cursor-pointer"
                                        >
                                            <option value="">-- Select Batch --</option>
                                            {BATCH_OPTIONS.map((b) => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Role / Title */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#374151] mb-2">
                                            Role / Title
                                        </label>
                                        <input
                                            type="text"
                                            value={role}
                                            onChange={(e) => setRole(e.target.value)}
                                            placeholder="e.g. Sales Executive"
                                            className="w-full px-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all duration-200"
                                        />
                                    </div>

                                    {/* Company */}
                                    <div>
                                        <label className="block text-sm font-semibold text-[#374151] mb-2">
                                            Company / Business Name
                                        </label>
                                        <input
                                            type="text"
                                            value={company}
                                            onChange={(e) => setCompany(e.target.value)}
                                            placeholder="Your company or business name"
                                            className="w-full px-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all duration-200"
                                        />
                                    </div>
                                </div>

                                {/* Rating */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#374151] mb-2">
                                        Rating
                                    </label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setRating(star)}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                                    star <= rating ? "text-yellow-400" : "text-gray-300"
                                                }`}
                                            >
                                                <svg className="w-8 h-8 fill-current" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Message Textarea */}
                                <div>
                                    <label className="block text-sm font-semibold text-[#374151] mb-2">
                                        Review Quote <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={6}
                                        placeholder="What did you think about the course?"
                                        className="w-full px-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-xl text-[#111827] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent transition-all duration-200 resize-none leading-relaxed"
                                    />
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-red-600 text-sm">{error}</p>
                                    </div>
                                )}



                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-[#059669] to-[#10b981] text-white font-bold text-base rounded-xl hover:from-[#047857] hover:to-[#059669] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Submit Review
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
