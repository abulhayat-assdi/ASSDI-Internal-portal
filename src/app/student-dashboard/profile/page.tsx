"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { StudentBatchInfo } from "@/services/batchInfoService";
import { submitUpdateRequest } from "@/services/studentUpdateService";
import { normalizeCurrentlyDoing, currentlyDoingLabel } from "@/lib/currentlyDoing";

function toDriveImg(url: string): string {
    if (url && url.includes("drive.google.com") && url.includes("/d/")) {
        const id = url.split("/d/")[1].split("/")[0];
        return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    }
    return url;
}

const EMPTY_FORM = {
    phone: "",
    dob: "",
    educationalDegree: "",
    category: "",
    bloodGroup: "",
    address: "",
    email: "",
    nidBirthNo: "",
    fatherName: "",
    motherName: "",
    permanentAddress: "",
    guardianName: "",
    guardianPhone: "",
    lastInstitute: "",
    latestDegree: "",
    gpaResult: "",
    currentDistrict: "",
    homeDistrict: "",
    tShirtSize: "",
    courseGoal: "",
    courseStatus: "",
    currentlyDoing: "",
    companyName: "",
    businessName: "",
    salary: "",
};
type FormState = typeof EMPTY_FORM;

export default function StudentProfilePage() {
    const { userProfile, loading } = useAuth();
    const [studentData, setStudentData] = useState<StudentBatchInfo | null>(null);
    const [fetching, setFetching] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState<FormState>(EMPTY_FORM);

    useEffect(() => {
        const fetchMyData = async () => {
            try {
                const res = await fetch("/api/student/profile");
                if (res.ok) {
                    const match = await res.json() as StudentBatchInfo;
                    setStudentData(match);
                    setForm({
                        phone: match.phone || "",
                        dob: match.dob || "",
                        educationalDegree: match.educationalDegree || "",
                        category: (match.category as string) || "",
                        bloodGroup: match.bloodGroup || "",
                        address: match.address || "",
                        email: match.email || "",
                        nidBirthNo: match.nidBirthNo || "",
                        fatherName: match.fatherName || "",
                        motherName: match.motherName || "",
                        permanentAddress: match.permanentAddress || "",
                        guardianName: match.guardianName || "",
                        guardianPhone: match.guardianPhone || "",
                        lastInstitute: match.lastInstitute || "",
                        latestDegree: match.latestDegree || "",
                        gpaResult: match.gpaResult || "",
                        currentDistrict: match.currentDistrict || "",
                        homeDistrict: match.homeDistrict || "",
                        tShirtSize: match.tShirtSize || "",
                        courseGoal: match.courseGoal || "",
                        courseStatus: (match.courseStatus as string) || "",
                        currentlyDoing: normalizeCurrentlyDoing(match.currentlyDoing),
                        companyName: match.companyName || "",
                        businessName: match.businessName || "",
                        salary: match.salary != null ? String(match.salary) : "",
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile data:", err);
            } finally {
                setFetching(false);
            }
        };
        if (!loading) fetchMyData();
    }, [userProfile, loading]);

    const handleChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const s = studentData;
            const proposedChanges: Record<string, string> = {};
            const check = (key: keyof FormState, current: string | number | null | undefined) => {
                const cur = current != null ? String(current) : "";
                if (form[key] !== cur) proposedChanges[key] = form[key];
            };

            check("phone", s?.phone);
            check("dob", s?.dob);
            check("educationalDegree", s?.educationalDegree);
            check("category", s?.category as string);
            check("bloodGroup", s?.bloodGroup);
            check("address", s?.address);
            check("email", s?.email);
            check("nidBirthNo", s?.nidBirthNo);
            check("fatherName", s?.fatherName);
            check("motherName", s?.motherName);
            check("permanentAddress", s?.permanentAddress);
            check("guardianName", s?.guardianName);
            check("guardianPhone", s?.guardianPhone);
            check("lastInstitute", s?.lastInstitute);
            check("latestDegree", s?.latestDegree);
            check("gpaResult", s?.gpaResult);
            check("currentDistrict", s?.currentDistrict);
            check("homeDistrict", s?.homeDistrict);
            check("tShirtSize", s?.tShirtSize);
            check("courseGoal", s?.courseGoal);
            check("courseStatus", s?.courseStatus as string);
            check("currentlyDoing", normalizeCurrentlyDoing(s?.currentlyDoing));
            check("companyName", s?.companyName);
            check("businessName", s?.businessName);
            check("salary", s?.salary != null ? String(s.salary) : "");

            if (Object.keys(proposedChanges).length === 0) {
                setError("কোনো পরিবর্তন হয়নি। অন্তত একটি তথ্য পরিবর্তন করে Submit করুন।");
                setSubmitting(false);
                return;
            }

            const uid = userProfile?.uid;
            const displayName = userProfile?.displayName;
            const batchName = userProfile?.studentBatchName;
            const roll = userProfile?.studentRoll;
            if (!uid || !displayName || !batchName || !roll) {
                throw new Error("Profile information missing.");
            }

            await submitUpdateRequest(uid, displayName, batchName, roll, proposedChanges as any, {
                phone: s?.phone, dob: s?.dob, educationalDegree: s?.educationalDegree,
                category: s?.category, bloodGroup: s?.bloodGroup, address: s?.address,
                email: s?.email, nidBirthNo: s?.nidBirthNo, fatherName: s?.fatherName,
                motherName: s?.motherName, permanentAddress: s?.permanentAddress,
                guardianName: s?.guardianName, guardianPhone: s?.guardianPhone,
                lastInstitute: s?.lastInstitute, latestDegree: s?.latestDegree,
                gpaResult: s?.gpaResult, currentDistrict: s?.currentDistrict,
                homeDistrict: s?.homeDistrict, tShirtSize: s?.tShirtSize,
                courseGoal: s?.courseGoal, courseStatus: s?.courseStatus,
                currentlyDoing: s?.currentlyDoing, companyName: s?.companyName,
                businessName: s?.businessName, salary: s?.salary,
            });

            setSubmitted(true);
            setIsEditing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || fetching) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
            </div>
        );
    }

    const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{value || <span className="text-gray-300 font-normal italic">Not set</span>}</p>
        </div>
    );

    const SectionTitle = ({ title }: { title: string }) => (
        <div className="col-span-full pt-2 pb-1 border-b border-gray-100">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{title}</p>
        </div>
    );

    const inputCls = "block w-full py-2.5 px-4 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-sm transition-all";
    const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-1 h-10 bg-[#059669] rounded-full" />
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2937]">My Profile</h1>
                    <p className="text-[#6b7280] mt-1">View your batch information and submit update requests.</p>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header banner */}
                <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5278] p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-3xl font-black shadow-inner overflow-hidden relative">
                            {userProfile?.profileImageUrl ? (
                                <Image src={toDriveImg(userProfile.profileImageUrl)} alt={userProfile.displayName || ""} fill sizes="64px" className="object-cover" />
                            ) : (
                                userProfile?.displayName?.charAt(0).toUpperCase() || "?"
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold no-gradient text-white">{userProfile?.displayName}</h2>
                            <p className="text-blue-200 text-sm mt-0.5 no-gradient">{userProfile?.email}</p>
                        </div>
                    </div>
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Batch</p>
                        <p className="text-xl font-bold text-white mt-0.5">{userProfile?.studentBatchName}</p>
                        <p className="text-blue-200 text-sm">Roll: {userProfile?.studentRoll}</p>
                    </div>
                </div>

                {/* Fields grid */}
                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                    <SectionTitle title="Basic Information" />
                    <Field label="Phone" value={studentData?.phone} />
                    <Field label="Date of Birth" value={studentData?.dob} />
                    <Field label="Blood Group" value={studentData?.bloodGroup ? <span className="text-red-600 font-bold">{studentData.bloodGroup}</span> : undefined} />
                    <Field label="Category" value={studentData?.category as string} />
                    <Field label="Educational Degree" value={studentData?.educationalDegree} />
                    <Field label="Address" value={studentData?.address} />

                    <SectionTitle title="Personal & Family" />
                    <Field label="Email" value={studentData?.email} />
                    <Field label="NID / Birth Certificate No" value={studentData?.nidBirthNo} />
                    <Field label="Father's Name" value={studentData?.fatherName} />
                    <Field label="Mother's Name" value={studentData?.motherName} />
                    <Field label="Permanent Address" value={studentData?.permanentAddress} />
                    <Field label="Guardian Name" value={studentData?.guardianName} />
                    <Field label="Guardian Phone" value={studentData?.guardianPhone} />

                    <SectionTitle title="Education" />
                    <Field label="Last Institute" value={studentData?.lastInstitute} />
                    <Field label="Latest Degree" value={studentData?.latestDegree} />
                    <Field label="GPA / Result" value={studentData?.gpaResult} />

                    <SectionTitle title="Location" />
                    <Field label="Current District" value={studentData?.currentDistrict} />
                    <Field label="Home District" value={studentData?.homeDistrict} />

                    <SectionTitle title="Course & Work" />
                    <Field label="Course Status" value={studentData?.courseStatus as string} />
                    <Field label="T-Shirt Size" value={studentData?.tShirtSize} />
                    <Field label="Currently Doing" value={currentlyDoingLabel(studentData?.currentlyDoing)} />
                    <Field label="Company Name" value={studentData?.companyName} />
                    <Field label="Business Name" value={studentData?.businessName} />
                    <Field label="Salary / Income" value={studentData?.salary ? `৳ ${Number(studentData.salary).toLocaleString()}` : undefined} />
                    <div className="col-span-full">
                        <Field label="Course Goal" value={studentData?.courseGoal} />
                    </div>
                </div>
            </div>

            {/* Success notice */}
            {submitted && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-4 animate-in fade-in zoom-in duration-300">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-800">আপডেট রিকোয়েস্ট পাঠানো হয়েছে!</h3>
                        <p className="text-emerald-700 text-sm mt-1">
                            Admin approve করলে আপনার তথ্য আপডেট হয়ে যাবে।
                        </p>
                    </div>
                </div>
            )}

            {/* Edit request section */}
            {!submitted && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Request Profile Update</h3>
                            <p className="text-sm text-gray-500 mt-1">Changes require admin approval before being reflected in your batch data.</p>
                        </div>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Information
                            </button>
                        )}
                    </div>

                    {isEditing && (
                        <form onSubmit={handleSubmitRequest} className="p-6 space-y-8">
                            {error && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* ── Basic Info ── */}
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Basic Information</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Phone Number</label>
                                        <input type="tel" value={form.phone} onChange={e => handleChange("phone", e.target.value)} className={inputCls} placeholder="01XXXXXXXXX" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Date of Birth</label>
                                        <input type="date" value={form.dob} onChange={e => handleChange("dob", e.target.value)} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Blood Group</label>
                                        <select value={form.bloodGroup} onChange={e => handleChange("bloodGroup", e.target.value)} className={`${inputCls} font-semibold text-red-600`}>
                                            <option value="">Select blood group</option>
                                            {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Category</label>
                                        <select value={form.category} onChange={e => handleChange("category", e.target.value)} className={inputCls}>
                                            <option value="">Select option</option>
                                            <option value="Alim">Alim</option>
                                            <option value="General">General</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Educational Degree</label>
                                        <input type="text" value={form.educationalDegree} onChange={e => handleChange("educationalDegree", e.target.value)} className={inputCls} placeholder="e.g. HSC, BBA, BSc" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Address</label>
                                        <input type="text" value={form.address} onChange={e => handleChange("address", e.target.value)} className={inputCls} placeholder="Current address" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Personal & Family ── */}
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Personal & Family</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Email</label>
                                        <input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} className={inputCls} placeholder="your@email.com" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>NID / Birth Certificate No</label>
                                        <input type="text" value={form.nidBirthNo} onChange={e => handleChange("nidBirthNo", e.target.value)} className={inputCls} placeholder="NID or Birth Cert number" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Father's Name</label>
                                        <input type="text" value={form.fatherName} onChange={e => handleChange("fatherName", e.target.value)} className={inputCls} placeholder="Father's full name" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Mother's Name</label>
                                        <input type="text" value={form.motherName} onChange={e => handleChange("motherName", e.target.value)} className={inputCls} placeholder="Mother's full name" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Permanent Address</label>
                                        <input type="text" value={form.permanentAddress} onChange={e => handleChange("permanentAddress", e.target.value)} className={inputCls} placeholder="Village / Thana / District" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Guardian Name</label>
                                        <input type="text" value={form.guardianName} onChange={e => handleChange("guardianName", e.target.value)} className={inputCls} placeholder="Emergency contact name" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Guardian Phone</label>
                                        <input type="tel" value={form.guardianPhone} onChange={e => handleChange("guardianPhone", e.target.value)} className={inputCls} placeholder="01XXXXXXXXX" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Education ── */}
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Education</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Last Institute</label>
                                        <input type="text" value={form.lastInstitute} onChange={e => handleChange("lastInstitute", e.target.value)} className={inputCls} placeholder="School / College / University name" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Latest Degree</label>
                                        <input type="text" value={form.latestDegree} onChange={e => handleChange("latestDegree", e.target.value)} className={inputCls} placeholder="e.g. Dakhil, HSC, B.Sc" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>GPA / Result</label>
                                        <input type="text" value={form.gpaResult} onChange={e => handleChange("gpaResult", e.target.value)} className={inputCls} placeholder="e.g. 5.00, A+" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Location ── */}
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Location</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Current District</label>
                                        <input type="text" value={form.currentDistrict} onChange={e => handleChange("currentDistrict", e.target.value)} className={inputCls} placeholder="District you currently live in" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Home District</label>
                                        <input type="text" value={form.homeDistrict} onChange={e => handleChange("homeDistrict", e.target.value)} className={inputCls} placeholder="Your home district" />
                                    </div>
                                </div>
                            </div>

                            {/* ── Course & Work ── */}
                            <div>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">Course & Work</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className={labelCls}>Course Status</label>
                                        <select value={form.courseStatus} onChange={e => handleChange("courseStatus", e.target.value)} className={inputCls}>
                                            <option value="">Select status</option>
                                            <option value="Running">Running</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Incomplete">Incomplete</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>T-Shirt Size</label>
                                        <select value={form.tShirtSize} onChange={e => handleChange("tShirtSize", e.target.value)} className={inputCls}>
                                            <option value="">Select size</option>
                                            {["S","M","L","XL","XXL","XXXL"].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Currently Doing</label>
                                        <select value={form.currentlyDoing} onChange={e => handleChange("currentlyDoing", e.target.value)} className={inputCls}>
                                            <option value="">Select option</option>
                                            <option value="Job">Job</option>
                                            <option value="Business">Business</option>
                                            <option value="StudyingFurther">Studying Further</option>
                                            <option value="Nothing">Nothing yet</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Company Name</label>
                                        <input type="text" value={form.companyName} onChange={e => handleChange("companyName", e.target.value)} className={inputCls} placeholder="Where you work" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Business Name</label>
                                        <input type="text" value={form.businessName} onChange={e => handleChange("businessName", e.target.value)} className={inputCls} placeholder="Your business name (if any)" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Salary / Income (৳)</label>
                                        <input type="number" value={form.salary} onChange={e => handleChange("salary", e.target.value)} className={inputCls} placeholder="e.g. 25000" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Course Goal</label>
                                        <textarea
                                            value={form.courseGoal}
                                            onChange={e => handleChange("courseGoal", e.target.value)}
                                            className={`${inputCls} resize-none`}
                                            rows={3}
                                            placeholder="What do you want to achieve from this course?"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`px-6 py-3 text-white font-bold text-sm rounded-xl shadow-sm transition-all ${submitting ? "bg-gray-400 cursor-not-allowed" : "bg-[#059669] hover:bg-[#047857]"}`}
                                >
                                    {submitting ? "Submitting..." : "Submit Update Request"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsEditing(false); setError(""); }}
                                    className="px-6 py-3 text-gray-600 bg-gray-100 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
