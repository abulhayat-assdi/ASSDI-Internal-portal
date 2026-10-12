"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import toast from "react-hot-toast";
import compressImage from "browser-image-compression";
import { cvFormSchema, type CvFormData, type CvDraftFull } from "@/lib/cv/schemas";
import { CvPreview, A4ScaledPreview } from "@/components/cv/CvPreview";
import {
    SECTION_LABELS,
    MAIN_SECTION_KEYS,
    BLOOD_GROUPS,
    MARITAL_STATUSES,
    LANGUAGE_PROFICIENCY_LEVELS,
    RELIGIONS,
    NATIONALITIES,
    AUTOSAVE_DEBOUNCE_MS,
    type TemplateConfig,
} from "@/lib/cv/constants";

// ─── Helpers ────────────────────────────────────────────────────────────────

function inputCls(extra = "") {
    return `block w-full py-2.5 px-4 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-sm transition-all ${extra}`;
}
function labelCls() { return "block text-sm font-semibold text-gray-700 mb-1.5"; }

// ─── Character counter ────────────────────────────────────────────────────────

function CharCount({ cur, max }: { cur: number; max: number }) {
    const pct = cur / max;
    const cls = pct >= 1 ? "text-red-500 font-bold" : pct >= 0.85 ? "text-amber-500" : "text-gray-400";
    return <span className={`text-xs ${cls}`}>{cur}/{max}</span>;
}

function FieldLabel({ label, cur, max }: { label: string; cur?: number; max?: number }) {
    return (
        <div className="flex justify-between items-center mb-1.5">
            <span className="text-sm font-semibold text-gray-700">{label}</span>
            {cur !== undefined && max !== undefined && <CharCount cur={cur} max={max} />}
        </div>
    );
}

// ─── Limits (keeps CV to 1 A4 page) ──────────────────────────────────────────

const LIM = {
    fullName: 50, careerObjective: 400, address: 60,
    jobTitle: 50, company: 40, location: 30,
    bullet: 90, bulletsPerEntry: 3, weEntries: 3,
    trainingName: 60, institute: 50, trainingEntries: 2,
    degree: 50, department: 40, institution: 60, eduEntries: 3,
    refName: 40, refTitle: 40, refOrg: 50, refEntries: 4,
    declaration: 250, signature: 40,
    skill: 25, maxSkills: 8, hobby: 25, maxHobbies: 6, maxLanguages: 5,
} as const;

// ─── Section collapse state ──────────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
                <span className="font-bold text-gray-900">{title}</span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">{children}</div>}
        </div>
    );
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ value, onChange, placeholder, maxLen = 30, maxItems }: {
    value: string[]; onChange: (v: string[]) => void; placeholder?: string;
    maxLen?: number; maxItems?: number;
}) {
    const [input, setInput] = useState("");
    const atMax = maxItems !== undefined && value.length >= maxItems;
    const addTag = () => {
        const tag = input.trim().slice(0, maxLen);
        if (tag && !value.includes(tag) && !atMax) onChange([...value, tag]);
        setInput("");
    };
    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                {value.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 bg-[#d1fae5] text-[#065f46] text-xs font-semibold px-3 py-1.5 rounded-full">
                        {tag}
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-red-500 font-bold ml-1">×</button>
                    </span>
                ))}
            </div>
            {atMax ? (
                <p className="text-xs text-amber-600 py-1">Max {maxItems} items reached. Remove one to add more.</p>
            ) : (
                <div className="flex gap-2">
                    <input
                        className={inputCls("flex-1")}
                        placeholder={placeholder ?? "Type and press Enter"}
                        value={input}
                        maxLength={maxLen}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    />
                    <button type="button" onClick={addTag} className="px-4 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857]">Add</button>
                </div>
            )}
            {maxItems && <p className="text-xs text-gray-400 mt-1">{value.length}/{maxItems}</p>}
        </div>
    );
}

// ─── CV Preview ────────────────────────────────────────────────────────────────

// ─── Version History Modal ────────────────────────────────────────────────────

function VersionHistoryModal({ draftId, onClose, onRestore }: { draftId: string; onClose: () => void; onRestore: (draft: CvFormData) => void }) {
    const [versions, setVersions] = useState<{ id: string; label: string | null; createdAt: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/cv/${draftId}/versions`)
            .then((r) => r.json())
            .then((d) => setVersions(Array.isArray(d) ? d : []))
            .catch(() => toast.error("Failed to load versions"))
            .finally(() => setLoading(false));
    }, [draftId]);

    const handleRestore = async (versionId: string) => {
        setRestoring(versionId);
        try {
            const res = await fetch(`/api/cv/${draftId}/versions`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ versionId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to restore");
            onRestore(data as CvFormData);
            toast.success("Version restored!");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Restore failed");
        } finally {
            setRestoring(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Version History</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading && <p className="text-center text-gray-400 py-8">Loading...</p>}
                    {!loading && versions.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No saved versions yet.<br /><span className="text-sm">Use the Save Version button to create a snapshot.</span></p>
                    )}
                    {versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div>
                                <p className="font-semibold text-sm text-gray-800">{v.label || "Unnamed version"}</p>
                                <p className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => handleRestore(v.id)}
                                disabled={restoring === v.id}
                                className="px-3 py-1.5 bg-[#059669] text-white text-xs font-bold rounded-lg hover:bg-[#047857] disabled:opacity-50"
                            >
                                {restoring === v.id ? "Restoring..." : "Restore"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function CvEditorPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [draft, setDraft] = useState<CvDraftFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
    const [showVersions, setShowVersions] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadingDocx, setDownloadingDocx] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState<string>("");
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const config: TemplateConfig = draft?.template?.config ?? {
        primaryColor: "#1e3a5f",
        sidebarColor: "#1e3a5f",
        sidebarWidth: 35,
        fontFamily: "Helvetica",
        photoShape: "circle",
        showPhoto: true,
    };

    const form = useForm<CvFormData>({
        resolver: zodResolver(cvFormSchema) as Resolver<CvFormData>,
        defaultValues: {
            title: "My CV",
            fullName: "", profilePhoto: "", careerObjective: "",
            phone: "", email: "", address: "", linkedin: "",
            dateOfBirth: "", bloodGroup: "", religion: "", maritalStatus: "", nationality: "",
            skills: [], languages: [], hobbies: [],
            workExperience: [], training: [], education: [], references: [],
            declaration: "", signature: "",
            sectionOrder: ["careerObjective","workExperience","training","education","references","declaration","skills","languages","hobbies"],
            visibleSections: ["careerObjective","workExperience","training","education","references","skills","languages","hobbies","personalInfo","declaration"],
        },
    });

    const { fields: weFields, append: appendWe, remove: removeWe } = useFieldArray({ control: form.control, name: "workExperience" });
    const { fields: trainingFields, append: appendTraining, remove: removeTraining } = useFieldArray({ control: form.control, name: "training" });
    const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control: form.control, name: "education" });
    const { fields: refFields, append: appendRef, remove: removeRef } = useFieldArray({ control: form.control, name: "references" });
    const { fields: langFields, append: appendLang, remove: removeLang } = useFieldArray({ control: form.control, name: "languages" });

    // Load draft
    useEffect(() => {
        fetch(`/api/cv/${id}`)
            .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
            .then((data: CvDraftFull) => {
                setDraft(data);
                const sidebarKeys = ["skills","languages","hobbies"];
                const rawOrder: string[] = Array.isArray(data.sectionOrder) && data.sectionOrder.length
                    ? data.sectionOrder as string[]
                    : ["careerObjective","workExperience","training","education","references","declaration","skills","languages","hobbies"];
                // Migrate old CVs: ensure careerObjective/declaration are present in main column
                let mainOrder = rawOrder.filter(k => !sidebarKeys.includes(k));
                const sidebarOrder = rawOrder.filter(k => sidebarKeys.includes(k));
                if (!mainOrder.includes("careerObjective")) mainOrder = ["careerObjective", ...mainOrder];
                if (!mainOrder.includes("declaration")) mainOrder = [...mainOrder, "declaration"];
                const sectionOrder = [...mainOrder, ...sidebarOrder];
                form.reset({
                    title: data.title ?? "My CV",
                    fullName: data.fullName ?? "",
                    profilePhoto: data.profilePhoto ?? "",
                    careerObjective: data.careerObjective ?? "",
                    phone: data.phone ?? "",
                    email: data.email ?? "",
                    address: data.address ?? "",
                    linkedin: (data as any).linkedin ?? "",
                    dateOfBirth: data.dateOfBirth ?? "",
                    bloodGroup: data.bloodGroup ?? "",
                    religion: data.religion ?? "",
                    maritalStatus: data.maritalStatus ?? "",
                    nationality: data.nationality ?? "",
                    skills: (data.skills as string[]) ?? [],
                    languages: (data.languages as CvFormData["languages"]) ?? [],
                    hobbies: (data.hobbies as string[]) ?? [],
                    workExperience: (data.workExperience as CvFormData["workExperience"]) ?? [],
                    training: (data.training as CvFormData["training"]) ?? [],
                    education: (data.education as CvFormData["education"]) ?? [],
                    references: (data.references as CvFormData["references"]) ?? [],
                    declaration: data.declaration ?? "",
                    signature: data.signature ?? "",
                    sectionOrder,
                    visibleSections: ((data as any).visibleSections as string[]) ?? [
                        'careerObjective', 'workExperience', 'training', 'education', 'references', 'skills', 'languages', 'hobbies', 'personalInfo', 'declaration'
                    ],
                });
            })
            .catch(() => { toast.error("Failed to load CV"); router.push("/student-dashboard/cv"); })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Auto-save
    const triggerAutoSave = useCallback((values: CvFormData) => {
        setSaveStatus("unsaved");
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
            setSaveStatus("saving");
            try {
                await fetch(`/api/cv/${id}/auto-save`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(values),
                });
                setSaveStatus("saved");
            } catch {
                setSaveStatus("unsaved");
            }
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [id]);

    useEffect(() => {
        const subscription = form.watch((values) => {
            triggerAutoSave(values as CvFormData);
        });
        return () => subscription.unsubscribe();
    }, [form, triggerAutoSave]);

    // Manual save
    const handleManualSave = form.handleSubmit(async (values) => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setSaveStatus("saving");
        try {
            const res = await fetch(`/api/cv/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok) throw new Error("Save failed");
            setSaveStatus("saved");
            toast.success("CV saved!");
        } catch {
            setSaveStatus("unsaved");
            toast.error("Failed to save CV");
        }
    });

    // Save version
    const handleSaveVersion = async () => {
        const label = prompt("Version label (optional):");
        if (label === null) return; // Cancelled
        try {
            await fetch(`/api/cv/${id}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label: label || undefined }),
            });
            toast.success("Version saved!");
        } catch {
            toast.error("Failed to save version");
        }
    };

    // Download PDF — client-side generation using @react-pdf/renderer in browser
    const handleDownload = async () => {
        setDownloading(true);
        try {
            const values = form.getValues();
            const fullData: CvDraftFull = {
                ...values,
                id,
                userId: "",
                templateId: draft?.templateId ?? "",
                downloadCount: draft?.downloadCount ?? 0,
                shareSlug: draft?.shareSlug,
                isPublic: draft?.isPublic ?? false,
                createdAt: draft?.createdAt ?? "",
                updatedAt: draft?.updatedAt ?? "",
                template: draft?.template,
            };
            // Dynamic import so the library is only loaded on button click (avoids SSR)
            const { generateCvPdf } = await import("@/lib/cv/pdf/generatePdf");
            await generateCvPdf(fullData);
            await fetch(`/api/cv/${id}/download`, { method: "POST" }).catch(() => {});
        } catch (err) {
            console.error("[PDF client]", err);
            toast.error("Failed to generate PDF");
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadDocx = async () => {
        setDownloadingDocx(true);
        try {
            await handleManualSave();
            const response = await fetch(`/api/cv/${id}/docx`);
            if (!response.ok) throw new Error("Failed to generate Word file");
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${watchedValues.fullName || "CV"}_CV.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            await fetch(`/api/cv/${id}/download`, { method: "POST" }).catch(() => {});
        } catch (err) {
            console.error("[Word download error]", err);
            toast.error("Failed to download Word file");
        } finally {
            setDownloadingDocx(false);
        }
    };

    // Profile photo upload
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImage(file, { maxSizeMB: 1.0, maxWidthOrHeight: 1200, useWebWorker: true });
            const reader = new FileReader();
            reader.onload = () => {
                const src = reader.result as string;
                setRawImageSrc(src);
                setShowAdjustModal(true);
            };
            reader.readAsDataURL(compressed);
        } catch {
            toast.error("Failed to process image");
        }
    };

    // Drag-and-drop section reorder
    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;

        // Work on only the visible (main-column) portion of sectionOrder
        const fullOrder = [...(form.getValues("sectionOrder") ?? [])];
        const sidebarKeys = ["skills", "languages", "hobbies"];
        const mainKeys = fullOrder.filter(k => MAIN_SECTION_KEYS.includes(k as typeof MAIN_SECTION_KEYS[number]));
        const sidebarRemainder = fullOrder.filter(k => sidebarKeys.includes(k));

        // Reorder the visible list
        const [moved] = mainKeys.splice(result.source.index, 1);
        mainKeys.splice(result.destination.index, 0, moved);

        // Reconstruct full order: main keys + sidebar keys appended at end
        form.setValue("sectionOrder", [...mainKeys, ...sidebarRemainder], { shouldDirty: true, shouldValidate: false });
    };

    // Restore from version
    const handleRestored = (restored: CvFormData) => {
        form.reset(restored);
        setSaveStatus("unsaved");
    };

    const toggleSection = (key: string, checked: boolean) => {
        const current = form.getValues("visibleSections") || [
            'careerObjective', 'workExperience', 'training', 'education', 'references', 'skills', 'languages', 'hobbies', 'personalInfo', 'declaration'
        ];
        let next;
        if (checked) {
            next = [...current];
            if (!next.includes(key)) next.push(key);
        } else {
            next = current.filter(k => k !== key);
        }
        form.setValue("visibleSections", next, { shouldDirty: true });
    };

    // useWatch is more reliably reactive than form.watch() for DnD updates
    // Must be declared before any conditional return to satisfy Rules of Hooks
    const sectionOrder = useWatch({ control: form.control, name: "sectionOrder" }) ?? [];
    const watchedValues = { ...form.watch(), sectionOrder };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]" />
            </div>
        );
    }

    return (
        <div className="max-w-screen-xl mx-auto pb-4 sm:pb-12">
            {/* Top toolbar */}
            <div className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm mb-4 sm:mb-6 rounded-xl overflow-hidden">
                <div className="flex items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2 sm:py-3 flex-wrap">
                    {/* Editable title */}
                    <input
                        {...form.register("title")}
                        className="flex-1 min-w-0 font-bold text-gray-900 bg-transparent outline-none border-b-2 border-transparent focus:border-[#059669] py-1 text-sm"
                        placeholder="CV Title"
                    />

                    {/* Save status */}
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${
                        saveStatus === "saved" ? "bg-green-50 text-green-600" :
                        saveStatus === "saving" ? "bg-yellow-50 text-yellow-600 animate-pulse" :
                        "bg-red-50 text-red-600"
                    }`}>
                        {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Unsaved"}
                    </span>

                    <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-shrink-0 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 [&>*]:shrink-0 [scrollbar-width:none]">
                        {/* Mobile tab toggle */}
                        <div className="flex lg:hidden bg-gray-100 rounded-lg p-0.5">
                            <button onClick={() => setActiveTab("form")} className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded-md ${activeTab === "form" ? "bg-white shadow-sm" : "text-gray-500"}`}>Edit</button>
                            <button onClick={() => setActiveTab("preview")} className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded-md ${activeTab === "preview" ? "bg-white shadow-sm" : "text-gray-500"}`}>Preview</button>
                        </div>

                        <button onClick={handleSaveVersion} className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200">
                            Save Version
                        </button>
                        <button onClick={() => setShowVersions(true)} className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200">
                            History
                        </button>
                        <button onClick={() => handleManualSave()} className="px-3 py-2 bg-[#059669] text-white text-xs font-bold rounded-xl hover:bg-[#047857]">
                            Save
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="px-3 py-2 bg-[#1e3a5f] text-white text-xs font-bold rounded-xl hover:bg-[#152d4a] disabled:opacity-50 flex items-center gap-1"
                        >
                            {downloading ? (
                                <><span className="animate-spin rounded-full h-3 w-3 border-b border-white inline-block" /> Generating...</>
                            ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> PDF</>
                            )}
                        </button>
                        <button
                            onClick={handleDownloadDocx}
                            disabled={downloadingDocx}
                            className="px-3 py-2 bg-[#059669] text-white text-xs font-bold rounded-xl hover:bg-[#047857] disabled:opacity-50 flex items-center gap-1"
                        >
                            {downloadingDocx ? (
                                <><span className="animate-spin rounded-full h-3 w-3 border-b border-white inline-block" /> Generating...</>
                            ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Word</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Two-panel layout */}
            <div className="flex gap-6">
                {/* Form panel */}
                <div className={`w-full lg:w-1/2 space-y-4 ${activeTab === "preview" ? "hidden lg:block" : ""}`}>
                    {/* Personal Info */}
                    <CollapsibleSection title="Personal Information" defaultOpen>
                        <div>
                            <FieldLabel label="Full Name" cur={watchedValues.fullName?.length ?? 0} max={LIM.fullName} />
                            <input {...form.register("fullName")} maxLength={LIM.fullName} className={inputCls()} placeholder="Your full name" />
                        </div>
                        <div>
                            <label className={labelCls()}>Profile Photo</label>
                            <div className="flex flex-wrap items-center gap-3">
                                {watchedValues.profilePhoto && (
                                    <div className="relative group w-14 h-14 shrink-0 rounded-full overflow-hidden border-2 border-gray-200 cursor-pointer">
                                        <img src={watchedValues.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                        <div 
                                            onClick={() => {
                                                setRawImageSrc(watchedValues.profilePhoto || "");
                                                setShowAdjustModal(true);
                                            }}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 flex flex-col items-center justify-center transition-all text-white text-[9px] font-bold"
                                        >
                                            <svg className="w-3.5 h-3.5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                            </svg>
                                            Adjust
                                        </div>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="min-w-0 max-w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#d1fae5] file:text-[#065f46] file:font-bold hover:file:bg-[#a7f3d0]" />
                                {watchedValues.profilePhoto && (
                                    <button type="button" onClick={() => form.setValue("profilePhoto", "")} className="text-xs text-red-500 hover:underline">Remove</button>
                                )}
                            </div>
                        </div>
                        <div className="border-t border-gray-100 pt-3 mt-3">
                            <div className="flex items-center justify-between mb-1">
                                <FieldLabel label="Career Objective" cur={watchedValues.careerObjective?.length ?? 0} max={LIM.careerObjective} />
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={watchedValues.visibleSections?.includes('careerObjective') ?? true}
                                        onChange={(e) => toggleSection('careerObjective', e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    Show in CV
                                </label>
                            </div>
                            <textarea
                                {...form.register("careerObjective")}
                                maxLength={LIM.careerObjective}
                                disabled={!(watchedValues.visibleSections?.includes('careerObjective') ?? true)}
                                className={inputCls("min-h-[80px] resize-y" + (!(watchedValues.visibleSections?.includes('careerObjective') ?? true) ? " opacity-50" : ""))}
                                rows={3}
                                placeholder="Brief professional summary..."
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Contact */}
                    <CollapsibleSection title="Contact Information">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls()}>Phone (BD)</label>
                                <input {...form.register("phone")} className={inputCls()} placeholder="01XXXXXXXXX" />
                                {form.formState.errors.phone && <p className="text-red-500 text-xs mt-1">{form.formState.errors.phone.message}</p>}
                            </div>
                            <div>
                                <label className={labelCls()}>Email</label>
                                <input {...form.register("email")} type="email" className={inputCls()} placeholder="you@email.com" />
                            </div>
                        </div>
                        <div>
                            <FieldLabel label="Address" cur={watchedValues.address?.length ?? 0} max={LIM.address} />
                            <input {...form.register("address")} maxLength={LIM.address} className={inputCls()} placeholder="City, Country" />
                        </div>
                        <div>
                            <label className={labelCls()}>LinkedIn URL / Username</label>
                            <input {...form.register("linkedin")} className={inputCls()} placeholder="e.g. linkedin.com/in/username or username" />
                        </div>
                    </CollapsibleSection>

                    {/* Personal Information */}
                    <CollapsibleSection title="Personal Information">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-personalInfo"
                                checked={watchedValues.visibleSections?.includes('personalInfo') ?? true}
                                onChange={(e) => toggleSection('personalInfo', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-personalInfo" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 ${!(watchedValues.visibleSections?.includes('personalInfo') ?? true) ? "opacity-50 pointer-events-none" : ""}`}>
                            <div>
                                <label className={labelCls()}>Date of Birth</label>
                                <input type="date" {...form.register("dateOfBirth")} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('personalInfo') ?? true)} />
                            </div>
                            <div>
                                <label className={labelCls()}>Blood Group</label>
                                <select {...form.register("bloodGroup")} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('personalInfo') ?? true)}>
                                    <option value="">Select</option>
                                    {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls()}>Marital Status</label>
                                <select {...form.register("maritalStatus")} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('personalInfo') ?? true)}>
                                    <option value="">Select</option>
                                    {MARITAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls()}>Religion</label>
                                <select {...form.register("religion")} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('personalInfo') ?? true)}>
                                    <option value="">Select</option>
                                    {RELIGIONS.map((r) => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="col-span-full">
                                <label className={labelCls()}>Nationality</label>
                                <select {...form.register("nationality")} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('personalInfo') ?? true)}>
                                    <option value="">Select</option>
                                    {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* Skills */}
                    <CollapsibleSection title={`Skills (max ${LIM.maxSkills})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-skills"
                                checked={watchedValues.visibleSections?.includes('skills') ?? true}
                                onChange={(e) => toggleSection('skills', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-skills" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('skills') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            <Controller
                                control={form.control}
                                name="skills"
                                render={({ field }) => (
                                    <TagInput value={field.value} onChange={field.onChange} placeholder="Add a skill (e.g. Excel, Photoshop)" maxLen={LIM.skill} maxItems={LIM.maxSkills} />
                                )}
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Languages */}
                    <CollapsibleSection title={`Languages (max ${LIM.maxLanguages})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-languages"
                                checked={watchedValues.visibleSections?.includes('languages') ?? true}
                                onChange={(e) => toggleSection('languages', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-languages" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('languages') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            {langFields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl mb-3">
                                    <div>
                                        <label className={labelCls()}>Language</label>
                                        <input {...form.register(`languages.${index}.name`)} maxLength={30} className={inputCls()} placeholder="e.g. English" disabled={!(watchedValues.visibleSections?.includes('languages') ?? true)} />
                                    </div>
                                    <div>
                                        <label className={labelCls()}>Level</label>
                                        <select {...form.register(`languages.${index}.level`)} className={inputCls()} disabled={!(watchedValues.visibleSections?.includes('languages') ?? true)}>
                                            <option value="">Select</option>
                                            {LANGUAGE_PROFICIENCY_LEVELS.map((l) => <option key={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <button type="button" onClick={() => removeLang(index)} className="col-span-full text-xs text-red-500 hover:underline text-right" disabled={!(watchedValues.visibleSections?.includes('languages') ?? true)}>Remove</button>
                                </div>
                            ))}
                            {langFields.length < LIM.maxLanguages ? (
                                <button type="button" onClick={() => appendLang({ name: "", level: "" })} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-[#059669] hover:text-[#059669]" disabled={!(watchedValues.visibleSections?.includes('languages') ?? true)}>
                                    + Add Language
                                </button>
                            ) : <p className="text-xs text-amber-600">Max {LIM.maxLanguages} languages reached.</p>}
                        </div>
                    </CollapsibleSection>

                    {/* Hobbies */}
                    <CollapsibleSection title={`Hobbies & Interests (max ${LIM.maxHobbies})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-hobbies"
                                checked={watchedValues.visibleSections?.includes('hobbies') ?? true}
                                onChange={(e) => toggleSection('hobbies', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-hobbies" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('hobbies') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            <Controller
                                control={form.control}
                                name="hobbies"
                                render={({ field }) => (
                                    <TagInput value={field.value} onChange={field.onChange} placeholder="Add a hobby (e.g. Reading, Photography)" maxLen={LIM.hobby} maxItems={LIM.maxHobbies} />
                                )}
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Work Experience */}
                    <CollapsibleSection title={`Work Experience (max ${LIM.weEntries})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-workExperience"
                                checked={watchedValues.visibleSections?.includes('workExperience') ?? true}
                                onChange={(e) => toggleSection('workExperience', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-workExperience" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('workExperience') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            {weFields.map((field, index) => (
                                <div key={field.id} className="p-4 bg-gray-50 rounded-xl space-y-3 mb-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">Entry {index + 1}</span>
                                        <button type="button" onClick={() => removeWe(index)} className="text-xs text-red-500 hover:underline" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)}>Remove</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        <div>
                                            <FieldLabel label="Job Title" cur={watchedValues.workExperience?.[index]?.jobTitle?.length ?? 0} max={LIM.jobTitle} />
                                            <input {...form.register(`workExperience.${index}.jobTitle`)} maxLength={LIM.jobTitle} className={inputCls()} placeholder="Sales Manager" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Company" cur={watchedValues.workExperience?.[index]?.company?.length ?? 0} max={LIM.company} />
                                            <input {...form.register(`workExperience.${index}.company`)} maxLength={LIM.company} className={inputCls()} placeholder="Company Name" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Location" cur={watchedValues.workExperience?.[index]?.location?.length ?? 0} max={LIM.location} />
                                            <input {...form.register(`workExperience.${index}.location`)} maxLength={LIM.location} className={inputCls()} placeholder="Dhaka, BD" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>Start Date</label>
                                            <input {...form.register(`workExperience.${index}.startDate`)} maxLength={20} className={inputCls()} placeholder="Jan 2022" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>End Date</label>
                                            <input {...form.register(`workExperience.${index}.endDate`)} maxLength={20} className={inputCls()} placeholder="Present" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-semibold text-gray-700">Bullet Points (one per line)</span>
                                            <span className="text-xs text-gray-400">max {LIM.bulletsPerEntry} lines · {LIM.bullet} chars each</span>
                                        </div>
                                        <Controller
                                            control={form.control}
                                            name={`workExperience.${index}.bullets`}
                                            render={({ field }) => {
                                                const limited = field.value.slice(0, LIM.bulletsPerEntry).map(b => b.slice(0, LIM.bullet));
                                                return (
                                                    <textarea
                                                        className={inputCls("min-h-[70px] resize-none")}
                                                        placeholder="Achieved 150% of sales target&#10;Managed a team of 5 people"
                                                        value={limited.join("\n")}
                                                        rows={LIM.bulletsPerEntry}
                                                        disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)}
                                                        onChange={(e) => {
                                                            const lines = e.target.value.split("\n").slice(0, LIM.bulletsPerEntry).map(l => l.slice(0, LIM.bullet));
                                                            field.onChange(lines);
                                                        }}
                                                    />
                                                );
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {weFields.length < LIM.weEntries ? (
                                <button type="button" onClick={() => appendWe({ jobTitle: "", company: "", location: "", startDate: "", endDate: "", bullets: [] })} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-[#059669] hover:text-[#059669]" disabled={!(watchedValues.visibleSections?.includes('workExperience') ?? true)}>
                                    + Add Work Experience
                                </button>
                            ) : <p className="text-xs text-amber-600">Max {LIM.weEntries} entries reached.</p>}
                        </div>
                    </CollapsibleSection>

                    {/* Training */}
                    <CollapsibleSection title={`Training (max ${LIM.trainingEntries})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-training"
                                checked={watchedValues.visibleSections?.includes('training') ?? true}
                                onChange={(e) => toggleSection('training', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-training" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('training') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            {trainingFields.map((field, index) => (
                                <div key={field.id} className="p-4 bg-gray-50 rounded-xl space-y-3 mb-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">Entry {index + 1}</span>
                                        <button type="button" onClick={() => removeTraining(index)} className="text-xs text-red-500 hover:underline" disabled={!(watchedValues.visibleSections?.includes('training') ?? true)}>Remove</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        <div>
                                            <FieldLabel label="Training Name" cur={watchedValues.training?.[index]?.trainingName?.length ?? 0} max={LIM.trainingName} />
                                            <input {...form.register(`training.${index}.trainingName`)} maxLength={LIM.trainingName} className={inputCls()} placeholder="Digital Marketing" disabled={!(watchedValues.visibleSections?.includes('training') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Institute" cur={watchedValues.training?.[index]?.institute?.length ?? 0} max={LIM.institute} />
                                            <input {...form.register(`training.${index}.institute`)} maxLength={LIM.institute} className={inputCls()} placeholder="Institute Name" disabled={!(watchedValues.visibleSections?.includes('training') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>Year</label>
                                            <input {...form.register(`training.${index}.year`)} maxLength={4} className={inputCls()} placeholder="2023" disabled={!(watchedValues.visibleSections?.includes('training') ?? true)} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-semibold text-gray-700">Bullet Points (one per line)</span>
                                            <span className="text-xs text-gray-400">max {LIM.bulletsPerEntry} lines · {LIM.bullet} chars each</span>
                                        </div>
                                        <Controller
                                            control={form.control}
                                            name={`training.${index}.bullets`}
                                            render={({ field }) => {
                                                const limited = field.value.slice(0, LIM.bulletsPerEntry).map(b => b.slice(0, LIM.bullet));
                                                return (
                                                    <textarea
                                                        className={inputCls("resize-none")}
                                                        placeholder="Learned Google Ads&#10;Completed certification"
                                                        value={limited.join("\n")}
                                                        rows={LIM.bulletsPerEntry}
                                                        disabled={!(watchedValues.visibleSections?.includes('training') ?? true)}
                                                        onChange={(e) => {
                                                            const lines = e.target.value.split("\n").slice(0, LIM.bulletsPerEntry).map(l => l.slice(0, LIM.bullet));
                                                            field.onChange(lines);
                                                        }}
                                                    />
                                                );
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {trainingFields.length < LIM.trainingEntries ? (
                                <button type="button" onClick={() => appendTraining({ trainingName: "", institute: "", year: "", bullets: [] })} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-[#059669] hover:text-[#059669]" disabled={!(watchedValues.visibleSections?.includes('training') ?? true)}>
                                    + Add Training
                                </button>
                            ) : <p className="text-xs text-amber-600">Max {LIM.trainingEntries} entries reached.</p>}
                        </div>
                    </CollapsibleSection>

                    {/* Education */}
                    <CollapsibleSection title={`Education (max ${LIM.eduEntries})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-education"
                                checked={watchedValues.visibleSections?.includes('education') ?? true}
                                onChange={(e) => toggleSection('education', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-education" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('education') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            {eduFields.map((field, index) => (
                                <div key={field.id} className="p-4 bg-gray-50 rounded-xl space-y-3 mb-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">Entry {index + 1}</span>
                                        <button type="button" onClick={() => removeEdu(index)} className="text-xs text-red-500 hover:underline" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)}>Remove</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        <div>
                                            <FieldLabel label="Degree" cur={watchedValues.education?.[index]?.degree?.length ?? 0} max={LIM.degree} />
                                            <input {...form.register(`education.${index}.degree`)} maxLength={LIM.degree} className={inputCls()} placeholder="BBA, BSc in CS" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Department" cur={watchedValues.education?.[index]?.department?.length ?? 0} max={LIM.department} />
                                            <input {...form.register(`education.${index}.department`)} maxLength={LIM.department} className={inputCls()} placeholder="Marketing" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)} />
                                        </div>
                                        <div className="col-span-full">
                                            <FieldLabel label="Institution" cur={watchedValues.education?.[index]?.institution?.length ?? 0} max={LIM.institution} />
                                            <input {...form.register(`education.${index}.institution`)} maxLength={LIM.institution} className={inputCls()} placeholder="University Name" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>GPA</label>
                                            <input {...form.register(`education.${index}.gpa`)} maxLength={5} className={inputCls()} placeholder="3.80" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>Year</label>
                                            <input {...form.register(`education.${index}.year`)} maxLength={4} className={inputCls()} placeholder="2022" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {eduFields.length < LIM.eduEntries ? (
                                <button type="button" onClick={() => appendEdu({ degree: "", department: "", institution: "", gpa: "", year: "" })} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-[#059669] hover:text-[#059669]" disabled={!(watchedValues.visibleSections?.includes('education') ?? true)}>
                                    + Add Education
                                </button>
                            ) : <p className="text-xs text-amber-600">Max {LIM.eduEntries} entries reached.</p>}
                        </div>
                    </CollapsibleSection>

                    {/* References */}
                    <CollapsibleSection title={`References (max ${LIM.refEntries})`}>
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-references"
                                checked={watchedValues.visibleSections?.includes('references') ?? true}
                                onChange={(e) => toggleSection('references', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-references" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={!(watchedValues.visibleSections?.includes('references') ?? true) ? "opacity-50 pointer-events-none" : ""}>
                            {refFields.map((field, index) => (
                                <div key={field.id} className="p-4 bg-gray-50 rounded-xl space-y-3 mb-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">Ref {index + 1}</span>
                                        <button type="button" onClick={() => removeRef(index)} className="text-xs text-red-500 hover:underline" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)}>Remove</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        <div>
                                            <FieldLabel label="Name" cur={watchedValues.references?.[index]?.name?.length ?? 0} max={LIM.refName} />
                                            <input {...form.register(`references.${index}.name`)} maxLength={LIM.refName} className={inputCls()} placeholder="Dr. John Doe" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Title / Designation" cur={watchedValues.references?.[index]?.title?.length ?? 0} max={LIM.refTitle} />
                                            <input {...form.register(`references.${index}.title`)} maxLength={LIM.refTitle} className={inputCls()} placeholder="Professor" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)} />
                                        </div>
                                        <div>
                                            <FieldLabel label="Organization" cur={watchedValues.references?.[index]?.organization?.length ?? 0} max={LIM.refOrg} />
                                            <input {...form.register(`references.${index}.organization`)} maxLength={LIM.refOrg} className={inputCls()} placeholder="University Name" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>Phone</label>
                                            <input {...form.register(`references.${index}.phone`)} maxLength={15} className={inputCls()} placeholder="01XXXXXXXXX" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)} />
                                        </div>
                                        <div>
                                            <label className={labelCls()}>Email</label>
                                            <input {...form.register(`references.${index}.email`)} maxLength={60} className={inputCls()} placeholder="ref@email.com" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {refFields.length < LIM.refEntries ? (
                                <button type="button" onClick={() => appendRef({ name: "", phone: "", email: "", title: "", organization: "" })} className="w-full py-2 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-[#059669] hover:text-[#059669]" disabled={!(watchedValues.visibleSections?.includes('references') ?? true)}>
                                    + Add Reference
                                </button>
                            ) : <p className="text-xs text-amber-600">Max {LIM.refEntries} references reached.</p>}
                        </div>
                    </CollapsibleSection>

                    {/* Declaration & Signature */}
                    <CollapsibleSection title="Declaration & Signature">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2">
                            <input
                                type="checkbox"
                                id="toggle-declaration"
                                checked={watchedValues.visibleSections?.includes('declaration') ?? true}
                                onChange={(e) => toggleSection('declaration', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 cursor-pointer"
                            />
                            <label htmlFor="toggle-declaration" className="text-xs font-bold text-gray-700 cursor-pointer select-none">Include this section in CV</label>
                        </div>
                        <div className={`space-y-4 ${!(watchedValues.visibleSections?.includes('declaration') ?? true) ? "opacity-50 pointer-events-none" : ""}`}>
                            <div>
                                <FieldLabel label="Declaration" cur={watchedValues.declaration?.length ?? 0} max={LIM.declaration} />
                                <textarea {...form.register("declaration")} maxLength={LIM.declaration} className={inputCls("min-h-[70px] resize-none")} rows={3} placeholder="I hereby declare that the information provided above is true and accurate to the best of my knowledge." disabled={!(watchedValues.visibleSections?.includes('declaration') ?? true)} />
                            </div>
                            <div>
                                <FieldLabel label="Signature (name or text)" cur={watchedValues.signature?.length ?? 0} max={LIM.signature} />
                                <input {...form.register("signature")} maxLength={LIM.signature} className={inputCls()} placeholder="Your name" disabled={!(watchedValues.visibleSections?.includes('declaration') ?? true)} />
                            </div>
                        </div>
                    </CollapsibleSection>

                    {/* Section Reorder */}
                    <CollapsibleSection title="Section Order (Drag to Reorder)">
                        <p className="text-xs text-gray-500 mb-3">
                            Drag to reorder main column sections. Skills, Languages, Hobbies are always in the sidebar.
                        </p>
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="sections">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {/* Only show main-column sections in DnD */}
                                        {[...sectionOrder]
                                            .filter(k => MAIN_SECTION_KEYS.includes(k as typeof MAIN_SECTION_KEYS[number]))
                                            .map((key, index) => (
                                            <Draggable key={key} draggableId={key} index={index}>
                                                {(drag, snapshot) => (
                                                    <div
                                                        ref={drag.innerRef}
                                                        {...drag.draggableProps}
                                                        {...drag.dragHandleProps}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border select-none transition-all ${snapshot.isDragging ? "bg-emerald-50 border-[#059669] shadow-lg" : "bg-white border-gray-200 hover:border-gray-300"}`}
                                                    >
                                                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                        </svg>
                                                        <span className="text-sm font-semibold text-gray-700">{SECTION_LABELS[key] ?? key}</span>
                                                        <span className="ml-auto text-xs text-gray-300">#{index + 1}</span>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </CollapsibleSection>
                </div>

                {/* Preview panel — A4 proportioned */}
                <div className={`w-full lg:w-1/2 ${activeTab === "form" ? "hidden lg:block" : ""}`}>
                    <div className="sticky top-32">
                        <h3 className="font-bold text-gray-600 text-xs uppercase tracking-widest mb-3">Live Preview (A4)</h3>
                        {/* A4 ratio: 210mm × 297mm = 1 : 1.4142 */}
                        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <A4ScaledPreview data={watchedValues} config={config} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Version History Modal */}
            {showVersions && (
                <VersionHistoryModal
                    draftId={id}
                    onClose={() => setShowVersions(false)}
                    onRestore={handleRestored}
                />
            )}

            {/* Photo Adjust Modal */}
            {showAdjustModal && rawImageSrc && (
                <AdjustModal
                    imageSrc={rawImageSrc}
                    shape={config.photoShape || "circle"}
                    onClose={() => setShowAdjustModal(false)}
                    onSave={(croppedBase64) => {
                        form.setValue("profilePhoto", croppedBase64, { shouldDirty: true });
                        setShowAdjustModal(false);
                    }}
                />
            )}
        </div>
    );
}

// ─── Photo Adjustment Modal (Cropping, Zooming & Panning) ─────────────────────

interface AdjustModalProps {
    imageSrc: string;
    shape: string;
    onClose: () => void;
    onSave: (croppedBase64: string) => void;
}

function AdjustModal({ imageSrc, shape, onClose, onSave }: AdjustModalProps) {
    const [zoom, setZoom] = useState(1.0);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const natW = img.naturalWidth || 400;
        const natH = img.naturalHeight || 400;

        // Cutout size is 200px. Center of parent container (280px) is at 140px.
        const scaleToCover = Math.max(200 / natW, 200 / natH);
        const baseW = natW * scaleToCover;
        const baseH = natH * scaleToCover;

        setDimensions({ width: baseW, height: baseH });
        setOffset({
            x: 140 - baseW / 2,
            y: 140 - baseH / 2
        });
        setZoom(1.0);
    };

    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    // Touch handlers for mobile support
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setOffset({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const handleApply = () => {
        // Create canvas of size 400x400 for high resolution print
        const canvas = document.createElement("canvas");
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // Cutout top-left is at (40, 40) inside 280x280 container.
            // Relativize the image offset to the cutout's top-left:
            const relX = offset.x - 40;
            const relY = offset.y - 40;

            // Multiply everything by 2 because canvas is 400x400 (cutout is 200x200)
            const drawX = relX * 2;
            const drawY = relY * 2;
            const drawW = dimensions.width * zoom * 2;
            const drawH = dimensions.height * zoom * 2;

            // Clear canvas
            ctx.clearRect(0, 0, 400, 400);
            
            // Draw image to canvas
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            
            const base64 = canvas.toDataURL("image/jpeg", 0.9);
            onSave(base64);
        };
        img.src = imageSrc;
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[100dvh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm">প্রোফাইল ছবি এডজাস্ট করুন</h3>
                    <button onClick={onClose} aria-label="Close" className="p-2 -m-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-3 sm:p-6 flex flex-col items-center gap-4 sm:gap-6">
                    {/* View Box Container */}
                    <div 
                        className="relative shrink-0 w-[280px] h-[280px] bg-gray-100 border border-gray-200 rounded-2xl overflow-hidden cursor-move select-none touch-none shadow-inner"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleDragEnd}
                    >
                        {/* Cropped Image */}
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Adjusting"
                            draggable={false}
                            onLoad={handleImageLoad}
                            style={{
                                position: "absolute",
                                left: `${offset.x}px`,
                                top: `${offset.y}px`,
                                width: `${dimensions.width * zoom}px`,
                                height: `${dimensions.height * zoom}px`,
                                maxWidth: "none",
                            }}
                        />

                        {/* Visual overlay mask with centered cutout window */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                            <div 
                                className={`w-[200px] h-[200px] bg-transparent pointer-events-none transition-all duration-300 ${
                                    shape === "circle" ? "rounded-full" : "rounded-2xl"
                                }`} 
                                style={{
                                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)"
                                }}
                            />
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="w-full space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                            <span>Zoom: {Math.round(zoom * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="1.0"
                            max="3.0"
                            step="0.05"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#059669]"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-3 sm:py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        বাতিল
                    </button>
                    <button 
                        onClick={handleApply}
                        className="px-5 py-3 sm:py-2 bg-[#059669] text-white text-xs font-bold rounded-xl hover:bg-[#047857] shadow-sm shadow-green-200 transition-colors"
                    >
                        সম্পন্ন করুন
                    </button>
                </div>
            </div>
        </div>
    );
}
