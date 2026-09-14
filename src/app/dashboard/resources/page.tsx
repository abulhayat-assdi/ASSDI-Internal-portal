"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useAuth } from "@/contexts/AuthContext";
import {
    ModuleResource, ResourceType,
    uploadModuleResourceFile, addModuleResource,
    getModuleResourcesByTeacher, getModuleResourcesByFolder,
    updateModuleResource, toggleModuleResourceVisibility, deleteModuleResource,
    getTeacherRootFiles,
} from "@/services/moduleResourceService";
import {
    ModuleFolder,
    getRootFoldersByTeacher, getSubFolders,
    addModuleFolder, updateModuleFolder,
    toggleModuleFolderVisibility, deleteModuleFolder,
} from "@/services/moduleFolderService";
import { getPublicUniqueBatches } from "@/services/batchInfoService";

// ─── Constants ─────────────────────────────────────────────────────────────
const RESOURCE_TYPES: ResourceType[] = ["Presentation", "Notes", "Assignment", "Practice", "Other"];
const resourceTypeIcon: Record<ResourceType, string> = {
    Presentation: "📊", Notes: "📝", Assignment: "📋", Practice: "🎯", Other: "📎",
};
const fileTypeIcon = (ft: string) => {
    if (ft === "pdf") return "📄";
    if (["pptx", "ppt"].includes(ft)) return "📊";
    if (["docx", "doc"].includes(ft)) return "📃";
    if (ft === "image") return "🖼️";
    return "📎";
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface FolderForm {
    title: string;
    description: string;
    visibleForBatches: string[];
    isHidden: boolean;
}
const defaultFolderForm = (): FolderForm => ({
    title: "", description: "", visibleForBatches: [], isHidden: false,
});

interface UploadForm {
    title: string;
    description: string;
    resourceType: ResourceType;
    visibleForBatches: string[];
    isHidden: boolean;
}
const defaultUploadForm = (): UploadForm => ({
    title: "", description: "", resourceType: "Presentation", visibleForBatches: [], isHidden: false,
});

// Each folder node carries its children (loaded lazily)
interface FolderNode extends ModuleFolder {
    subFolders: FolderNode[];
    files: ModuleResource[];
    loaded: boolean;
    expanded: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function ResourceManagementPage() {
    const confirm  = useConfirm();
    const { user, userProfile } = useAuth();

    const [rootFolders, setRootFolders]   = useState<FolderNode[]>([]);
    const [rootFiles,   setRootFiles]     = useState<ModuleResource[]>([]);
    const [batchNames,  setBatchNames]    = useState<string[]>([]);
    const [loading,     setLoading]       = useState(true);
    const [dbError,     setDbError]       = useState(false);

    // ── Folder modal ──────────────────────────────────────────────────────
    const [folderModal,     setFolderModal]     = useState(false);
    const [editingFolder,   setEditingFolder]   = useState<ModuleFolder | null>(null);
    const [parentForFolder, setParentForFolder] = useState<ModuleFolder | null>(null); // null = root
    const [folderForm,      setFolderForm]      = useState<FolderForm>(defaultFolderForm());
    const [isSavingFolder,  setIsSavingFolder]  = useState(false);

    // ── Upload modal ──────────────────────────────────────────────────────
    const [uploadModal,      setUploadModal]      = useState(false);
    const [uploadForFolder,  setUploadForFolder]  = useState<ModuleFolder | null>(null); // null = root
    const [editingResource,  setEditingResource]  = useState<ModuleResource | null>(null);
    const [uploadForm,       setUploadForm]       = useState<UploadForm>(defaultUploadForm());
    const [uploadProgress,   setUploadProgress]   = useState(0);
    const [isUploading,      setIsUploading]      = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Load data ──────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setDbError(false);
        try {
            const [roots, allFiles, batches] = await Promise.all([
                getRootFoldersByTeacher(user.id),
                getModuleResourcesByTeacher(user.id),
                getPublicUniqueBatches(),
            ]);
            setBatchNames(batches);
            setRootFiles(allFiles.filter(f => !f.folderId));

            const filesByFolder: Record<string, ModuleResource[]> = {};
            allFiles.filter(f => f.folderId).forEach(f => {
                if (!filesByFolder[f.folderId!]) filesByFolder[f.folderId!] = [];
                filesByFolder[f.folderId!].push(f);
            });

            setRootFolders(roots.map(f => ({
                ...f,
                subFolders: [],
                files: filesByFolder[f.id] || [],
                loaded: false,
                expanded: true,
            })));
        } catch {
            setDbError(true);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Expand / load sub-folders ──────────────────────────────────────────
    const toggleFolder = async (folderId: string) => {
        const updateTree = (nodes: FolderNode[]): FolderNode[] =>
            nodes.map(n => {
                if (n.id === folderId) return { ...n, expanded: !n.expanded };
                return { ...n, subFolders: updateTree(n.subFolders) };
            });
        setRootFolders(prev => updateTree(prev));
    };

    const loadSubFolders = async (folderId: string) => {
        const subs = await getSubFolders(folderId);
        const files = await getModuleResourcesByFolder(folderId);
        const updateTree = (nodes: FolderNode[]): FolderNode[] =>
            nodes.map(n => {
                if (n.id === folderId) return {
                    ...n,
                    subFolders: subs.map(s => ({ ...s, subFolders: [], files: [], loaded: false, expanded: true })),
                    files,
                    loaded: true,
                    expanded: true,
                };
                return { ...n, subFolders: updateTree(n.subFolders) };
            });
        setRootFolders(prev => updateTree(prev));
    };

    const refreshFolderFiles = async (folderId: string) => {
        const files = await getModuleResourcesByFolder(folderId);
        const updateTree = (nodes: FolderNode[]): FolderNode[] =>
            nodes.map(n => {
                if (n.id === folderId) return { ...n, files };
                return { ...n, subFolders: updateTree(n.subFolders) };
            });
        setRootFolders(prev => updateTree(prev));
    };

    // ── Folder handlers ────────────────────────────────────────────────────
    const openCreateFolder = (parent: ModuleFolder | null) => {
        setEditingFolder(null);
        setParentForFolder(parent);
        setFolderForm(defaultFolderForm());
        setFolderModal(true);
    };

    const openEditFolder = (folder: ModuleFolder) => {
        setEditingFolder(folder);
        setParentForFolder(null);
        setFolderForm({
            title: folder.title,
            description: folder.description || "",
            visibleForBatches: folder.visibleForBatches,
            isHidden: folder.isHidden,
        });
        setFolderModal(true);
    };

    const handleSaveFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSavingFolder(true);
        try {
            const payload = {
                teacherUid:        user.id,
                teacherName:       userProfile?.displayName || "",
                parentFolderId:    parentForFolder?.id || null,
                title:             folderForm.title,
                description:       folderForm.description,
                visibleForBatches: folderForm.visibleForBatches.length === 0 ? ["all"] : folderForm.visibleForBatches,
                isHidden:          folderForm.isHidden,
            };
            if (editingFolder) {
                await updateModuleFolder(editingFolder.id, payload);
            } else {
                await addModuleFolder(payload);
            }
            await fetchAll();
            setFolderModal(false);
        } catch (err) {
            console.error("Folder save error:", err);
            alert("Failed to save folder.");
        } finally {
            setIsSavingFolder(false);
        }
    };

    const handleToggleFolder = async (folder: ModuleFolder) => {
        await toggleModuleFolderVisibility(folder.id, !folder.isHidden);
        await fetchAll();
    };

    const handleDeleteFolder = async (folder: ModuleFolder) => {
        const ok = await confirm({ message: `"${folder.title}" ফোল্ডার এবং ভেতরের সব ফাইল মুছে যাবে। নিশ্চিত?`, variant: "danger" });
        if (!ok) return;
        await deleteModuleFolder(folder.id);
        await fetchAll();
    };

    // ── Upload handlers ────────────────────────────────────────────────────
    const openUploadModal = (folder: ModuleFolder | null, res?: ModuleResource) => {
        setUploadForFolder(folder);
        setEditingResource(res || null);
        setUploadForm(res ? {
            title: res.title, description: res.description || "",
            resourceType: res.resourceType, visibleForBatches: res.visibleForBatches, isHidden: res.isHidden,
        } : defaultUploadForm());
        if (fileInputRef.current) fileInputRef.current.value = "";
        setUploadProgress(0);
        setUploadModal(true);
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsUploading(true);
        try {
            const file = fileInputRef.current?.files?.[0];
            let fileUrl = editingResource?.fileUrl || "";
            let storagePath = editingResource?.storagePath || "";
            let fileSize = editingResource?.fileSize || "";
            let fileType = editingResource?.fileType || "other";

            if (file) {
                const pathLabel = uploadForFolder ? uploadForFolder.title : (userProfile?.displayName || "root");
                const result = await uploadModuleResourceFile(file, pathLabel, setUploadProgress);
                fileUrl = result.fileUrl; storagePath = result.storagePath;
                fileSize = result.fileSize; fileType = result.fileType;
            }

            const batchList = uploadForm.visibleForBatches.length === 0 ? ["all"] : uploadForm.visibleForBatches;

            if (editingResource) {
                await updateModuleResource(editingResource.id, {
                    title: uploadForm.title, description: uploadForm.description,
                    resourceType: uploadForm.resourceType, visibleForBatches: batchList, isHidden: uploadForm.isHidden,
                    ...(file ? { fileUrl, storagePath, fileSize, fileType, fileName: file.name } : {}),
                });
            } else {
                if (!file) { alert("Please select a file."); setIsUploading(false); return; }
                await addModuleResource({
                    moduleId: "", moduleTitle: "",
                    teacherName: userProfile?.displayName || "",
                    teacherUid: user.id,
                    folderId: uploadForFolder?.id || null,
                    title: uploadForm.title, description: uploadForm.description,
                    resourceType: uploadForm.resourceType, visibleForBatches: batchList,
                    isHidden: uploadForm.isHidden, fileUrl, storagePath, fileSize, fileType,
                    fileName: file.name,
                });
            }

            if (uploadForFolder) {
                await refreshFolderFiles(uploadForFolder.id);
            } else {
                const all = await getModuleResourcesByTeacher(user.id);
                setRootFiles(all.filter(f => !f.folderId));
            }
            setUploadModal(false);
            setUploadProgress(0);
        } catch (err) {
            console.error("Upload error:", err);
            alert("Upload failed.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleResource = async (res: ModuleResource) => {
        await toggleModuleResourceVisibility(res.id, !res.isHidden);
        if (res.folderId) {
            await refreshFolderFiles(res.folderId);
        } else {
            setRootFiles(prev => prev.map(r => r.id === res.id ? { ...r, isHidden: !res.isHidden } : r));
        }
    };

    const handleDeleteResource = async (res: ModuleResource) => {
        const ok = await confirm({ message: `"${res.title}" ফাইলটি মুছে ফেলা হবে। নিশ্চিত?`, variant: "danger" });
        if (!ok) return;
        await deleteModuleResource(res.id, res.storagePath);
        if (res.folderId) {
            await refreshFolderFiles(res.folderId);
        } else {
            setRootFiles(prev => prev.filter(r => r.id !== res.id));
        }
    };

    // ── Batch picker ───────────────────────────────────────────────────────
    const toggleBatch = (batch: string, form: FolderForm | UploadForm, setForm: any) => {
        setForm((prev: any) => ({
            ...prev,
            visibleForBatches: prev.visibleForBatches.includes(batch)
                ? prev.visibleForBatches.filter((b: string) => b !== batch)
                : [...prev.visibleForBatches, batch],
        }));
    };

    const renderBatchPicker = (form: FolderForm | UploadForm, setForm: any) => (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                Visible for Batches
                <span className="ml-2 text-xs font-normal text-gray-400">(না বাছাই করলে সব batch দেখবে)</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {batchNames.length === 0
                    ? <p className="text-xs text-gray-400">No batches found</p>
                    : batchNames.map(b => (
                        <button key={b} type="button" onClick={() => toggleBatch(b, form, setForm)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                form.visibleForBatches.includes(b)
                                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f]"
                            }`}>
                            {b}
                        </button>
                    ))
                }
            </div>
            {form.visibleForBatches.length > 0 && (
                <p className="text-xs text-[#1e3a5f] mt-1 font-medium">Selected: {form.visibleForBatches.join(", ")}</p>
            )}
        </div>
    );

    // ── Render file row ────────────────────────────────────────────────────
    const renderFileRow = (res: ModuleResource) => (
        <div key={res.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${res.isHidden ? "opacity-50" : ""}`}>
            <span className="text-2xl flex-shrink-0">{fileTypeIcon(res.fileType)}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{res.title}</p>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                        {resourceTypeIcon[res.resourceType]} {res.resourceType}
                    </span>
                    {res.isHidden && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Hidden</span>}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                    <span>{res.fileSize}</span>·
                    <span>Visible: {res.visibleForBatches.includes("all") ? "All Batches" : res.visibleForBatches.join(", ")}</span>
                </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
                <a href={res.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View/Download">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </a>
                <button onClick={() => openUploadModal(res.folderId ? rootFolders.find(f => f.id === res.folderId) || null : null, res)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button onClick={() => handleToggleResource(res)}
                    className={`p-1.5 rounded-lg transition-colors ${res.isHidden ? "text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                    title={res.isHidden ? "Show" : "Hide"}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {res.isHidden
                            ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        }
                    </svg>
                </button>
                <button onClick={() => handleDeleteResource(res)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );

    // ── Recursive folder tree ───────────────────────────────────────────────
    const renderFolderNode = (node: FolderNode, depth = 0) => (
        <div key={node.id} className={`${depth > 0 ? "ml-6 border-l border-gray-100" : ""}`}>
            {/* Folder header */}
            <div className={`flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors ${node.isHidden ? "opacity-60" : ""}`}>
                <button
                    onClick={async () => {
                        if (!node.loaded) await loadSubFolders(node.id);
                        else toggleFolder(node.id);
                    }}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                    <span className="text-xl">{node.expanded ? "📂" : "📁"}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-800 text-sm">{node.title}</span>
                            {node.isHidden && <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">Hidden</span>}
                            <span className="text-xs text-gray-400">
                                {node.visibleForBatches.includes("all") ? "All Batches" : node.visibleForBatches.join(", ")}
                            </span>
                        </div>
                        {node.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{node.description}</p>}
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${node.expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openCreateFolder(node)}
                        className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1" title="New Sub-folder">
                        <span>📁</span> Sub-folder
                    </button>
                    <button onClick={() => openUploadModal(node)}
                        className="px-2 py-1 bg-[#1e3a5f] text-white text-xs font-bold rounded-lg hover:bg-[#162e4a] transition-colors flex items-center gap-1" title="Upload to folder">
                        <span>+</span> Upload
                    </button>
                    <button onClick={() => openEditFolder(node)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onClick={() => handleToggleFolder(node)}
                        className={`p-1.5 rounded-lg transition-colors ${node.isHidden ? "text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}
                        title={node.isHidden ? "Show" : "Hide"}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {node.isHidden
                                ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            }
                        </svg>
                    </button>
                    <button onClick={() => handleDeleteFolder(node)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Folder contents */}
            {node.expanded && (
                <div className="bg-gray-50/50">
                    {/* Sub-folders */}
                    {node.subFolders.map(sub => renderFolderNode(sub, depth + 1))}

                    {/* Files */}
                    {node.files.length > 0 && (
                        <div className={`divide-y divide-gray-50 ${depth > 0 ? "ml-4" : ""}`}>
                            {node.files.map(renderFileRow)}
                        </div>
                    )}

                    {node.loaded && node.subFolders.length === 0 && node.files.length === 0 && (
                        <p className="text-sm text-gray-400 px-6 py-4">ফোল্ডার খালি। উপরের বাটন দিয়ে sub-folder বা ফাইল যোগ করুন।</p>
                    )}
                </div>
            )}
        </div>
    );

    // ── Main render ────────────────────────────────────────────────────────
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#1e3a5f] rounded-full"></div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1f2937]">Resource Library</h1>
                        <p className="text-[#6b7280] mt-1">ফোল্ডার তৈরি করুন, ফাইল আপলোড করুন এবং স্টুডেন্টদের জন্য ম্যানেজ করুন।</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openCreateFolder(null)}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2">
                        <span>📁</span> New Folder
                    </button>
                    <button onClick={() => openUploadModal(null)}
                        className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-bold rounded-xl hover:bg-[#162e4a] transition-colors flex items-center gap-2">
                        <span>+</span> Upload File
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {dbError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center justify-between gap-4">
                    <div>
                        <p className="font-bold text-red-800">লোড করা যায়নি</p>
                        <p className="text-sm text-red-600 mt-1">Resource Library-র ডেটা লোড করতে সমস্যা হয়েছে।</p>
                    </div>
                    <button
                        onClick={fetchAll}
                        className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 whitespace-nowrap text-sm"
                    >
                        আবার চেষ্টা করুন
                    </button>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="text-center py-16">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
                    <p className="mt-3 text-gray-500">Loading...</p>
                </div>
            ) : dbError ? null : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {rootFolders.length === 0 && rootFiles.length === 0 ? (
                        <div className="p-14 text-center">
                            <div className="text-5xl mb-4">📂</div>
                            <p className="font-bold text-gray-700 text-lg">এখনো কোনো ফোল্ডার বা ফাইল নেই</p>
                            <p className="text-gray-400 text-sm mt-2">উপরের বাটন দিয়ে ফোল্ডার তৈরি করুন বা ফাইল আপলোড করুন।</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {/* Root folders */}
                            {rootFolders.map(node => renderFolderNode(node))}

                            {/* Root files (no folder) */}
                            {rootFiles.length > 0 && (
                                <div>
                                    <div className="px-5 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Root Files (no folder)
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {rootFiles.map(renderFileRow)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ══ FOLDER MODAL ══════════════════════════════════════════════ */}
            {folderModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => !isSavingFolder && setFolderModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-purple-700 to-purple-500 p-5 text-white rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-white no-gradient">
                                        {editingFolder ? "Edit Folder" : parentForFolder ? `New Sub-folder in "${parentForFolder.title}"` : "New Root Folder"}
                                    </h3>
                                </div>
                                <button onClick={() => !isSavingFolder && setFolderModal(false)} className="text-white/80 hover:text-white text-2xl">✕</button>
                            </div>
                        </div>
                        <form onSubmit={handleSaveFolder} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Folder Name *</label>
                                <input type="text" required value={folderForm.title}
                                    onChange={e => setFolderForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="e.g. MS Word, Lecture 01..." />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
                                <textarea value={folderForm.description}
                                    onChange={e => setFolderForm(p => ({ ...p, description: e.target.value }))}
                                    rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                    placeholder="Brief description..." />
                            </div>
                            {renderBatchPicker(folderForm, setFolderForm)}
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setFolderForm(p => ({ ...p, isHidden: !p.isHidden }))}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${folderForm.isHidden ? "bg-gray-300" : "bg-purple-600"}`}>
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${folderForm.isHidden ? "left-1" : "left-5"}`}></span>
                                </button>
                                <label className="text-sm font-medium text-gray-700">
                                    {folderForm.isHidden ? "Hidden" : "Visible to students"}
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => !isSavingFolder && setFolderModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
                                <button type="submit" disabled={isSavingFolder}
                                    className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-60 text-sm">
                                    {isSavingFolder ? "Saving..." : editingFolder ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ UPLOAD MODAL ══════════════════════════════════════════════ */}
            {uploadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => !isUploading && setUploadModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5484] p-5 text-white rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-white no-gradient">{editingResource ? "Edit Resource" : "Upload File"}</h3>
                                    <p className="text-blue-200 text-sm mt-0.5">
                                        📁 {uploadForFolder ? uploadForFolder.title : "Root (no folder)"}
                                    </p>
                                </div>
                                <button onClick={() => !isUploading && setUploadModal(false)} className="text-white/80 hover:text-white text-2xl">✕</button>
                            </div>
                        </div>
                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                                <input type="text" required value={uploadForm.title}
                                    onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                                    placeholder="e.g. Lecture 01 - Introduction" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
                                <textarea value={uploadForm.description}
                                    onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                                    rows={2} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f] resize-none"
                                    placeholder="Brief description..." />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Resource Type *</label>
                                <select value={uploadForm.resourceType}
                                    onChange={e => setUploadForm(p => ({ ...p, resourceType: e.target.value as ResourceType }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                                    {RESOURCE_TYPES.map(t => <option key={t} value={t}>{resourceTypeIcon[t]} {t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                    File {editingResource ? "(leave empty to keep existing)" : "*"}
                                </label>
                                <input ref={fileInputRef} type="file"
                                    accept=".pdf,.pptx,.ppt,.docx,.doc,.jpg,.jpeg,.png,.html,.htm"
                                    className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-semibold file:bg-[#1e3a5f] file:text-white hover:file:bg-[#162e4a] cursor-pointer" />
                                {isUploading && uploadProgress > 0 && (
                                    <div className="mt-2">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Uploading...</span><span>{uploadProgress}%</span></div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-[#1e3a5f] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {renderBatchPicker(uploadForm, setUploadForm)}
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setUploadForm(p => ({ ...p, isHidden: !p.isHidden }))}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${uploadForm.isHidden ? "bg-gray-300" : "bg-emerald-500"}`}>
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${uploadForm.isHidden ? "left-1" : "left-5"}`}></span>
                                </button>
                                <label className="text-sm font-medium text-gray-700">
                                    {uploadForm.isHidden ? "Hidden" : "Visible to students"}
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => !isUploading && setUploadModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
                                <button type="submit" disabled={isUploading}
                                    className="flex-1 px-4 py-2.5 bg-[#1e3a5f] text-white font-bold rounded-xl hover:bg-[#162e4a] disabled:opacity-60 text-sm">
                                    {isUploading ? "Uploading..." : editingResource ? "Update" : "Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
