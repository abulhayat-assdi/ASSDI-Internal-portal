"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DocumentTextIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const UserIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const EmailIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

interface DBModule {
    id: string;
    slug: string;
    title: string;
    description: string;
    teacherName: string;
    teacherEmail: string;
    isPublished: boolean;
}

export default function CourseOutlinePage() {
    const [modules, setModules] = useState<DBModule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/course-modules")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    setModules(data.filter((m: DBModule) => m.isPublished));
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-5 sm:space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-4 sm:pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2937]">Course Outline</h1>
                        <p className="text-[#6b7280] mt-1">
                            A dynamic overview of the curriculum and modules published by your instructors.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <svg className="w-64 h-64 text-[#059669]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L1 21h22M12 6l7.53 13H4.47" />
                    </svg>
                </div>

                <div className="p-4 sm:p-8 grid gap-6 sm:gap-8 relative z-10 w-full">
                    {loading ? (
                        <div className="text-center py-16">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#059669]"></div>
                            <p className="mt-4 text-[#6b7280] text-sm">Loading modules...</p>
                        </div>
                    ) : modules.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 text-sm">No modules available.</div>
                    ) : (
                        modules.map((module, idx) => (
                            <div key={module.slug} className="flex gap-3 sm:gap-6 relative">
                                {idx !== modules.length - 1 && (
                                    <div className="absolute left-[1.15rem] top-10 bottom-[-2rem] w-0.5 bg-gray-100"></div>
                                )}

                                <div className="shrink-0 flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full bg-[#059669] text-white flex items-center justify-center font-bold shadow-md z-10">
                                        {idx + 1}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl p-4 sm:p-6 border border-gray-100 hover:border-[#059669]/30 hover:shadow-md transition-all group">
                                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#059669] transition-colors">{module.title}</h3>

                                    <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                                        {module.description}
                                    </p>

                                    <div className="mt-5 pt-5 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                                                <UserIcon className="w-4 h-4 text-[#059669]" />
                                                <span>Teacher Name: {module.teacherName || "—"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                                                <EmailIcon className="w-4 h-4 text-[#059669]" />
                                                <span>{module.teacherEmail || "—"}</span>
                                            </div>
                                        </div>

                                        <Link
                                            href={`/student-dashboard/course-outline/${module.slug}`}
                                            className="w-full sm:w-auto text-center px-6 py-3 sm:py-2 bg-[#059669] text-white rounded-lg hover:bg-[#047857] transition-all font-semibold shadow-sm hover:shadow-md active:scale-[0.98] text-sm flex items-center justify-center gap-2 whitespace-nowrap"
                                        >
                                            <DocumentTextIcon className="w-4 h-4" />
                                            View
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
