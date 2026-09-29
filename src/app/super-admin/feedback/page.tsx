"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import * as feedbackService from "@/services/feedbackService";
import type { FeedbackCategory, FeedbackWithIdentity } from "@/services/feedbackService";

interface CourseOpt { id: string; slug: string; name: string }

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    CourseContent: "Course Content",
    Teacher: "Teacher",
    Facilities: "Facilities",
    Administration: "Administration",
    Other: "Other",
};

export default function SuperAdminFeedbackPage() {
    const [list, setList] = useState<FeedbackWithIdentity[]>([]);
    const [courses, setCourses] = useState<CourseOpt[]>([]);
    const [courseId, setCourseId] = useState<string>("all");
    const [category, setCategory] = useState<FeedbackCategory | "all">("all");
    const [loading, setLoading] = useState(true);

    const loadCourses = useCallback(async () => {
        const res = await fetch("/api/saas/courses");
        const data = await res.json();
        if (res.ok) setCourses((data.courses || []).map((x: CourseOpt) => ({ id: x.id, slug: x.slug, name: x.name })));
    }, []);

    const loadFeedback = useCallback(async () => {
        setLoading(true);
        try {
            const data = await feedbackService.getFeedbackWithIdentity({
                courseId: courseId === "all" ? undefined : courseId,
                category: category === "all" ? undefined : category,
            });
            setList(data);
        } finally {
            setLoading(false);
        }
    }, [courseId, category]);

    useEffect(() => { loadCourses(); }, [loadCourses]);
    useEffect(() => { loadFeedback(); }, [loadFeedback]);

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
            <Link href="/super-admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-4 h-4" /> Back
            </Link>

            <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Feedback</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Every course's feedback, with the submitting student's identity — visible only here.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                    <option value="all">All Courses</option>
                    {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FeedbackCategory | "all")}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                    <option value="all">All Categories</option>
                    {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                </select>
                <span className="ml-auto self-center text-sm text-slate-500">{list.length} item{list.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : list.length === 0 ? (
                <div className="text-center py-16 text-slate-400">No feedback found.</div>
            ) : (
                <div className="space-y-3">
                    {list.map((fb) => (
                        <div key={fb.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                                    {fb.course?.name || fb.courseId}
                                </span>
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                                    {fb.batchName}
                                </span>
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                    {CATEGORY_LABELS[fb.category]}
                                </span>
                                <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 text-xs font-semibold rounded-full">
                                    {"★".repeat(fb.rating)} {fb.rating}/5
                                </span>
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${fb.isRead ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"}`}>
                                    {fb.isRead ? "Read" : "Unread"}
                                </span>
                                <span className="text-xs text-slate-400 ml-auto">
                                    {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                                </span>
                            </div>
                            <p className="text-slate-800 text-sm leading-relaxed mb-3">&quot;{fb.message}&quot;</p>
                            <p className="text-xs text-slate-500 font-semibold">
                                — {fb.studentName || "Unknown"} (Roll {fb.studentRoll || "—"})
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
