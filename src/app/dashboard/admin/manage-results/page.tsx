"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { exportRowsToXlsx, type ExportRow } from "@/lib/exportRows";
import { getAllBatchInfo, StudentBatchInfo } from "@/services/batchInfoService";
import {
    saveSingleResult, ExamResult, getAllExamResults, createDefaultExamRecord, ExamRecord,
    CustomColumn, PresentationColumn, PresentationRecord, createDefaultPresentationRecord
} from "@/services/resultService";

const FIXED_SUBJECTS = [
    { key: "sales", label: "Sales" },
    { key: "service", label: "Service" },
    { key: "careerPlanning", label: "Career Planning & Branding" },
    { key: "ai", label: "AI" },
    { key: "metaMarketing", label: "Meta Marketing" },
    { key: "msOffice", label: "MS Office" },
    { key: "landingPage", label: "Landing Page & Content" },
];

const XMarkIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);
const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);
const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);

export default function ManageResultsPage() {
    const [allStudents, setAllStudents] = useState<StudentBatchInfo[]>([]);
    const [allResults, setAllResults] = useState<ExamResult[]>([]);
    const [batches, setBatches] = useState<string[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string>("");
    const [batchStudentsList, setBatchStudentsList] = useState<{ student: StudentBatchInfo, result: ExamResult | undefined }[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentBatchInfo | null>(null);
    const [editingResultId, setEditingResultId] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"exam" | "presentation">("exam");

    // Exam tab state
    const [fixedSubjectLabels, setFixedSubjectLabels] = useState<Record<string, string>>({});
    const [editingRecords, setEditingRecords] = useState<ExamRecord[]>([]);
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

    // Presentation tab state
    const [presentationColumns, setPresentationColumns] = useState<PresentationColumn[]>([]);
    const [presentationRecords, setPresentationRecords] = useState<PresentationRecord[]>([]);

    const [saving, setSaving] = useState(false);
    const [notifying, setNotifying] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [students, results] = await Promise.all([getAllBatchInfo(), getAllExamResults()]);
                setAllStudents(students);
                setAllResults(results);
                const uniqueBatches = Array.from(new Set(students.map(s => s.batchName))).sort();
                setBatches(uniqueBatches);
            } catch (error) {
                console.error("Failed to load data for results management", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            const batchStudents = allStudents.filter(s => s.batchName === selectedBatch);
            const studentsWithResults = batchStudents.map(student => {
                const existingResult = allResults.find(r => r.batchName === selectedBatch && r.roll === student.roll);
                return { student, result: existingResult };
            });
            studentsWithResults.sort((a, b) => {
                const numA = parseInt(a.student.roll);
                const numB = parseInt(b.student.roll);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.student.roll.localeCompare(b.student.roll);
            });
            setBatchStudentsList(studentsWithResults);
        } else {
            setBatchStudentsList([]);
        }
    }, [selectedBatch, allStudents, allResults]);

    const openEditModal = (student: StudentBatchInfo, result?: ExamResult) => {
        setEditingStudent(student);
        setEditingResultId(result?.id || "");
        setActiveTab("exam");

        // Exam tab
        setFixedSubjectLabels(result?.fixedSubjectLabels || {});
        if (result?.examRecords && result.examRecords.length > 0) {
            setEditingRecords(result.examRecords);
        } else {
            setEditingRecords([
                createDefaultExamRecord("1st Monthly Exam"),
                createDefaultExamRecord("2nd Monthly Exam"),
                createDefaultExamRecord("Final Exam"),
            ]);
        }
        setCustomColumns(result?.customColumns || []);

        // Presentation tab
        setPresentationColumns(result?.presentationColumns || []);
        setPresentationRecords(result?.presentationRecords || []);

        setEditModalOpen(true);
    };

    // ── Exam tab handlers ──────────────────────────────────────
    const handleFixedSubjectLabelChange = (key: string, label: string) => {
        setFixedSubjectLabels(prev => ({ ...prev, [key]: label }));
    };

    const handleAddRow = () => {
        const defaultNames = ["1st Monthly Exam", "2nd Monthly Exam", "Final Exam"];
        const nextDefaultName = defaultNames[editingRecords.length] || `Exam ${editingRecords.length + 1}`;
        setEditingRecords([...editingRecords, createDefaultExamRecord(nextDefaultName)]);
    };

    const handleRemoveRow = (id: string) => {
        setEditingRecords(editingRecords.filter(r => r.id !== id));
    };

    const handleAddColumn = () => {
        const newCol: CustomColumn = {
            id: Math.random().toString(36).substring(2, 9),
            label: `Extra ${customColumns.length + 1}`,
        };
        setCustomColumns([...customColumns, newCol]);
    };

    const handleRemoveColumn = (colId: string) => {
        setCustomColumns(customColumns.filter(c => c.id !== colId));
        setEditingRecords(editingRecords.map(record => {
            const newSubjects = { ...record.subjects };
            delete newSubjects[colId];
            return { ...record, subjects: newSubjects };
        }));
    };

    const handleColumnLabelChange = (colId: string, label: string) => {
        setCustomColumns(customColumns.map(c => c.id === colId ? { ...c, label } : c));
    };

    const handleCellChange = (recordId: string, field: string, value: string) => {
        setEditingRecords(records => records.map(record => {
            if (record.id === recordId) {
                if (field === "examName") return { ...record, examName: value };
                return { ...record, subjects: { ...record.subjects, [field]: value } };
            }
            return record;
        }));
    };

    // ── Presentation tab handlers ──────────────────────────────
    const handleAddPresentationColumn = () => {
        const newCol: PresentationColumn = {
            id: Math.random().toString(36).substring(2, 9),
            label: `Criteria ${presentationColumns.length + 1}`,
        };
        setPresentationColumns([...presentationColumns, newCol]);
    };

    const handleRemovePresentationColumn = (colId: string) => {
        setPresentationColumns(presentationColumns.filter(c => c.id !== colId));
        setPresentationRecords(presentationRecords.map(record => {
            const newCriteria = { ...record.criteria };
            delete newCriteria[colId];
            return { ...record, criteria: newCriteria };
        }));
    };

    const handlePresentationColumnLabelChange = (colId: string, label: string) => {
        setPresentationColumns(presentationColumns.map(c => c.id === colId ? { ...c, label } : c));
    };

    const handleAddPresentationRow = () => {
        setPresentationRecords([...presentationRecords, createDefaultPresentationRecord(`Presentation ${presentationRecords.length + 1}`)]);
    };

    const handleRemovePresentationRow = (id: string) => {
        setPresentationRecords(presentationRecords.filter(r => r.id !== id));
    };

    const handlePresentationCellChange = (recordId: string, field: string, value: string) => {
        setPresentationRecords(records => records.map(record => {
            if (record.id === recordId) {
                if (field === "presentationName") return { ...record, presentationName: value };
                return { ...record, criteria: { ...record.criteria, [field]: value } };
            }
            return record;
        }));
    };

    // ── Save ──────────────────────────────────────────────────
    const handleSaveStudentResult = async () => {
        if (!editingStudent) return;
        setSaving(true);
        try {
            const newResult: ExamResult = {
                id: editingResultId,
                batchName: editingStudent.batchName,
                roll: editingStudent.roll,
                name: editingStudent.name,
                fixedSubjectLabels: Object.keys(fixedSubjectLabels).length > 0 ? fixedSubjectLabels : undefined,
                examRecords: editingRecords,
                customColumns,
                presentationColumns: presentationColumns.length > 0 ? presentationColumns : undefined,
                presentationRecords: presentationRecords.length > 0 ? presentationRecords : undefined,
            };
            await saveSingleResult(newResult);
            const refreshedResults = await getAllExamResults();
            setAllResults(refreshedResults);
            setEditModalOpen(false);
        } catch (error) {
            console.error("Failed to save result", error);
            alert("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
            </div>
        );
    }

    /** Announces the published results to the batch — a deliberate action,
     *  never a side effect of saving a row (see /api/results/notify). */
    const notifyStudents = async () => {
        if (!selectedBatch) return;
        setNotifying(true);
        try {
            const res = await fetch("/api/results/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batchName: selectedBatch }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "পাঠানো যায়নি।");
            toast.success(`${selectedBatch} ব্যাচকে জানানো হয়েছে।`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "পাঠানো যায়নি।");
        } finally {
            setNotifying(false);
        }
    };

    /** One row per student per exam, with a column for every subject in play. */
    const exportResults = () => {
        if (!selectedBatch || batchStudentsList.length === 0) {
            toast.error("আগে একটি ব্যাচ বেছে নিন।");
            return;
        }

        const rows: ExportRow[] = [];
        for (const { student, result } of batchStudentsList) {
            const labels = { ...Object.fromEntries(FIXED_SUBJECTS.map((s) => [s.key, s.label])), ...(result?.fixedSubjectLabels ?? {}) };
            const customs = result?.customColumns ?? [];
            const records = result?.examRecords ?? [];

            if (records.length === 0) {
                rows.push({ Batch: selectedBatch, Roll: student.roll, Name: student.name, Exam: "", Remarks: result?.remarks ?? "" });
                continue;
            }
            for (const rec of records) {
                const row: ExportRow = { Batch: selectedBatch, Roll: student.roll, Name: student.name, Exam: rec.examName };
                for (const f of FIXED_SUBJECTS) row[labels[f.key] ?? f.label] = rec.subjects?.[f.key] ?? "";
                for (const c of customs) row[c.label] = rec.subjects?.[c.id] ?? "";
                row.Remarks = result?.remarks ?? "";
                rows.push(row);
            }
        }

        exportRowsToXlsx({ fileName: `results-${selectedBatch}`, sheetName: "Results", rows });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manage Students Exam Results</h1>
                    <p className="text-sm text-gray-500 mt-1">Select a batch to view students and edit their result grids.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={notifyStudents}
                        disabled={!selectedBatch || notifying}
                        className="bg-white border border-[#059669] text-[#059669] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#f0fdf4] disabled:opacity-50"
                    >
                        {notifying ? "পাঠানো হচ্ছে..." : "ছাত্রদের জানিয়ে দিন"}
                    </button>
                    <button
                        onClick={exportResults}
                        disabled={!selectedBatch || batchStudentsList.length === 0}
                        className="bg-[#059669] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#047857] disabled:opacity-50"
                    >
                        Excel ডাউনলোড
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="w-full max-w-sm">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Batch</label>
                    <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="block w-full py-2.5 px-3 border border-gray-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] sm:text-sm transition-colors"
                    >
                        <option value="" disabled>Select a batch to begin</option>
                        {batches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
            </div>

            {selectedBatch && batchStudentsList.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800">{selectedBatch} — Students</h3>
                    </div>
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1e3a5f] text-white text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-[20%]">Roll No.</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-[40%]">Student Name</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-[20%]">Status</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-[20%]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batchStudentsList.map(({ student, result }, index) => (
                                    <tr key={student.roll} className={index % 2 === 0 ? "bg-white" : "bg-[#f9fafb]"}>
                                        <td className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-700"># {student.roll}</td>
                                        <td className="px-4 py-3 border-b border-gray-200 text-gray-900">{student.name}</td>
                                        <td className="px-4 py-3 border-b border-gray-200">
                                            {result?.examRecords || result?.presentationRecords ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Results Added</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">No Result Yet</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 border-b border-gray-200">
                                            <button
                                                onClick={() => openEditModal(student, result)}
                                                className="text-sm px-4 py-1.5 bg-[#059669] hover:bg-[#047857] text-white font-medium rounded-lg transition-colors"
                                            >
                                                Edit Sheet
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && editingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditModalOpen(false)}></div>

                    <div className="bg-white rounded-2xl shadow-2xl relative w-full max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Result Sheet — {editingStudent.name}</h3>
                                <p className="text-sm text-gray-500">Roll: {editingStudent.roll} • Batch: {editingStudent.batchName}</p>
                            </div>
                            <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-500 bg-gray-100 p-2 rounded-full">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 bg-white px-5">
                            <button
                                onClick={() => setActiveTab("exam")}
                                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                                    activeTab === "exam"
                                        ? "border-[#8cc63f] text-[#5a8a2e]"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                Exam Results
                            </button>
                            <button
                                onClick={() => setActiveTab("presentation")}
                                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                                    activeTab === "presentation"
                                        ? "border-[#8cc63f] text-[#5a8a2e]"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                Final Project Presentation
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-auto bg-gray-50/50 flex-grow">

                            {/* ── EXAM TAB ── */}
                            {activeTab === "exam" && (
                                <>
                                    <p className="text-xs text-gray-400 mb-3">Click any header cell to rename the subject. Click any mark cell to edit the score.</p>
                                    <div className="bg-white border border-[#8cc63f]/30 rounded-xl overflow-x-auto shadow-sm text-sm">
                                        <table className="w-full text-center border-collapse" style={{ minWidth: `${550 + customColumns.length * 130}px` }}>
                                            <thead>
                                                <tr className="bg-[#8cc63f] text-black">
                                                    <th className="p-3 border border-[#7db037] font-bold text-left whitespace-nowrap w-[160px]">Exam</th>
                                                    {FIXED_SUBJECTS.map(s => (
                                                        <th key={s.key} className="p-2 border border-[#7db037] min-w-[100px]">
                                                            <input
                                                                value={fixedSubjectLabels[s.key] ?? s.label}
                                                                onChange={e => handleFixedSubjectLabelChange(s.key, e.target.value)}
                                                                className="bg-white/60 text-black text-center w-full px-1 py-0.5 rounded font-medium focus:ring-1 focus:ring-black outline-none border border-transparent hover:border-black/20 text-sm leading-tight"
                                                                placeholder={s.label}
                                                            />
                                                        </th>
                                                    ))}
                                                    {customColumns.map(col => (
                                                        <th key={col.id} className="p-2 border border-[#7db037] w-[130px]">
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    value={col.label}
                                                                    onChange={e => handleColumnLabelChange(col.id, e.target.value)}
                                                                    className="bg-white/60 text-black text-center w-full px-1 py-0.5 rounded font-medium focus:ring-1 focus:ring-black outline-none border border-transparent hover:border-black/20 text-sm"
                                                                    placeholder="Column Name"
                                                                />
                                                                <button
                                                                    onClick={() => handleRemoveColumn(col.id)}
                                                                    className="text-red-700 hover:text-red-900 flex-shrink-0"
                                                                    title="Remove Column"
                                                                >
                                                                    <XMarkIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="p-2 border border-[#7db037] w-[40px]"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editingRecords.map(record => (
                                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors bg-white">
                                                        <td className="border border-gray-200 p-0">
                                                            <input
                                                                type="text"
                                                                value={record.examName}
                                                                onChange={e => handleCellChange(record.id, "examName", e.target.value)}
                                                                className="w-full p-3 font-semibold text-gray-800 bg-transparent focus:bg-white outline-none focus:ring-2 focus:ring-[#8cc63f]"
                                                                placeholder="e.g. 1st Monthly Exam"
                                                            />
                                                        </td>
                                                        {FIXED_SUBJECTS.map(s => (
                                                            <td key={s.key} className="border border-gray-200 p-0">
                                                                <input
                                                                    type="text"
                                                                    value={record.subjects[s.key] || ""}
                                                                    onChange={e => handleCellChange(record.id, s.key, e.target.value)}
                                                                    className="w-full p-3 text-center text-gray-700 bg-transparent focus:bg-white outline-none focus:ring-2 focus:ring-[#8cc63f]"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        {customColumns.map(col => (
                                                            <td key={col.id} className="border border-gray-200 p-0">
                                                                <input
                                                                    type="text"
                                                                    value={record.subjects[col.id] || ""}
                                                                    onChange={e => handleCellChange(record.id, col.id, e.target.value)}
                                                                    className="w-full p-3 text-center text-gray-700 bg-transparent focus:bg-white outline-none focus:ring-2 focus:ring-[#8cc63f]"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="border border-gray-200 p-0 text-center">
                                                            <button
                                                                onClick={() => handleRemoveRow(record.id)}
                                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors w-full h-full flex items-center justify-center"
                                                                title="Remove Row"
                                                            >
                                                                <TrashIcon className="w-5 h-5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            onClick={handleAddRow}
                                            className="flex items-center gap-2 text-sm font-semibold text-[#059669] bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl transition-colors border border-emerald-200"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Add Exam Row
                                        </button>
                                        <button
                                            onClick={handleAddColumn}
                                            className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-colors border border-blue-200"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Add Column
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* ── PRESENTATION TAB ── */}
                            {activeTab === "presentation" && (
                                <>
                                    <p className="text-xs text-gray-400 mb-3">Add criteria columns (e.g. Slide Quality, Delivery, Content), then add presentation rows and enter marks.</p>

                                    {presentationColumns.length === 0 && presentationRecords.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                                            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                                            </svg>
                                            <p className="font-medium text-gray-500">No presentation results yet</p>
                                            <p className="text-sm mt-1">Start by adding criteria columns, then add presentation rows.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white border border-[#8cc63f]/30 rounded-xl overflow-x-auto shadow-sm text-sm">
                                            <table className="w-full text-center border-collapse" style={{ minWidth: `${300 + presentationColumns.length * 150}px` }}>
                                                <thead>
                                                    <tr className="bg-[#8cc63f] text-black">
                                                        <th className="p-3 border border-[#7db037] font-bold text-left whitespace-nowrap w-[200px]">Presentation</th>
                                                        {presentationColumns.map(col => (
                                                            <th key={col.id} className="p-2 border border-[#7db037] min-w-[140px]">
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        value={col.label}
                                                                        onChange={e => handlePresentationColumnLabelChange(col.id, e.target.value)}
                                                                        className="bg-white/60 text-black text-center w-full px-1 py-0.5 rounded font-medium focus:ring-1 focus:ring-black outline-none border border-transparent hover:border-black/20 text-sm"
                                                                        placeholder="Criteria Name"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleRemovePresentationColumn(col.id)}
                                                                        className="text-red-700 hover:text-red-900 flex-shrink-0"
                                                                        title="Remove Column"
                                                                    >
                                                                        <XMarkIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </th>
                                                        ))}
                                                        <th className="p-2 border border-[#7db037] w-[40px]"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {presentationRecords.map(record => (
                                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors bg-white">
                                                            <td className="border border-gray-200 p-0">
                                                                <input
                                                                    type="text"
                                                                    value={record.presentationName}
                                                                    onChange={e => handlePresentationCellChange(record.id, "presentationName", e.target.value)}
                                                                    className="w-full p-3 font-semibold text-gray-800 bg-transparent focus:bg-white outline-none focus:ring-2 focus:ring-[#8cc63f]"
                                                                    placeholder="e.g. Presentation 1"
                                                                />
                                                            </td>
                                                            {presentationColumns.map(col => (
                                                                <td key={col.id} className="border border-gray-200 p-0">
                                                                    <input
                                                                        type="text"
                                                                        value={record.criteria[col.id] || ""}
                                                                        onChange={e => handlePresentationCellChange(record.id, col.id, e.target.value)}
                                                                        className="w-full p-3 text-center text-gray-700 bg-transparent focus:bg-white outline-none focus:ring-2 focus:ring-[#8cc63f]"
                                                                        placeholder="-"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="border border-gray-200 p-0 text-center">
                                                                <button
                                                                    onClick={() => handleRemovePresentationRow(record.id)}
                                                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors w-full h-full flex items-center justify-center"
                                                                    title="Remove Row"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            onClick={handleAddPresentationRow}
                                            className="flex items-center gap-2 text-sm font-semibold text-[#059669] bg-emerald-50 hover:bg-emerald-100 px-4 py-2.5 rounded-xl transition-colors border border-emerald-200"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Add Presentation Row
                                        </button>
                                        <button
                                            onClick={handleAddPresentationColumn}
                                            className="flex items-center gap-2 text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2.5 rounded-xl transition-colors border border-purple-200"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Add Criteria Column
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveStudentResult}
                                disabled={saving}
                                className={`px-6 py-2.5 font-bold rounded-xl text-white shadow-sm transition-all ${saving ? "bg-gray-400 cursor-not-allowed" : "bg-[#059669] hover:bg-[#047857]"}`}
                            >
                                {saving ? "Saving..." : "Save Results"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
