"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CvPreview, A4ScaledPreview } from "@/components/cv/CvPreview";
import type { CvFormData } from "@/lib/cv/schemas";
import type { TemplateConfig } from "@/lib/cv/constants";
import { useCourseName } from "@/contexts/BrandingContext";
import { PLATFORM_NAME } from "@/types/branding";

interface CvTemplate {
    id: string;
    name: string;
    slug: string;
    thumbnail: string | null;
    description: string | null;
    config: {
        primaryColor: string;
        sidebarColor: string;
        sidebarWidth: number;
        fontFamily: string;
        photoShape: string;
        showPhoto: boolean;
    };
}

const PREVIEW_WIDTH  = 794;
const PREVIEW_HEIGHT = 1123; // A4 at 96 dpi: 794 × (297/210)

// Dense dummy data — fills a full A4 page like a real CV.
// Built per course so a telesales student's template preview doesn't advertise
// a sales & marketing course.
const buildSampleCv = (courseName: string): CvFormData => ({
    title: "My CV",
    fullName: "Your Name",
    profilePhoto: "",
    careerObjective: `I am a motivated and hardworking professional with real, hands-on experience from the ${courseName} programme. Now I am looking for a job in a growing company where I can apply my skills in communication, customer service and teamwork to help the company grow and keep customers happy.`,
    phone: "01568-274516",
    email: "yourname@gmail.com",
    address: "3642 Matlab Uttar, Chandpur",
    dateOfBirth: "06-11-2003",
    bloodGroup: "O+",
    religion: "Islam",
    maritalStatus: "Single",
    nationality: "Bangladeshi",
    skills: [
        "Sales & Marketing",
        "Public Relations",
        "Teamwork & Leadership",
        "MS Word and MS Excel",
        "Effective Communication",
        "Customer Service",
    ],
    languages: [
        { name: "English", level: "Beginner" },
        { name: "Bengali", level: "Native" },
    ],
    hobbies: ["Traveling", "Walking", "Outdoor Activities"],
    workExperience: [
        {
            jobTitle: "Sales Executive (Internship)",
            company: "Global Distribution",
            location: "Mohammadpur, Dhaka",
            startDate: "", endDate: "",
            bullets: [
                "2 years experience in grocery business",
                "Sold 20 kg of dates in 2 days on the footpath with the team",
                "Retail Sales experience in FMCG sector",
                "Sold 20 kg of dates in 2 days on the street with the team",
            ],
        },
        {
            jobTitle: "Sales Associate",
            company: "Akij Group",
            location: "Dhaka",
            startDate: "", endDate: "",
            bullets: [
                "Achieved weekly sales targets and maintained client database",
                "Coordinated with logistics team for on-time product delivery",
            ],
        },
    ],
    training: [
        {
            trainingName: courseName,
            institute: PLATFORM_NAME,
            year: "2024",
            bullets: [
                "Customers Service, Objection handling, Branding, USP, KPI",
                "Communication, Distribution, Negotiations, Market research",
                "Retail Business, Self Assessment, Copyrighting, Success Mindset",
                "Digital Marketing basics, AI",
            ],
        },
    ],
    education: [
        {
            degree: "Bachelor — Marketing",
            department: "",
            institution: "East West University",
            year: "2025",
            gpa: "4.30",
        },
        {
            degree: "HSC in Science",
            department: "",
            institution: "Kalipur high school and college",
            year: "2023",
            gpa: "4.33 out of 5.00",
        },
        {
            degree: "SSC in Science",
            department: "",
            institution: "Matlab Uttar Model High School",
            year: "2021",
            gpa: "4.72 out of 5.00",
        },
    ],
    references: [
        {
            name: "Abu Zabar Rezwhe",
            title: "Executive Director",
            organization: "KSF Chemicals",
            phone: "01711504223",
            email: "rezwhe@gmail.com",
        },
        {
            name: "Shaibal Shahriar",
            title: "Co - founder & Chief Operating Officer (COO) at Prokrity Store",
            organization: "",
            phone: "01711080891",
            email: "shaibal@quantiqdynamics.com",
        },
    ],
    declaration: "I do hereby state that the above statement are true and I will be responsible for any wrong information.",
    signature: "Your Name",
    sectionOrder: ["careerObjective", "workExperience", "training", "education", "references", "declaration", "skills", "languages", "hobbies"],
    linkedin: "",
    visibleSections: ["careerObjective", "workExperience", "training", "education", "references", "skills", "languages", "hobbies", "personalInfo", "declaration"],
});

// Scales CvPreview to fit container width, height follows content naturally
function ScaledCvPreview({ data, config }: { data: CvFormData; config: TemplateConfig }) {
    const wrapRef  = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale]               = useState(0.45);
    const [contentHeight, setContentHeight] = useState(600);

    useEffect(() => {
        const wrap  = wrapRef.current;
        const inner = innerRef.current;
        if (!wrap || !inner) return;

        const update = () => {
            const s = wrap.getBoundingClientRect().width / PREVIEW_WIDTH;
            setScale(s);
            setContentHeight(inner.scrollHeight);
        };
        const ro = new ResizeObserver(update);
        ro.observe(wrap);
        ro.observe(inner);
        update();
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={wrapRef} style={{ width: "100%", height: Math.round(contentHeight * scale), overflow: "hidden", position: "relative" }}>
            <div ref={innerRef} style={{
                width: PREVIEW_WIDTH,
                transformOrigin: "top left",
                transform: `scale(${scale})`,
                position: "absolute",
                top: 0, left: 0,
                pointerEvents: "none",
            }}>
                <CvPreview data={data} config={config} />
            </div>
        </div>
    );
}



// Zoomed A4 modal
function TemplateViewModal({
    tmpl, data, config, onClose,
}: {
    tmpl: CvTemplate;
    data: CvFormData;
    config: TemplateConfig;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-[#f1f5f9] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ maxWidth: 640, width: "100%", maxHeight: "94vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 flex-shrink-0 rounded-t-2xl">
                    <div>
                        <p className="no-gradient font-bold text-gray-900 text-sm">{tmpl.name}</p>
                        {tmpl.description && <p className="text-xs text-gray-400 mt-0.5">{tmpl.description}</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* A4 page — scrollable */}
                <div className="overflow-y-auto flex-1 py-5 px-6">
                    {/* White A4 paper shadow */}
                    <div className="mx-auto rounded-lg shadow-2xl overflow-hidden" style={{ maxWidth: 560 }}>
                        <A4ScaledPreview data={data} config={config} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NewCvPage() {
    const courseName = useCourseName();
    const sampleCv = useMemo(() => buildSampleCv(courseName), [courseName]);
    const router = useRouter();
    const [templates, setTemplates] = useState<CvTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [viewingTemplate, setViewingTemplate] = useState<CvTemplate | null>(null);
    const [title, setTitle] = useState("My CV");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch("/api/cv/admin/templates")
            .then((r) => r.json())
            .then((data) => setTemplates(Array.isArray(data) ? data.filter((t: CvTemplate & { isActive?: boolean }) => t.isActive !== false) : []))
            .catch(() => toast.error("Failed to load templates"))
            .finally(() => setLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!selectedTemplate) { toast.error("Please select a template"); return; }
        if (!title.trim()) { toast.error("Please enter a CV title"); return; }
        setCreating(true);
        try {
            const res = await fetch("/api/cv", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ templateId: selectedTemplate, title: title.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create CV");
            toast.success("CV created!");
            router.push(`/student-dashboard/cv/${data.id}/edit`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create CV");
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full" />
                    <div>
                        <h1 className="text-3xl font-bold text-[#1f2937]">Create New CV</h1>
                        <p className="text-[#6b7280] mt-1">Choose a template to get started</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50">
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={creating || !selectedTemplate}
                        className="px-7 py-2.5 bg-[#059669] text-white rounded-xl font-bold text-sm hover:bg-[#047857] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? "Creating..." : "Create CV →"}
                    </button>
                </div>
            </div>

            {/* CV Title */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <label className="block text-sm font-bold text-gray-700 mb-2">CV Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. My Professional CV"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-sm"
                    maxLength={100}
                />
            </div>

            {/* Template grid */}
            <div>
                <h2 className="text-base font-bold text-gray-700 mb-4 uppercase tracking-wide text-sm">Choose a Template</h2>
                {templates.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
                        No templates available yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((tmpl) => {
                            const isSelected = selectedTemplate === tmpl.id;
                            const config: TemplateConfig = {
                                primaryColor: tmpl.config.primaryColor ?? "#1e3a5f",
                                sidebarColor: tmpl.config.sidebarColor ?? "#1e3a5f",
                                sidebarWidth: tmpl.config.sidebarWidth ?? 35,
                                fontFamily: tmpl.config.fontFamily ?? "Helvetica",
                                photoShape: (tmpl.config.photoShape as "circle" | "square") ?? "circle",
                                showPhoto: tmpl.config.showPhoto ?? true,
                            };
                            const previewData: CvFormData = { ...sampleCv };

                            return (
                                <button
                                    key={tmpl.id}
                                    onClick={() => setSelectedTemplate(tmpl.id)}
                                    className={`text-left rounded-2xl border-2 overflow-hidden transition-all focus:outline-none group ${
                                        isSelected
                                            ? "border-[#059669] ring-4 ring-[#059669]/20 shadow-xl"
                                            : "border-gray-200 hover:border-[#059669]/60 hover:shadow-lg"
                                    }`}
                                >
                                    {/* Full CV preview */}
                                    <div className="relative bg-white">
                                        <ScaledCvPreview data={previewData} config={config} />

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-[#059669]/0 group-hover:bg-[#059669]/5 transition-colors pointer-events-none" />

                                        {/* View button — bottom centre on hover */}
                                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setViewingTemplate(tmpl); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-700 text-xs font-bold rounded-full shadow-lg hover:bg-white hover:border-[#059669] hover:text-[#059669] transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                                                </svg>
                                                View Full
                                            </button>
                                        </div>

                                        {/* Selected checkmark */}
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-8 h-8 bg-[#059669] rounded-full flex items-center justify-center shadow-lg z-10">
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Template name footer */}
                                    <div className={`px-4 py-3 flex items-center justify-between border-t ${isSelected ? "bg-[#059669]/5 border-[#059669]/20" : "bg-white border-gray-100"}`}>
                                        <div>
                                            <p className="no-gradient font-bold text-gray-900 text-sm">{tmpl.name}</p>
                                            {tmpl.description && (
                                                <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{tmpl.description}</p>
                                            )}
                                        </div>
                                        {isSelected
                                            ? <span className="text-xs font-bold text-[#059669] bg-[#059669]/10 px-2 py-1 rounded-full flex-shrink-0">✓ Selected</span>
                                            : <span className="text-xs text-gray-400 group-hover:text-[#059669] transition-colors flex-shrink-0">Select →</span>
                                        }
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Template zoom modal */}
            {viewingTemplate && (() => {
                const vc: TemplateConfig = {
                    primaryColor: viewingTemplate.config.primaryColor ?? "#1e3a5f",
                    sidebarColor: viewingTemplate.config.sidebarColor ?? "#1e3a5f",
                    sidebarWidth: viewingTemplate.config.sidebarWidth ?? 35,
                    fontFamily: viewingTemplate.config.fontFamily ?? "Helvetica",
                    photoShape: (viewingTemplate.config.photoShape as "circle" | "square") ?? "circle",
                    showPhoto: viewingTemplate.config.showPhoto ?? true,
                };
                return (
                    <TemplateViewModal
                        tmpl={viewingTemplate}
                        data={{ ...sampleCv }}
                        config={vc}
                        onClose={() => setViewingTemplate(null)}
                    />
                );
            })()}

            {/* Sticky bottom bar when template selected */}
            {selectedTemplate && (
                <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-4 px-4 pointer-events-none">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-6 py-4 flex items-center gap-4 pointer-events-auto">
                        <div>
                            <p className="no-gradient text-sm font-bold text-gray-900">
                                {templates.find(t => t.id === selectedTemplate)?.name}
                            </p>
                            <p className="text-xs text-gray-400">Template selected — ready to create</p>
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="px-6 py-2.5 bg-[#059669] text-white rounded-xl font-bold text-sm hover:bg-[#047857] disabled:opacity-50 transition-all whitespace-nowrap"
                        >
                            {creating ? "Creating..." : "Create CV →"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
