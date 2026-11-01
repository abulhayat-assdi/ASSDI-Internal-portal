"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    ModuleFolder,
    ResourceTeacher,
    getResourceTeachers,
    getRootFoldersByTeacher,
    getSubFolders,
} from "@/services/moduleFolderService";
import {
    ModuleResource,
    getTeacherRootFiles,
    getModuleResourcesByFolder,
} from "@/services/moduleResourceService";

// ─── Icons ──────────────────────────────────────────────────────────────────
const FolderIcon = () => (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25m19.5 0v5.25a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 19.5V6" />
    </svg>
);
const FolderOpenIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    </svg>
);
const DownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);
const EyeIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);
const ChevronRightIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);
const BackIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────
const fileTypeIcon = (ft: string) => {
    if (ft === "pdf") return "📄";
    if (["pptx", "ppt"].includes(ft)) return "📊";
    if (["docx", "doc"].includes(ft)) return "📃";
    if (ft === "image") return "🖼️";
    return "📎";
};
const resourceTypeIcon: Record<string, string> = {
    Presentation: "📊", Notes: "📝", Assignment: "📋", Practice: "🎯", Other: "📎",
};

// ─── View state ────────────────────────────────────────────────────────────
type View =
    | { level: "teachers" }
    | { level: "folders"; teacher: ResourceTeacher }
    | { level: "folder-content"; teacher: ResourceTeacher; folder: ModuleFolder; breadcrumb: ModuleFolder[] };

// ═══════════════════════════════════════════════════════════════════════════
export default function StudentResourcePage() {
    const { userProfile } = useAuth();
    const studentBatch = userProfile?.studentBatchName || "";

    const [view, setView]             = useState<View>({ level: "teachers" });
    const [teachers, setTeachers]     = useState<ResourceTeacher[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);

    // Level 2: teacher's root folders + root files
    const [rootFolders, setRootFolders] = useState<ModuleFolder[]>([]);
    const [rootFiles,   setRootFiles]   = useState<ModuleResource[]>([]);
    const [lvl2Loading, setLvl2Loading] = useState(false);

    // Level 3+: folder contents (sub-folders + files)
    const [subFolders,    setSubFolders]    = useState<ModuleFolder[]>([]);
    const [folderFiles,   setFolderFiles]   = useState<ModuleResource[]>([]);
    const [lvl3Loading,   setLvl3Loading]   = useState(false);

    // ── Batch visibility helper ────────────────────────────────────────────
    const visibleForMe = useCallback((batches: string[]) => {
        if (batches.includes("all")) return true;
        return studentBatch !== "" && batches.includes(studentBatch);
    }, [studentBatch]);

    // ── Load teachers ──────────────────────────────────────────────────────
    useEffect(() => {
        getResourceTeachers()
            .then(setTeachers)
            .finally(() => setTeachersLoading(false));
    }, []);

    // ── Open teacher → show their root folders + root files ───────────────
    const [lvl2Error, setLvl2Error] = useState(false);

    const openTeacher = useCallback(async (teacher: ResourceTeacher) => {
        setView({ level: "folders", teacher });
        setLvl2Loading(true);
        setLvl2Error(false);
        try {
            const [folders, files] = await Promise.all([
                getRootFoldersByTeacher(teacher.teacherUid),
                getTeacherRootFiles(teacher.teacherUid),
            ]);
            setRootFolders(folders.filter(f => !f.isHidden && visibleForMe(f.visibleForBatches)));
            setRootFiles(files.filter(f => !f.isHidden && visibleForMe(f.visibleForBatches)));
        } catch {
            setLvl2Error(true);
        } finally {
            setLvl2Loading(false);
        }
    }, [visibleForMe]);

    // ── Open folder → show sub-folders + files ────────────────────────────
    const openFolder = useCallback(async (folder: ModuleFolder, teacher: ResourceTeacher, breadcrumb: ModuleFolder[]) => {
        setView({ level: "folder-content", teacher, folder, breadcrumb: [...breadcrumb, folder] });
        setLvl3Loading(true);
        try {
            const [subs, files] = await Promise.all([
                getSubFolders(folder.id),
                getModuleResourcesByFolder(folder.id),
            ]);
            setSubFolders(subs.filter(f => !f.isHidden && visibleForMe(f.visibleForBatches)));
            setFolderFiles(files.filter(f => !f.isHidden && visibleForMe(f.visibleForBatches)));
        } finally {
            setLvl3Loading(false);
        }
    }, [visibleForMe]);

    // ── File card ─────────────────────────────────────────────────────────
    const renderFileCard = (res: ModuleResource) => (
        <div key={res.id} className="border border-gray-100 hover:border-emerald-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all flex flex-col bg-white group">
            <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl flex-shrink-0">{fileTypeIcon(res.fileType)}</span>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 group-hover:text-[#059669] transition-colors leading-tight text-sm">{res.title}</h4>
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                        {resourceTypeIcon[res.resourceType] || "📎"} {res.resourceType}
                    </span>
                </div>
            </div>
            {res.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{res.description}</p>}
            <p className="text-xs text-gray-400 mb-4">{res.fileSize}</p>
            <div className="pt-3 border-t border-gray-50 flex gap-2 mt-auto">
                <a href={res.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-[#059669] bg-emerald-50 hover:bg-[#059669] hover:text-white rounded-lg transition-colors">
                    <EyeIcon /> View
                </a>
                <a href={res.fileUrl} download target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-lg transition-colors">
                    <DownloadIcon /> Download
                </a>
            </div>
        </div>
    );

    // ── Folder card ───────────────────────────────────────────────────────
    const renderFolderCard = (folder: ModuleFolder, teacher: ResourceTeacher, breadcrumb: ModuleFolder[]) => (
        <div key={folder.id}
            onClick={() => openFolder(folder, teacher, breadcrumb)}
            className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex items-center gap-3 sm:gap-4">
            <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl group-hover:scale-110 transition-transform shrink-0">
                <FolderIcon />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 group-hover:text-[#059669] transition-colors truncate">{folder.title}</h4>
                {folder.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{folder.description}</p>}
            </div>
            <ChevronRightIcon />
        </div>
    );

    // ── Breadcrumb ────────────────────────────────────────────────────────
    const renderBreadcrumb = () => {
        if (view.level === "teachers") return null;
        const teacher = view.teacher;
        return (
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 flex-wrap">
                <button onClick={() => setView({ level: "teachers" })} className="hover:text-[#059669] font-medium transition-colors">
                    Resources
                </button>
                <span>/</span>
                {view.level === "folders" ? (
                    <span className="text-gray-900 font-semibold">{teacher.teacherName}</span>
                ) : (
                    <>
                        <button onClick={() => openTeacher(teacher)} className="hover:text-[#059669] font-medium transition-colors">
                            {teacher.teacherName}
                        </button>
                        {view.breadcrumb.map((f, i) => (
                            <span key={f.id} className="flex items-center gap-1.5">
                                <span>/</span>
                                {i < view.breadcrumb.length - 1 ? (
                                    <button
                                        onClick={() => openFolder(f, teacher, view.breadcrumb.slice(0, i))}
                                        className="hover:text-[#059669] font-medium transition-colors"
                                    >
                                        {f.title}
                                    </button>
                                ) : (
                                    <span className="text-gray-900 font-semibold">{f.title}</span>
                                )}
                            </span>
                        ))}
                    </>
                )}
            </nav>
        );
    };

    // ── Back bar ──────────────────────────────────────────────────────────
    const renderBackBar = () => {
        if (view.level === "teachers") return null;
        const goBack = view.level === "folders"
            ? () => setView({ level: "teachers" })
            : view.breadcrumb.length > 1
                ? () => openFolder(view.breadcrumb[view.breadcrumb.length - 2], view.teacher, view.breadcrumb.slice(0, -2))
                : () => openTeacher(view.teacher);

        const backLabel = view.level === "folders"
            ? "Back to Teachers"
            : view.breadcrumb.length > 1
                ? `Back to ${view.breadcrumb[view.breadcrumb.length - 2].title}`
                : `Back to ${view.teacher.teacherName}`;

        return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
                <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 flex items-center gap-2 font-medium text-sm">
                    <BackIcon /> {backLabel}
                </button>
                <div className="h-6 w-px bg-gray-200" />
                <h2 className="text-base sm:text-lg font-bold text-[#059669] flex items-center gap-2 min-w-0 break-words">
                    <FolderOpenIcon />
                    {view.level === "folders" ? view.teacher.teacherName : view.folder.title}
                </h2>
            </div>
        );
    };

    // ── Loading ──────────────────────────────────────────────────────────
    const renderSpinner = (text: string) => (
        <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669] mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">{text}</p>
        </div>
    );

    const renderEmpty = (icon: string, title: string, sub: string) => (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">{icon}</div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-gray-500 mt-1 text-sm">{sub}</p>
        </div>
    );

    // ════════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-4 sm:pb-12">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full" />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#1f2937]">Course Resources</h1>
                        <p className="text-[#6b7280] mt-1 text-sm">টিচারের আপলোড করা লেকচার, প্রেজেন্টেশন ও অ্যাসাইনমেন্ট ডাউনলোড করুন।</p>
                    </div>
                </div>
                {view.level !== "teachers" && <div>{renderBreadcrumb()}</div>}
            </div>

            {renderBackBar()}

            {/* ── Level 1: Teachers ─────────────────────────────────────── */}
            {view.level === "teachers" && (
                teachersLoading
                    ? renderSpinner("Loading teachers...")
                    : teachers.length === 0
                        ? renderEmpty("👨‍🏫", "No resources yet", "Teachers haven't uploaded any materials yet. Check back later.")
                        : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                                {teachers.map(t => (
                                    <div key={t.teacherUid} onClick={() => openTeacher(t)}
                                        className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex items-center gap-4 sm:gap-5">
                                        {t.profileImageUrl
                                            ? <img src={t.profileImageUrl} alt={t.teacherName}
                                                className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-gray-100 group-hover:border-[#059669] transition-colors" />
                                            : (
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1e3a5f]/10 text-[#1e3a5f] flex items-center justify-center text-xl font-bold shrink-0">
                                                    {t.teacherName.charAt(0)}
                                                </div>
                                            )
                                        }
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-900 group-hover:text-[#059669] transition-colors">{t.teacherName}</h3>
                                            {t.designation && <p className="text-sm text-gray-500 mt-0.5 truncate">{t.designation}</p>}
                                        </div>
                                        <ChevronRightIcon />
                                    </div>
                                ))}
                            </div>
                        )
            )}

            {/* ── Level 2: Teacher's root folders + root files ────────────── */}
            {view.level === "folders" && (
                lvl2Loading
                    ? renderSpinner("Loading materials...")
                    : lvl2Error
                        ? renderEmpty("⚠️", "লোড হয়নি", "ফাইল লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।")
                    : rootFolders.length === 0 && rootFiles.length === 0
                        ? renderEmpty("📁", "No materials yet", `${view.teacher.teacherName} এখনো কোনো ফাইল আপলোড করেননি বা আপনার ব্যাচের জন্য কোনো কন্টেন্ট নেই।`)
                        : (
                            <div className="space-y-8">
                                {rootFolders.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Folders</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {rootFolders.map(f => renderFolderCard(f, view.teacher, []))}
                                        </div>
                                    </div>
                                )}
                                {rootFiles.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Files</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                            {rootFiles.map(renderFileCard)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
            )}

            {/* ── Level 3+: Folder contents ─────────────────────────────── */}
            {view.level === "folder-content" && (
                lvl3Loading
                    ? renderSpinner("Loading folder contents...")
                    : subFolders.length === 0 && folderFiles.length === 0
                        ? renderEmpty("📄", "Folder is empty", "এই ফোল্ডারে এখনো কোনো ফাইল নেই।")
                        : (
                            <div className="space-y-8">
                                {subFolders.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Sub-folders</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {subFolders.map(f => renderFolderCard(f, view.teacher, view.breadcrumb))}
                                        </div>
                                    </div>
                                )}
                                {folderFiles.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-1">Files</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                            {folderFiles.map(renderFileCard)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
            )}
        </div>
    );
}
