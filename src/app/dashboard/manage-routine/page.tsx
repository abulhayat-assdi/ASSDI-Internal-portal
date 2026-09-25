"use client";

import { useState, useEffect, useRef } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getBatches } from "@/services/scheduleService";
import { getRoutineByBatch, uploadRoutineImage, deleteRoutine, BatchRoutine } from "@/services/routinesService";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ManageRoutinePage() {
    const confirm = useConfirm();
    const { hasPermission } = useAuth();
    // Teachers open this screen to look at every batch's routine; only
    // admins (or an admin+teacher granted it) can replace one.
    const canManageRoutine = hasPermission("admin_routine");
    const [batches, setBatches] = useState<{ id: string; name: string; status: string }[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

    const [routine, setRoutine] = useState<BatchRoutine | null>(null);
    const [loadingRoutine, setLoadingRoutine] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getBatches()
            .then(d => setBatches(d.filter(b => b.status === "active")))
            .catch(() => {})
            .finally(() => setLoadingBatches(false));
    }, []);

    const loadRoutine = async (batchName: string) => {
        setLoadingRoutine(true);
        try {
            setRoutine(await getRoutineByBatch(batchName));
        } catch {
            setRoutine(null);
        } finally {
            setLoadingRoutine(false);
        }
    };

    const handleBatchSelect = async (batchName: string) => {
        setSelectedBatch(batchName);
        await loadRoutine(batchName);
    };

    const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-picking the same file
        if (!file || !selectedBatch) return;

        if (!file.type.startsWith("image/")) {
            alert("দয়া করে একটি ইমেজ ফাইল (JPG/PNG/WebP) সিলেক্ট করুন।");
            return;
        }

        setUploading(true);
        try {
            const saved = await uploadRoutineImage(selectedBatch, file);
            setRoutine(saved);
        } catch (err: any) {
            console.error("Upload error", err);
            alert(err?.message || "আপলোড ব্যর্থ হয়েছে।");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!routine) return;
        const ok = await confirm({ message: `${selectedBatch} এর রুটিন ইমেজটি মুছে ফেলবেন?`, variant: "danger" });
        if (!ok) return;
        try {
            await deleteRoutine(routine.id);
            setRoutine(null);
        } catch (err: any) {
            console.error("Delete error", err);
            alert(err?.message || "ডিলিট ব্যর্থ হয়েছে।");
        }
    };

    // ── Batch list ──────────────────────────────────────────────────────────
    if (!selectedBatch) {
        return (
            <div className="p-6">
                <h1 className="no-gradient text-2xl font-bold text-[#1f2937] mb-6">Manage Class Routine</h1>
                <Card className="max-w-xl mx-auto shadow-sm border border-[#e5e7eb]">
                    <CardBody className="p-6">
                        <h2 className="no-gradient text-lg font-semibold text-gray-800 mb-1">Select Batch to View Routine</h2>
                        <p className="text-sm text-gray-500 mb-4">ব্যাচ সিলেক্ট করে এই সেকশনের রুটিন ইমেজ দেখতে পারবেন। আপলোড/replace শুধু Routine access থাকলে সম্ভব।</p>
                        {!canManageRoutine && (
                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                View-only mode: you can inspect the selected routine image, but editing is disabled.
                            </div>
                        )}
                        {loadingBatches ? (
                            <p className="text-gray-500">Loading batches...</p>
                        ) : batches.length === 0 ? (
                            <p className="text-red-500">No batches created yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {batches.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => handleBatchSelect(v.name)}
                                        className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-500 rounded-xl transition-all font-medium text-gray-700 flex justify-between items-center"
                                    >
                                        <span>{v.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${v.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                                            {v.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        );
    }

    // ── Upload / preview for selected batch ─────────────────────────────────
    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <h1 className="no-gradient text-2xl font-bold text-[#1f2937] flex items-center gap-2">
                    <button onClick={() => { setSelectedBatch(null); setRoutine(null); }} className="text-gray-500 hover:text-emerald-600 text-sm">← Back</button>
                    <span>Routine: <span className="text-emerald-600">{selectedBatch}</span></span>
                </h1>
            </div>

            <Card className="shadow-sm border border-[#e5e7eb]">
                <CardBody className="p-6">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFilePicked}
                    />

                    {loadingRoutine ? (
                        <div className="py-16 text-center text-gray-500">Loading routine...</div>
                    ) : routine ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={routine.fileUrl} alt={`${selectedBatch} routine`} className="w-full h-auto block" />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-gray-400 truncate">{routine.fileName}</p>
                                {canManageRoutine ? (
                                    <div className="flex gap-2">
                                        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                            {uploading ? "Uploading..." : "Replace Image"}
                                        </Button>
                                        <Button variant="outline" className="bg-white text-red-600 border-red-300 hover:bg-red-50" onClick={handleDelete} disabled={uploading}>
                                            Delete
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">View only</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => canManageRoutine ? fileInputRef.current?.click() : undefined}
                            disabled={uploading || !canManageRoutine}
                            className="w-full py-16 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-emerald-500 hover:bg-emerald-50/40 transition-colors disabled:opacity-60"
                        >
                            <div className="text-5xl mb-3">🖼️</div>
                            <p className="font-semibold text-gray-700">{uploading ? "Uploading..." : canManageRoutine ? "রুটিন ইমেজ আপলোড করুন" : "No routine image uploaded yet"}</p>
                            <p className="text-sm text-gray-400 mt-1">{canManageRoutine ? "JPG / PNG / WebP — ক্লিক করে ফাইল সিলেক্ট করুন" : "এই ব্যাচের রুটিন দেখার জন্য শুধু view mode।"}</p>
                        </button>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
