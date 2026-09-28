"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourseName } from "@/contexts/BrandingContext";
import { getAllStudentNotices, StudentNotice } from "@/services/dashboardService";
import Link from "next/link";
import { getStudentProfile, BatchStudent } from "@/services/studentService";
import { currentlyDoingLabel } from "@/lib/currentlyDoing";

const AcademicCapIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>
);
const BriefcaseIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 14.15v4.25c0 1.094-.896 1.95-2 1.95H5.75c-1.104 0-2-.856-2-1.95v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
);
const CurrencyDollarIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
    </svg>
);
const MapPinIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
);

export default function StudentDashboardOverview() {
    const { userProfile, loading } = useAuth();
    const courseName = useCourseName();
    const [studentData, setStudentData] = useState<BatchStudent | null>(null);
    const [fetching, setFetching] = useState(true);
    const [studentNotices, setStudentNotices] = useState<StudentNotice[]>([]);

    useEffect(() => {
        const fetchMyData = async () => {
            try {
                const [profile, notices] = await Promise.all([
                    getStudentProfile(),
                    getAllStudentNotices()
                ]);
                setStudentData(profile);
                setStudentNotices(notices);
            } catch (err) {
                console.error("Failed to fetch student dashboard data:", err);
            } finally {
                setFetching(false);
            }
        };

        if (!loading) {
            fetchMyData();
        }
    }, [userProfile, loading]);

    if (loading || fetching) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
            </div>
        );
    }

    const { displayName, studentBatchName, studentRoll } = userProfile || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#059669] to-[#10b981] rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full border-4 border-white/10 opacity-50"></div>
                <div className="absolute bottom-0 left-1/2 -ml-32 -mb-24 w-80 h-80 rounded-full border-4 border-white/10 opacity-30"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="no-gradient text-white text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
                        <p className="no-gradient text-emerald-50 text-lg opacity-90">
                            {`Your dedicated student portal for ${courseName}`}
                        </p>
                        <p className="no-gradient text-emerald-100 text-sm mt-1.5 opacity-80">📌 আপনার প্রোফাইল সবসময় আপডেট রাখুন।</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl py-3 px-6 border border-white/30 text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-100 uppercase tracking-widest">Enrollment Details</p>
                        <p className="text-xl font-bold mt-1">Batch {studentBatchName} <span className="text-emerald-200 mx-2">|</span> Roll: {studentRoll}</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <AcademicCapIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium font-semibold uppercase tracking-wider">Course Status</p>
                            <h3 className={`text-xl font-bold mt-1 ${
                                studentData?.courseStatus === 'Completed' ? 'text-emerald-600' :
                                studentData?.courseStatus === 'Incomplete' ? 'text-orange-600' :
                                studentData?.courseStatus === 'Expelled' ? 'text-red-600' : 'text-gray-900'
                            }`}>
                                {studentData?.courseStatus || "Ongoing"}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
                            <BriefcaseIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium font-semibold uppercase tracking-wider">Currently Doing</p>
                            <h3 className="text-xl font-bold text-gray-900 mt-1 truncate">
                                {currentlyDoingLabel(studentData?.currentlyDoing) || "N/A"}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <CurrencyDollarIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium font-semibold uppercase tracking-wider">Present Salary</p>
                            <h3 className="text-xl font-bold text-gray-900 mt-1">
                                {studentData?.salary ? `৳ ${studentData.salary.toLocaleString()}` : "N/A"}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <MapPinIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium font-semibold uppercase tracking-wider">Location</p>
                            <h3 className="text-base font-bold text-gray-900 mt-1 leading-snug">
                                {studentData?.address || "N/A"}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions & Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3 border-gray-100 flex items-center gap-2">
                        📢 Notice Board
                        {studentNotices.length > 0 && (
                            <span className="ml-auto text-xs bg-blue-50 text-[#1e3a5f] font-semibold px-2 py-0.5 rounded-full">{studentNotices.length}</span>
                        )}
                    </h2>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {studentNotices.length === 0 ? (
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                                <p className="text-gray-500 text-sm">No notices from teachers yet.</p>
                            </div>
                        ) : (
                            studentNotices.map(notice => (
                                <div key={notice.id} className={`p-4 rounded-xl border flex items-start gap-4 ${
                                    notice.priority === 'urgent' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                                }`}>
                                    <div className={`p-2 rounded-lg text-center min-w-[60px] ${
                                        notice.priority === 'urgent' ? 'bg-red-500 text-white' : 'bg-[#059669] text-white'
                                    }`}>
                                        <p className="text-xs font-semibold uppercase">{notice.date?.split('-')[1] ? new Date(notice.date + 'T00:00:00').toLocaleString('en', { month: 'short' }) : 'New'}</p>
                                        <p className="text-xl font-bold">{notice.date?.split('-')[2] || '•'}</p>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {notice.priority === 'urgent' && (
                                            <span className="text-xs font-bold text-red-600 uppercase">🔴 Urgent — </span>
                                        )}
                                        <h4 className="font-bold text-gray-900 inline">{notice.title}</h4>
                                        <p className="text-gray-600 text-sm mt-1">{notice.description}</p>
                                        <p className="text-xs text-gray-400 mt-1">By: {notice.createdByName}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#1e3a5f] rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                     {/* Floating subtle overlay element */}
                     <svg className="absolute top-0 right-0 opacity-10 blur-xl w-64 h-64 -translate-y-12 translate-x-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z" /></svg>
                     
                     <div className="relative z-10">
                        <h3 className="text-xl text-white font-bold mb-3 flex items-center gap-2 no-gradient">
                             <span className="bg-white/20 p-2 rounded-lg">👤</span>
                             Update Profile
                        </h3>
                        <p className="text-white/90 text-sm leading-relaxed mb-6 no-gradient">
                            Is your current employment, business, or address information outdated? Submit a profile update request to keep our batch records accurate.
                        </p>
                     </div>

                     <Link href="/student-dashboard/profile" className="relative z-10 w-full text-center bg-white text-[#1e3a5f] hover:bg-gray-10 text-sm font-bold py-3 px-4 rounded-xl shadow transition-colors">
                        Go to Profile Settings
                     </Link>
                </div>

            </div>
        </div>
    );
}
