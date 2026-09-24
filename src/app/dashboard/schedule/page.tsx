"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { getBatchClassCounts, getBatches, BatchItem } from "@/services/scheduleService";
import { getRoutineByBatch, BatchRoutine, uploadRoutineImage } from "@/services/routinesService";
import ImageLightbox from "@/components/ui/ImageLightbox";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

/**
 * Turns a worksheet into the row-objects shape XLSX.utils.sheet_to_json
 * produced: the first non-empty row supplies the keys, later rows the values.
 * Fully-empty rows are dropped, matching sheet_to_json's default.
 */
function worksheetToJson(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
    const cellText = (value: ExcelJS.CellValue): string => {
        if (value === null || value === undefined) return "";
        // Rich text and formula cells arrive as objects, not primitives.
        if (typeof value === "object") {
            if ("richText" in value) return value.richText.map((part) => part.text).join("");
            if ("result" in value) return String(value.result ?? "");
            if ("text" in value) return String(value.text ?? "");
            if (value instanceof Date) return value.toISOString();
        }
        return String(value);
    };

    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
        // row.values is 1-indexed with a leading hole; drop it.
        const values = (row.values as ExcelJS.CellValue[]).slice(1);

        if (headers.length === 0) {
            headers = values.map(cellText);
            return;
        }

        const record: Record<string, unknown> = {};
        let hasValue = false;
        headers.forEach((header, i) => {
            if (!header) return;
            const text = cellText(values[i]);
            if (text !== "") hasValue = true;
            record[header] = text;
        });
        if (hasValue) rows.push(record);
    });

    return rows;
}

export default function SchedulePage() {
    const { loading: authLoading, hasPermission } = useAuth();

    const [selectedRoutineBatch, setSelectedRoutineBatch] = useState("");
    const [routines, setRoutines] = useState<Record<string, BatchRoutine | null>>({});
    const [routineImageLoading, setRoutineImageLoading] = useState(false);
    const [availableRoutineBatches, setAvailableRoutineBatches] = useState<string[]>([]);
    const [batchStats, setBatchStats] = useState<Record<string, { subjectName: string; classCount: number }[]>>({});
    const [batchStatsLoading, setBatchStatsLoading] = useState(true);
    const [uploadingRoutine, setUploadingRoutine] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canManageRoutine = hasPermission("routine");

    const [editingBatch, setEditingBatch] = useState<string | null>(null);
    const [editSubjects, setEditSubjects] = useState<{ subjectName: string; classCount: number }[]>([]);
    const [savingBatch, setSavingBatch] = useState(false);
    const [excelFileLoading, setExcelFileLoading] = useState(false);

    useEffect(() => {
        getBatches()
            .then((batches: BatchItem[]) => {
                const activeBatchNames = batches.filter((b) => b.status === "active").map((b) => b.name).sort();
                setAvailableRoutineBatches(activeBatchNames);
                if (activeBatchNames.length > 0 && !selectedRoutineBatch) {
                    setSelectedRoutineBatch(activeBatchNames[activeBatchNames.length - 1]);
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        const fetchBatchStats = async () => {
            setBatchStatsLoading(true);
            try {
                setBatchStats(await getBatchClassCounts());
            } catch (error) {
                console.error("Failed to fetch batch stats", error);
            } finally {
                setBatchStatsLoading(false);
            }
        };

        fetchBatchStats();
    }, []);

    // Fetch all active batch routines in parallel
    useEffect(() => {
        if (availableRoutineBatches.length === 0) return;

        const loadAllRoutines = async () => {
            setRoutineImageLoading(true);
            const results: Record<string, BatchRoutine | null> = {};
            await Promise.all(
                availableRoutineBatches.map(async (batchName) => {
                    try {
                        const r = await getRoutineByBatch(batchName);
                        results[batchName] = r;
                    } catch {
                        results[batchName] = null;
                    }
                })
            );
            setRoutines(results);
            setRoutineImageLoading(false);
        };

        loadAllRoutines();
    }, [availableRoutineBatches]);

    const handleRoutineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";

        if (!file || !selectedRoutineBatch) return;
        if (!file.type.startsWith("image/")) {
            alert("দয়া করে একটি ইমেজ ফাইল (JPG/PNG/WebP) সিলেক্ট করুন।");
            return;
        }

        setUploadingRoutine(true);
        try {
            const saved = await uploadRoutineImage(selectedRoutineBatch, file);
            setRoutines(prev => ({ ...prev, [selectedRoutineBatch]: saved }));
        } catch (error: any) {
            console.error("Routine upload failed", error);
            alert(error?.message || "রুটিন আপলোড ব্যর্থ হয়েছে।");
        } finally {
            setUploadingRoutine(false);
        }
    };

    const handleStartEdit = (batchName: string) => {
        setEditingBatch(batchName);
        setEditSubjects([...(batchStats[batchName] || [])]);
    };

    const handleSubjectChange = (index: number, field: "subjectName" | "classCount", value: any) => {
        setEditSubjects(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                [field]: value
            };
            return updated;
        });
    };

    const handleAddSubjectRow = () => {
        setEditSubjects(prev => [...prev, { subjectName: "", classCount: 0 }]);
    };

    const handleDeleteSubjectRow = (index: number) => {
        setEditSubjects(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleCancelEdit = () => {
        setEditingBatch(null);
        setEditSubjects([]);
    };

    const handleSaveEdit = async (batchName: string) => {
        const hasEmptySubject = editSubjects.some(s => !s.subjectName.trim());
        if (hasEmptySubject) {
            alert("দয়া করে বিষয়ের নাম পূরণ করুন।");
            return;
        }

        setSavingBatch(true);
        try {
            const res = await fetch("/api/schedule/class-counts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    isBulk: false,
                    batchName,
                    subjects: editSubjects
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData?.error || "Failed to save changes");
            }

            const stats = await getBatchClassCounts();
            setBatchStats(stats);
            setEditingBatch(null);
            setEditSubjects([]);
        } catch (error: any) {
            console.error("Save edit failed", error);
            alert(error?.message || "পরিবর্তন সংরক্ষণ করতে ব্যর্থ হয়েছে।");
        } finally {
            setSavingBatch(false);
        }
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setExcelFileLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target?.result;
                    if (!data) throw new Error("Could not read file data");

                    // exceljs, not XLSX.read: SheetJS's npm build is
                    // abandoned at 0.18.5 with an unfixed prototype-pollution
                    // advisory in exactly this parse path. Writing with it is
                    // unaffected, so the export helpers below still use it.
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.load(data as ArrayBuffer);
                    const worksheet = workbook.worksheets[0];
                    const json = worksheetToJson(worksheet);

                    if (json.length === 0) {
                        alert("Excel ফাইলটি খালি অথবা সঠিক ডাটা নেই।");
                        setExcelFileLoading(false);
                        return;
                    }

                    const findKey = (row: any, candidates: string[]) => {
                        const keys = Object.keys(row);
                        for (const candidate of candidates) {
                            const match = keys.find(k => k.toLowerCase().replace(/[\s\-_]/g, '') === candidate);
                            if (match) return row[match];
                        }
                        return null;
                    };

                    const parsedData: { batchName: string; subjectName: string; classCount: number }[] = [];

                    for (const row of json) {
                        const batch = findKey(row, ['batch', 'batchname', 'batch_name', 'batch name']);
                        const subject = findKey(row, ['subject', 'subjectname', 'subject_name', 'subject name', 'course']);
                        const count = findKey(row, ['classes', 'classcount', 'class_count', 'class count', 'classestaken', 'classes_taken', 'classes taken', 'count']);

                        if (batch && subject) {
                            parsedData.push({
                                batchName: String(batch).trim(),
                                subjectName: String(subject).trim(),
                                classCount: Number(count) || 0
                            });
                        }
                    }

                    if (parsedData.length === 0) {
                        alert("Excel ফাইলে সঠিক কলাম পাওয়া যায়নি। কলামগুলো অবশ্যই Batch, Subject, এবং Classes Taken হতে হবে।");
                        setExcelFileLoading(false);
                        return;
                    }

                    const res = await fetch("/api/schedule/class-counts", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isBulk: true, data: parsedData }),
                    });

                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData?.error || "Failed to save imported data");
                    }

                    const stats = await getBatchClassCounts();
                    setBatchStats(stats);
                    alert(`সফলভাবে ${parsedData.length} টি বিষয়ের ক্লাস কাউন্ট আপডেট করা হয়েছে!`);
                } catch (err: any) {
                    console.error("Excel processing error:", err);
                    alert(err?.message || "Excel ফাইল প্রসেস করতে ত্রুটি হয়েছে।");
                } finally {
                    setExcelFileLoading(false);
                }
            };

            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error("Excel upload failed", error);
            alert("ফাইল আপলোড ব্যর্থ হয়েছে।");
            setExcelFileLoading(false);
        }
    };

    const batchCountSummary = useMemo(() => Object.keys(batchStats).sort(), [batchStats]);

    if (authLoading) {
        return <div className="p-8 text-center text-[#6b7280]">Loading profile...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1f2937]">Class Routine</h1>
                        <p className="text-[#6b7280] mt-1">Upload and view batch-wise routine images for teachers and students.</p>
                    </div>
                </div>
            </div>

            <Card>
                <CardBody className="p-6 space-y-8">
                    {canManageRoutine && (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 space-y-3">
                            <div>
                                <h2 className="text-lg font-semibold text-[#1f2937]">Routine Upload</h2>
                                <p className="text-sm text-[#6b7280] mt-1">এই সেকশনটি শুধুমাত্র Access Management-এ Routine/Edit access দেওয়া ব্যবহারকারী আপলোড ও replace করতে পারবেন।</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={selectedRoutineBatch}
                                    onChange={(e) => setSelectedRoutineBatch(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-700"
                                >
                                    {availableRoutineBatches.map((batch) => (
                                        <option key={batch} value={batch}>{batch}</option>
                                    ))}
                                </select>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleRoutineUpload}
                                />
                                <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingRoutine || !selectedRoutineBatch}>
                                    {uploadingRoutine ? "Uploading..." : "Upload / Replace Routine Image"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Batch-wise Class Routines Grid: 1 col on mobile, 2 cols on PC */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Active Batch Routines
                        </h2>

                        {availableRoutineBatches.length === 0 ? (
                            <div className="py-8 text-center text-[#6b7280] bg-white rounded-lg border border-gray-100 italic">No active batch routine is available yet.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {availableRoutineBatches.map((batchName) => {
                                    const rImg = routines[batchName];
                                    return (
                                        <div key={batchName} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
                                            <div style={{ backgroundColor: "#0D1B4A", textAlign: "center", padding: "12px 24px" }} className="shrink-0">
                                                <div style={{ color: "#FFFFFF", fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.02em", lineHeight: 1.2 }}>
                                                    {batchName}
                                                </div>
                                            </div>
                                            <div className="p-3 md:p-5 flex-1 flex flex-col items-center justify-center bg-gray-50/30 min-h-[220px]">
                                                {routineImageLoading && !rImg ? (
                                                    <div className="text-center py-8">
                                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669] mb-2"></div>
                                                        <p className="text-sm text-gray-500">Loading routine...</p>
                                                    </div>
                                                ) : rImg ? (
                                                    <button
                                                        onClick={() => setLightboxImage({ src: rImg.fileUrl, alt: `${batchName} class routine` })}
                                                        className="w-full text-left focus:outline-none block hover:opacity-95 transition-opacity cursor-zoom-in"
                                                        title="Click to zoom"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={rImg.fileUrl}
                                                            alt={`${batchName} class routine`}
                                                            className="w-full h-auto rounded-lg border border-gray-100"
                                                        />
                                                    </button>
                                                ) : (
                                                    <div className="text-center py-8 text-[#6b7280] italic text-sm">
                                                        🖼️ No class routine uploaded yet for {batchName}.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-[#1f2937]">Batch-wise Class Count</h2>
                                <p className="text-sm text-[#6b7280] mt-1">এখানে ব্যাচ অনুযায়ী ক্লাসের সংখ্যা দেখা যাবে। আপনি চাইলে Excel/Sheets থেকে manually update করতে পারেন।</p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                {canManageRoutine && (
                                    <>
                                        <input
                                            type="file"
                                            id="excel-upload-input"
                                            accept=".xlsx, .xls, .csv"
                                            className="hidden"
                                            onChange={handleExcelUpload}
                                        />
                                        <Button
                                            onClick={() => document.getElementById("excel-upload-input")?.click()}
                                            disabled={excelFileLoading}
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                                        >
                                            {excelFileLoading ? "Uploading..." : "📊 Excel Upload"}
                                        </Button>
                                    </>
                                )}
                                <span className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">Manual update ready</span>
                            </div>
                        </div>

                        {batchStatsLoading ? (
                            <div className="text-sm text-gray-500 py-4 text-center">Loading class count...</div>
                        ) : batchCountSummary.length === 0 ? (
                            <div className="text-sm text-gray-500 py-4 text-center">No batch class count data available yet.</div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {batchCountSummary.map((batchName) => {
                                    const isEditingThisBatch = editingBatch === batchName;
                                    const subjectsList = isEditingThisBatch ? editSubjects : (batchStats[batchName] || []);

                                    return (
                                        <div key={batchName} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
                                            <div className="bg-[#1e3a5f] px-4 py-3 text-white font-semibold flex items-center justify-between">
                                                <span>{batchName}</span>
                                                {canManageRoutine && (
                                                    <div className="flex gap-1.5">
                                                        {isEditingThisBatch ? (
                                                            <>
                                                                <button
                                                                    onClick={handleAddSubjectRow}
                                                                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded transition-colors"
                                                                >
                                                                    + Add Subject
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSaveEdit(batchName)}
                                                                    disabled={savingBatch}
                                                                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                                                                >
                                                                    {savingBatch ? "Saving..." : "Save"}
                                                                </button>
                                                                <button
                                                                    onClick={handleCancelEdit}
                                                                    className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2.5 py-1 rounded transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleStartEdit(batchName)}
                                                                className="text-xs bg-white/20 hover:bg-white/35 text-white px-2.5 py-1 rounded transition-colors border border-white/30"
                                                            >
                                                                Edit Counts
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="overflow-x-auto flex-1">
                                                <table className="min-w-full text-sm">
                                                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                                                        <tr>
                                                            <th className="px-4 py-2.5 text-left font-semibold w-12">#</th>
                                                            <th className="px-4 py-2.5 text-left font-semibold">Subject</th>
                                                            <th className="px-4 py-2.5 text-right font-semibold w-32">Classes Taken</th>
                                                            {isEditingThisBatch && (
                                                                <th className="px-4 py-2.5 text-center font-semibold w-24">Action</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {subjectsList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={isEditingThisBatch ? 4 : 3} className="px-4 py-6 text-center text-gray-500 italic">
                                                                    No class counts defined yet. {isEditingThisBatch ? 'Click "+ Add Subject" to start.' : ''}
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            subjectsList.map((item, idx) => (
                                                                <tr key={`${batchName}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                                                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                                                    <td className="px-4 py-2.5">
                                                                        {isEditingThisBatch ? (
                                                                            <input
                                                                                type="text"
                                                                                value={item.subjectName}
                                                                                onChange={(e) => handleSubjectChange(idx, "subjectName", e.target.value)}
                                                                                placeholder="Subject Name"
                                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#1e3a5f] focus:outline-none text-gray-700 bg-white"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-gray-700 font-medium">{item.subjectName}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-right">
                                                                        {isEditingThisBatch ? (
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                value={item.classCount}
                                                                                onChange={(e) => handleSubjectChange(idx, "classCount", parseInt(e.target.value) || 0)}
                                                                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:border-[#1e3a5f] focus:outline-none text-gray-700 bg-white"
                                                                            />
                                                                        ) : (
                                                                            <span className="font-semibold text-[#1e3a5f] bg-blue-50/50 px-2.5 py-1 rounded-md border border-blue-100/50">{item.classCount}</span>
                                                                        )}
                                                                    </td>
                                                                    {isEditingThisBatch && (
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            <button
                                                                                onClick={() => handleDeleteSubjectRow(idx)}
                                                                                className="text-red-500 hover:text-red-700 text-xs font-semibold"
                                                                            >
                                                                                ✕ Remove
                                                                            </button>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </CardBody>
            </Card>

            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage.src}
                    alt={lightboxImage.alt}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </div>
    );
}
