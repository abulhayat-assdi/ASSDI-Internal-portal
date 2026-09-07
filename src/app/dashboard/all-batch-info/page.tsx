"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { StudentBatchInfo, saveBatchInfo, getAllBatchInfo, updateStudentPhoto, deleteBatch } from "@/services/batchInfoService";
import Button from "@/components/ui/Button";
import * as XLSX from "xlsx";

function toDriveImg(url: string): string {
    if (url && url.includes("drive.google.com") && url.includes("/d/")) {
        const id = url.split("/d/")[1].split("/")[0];
        return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
    }
    return url;
}

type IconProps = React.SVGProps<SVGSVGElement>;

// Inline SVG icons (retained from previous design)
const CheckCircleIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const PlayCircleIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
    </svg>
);
const AcademicCapIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
);
const XCircleIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 13.5 3-3m0 0 3-3m-3 3-3-3m3 3 3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const NoSymbolIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);
const BriefcaseIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.896 1.95-2 1.95H5.75c-1.104 0-2-.856-2-1.95v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
    </svg>
);
const BuildingOfficeIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
    </svg>
);
const QuestionMarkCircleIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
);
const CurrencyDollarIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const UserGroupIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
);
const MagnifyingGlassIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

const ArrowDownTrayIcon = (props: IconProps) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

interface BatchStatItem {
    id: string;
    total: number;
    completed: number;
    incomplete: number;
    expelled: number;
    job: number;
    business: number;
    furtherStudy: number;
}

interface OverviewStat {
    label: string;
    value?: string;
    icon: React.ComponentType<IconProps>;
    color: string;
    lightColor: string;
    textColor: string;
    // For combined stats
    combined?: boolean;
    valueA?: string;
    valueB?: string;
    labelA?: string;
    labelB?: string;
    iconB?: React.ComponentType<IconProps>;
    textColorB?: string;
}

const COLUMNS = [
    "roll", "name", "phone", "dob", "educationalDegree", "category", "bloodGroup", "totalPaidTk", "address",
    "email", "nidBirthNo", "fatherName", "motherName", "permanentAddress",
    "guardianName", "guardianPhone", "lastInstitute", "latestDegree", "gpaResult",
    "currentDistrict", "homeDistrict", "tShirtSize", "courseGoal",
    "courseStatus", "currentlyDoing", "companyName", "businessName", "salary",
] as const;

// Edit-grid column definitions: order, header label and default pixel width.
// "__row" is the leading row-number column. The first four keys stay frozen
// (sticky) on desktop while the rest scroll horizontally; every column is
// user-resizable via the drag handle on its header's right edge.
const GRID_COLUMN_META: { key: string; label: string; width: number }[] = [
    { key: "__row", label: "#", width: 48 },
    { key: "roll", label: "Roll", width: 90 },
    { key: "name", label: "Name", width: 200 },
    { key: "phone", label: "Phone", width: 150 },
    { key: "dob", label: "Date of Birth", width: 130 },
    { key: "educationalDegree", label: "Educational Degree", width: 190 },
    { key: "category", label: "Category", width: 120 },
    { key: "bloodGroup", label: "Blood Group", width: 120 },
    { key: "totalPaidTk", label: "Total Paid TK", width: 120 },
    { key: "address", label: "Address", width: 260 },
    { key: "email", label: "Email", width: 200 },
    { key: "nidBirthNo", label: "NID / Birth No", width: 160 },
    { key: "fatherName", label: "Father Name", width: 170 },
    { key: "motherName", label: "Mother Name", width: 170 },
    { key: "permanentAddress", label: "Permanent Address", width: 240 },
    { key: "guardianName", label: "Guardian Name", width: 170 },
    { key: "guardianPhone", label: "Guardian Phone", width: 150 },
    { key: "lastInstitute", label: "Last Institute", width: 210 },
    { key: "latestDegree", label: "Latest Degree", width: 160 },
    { key: "gpaResult", label: "GPA / Result", width: 130 },
    { key: "currentDistrict", label: "Current District", width: 150 },
    { key: "homeDistrict", label: "Home District", width: 140 },
    { key: "tShirtSize", label: "T-Shirt Size", width: 120 },
    { key: "courseGoal", label: "Course Goal", width: 240 },
    { key: "courseStatus", label: "Course Status", width: 140 },
    { key: "currentlyDoing", label: "Currently Doing", width: 150 },
    { key: "companyName", label: "Company Name", width: 160 },
    { key: "businessName", label: "Business Name", width: 160 },
    { key: "salary", label: "Salary / Income", width: 150 },
];

const FROZEN_GRID_KEYS = ["__row", "roll", "name", "phone"];
const MIN_GRID_COL_WIDTH = 56;

export default function AllBatchInfoPage() {
    const confirm = useConfirm();
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.role === "admin" || userProfile?.role === "super_admin";
    const [allStudents, setAllStudents] = useState<StudentBatchInfo[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Batch Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newBatchName, setNewBatchName] = useState("");
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [isEditingExisting, setIsEditingExisting] = useState(false);
    const [isAddingRunningBatch, setIsAddingRunningBatch] = useState(false);

    // Search Features State
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [selectedSearchBatch, setSelectedSearchBatch] = useState("all");

    // Address Preview Modal State
    const [viewingAddress, setViewingAddress] = useState<{ name: string; address: string } | null>(null);

    // Photo Edit Modal State
    const [photoEditStudent, setPhotoEditStudent] = useState<StudentBatchInfo | null>(null);
    const [photoInputUrl, setPhotoInputUrl] = useState("");
    const [savingPhoto, setSavingPhoto] = useState(false);

    // Student Detail Modal State
    const [detailStudent, setDetailStudent] = useState<StudentBatchInfo | null>(null);

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedExportBatch, setSelectedExportBatch] = useState("all");

    // Grid Data State (replaces ref — React controls all re-renders)
    const MAX_ROWS = 200;
    const PAGE_SIZE = 50;
    const [gridData, setGridData] = useState<Record<string, string>[]>([]);
    const [gridPage, setGridPage] = useState(0);

    const initializeEmptyRows = useCallback(() => {
        return Array.from({ length: MAX_ROWS }).map(() =>
            Object.fromEntries(COLUMNS.map(c => [c, ""]))
        );
    }, []);

    const totalPages = Math.ceil(MAX_ROWS / PAGE_SIZE);
    const pagedRows = useMemo(() => {
        const start = gridPage * PAGE_SIZE;
        return gridData.slice(start, start + PAGE_SIZE);
    }, [gridData, gridPage]);

    // Resizable edit-grid columns
    const [gridColWidths, setGridColWidths] = useState<Record<string, number>>(
        () => Object.fromEntries(GRID_COLUMN_META.map(c => [c.key, c.width]))
    );
    const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

    const startColResize = useCallback((e: React.PointerEvent, key: string) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = { key, startX: e.clientX, startW: gridColWidths[key] ?? 120 };

        const onMove = (ev: PointerEvent) => {
            const s = resizeRef.current;
            if (!s) return;
            const next = Math.max(MIN_GRID_COL_WIDTH, s.startW + (ev.clientX - s.startX));
            setGridColWidths(prev => ({ ...prev, [s.key]: next }));
        };
        const onUp = () => {
            resizeRef.current = null;
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }, [gridColWidths]);

    // Cumulative left offset for each frozen column (used for sticky positioning)
    const frozenGridLeft = useMemo(() => {
        const map: Record<string, number> = {};
        let acc = 0;
        for (const key of FROZEN_GRID_KEYS) {
            map[key] = acc;
            acc += gridColWidths[key] ?? 0;
        }
        return map;
    }, [gridColWidths]);

    const totalGridWidth = useMemo(
        () => GRID_COLUMN_META.reduce((sum, c) => sum + (gridColWidths[c.key] ?? 0), 0),
        [gridColWidths]
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getAllBatchInfo();
            setAllStudents(data);
        } catch (error) {
            console.error("Error fetching batch info:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Separate students by batch type
    const completedStudentsList = allStudents.filter(s => s.batchType !== "Running");
    const runningStudentsList = allStudents.filter(s => s.batchType === "Running");

    // Derive stats from filtered batch (or all when 'all') ONLY for completed batches
    const filteredStudents = selectedSearchBatch === "all" ? completedStudentsList : completedStudentsList.filter(s => s.batchName === selectedSearchBatch);

    // Derived Statistics (always based on filteredStudents for real-time batch filtering)
    const uniqueBatchesCount = new Set(completedStudentsList.map(s => s.batchName)).size;
    const totalStudents = filteredStudents.length;
    const completedStudents = filteredStudents.filter(s => s.courseStatus === "Completed").length;
    const incompleteStudents = filteredStudents.filter(s => s.courseStatus === "Incomplete").length;
    const expelledStudents = filteredStudents.filter(s => s.courseStatus === "Expelled").length;

    const studentsJob = filteredStudents.filter(s => s.currentlyDoing === "Job").length;
    const studentsBusiness = filteredStudents.filter(s => s.currentlyDoing === "Business").length;
    const studentsFurtherStudy = filteredStudents.filter(s => s.currentlyDoing === "Nothing" || s.currentlyDoing === "Studying Further").length;

    const totalEarnings = filteredStudents.reduce((sum, student) => sum + (Number(student.salary) || 0), 0);
    const formattedEarnings = "৳ " + totalEarnings.toLocaleString();

    const isBatchFiltered = selectedSearchBatch !== "all";

    const overviewStats: OverviewStat[] = [
        { label: isBatchFiltered ? "Batch" : "Completed Batches", value: isBatchFiltered ? selectedSearchBatch : uniqueBatchesCount.toString(), icon: CheckCircleIcon, color: "bg-emerald-500", lightColor: "bg-emerald-50", textColor: "text-emerald-700" },
        { label: "Total Student Admitted", value: totalStudents.toString(), icon: UserGroupIcon, color: "bg-blue-500", lightColor: "bg-blue-50", textColor: "text-blue-700" },
        { label: "Students Completed", value: completedStudents.toString(), icon: AcademicCapIcon, color: "bg-indigo-500", lightColor: "bg-indigo-50", textColor: "text-indigo-700" },
        { label: "Incomplete + Expelled", valueA: incompleteStudents.toString(), valueB: expelledStudents.toString(), labelA: "Incomplete", labelB: "Expelled", icon: XCircleIcon, iconB: NoSymbolIcon, color: "bg-orange-500", lightColor: "bg-orange-50", textColor: "text-orange-600", textColorB: "text-red-600", combined: true },
        { label: "Employed / Job", value: studentsJob.toString(), icon: BriefcaseIcon, color: "bg-cyan-500", lightColor: "bg-cyan-50", textColor: "text-cyan-700" },
        { label: "Doing Business", value: studentsBusiness.toString(), icon: BuildingOfficeIcon, color: "bg-purple-500", lightColor: "bg-purple-50", textColor: "text-purple-700" },
        { label: "Studying Further", value: studentsFurtherStudy.toString(), icon: QuestionMarkCircleIcon, color: "bg-slate-500", lightColor: "bg-slate-50", textColor: "text-slate-700" },
        { label: "Students Earning / Month", value: formattedEarnings, icon: CurrencyDollarIcon, color: "bg-emerald-600", lightColor: "bg-emerald-100", textColor: "text-emerald-800" },
    ];

    // Stats for Running Batches
    const runningBatchesFiltered = selectedSearchBatch === "all" ? runningStudentsList : runningStudentsList.filter(s => s.batchName === selectedSearchBatch);
    const runningUniqueBatchesCount = new Set(runningStudentsList.map(s => s.batchName)).size;
    const runningTotalStudents = runningBatchesFiltered.length;
    const runningIncomplete = runningBatchesFiltered.filter(s => s.courseStatus === "Incomplete").length;
    const runningExpelled = runningBatchesFiltered.filter(s => s.courseStatus === "Expelled").length;
    const runningActiveList = runningBatchesFiltered.length - runningIncomplete - runningExpelled;

    const runningStats: OverviewStat[] = [
        { label: isBatchFiltered ? "Running Batch" : "Running Batches", value: isBatchFiltered ? selectedSearchBatch : runningUniqueBatchesCount.toString(), icon: PlayCircleIcon, color: "bg-blue-500", lightColor: "bg-blue-50", textColor: "text-blue-700" },
        { label: "Total Student Admitted", value: runningTotalStudents.toString(), icon: UserGroupIcon, color: "bg-purple-500", lightColor: "bg-purple-50", textColor: "text-purple-700" },
        { label: "Total Student Running", value: runningActiveList.toString(), icon: UserGroupIcon, color: "bg-emerald-500", lightColor: "bg-emerald-50", textColor: "text-emerald-700" },
        { label: "Incomplete + Expelled", valueA: runningIncomplete.toString(), valueB: runningExpelled.toString(), labelA: "Incomplete", labelB: "Expelled", icon: XCircleIcon, iconB: NoSymbolIcon, color: "bg-orange-500", lightColor: "bg-orange-50", textColor: "text-orange-600", textColorB: "text-red-600", combined: true },
    ];

    const searchResults = useMemo(() => {
        const filtered = allStudents.filter(student => {
            const query = studentSearchQuery.toLowerCase();
            const matchesQuery = !query ||
                (student.name?.toLowerCase().includes(query)) ||
                (student.roll?.toLowerCase().includes(query)) ||
                (student.phone?.toLowerCase().includes(query));
            const matchesBatch = selectedSearchBatch === "all" || student.batchName === selectedSearchBatch;
            return matchesQuery && matchesBatch;
        });

        return filtered.sort((a, b) => {
            const batchCompare = a.batchName.localeCompare(b.batchName, undefined, { numeric: true, sensitivity: "base" });
            if (batchCompare !== 0) return batchCompare;
            return (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true, sensitivity: "base" });
        });
    }, [allStudents, studentSearchQuery, selectedSearchBatch]);

    const isSearchActive = studentSearchQuery.trim() !== "" || selectedSearchBatch !== "all";

    // Batch-wise Aggregation (always over ALL students for the breakdown table)
    const batchStatsMap = allStudents.reduce((acc, student) => {
        if (!acc[student.batchName]) {
            acc[student.batchName] = {
                id: student.batchName,
                total: 0, completed: 0, incomplete: 0, expelled: 0, job: 0, business: 0, furtherStudy: 0
            };
        }
        const b = acc[student.batchName];
        b.total += 1;
        if (student.courseStatus === "Completed") b.completed += 1;
        if (student.courseStatus === "Incomplete") b.incomplete += 1;
        if (student.courseStatus === "Expelled") b.expelled += 1;
        if (student.currentlyDoing === "Job") b.job += 1;
        if (student.currentlyDoing === "Business") b.business += 1;
        if (student.currentlyDoing === "Nothing" || student.currentlyDoing === "Studying Further") b.furtherStudy += 1;
        return acc;
    }, {} as Record<string, BatchStatItem>);

    const batchWiseData = Object.values(batchStatsMap).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }));
    const uniqueBatchesList = Array.from(new Set(allStudents.map(s => s.batchName))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    const handleSelectExistingBatch = (batchName: string) => {
        setNewBatchName(batchName);
        setIsEditingExisting(true);

        // Pre-fill grid data via React state
        const batchStudents = allStudents.filter(s => s.batchName === batchName);
        batchStudents.sort((a, b) => (a.roll || "").localeCompare(b.roll || "", undefined, { numeric: true, sensitivity: "base" }));
        const wasRunning = batchStudents.length > 0 && batchStudents[0].batchType === "Running";
        setIsAddingRunningBatch(wasRunning);

        const newGrid = initializeEmptyRows();
        batchStudents.forEach((student, index) => {
            if (index < MAX_ROWS) {
                newGrid[index] = {
                    roll: student.roll || "",
                    name: student.name || "",
                    phone: student.phone || "",
                    dob: student.dob || "",
                    educationalDegree: student.educationalDegree || "",
                    category: student.category || "",
                    bloodGroup: student.bloodGroup || "",
                    totalPaidTk: student.totalPaidTk ? student.totalPaidTk.toString() : "",
                    address: student.address || "",
                    email: student.email || "",
                    nidBirthNo: student.nidBirthNo || "",
                    fatherName: student.fatherName || "",
                    motherName: student.motherName || "",
                    permanentAddress: student.permanentAddress || "",
                    guardianName: student.guardianName || "",
                    guardianPhone: student.guardianPhone || "",
                    lastInstitute: student.lastInstitute || "",
                    latestDegree: student.latestDegree || "",
                    gpaResult: student.gpaResult || "",
                    currentDistrict: student.currentDistrict || "",
                    homeDistrict: student.homeDistrict || "",
                    tShirtSize: student.tShirtSize || "",
                    courseGoal: student.courseGoal || "",
                    courseStatus: student.courseStatus || "",
                    currentlyDoing: student.currentlyDoing || "",
                    companyName: student.companyName || "",
                    businessName: student.businessName || "",
                    salary: student.salary ? student.salary.toString() : ""
                };
            }
        });
        setGridData(newGrid);
        setGridPage(0);
        setIsSelectionModalOpen(false);
        setIsAddModalOpen(true);
    };

    const handleOpenNewBatch = (isRunning: boolean = false) => {
        setNewBatchName("");
        setIsEditingExisting(false);
        setIsAddingRunningBatch(isRunning);
        setGridData(initializeEmptyRows());
        setGridPage(0);
        setIsSelectionModalOpen(false);
        setIsAddModalOpen(true);
    };

    // Form Event Handlers — update React state directly (no DOM mutation)
    const handleCellChange = useCallback((rowIndex: number, field: string, value: string) => {
        setGridData(prev => {
            const next = [...prev];
            next[rowIndex] = { ...next[rowIndex], [field]: value };
            return next;
        });
    }, []);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>, startRowIndex: number, startColKey: string) => {
        e.preventDefault();

        const clipboardData = e.clipboardData.getData('Text');
        if (!clipboardData) return;

        const pastedLines = clipboardData.split(/\r?\n/).filter(line => line.length > 0);
        const startColIndex = (COLUMNS as readonly string[]).indexOf(startColKey);
        if (startColIndex === -1) return;

        // Update React state — let React update the DOM
        setGridData(prev => {
            const next = [...prev];
            pastedLines.forEach((line, lineIndex) => {
                const cells = line.split('\t');
                const targetRowIndex = startRowIndex + lineIndex;
                if (targetRowIndex >= MAX_ROWS) return;
                cells.forEach((cellValue, cellIndex) => {
                    const targetColIndex = startColIndex + cellIndex;
                    if (targetColIndex < COLUMNS.length) {
                        const fieldKey = COLUMNS[targetColIndex];
                        next[targetRowIndex] = { ...next[targetRowIndex], [fieldKey]: cellValue };
                    }
                });
            });
            return next;
        });

        // Navigate to the page where paste began
        const pasteEndRow = startRowIndex + pastedLines.length - 1;
        const targetPage = Math.floor(Math.min(pasteEndRow, MAX_ROWS - 1) / PAGE_SIZE);
        setGridPage(targetPage);
    }, []);

    const handleSaveBatchInfo = async () => {
        if (!newBatchName.trim()) {
            alert("Please enter a valid Batch Name.");
            return;
        }

        setIsAdding(true);
        try {
            // Filter out purely empty rows
            const validRows = gridData.filter(row =>
                row.roll && row.roll.trim() !== "" &&
                row.name && row.name.trim() !== ""
            );

            if (validRows.length === 0) {
                alert("Please add at least one student with a Roll and Name.");
                setIsAdding(false);
                return;
            }

            const cleanData = validRows.map(row => ({
                batchName: newBatchName,
                roll: row.roll,
                name: row.name,
                phone: row.phone || "",
                dob: row.dob || "",
                educationalDegree: row.educationalDegree || "",
                category: (row.category || "") as StudentBatchInfo['category'],
                bloodGroup: row.bloodGroup || "",
                totalPaidTk: row.totalPaidTk || "",
                address: row.address || "",
                email: row.email || "",
                nidBirthNo: row.nidBirthNo || "",
                fatherName: row.fatherName || "",
                motherName: row.motherName || "",
                permanentAddress: row.permanentAddress || "",
                guardianName: row.guardianName || "",
                guardianPhone: row.guardianPhone || "",
                lastInstitute: row.lastInstitute || "",
                latestDegree: row.latestDegree || "",
                gpaResult: row.gpaResult || "",
                currentDistrict: row.currentDistrict || "",
                homeDistrict: row.homeDistrict || "",
                tShirtSize: row.tShirtSize || "",
                courseGoal: row.courseGoal || "",
                courseStatus: (row.courseStatus || "") as StudentBatchInfo['courseStatus'],
                currentlyDoing: (row.currentlyDoing || "") as StudentBatchInfo['currentlyDoing'],
                companyName: row.companyName || "",
                businessName: row.businessName || "",
                salary: Number(row.salary) || 0
            }));

            await saveBatchInfo(newBatchName, cleanData, isAddingRunningBatch ? "Running" : "Completed");
            await fetchData();
            setIsAddModalOpen(false);
            setIsEditingExisting(false);
        } catch (error) {
            console.error(error);
            alert("Failed to save batch data. Please check console for details.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleSavePhoto = async () => {
        if (!photoEditStudent) return;
        setSavingPhoto(true);
        try {
            await updateStudentPhoto(photoEditStudent.batchName, photoEditStudent.roll, photoInputUrl.trim() || null);
            setAllStudents(prev => prev.map(s =>
                s.batchName === photoEditStudent.batchName && s.roll === photoEditStudent.roll
                    ? { ...s, photo: photoInputUrl.trim() || undefined }
                    : s
            ));
            setPhotoEditStudent(null);
        } catch (err) {
            alert("Failed to save photo. Please try again.");
            console.error(err);
        } finally {
            setSavingPhoto(false);
        }
    };

    const handleCompleteBatch = async () => {
        if (!newBatchName.trim()) {
            alert("Please enter a valid Batch Name.");
            return;
        }

        const ok = await confirm({ message: `Are you sure you want to mark ${newBatchName} as Completed? This will change the status of all missing/running students to 'Completed'.`, variant: "warning" });
        if (ok) {
            setIsAdding(true);
            try {
                // Filter out purely empty rows
                const validRows = gridData.filter(row =>
                    row.roll && row.roll.trim() !== "" &&
                    row.name && row.name.trim() !== ""
                );

                if (validRows.length === 0) {
                    alert("Please add at least one student with a Roll and Name.");
                    setIsAdding(false);
                    return;
                }

                const cleanData = validRows.map(row => {
                    let updatedStatus = row.courseStatus;
                    if (!updatedStatus || updatedStatus === "Running") {
                        updatedStatus = "Completed";
                    }

                    return {
                        batchName: newBatchName,
                        roll: row.roll,
                        name: row.name,
                        phone: row.phone || "",
                        dob: row.dob || "",
                        educationalDegree: row.educationalDegree || "",
                        category: (row.category || "") as StudentBatchInfo['category'],
                        bloodGroup: row.bloodGroup || "",
                        totalPaidTk: row.totalPaidTk || "",
                        address: row.address || "",
                        email: row.email || "",
                        nidBirthNo: row.nidBirthNo || "",
                        fatherName: row.fatherName || "",
                        motherName: row.motherName || "",
                        permanentAddress: row.permanentAddress || "",
                        guardianName: row.guardianName || "",
                        guardianPhone: row.guardianPhone || "",
                        lastInstitute: row.lastInstitute || "",
                        latestDegree: row.latestDegree || "",
                        gpaResult: row.gpaResult || "",
                        currentDistrict: row.currentDistrict || "",
                        homeDistrict: row.homeDistrict || "",
                        tShirtSize: row.tShirtSize || "",
                        courseGoal: row.courseGoal || "",
                        courseStatus: (updatedStatus || "") as StudentBatchInfo['courseStatus'],
                        currentlyDoing: (row.currentlyDoing || "") as StudentBatchInfo['currentlyDoing'],
                        companyName: row.companyName || "",
                        businessName: row.businessName || "",
                        salary: Number(row.salary) || 0
                    };
                });

                await saveBatchInfo(newBatchName, cleanData, "Completed", new Date());
                await fetchData();
                setIsAddModalOpen(false);
                setIsEditingExisting(false);
            } catch (error) {
                console.error(error);
                alert("Failed to complete batch. Please check console for details.");
            } finally {
                setIsAdding(false);
            }
        }
    };

    const executeExportExcel = (batchName: string) => {
        try {
            const isAll = batchName === "all";
            const currentExportStudents = isAll ? allStudents : allStudents.filter(s => s.batchName === batchName);

            // Calculate stats for this specific export
            const expTotalStudents = currentExportStudents.length;
            const expCompleted = currentExportStudents.filter(s => s.courseStatus === "Completed").length;
            const expIncomplete = currentExportStudents.filter(s => s.courseStatus === "Incomplete").length;
            const expExpelled = currentExportStudents.filter(s => s.courseStatus === "Expelled").length;
            const expJob = currentExportStudents.filter(s => s.currentlyDoing === "Job").length;
            const expBusiness = currentExportStudents.filter(s => s.currentlyDoing === "Business").length;
            const expFurtherStudy = currentExportStudents.filter(s => s.currentlyDoing === "Nothing" || s.currentlyDoing === "Studying Further").length;
            const expEarnings = currentExportStudents.reduce((sum, s) => sum + (Number(s.salary) || 0), 0);

            const wb = XLSX.utils.book_new();
            const sheetData: (string | number)[][] = [];

            // 1. Overview Summary Header
            sheetData.push(["Overview Summary", ""]);
            sheetData.push(["Metric", "Value"]);
            sheetData.push([isAll ? "Completed Batches" : "Batch Name", isAll ? uniqueBatchesCount : batchName]);
            sheetData.push(["Total Student Admitted", expTotalStudents]);
            sheetData.push(["Students Completed", expCompleted]);
            sheetData.push(["Incomplete", expIncomplete]);
            sheetData.push(["Expelled", expExpelled]);
            sheetData.push(["Employed / Job", expJob]);
            sheetData.push(["Doing Business", expBusiness]);
            sheetData.push(["Studying Further", expFurtherStudy]);
            sheetData.push(["Students Earning / Month", expEarnings]);

            // Leave empty rows
            sheetData.push([]);
            sheetData.push([]);

            // 2. Student List Header
            sheetData.push(["Student List"]);
            sheetData.push([
                "Batch", "Roll", "Name", "Phone", "Date of Birth", "Educational Degree", "Category", "Blood Group",
                "Total Paid TK", "Address", "Email", "NID / Birth No", "Father Name", "Mother Name", "Permanent Address",
                "Guardian Name", "Guardian Phone", "Last Institute", "Latest Degree", "GPA / Result",
                "Current District", "Home District", "T-Shirt Size", "Course Goal",
                "Status", "Currently", "Company Name", "Business Name", "Salary"
            ]);

            // 3. Student Data
            currentExportStudents.forEach(s => {
                sheetData.push([
                    s.batchName || "-",
                    s.roll || "-",
                    s.name || "-",
                    s.phone || "-",
                    s.dob || "-",
                    s.educationalDegree || "-",
                    s.category || "-",
                    s.bloodGroup || "-",
                    s.totalPaidTk || "-",
                    s.address || "-",
                    s.email || "-",
                    s.nidBirthNo || "-",
                    s.fatherName || "-",
                    s.motherName || "-",
                    s.permanentAddress || "-",
                    s.guardianName || "-",
                    s.guardianPhone || "-",
                    s.lastInstitute || "-",
                    s.latestDegree || "-",
                    s.gpaResult || "-",
                    s.currentDistrict || "-",
                    s.homeDistrict || "-",
                    s.tShirtSize || "-",
                    s.courseGoal || "-",
                    s.courseStatus || "-",
                    s.currentlyDoing === 'Nothing' ? 'Studying Further' : (s.currentlyDoing || "-"),
                    s.companyName || "-",
                    s.businessName || "-",
                    s.salary ? `৳ ${s.salary.toLocaleString()}` : "-"
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            ws['!cols'] = [
                { wch: 18 }, // Batch / Metric
                { wch: 15 }, // Roll / Value
                { wch: 25 }, // Name
                { wch: 15 }, // Phone
                { wch: 14 }, // Date of Birth
                { wch: 18 }, // Educational Degree
                { wch: 12 }, // Category
                { wch: 10 }, // Blood Group
                { wch: 14 }, // Total Paid TK
                { wch: 30 }, // Address
                { wch: 26 }, // Email
                { wch: 16 }, // NID / Birth No
                { wch: 20 }, // Father Name
                { wch: 20 }, // Mother Name
                { wch: 30 }, // Permanent Address
                { wch: 20 }, // Guardian Name
                { wch: 15 }, // Guardian Phone
                { wch: 22 }, // Last Institute
                { wch: 16 }, // Latest Degree
                { wch: 14 }, // GPA / Result
                { wch: 16 }, // Current District
                { wch: 16 }, // Home District
                { wch: 10 }, // T-Shirt Size
                { wch: 22 }, // Course Goal
                { wch: 12 }, // Status
                { wch: 18 }, // Currently
                { wch: 20 }, // Company Name
                { wch: 20 }, // Business Name
                { wch: 15 }, // Salary
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Batch Data");

            const fileName = `Batch_Data_${isAll ? 'All' : batchName}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            setIsExportModalOpen(false);
        } catch (error) {
            console.error("Error exporting to Excel:", error);
            alert("Failed to export data to Excel.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-[#059669] rounded-full"></div>
                    <div>
                        <h1 className="text-3xl font-bold text-[#1f2937]">
                            All Batch Information
                        </h1>
                        <p className="text-[#6b7280] mt-1">
                            Comprehensive overview of batch statistics, student outcomes, and students earning.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button
                            onClick={() => setIsSelectionModalOpen(true)}
                            className="px-4 py-2.5 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#10b981] transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Manage Batch Data
                        </button>
                    )}
                </div>
            </div>

            {/* Search Filters Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="Search student by Name, Roll, or Phone Number..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#059669] focus:border-[#059669] sm:text-sm transition-colors"
                    />
                </div>
                <div className="w-full md:w-64 shrink-0">
                    <select
                        value={selectedSearchBatch}
                        onChange={(e) => setSelectedSearchBatch(e.target.value)}
                        className="block w-full py-2.5 px-3 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] sm:text-sm transition-colors"
                    >
                        <option value="all">💳 All Batches</option>
                        {uniqueBatchesList.map(batchName => (
                            <option key={batchName} value={batchName}>{batchName}</option>
                        ))}
                    </select>
                </div>
                <div className="shrink-0">
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f0fdf4] text-[#059669] border border-[#059669]/20 text-sm font-semibold rounded-xl hover:bg-[#dcfce7] transition-colors shadow-sm whitespace-nowrap"
                        title="Download Data to Excel"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Download Data
                    </button>
                </div>
            </div>



            {/* Student Detail Modal */}
            {detailStudent && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setDetailStudent(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{detailStudent.name}</h3>
                                <p className="text-sm text-gray-500">Roll: {detailStudent.roll} &bull; {detailStudent.batchName}</p>
                            </div>
                            <button onClick={() => setDetailStudent(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            {([
                                ["ফোন", detailStudent.phone],
                                ["সর্বমোট পেমেন্ট", detailStudent.totalPaidTk ? `৳ ${detailStudent.totalPaidTk}` : undefined],
                                ["ই-মেইল", detailStudent.email],
                                ["NID / জন্ম নং", detailStudent.nidBirthNo],
                                ["জন্ম তারিখ", detailStudent.dob],
                                ["ব্লাড গ্রুপ", detailStudent.bloodGroup],
                                ["ক্যাটাগরি", detailStudent.category],
                                ["টি-শার্ট সাইজ", detailStudent.tShirtSize],
                                ["পিতার নাম", detailStudent.fatherName],
                                ["মাতার নাম", detailStudent.motherName],
                                ["অভিভাবক", detailStudent.guardianName],
                                ["অভিভাবকের ফোন", detailStudent.guardianPhone],
                                ["বর্তমান ঠিকানা", detailStudent.address],
                                ["স্থায়ী ঠিকানা", detailStudent.permanentAddress],
                                ["বর্তমান জেলা", detailStudent.currentDistrict],
                                ["স্থায়ী জেলা", detailStudent.homeDistrict],
                                ["শিক্ষা প্রতিষ্ঠান", detailStudent.lastInstitute],
                                ["সর্বোচ্চ ডিগ্রি", detailStudent.latestDegree || detailStudent.educationalDegree],
                                ["GPA / ফলাফল", detailStudent.gpaResult],
                                ["Course Status", detailStudent.courseStatus],
                                ["Currently Doing", detailStudent.currentlyDoing],
                                ["Company", detailStudent.companyName],
                                ["Business", detailStudent.businessName],
                                ["Salary", detailStudent.salary ? `৳ ${detailStudent.salary.toLocaleString()}` : undefined],
                            ] as [string, string | number | undefined][]).map(([label, val]) =>
                                val ? (
                                    <div key={label} className="flex gap-2 py-1.5 border-b border-gray-50">
                                        <span className="text-xs text-gray-400 w-32 shrink-0">{label}</span>
                                        <span className="text-sm text-gray-800 break-words flex-1">{String(val)}</span>
                                    </div>
                                ) : null
                            )}
                            {detailStudent.courseGoal && (
                                <div className="col-span-2 flex gap-2 py-1.5 border-b border-gray-50">
                                    <span className="text-xs text-gray-400 w-32 shrink-0">কোর্সের লক্ষ্য</span>
                                    <span className="text-sm text-gray-800 flex-1">{detailStudent.courseGoal}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Address Preview Modal */}
            {viewingAddress && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setViewingAddress(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-[#1e3a5f] px-5 py-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-white font-bold text-base">Full Address</h3>
                                <p className="text-blue-200 text-xs mt-0.5">{viewingAddress.name}</p>
                            </div>
                            <button
                                onClick={() => setViewingAddress(null)}
                                className="text-blue-200 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="text-gray-700 text-sm leading-relaxed">{viewingAddress.address}</p>
                            </div>
                        </div>
                        <div className="px-5 pb-4">
                            <button
                                onClick={() => setViewingAddress(null)}
                                className="w-full py-2 bg-[#059669] text-white text-sm font-semibold rounded-lg hover:bg-[#047857] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Edit Modal */}
            {photoEditStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPhotoEditStudent(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#1e3a5f] px-5 py-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-white font-bold text-base">Edit Student Photo</h3>
                                <p className="text-blue-200 text-xs mt-0.5">{photoEditStudent.name} — Roll {photoEditStudent.roll}</p>
                            </div>
                            <button onClick={() => setPhotoEditStudent(null)} className="text-blue-200 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Preview */}
                            <div className="flex justify-center">
                                {photoInputUrl.trim() ? (
                                    <div className="w-24 h-24 rounded-full overflow-hidden relative border-4 border-emerald-200 shadow-md">
                                        <Image src={toDriveImg(photoInputUrl.trim())} alt="Preview" fill sizes="96px" className="object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center">
                                        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Google Drive Share Link</label>
                                <input
                                    type="text"
                                    value={photoInputUrl}
                                    onChange={e => setPhotoInputUrl(e.target.value)}
                                    placeholder="https://drive.google.com/file/d/.../view"
                                    className="block w-full py-2.5 px-4 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-sm transition-all"
                                />
                                <p className="text-xs text-gray-400 mt-1.5">গুগল ড্রাইভে আপলোড করে "Anyone with the link" শেয়ার করুন, তারপর লিংকটি এখানে পেস্ট করুন।</p>
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={handleSavePhoto}
                                    disabled={savingPhoto}
                                    className="flex-1 py-2.5 bg-[#059669] text-white text-sm font-bold rounded-xl hover:bg-[#047857] transition-colors disabled:opacity-60"
                                >
                                    {savingPhoto ? "Saving..." : "Save Photo"}
                                </button>
                                {photoEditStudent.photo && (
                                    <button
                                        onClick={() => { setPhotoInputUrl(""); }}
                                        className="px-4 py-2.5 text-red-600 bg-red-50 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors border border-red-100"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setPhotoEditStudent(null)}
                                    className="px-4 py-2.5 text-gray-600 bg-gray-100 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Selection Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsExportModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Download Data</h3>
                            <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Batch to Download</label>
                            <select
                                value={selectedExportBatch}
                                onChange={(e) => setSelectedExportBatch(e.target.value)}
                                className="block w-full py-2.5 px-3 border border-gray-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-[#059669] sm:text-sm transition-colors mb-6"
                            >
                                <option value="all">💳 All Batches</option>
                                {uniqueBatchesList.map(batchName => (
                                    <option key={batchName} value={batchName}>{batchName}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => executeExportExcel(selectedExportBatch)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#059669] text-white text-sm font-semibold rounded-xl hover:bg-[#047857] transition-colors shadow-sm"
                            >
                                <ArrowDownTrayIcon className="w-5 h-5" />
                                Download Excel File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overview Stats Grid */}
            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
                    <span className="ml-3 text-gray-500">Loading metrics...</span>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {overviewStats.map((stat, index) => {
                            const Icon = stat.icon;
                            if (stat.combined) {
                                const IconB = stat.iconB!;
                                return (
                                    <div
                                        key={index}
                                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group"
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-500 mb-2">{stat.label}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="text-center">
                                                    <p className="text-xs text-gray-400 mb-0.5">{stat.labelA}</p>
                                                    <span className={"text-2xl lg:text-3xl font-bold " + stat.textColor}>{stat.valueA}</span>
                                                </div>
                                                <span className="text-2xl font-light text-gray-300 pb-0 mt-4">+</span>
                                                <div className="text-center">
                                                    <p className="text-xs text-gray-400 mb-0.5">{stat.labelB}</p>
                                                    <span className={"text-2xl lg:text-3xl font-bold " + stat.textColorB}>{stat.valueB}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={"flex flex-col gap-1.5 p-2 rounded-xl " + stat.lightColor}>
                                            <Icon className={"w-5 h-5 " + stat.textColor} />
                                            <IconB className={"w-5 h-5 " + stat.textColorB} />
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div
                                    key={index}
                                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                                        <h3 className={"text-2xl lg:text-3xl font-bold " + stat.textColor}>{stat.value}</h3>
                                    </div>
                                    <div className={"p-3 rounded-xl transition-colors duration-300 " + stat.lightColor}>
                                        <Icon className={"w-7 h-7 " + stat.textColor} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Running Batches Stats Grid */}
                    {(!isBatchFiltered || runningTotalStudents > 0) && (
                        <div className="pt-2 animate-in fade-in duration-500">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Current Running Batches
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {runningStats.map((stat, index) => {
                                    const Icon = stat.icon;
                                    if (stat.combined) {
                                        const IconB = stat.iconB!;
                                        return (
                                            <div
                                                key={`run-${index}`}
                                                className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group"
                                            >
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-500 mb-2">{stat.label}</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-400 mb-0.5">{stat.labelA}</p>
                                                            <span className={"text-2xl lg:text-3xl font-bold " + stat.textColor}>{stat.valueA}</span>
                                                        </div>
                                                        <span className="text-2xl font-light text-gray-300 pb-0 mt-4">+</span>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-400 mb-0.5">{stat.labelB}</p>
                                                            <span className={"text-2xl lg:text-3xl font-bold " + stat.textColorB}>{stat.valueB}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={"flex flex-col gap-1.5 p-2 rounded-xl " + stat.lightColor}>
                                                    <Icon className={"w-5 h-5 " + stat.textColor} />
                                                    <IconB className={"w-5 h-5 " + stat.textColorB} />
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div
                                            key={`run-${index}`}
                                            className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                                                <h3 className={"text-2xl lg:text-3xl font-bold " + stat.textColor}>{stat.value}</h3>
                                            </div>
                                            <div className={"p-3 rounded-xl transition-colors duration-300 " + stat.lightColor}>
                                                <Icon className={"w-7 h-7 " + stat.textColor} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Student Table for batch-filtered view */}
            {!loading && isBatchFiltered && (
                <div className="bg-white rounded-2xl shadow-sm border border-[#059669]/20 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-[#059669]/5 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-[#059669] flex items-center gap-2">
                            <UserGroupIcon className="w-5 h-5" />
                            {selectedSearchBatch} — Students ({searchResults.length})
                        </h2>
                        {studentSearchQuery && (
                            <span className="text-xs text-gray-500">Filtered by name / roll / phone</span>
                        )}
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-[#1e3a5f] text-white text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-16 md:sticky md:left-0 md:z-20 bg-[#1e3a5f]">Photo</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-20 md:sticky md:left-16 md:z-20 bg-[#1e3a5f]">Roll</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-40 md:sticky md:left-[144px] md:z-20 bg-[#1e3a5f]">Name</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-32 md:sticky md:left-[304px] md:z-20 bg-[#1e3a5f] md:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.3)]">Phone</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[120px]">Date of Birth</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[150px]">Educational Degree</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278]">Category</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[100px]">Blood Group</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[100px]">Total Paid TK</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[200px]">Address</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[160px]">Email</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[140px]">NID / Birth No</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[140px]">Father Name</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[140px]">Mother Name</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[120px]">T-Shirt Size</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[120px]">Current District</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278]">Status</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278]">Currently</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[120px]">Company</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] min-w-[120px]">Business</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278]">Salary</th>
                                    <th className="px-4 py-3 font-medium border border-[#2d5278] w-20">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchResults.length === 0 ? (
                                    <tr>
                                        <td colSpan={24} className="px-6 py-12 text-center text-gray-500">
                                            <NoSymbolIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p>No students found.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    searchResults.map((student, idx) => (
                                        <tr
                                            key={student.id}
                                            className={idx % 2 === 0 ? "bg-white hover:bg-gray-50 transition-colors" : "bg-[#f9fafb] hover:bg-gray-50 transition-colors"}
                                        >
                                            <td className="px-4 py-3 border-b border-gray-200 text-center w-16 md:sticky md:left-0 md:z-[5] bg-inherit">
                                                <button
                                                    onClick={() => { setPhotoEditStudent(student); setPhotoInputUrl(student.photo || ""); }}
                                                    className="mx-auto block"
                                                    title="Edit photo"
                                                >
                                                    {student.photo ? (
                                                        <div className="w-9 h-9 rounded-full overflow-hidden relative border-2 border-emerald-200 mx-auto">
                                                            <Image src={toDriveImg(student.photo)} alt={student.name} fill sizes="36px" className="object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto hover:border-[#059669] hover:bg-emerald-50 transition-colors">
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 w-20 md:sticky md:left-16 md:z-[5] bg-inherit">{student.roll}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-semibold border-b border-gray-200 w-40 md:sticky md:left-[144px] md:z-[5] bg-inherit">{student.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 w-32 md:sticky md:left-[304px] md:z-[5] bg-inherit md:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.15)]">{student.phone}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.dob || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.educationalDegree || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">
                                                {student.category ? (
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${student.category === 'Alim' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>
                                                        {student.category}
                                                    </span>
                                                ) : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 text-center">
                                                <span className="font-bold text-red-600">{student.bloodGroup || "-"}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 text-center">
                                                <span className="font-semibold text-emerald-600">{student.totalPaidTk || "-"}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 max-w-[200px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate block flex-1">{student.address || "-"}</span>
                                                    {student.address && (
                                                        <button
                                                            onClick={() => setViewingAddress({ name: student.name, address: student.address! })}
                                                            title="View full address"
                                                            className="shrink-0 text-gray-400 hover:text-[#059669] transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.email || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.nidBirthNo || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.fatherName || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.motherName || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 text-center">
                                                {student.tShirtSize ? <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-semibold">{student.tShirtSize}</span> : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.currentDistrict || "-"}</td>
                                            <td className="px-4 py-3 text-sm border-b border-gray-200">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${student.courseStatus === 'Completed' ? 'bg-emerald-100/50 text-emerald-700' :
                                                    student.courseStatus === 'Incomplete' ? 'bg-orange-100/50 text-orange-700' :
                                                        student.courseStatus === 'Expelled' ? 'bg-red-100/50 text-red-700' : 'text-gray-500'
                                                    }`}>{student.courseStatus || "-"}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm border-b border-gray-200">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${student.currentlyDoing === 'Job' ? 'bg-cyan-100/50 text-cyan-700' :
                                                    student.currentlyDoing === 'Business' ? 'bg-purple-100/50 text-purple-700' :
                                                        (student.currentlyDoing === 'Nothing' || student.currentlyDoing === 'Studying Further') ? 'bg-slate-100 text-slate-600' : 'text-gray-500'
                                                    }`}>{student.currentlyDoing === 'Nothing' ? 'Studying Further' : (student.currentlyDoing || "-")}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.companyName || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200">{student.businessName || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-emerald-700 font-medium border-b border-gray-200">
                                                {student.salary ? `৳ ${student.salary.toLocaleString()}` : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm border-b border-gray-200 text-center">
                                                <button
                                                    onClick={() => setDetailStudent(student)}
                                                    className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                                                    title="View full profile"
                                                >
                                                    👁 View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Batch-wise Breakdown Section (only for All Batches) */}
            {!loading && !isBatchFiltered && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transform transition-all duration-300">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <UserGroupIcon className="w-5 h-5 text-gray-500" />
                            Batch-wise Breakdown ({totalStudents} Students Total)
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1e3a5f] text-white text-xs uppercase tracking-wider">
                                    <th className="px-6 py-4 font-medium border border-[#2d5278]">Batch No.</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Total Students</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Completed</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Incomplete</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Expelled</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Job</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Business</th>
                                    <th className="px-6 py-4 font-medium text-center border border-[#2d5278]">Studying Further</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batchWiseData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500 italic">
                                            No batch data has been added yet. Add a batch to see breakdown.
                                        </td>
                                    </tr>
                                ) : (
                                    batchWiseData.map((batch, idx) => (
                                        <tr
                                            key={idx}
                                            className={idx % 2 === 0 ? "bg-white hover:bg-gray-50 transition-colors" : "bg-[#f9fafb] hover:bg-gray-50 transition-colors"}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap border-b border-gray-200 border-r">
                                                <div className="font-semibold text-gray-900">{batch.id}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600 font-medium border-b border-gray-200">{batch.total}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-emerald-600 font-semibold border-b border-gray-200">{batch.completed}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-orange-600 font-semibold border-b border-gray-200">{batch.incomplete}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-red-600 font-semibold border-b border-gray-200">{batch.expelled}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-cyan-600 font-semibold border-b border-gray-200">{batch.job}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-purple-600 font-semibold border-b border-gray-200">{batch.business}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-slate-500 font-medium border-b border-gray-200">{batch.furtherStudy}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Batch Selection Modal */}
            {isSelectionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsSelectionModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Manage Batch Data</h3>
                                <p className="text-sm text-gray-500 mt-1">Select an existing batch to edit its data, or add a completely new batch.</p>
                            </div>
                            <button onClick={() => setIsSelectionModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8">
                            {/* Completed Batches Section */}
                            <div>
                                <h4 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Completed Batches</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <button
                                        onClick={() => handleOpenNewBatch(false)}
                                        className="h-28 border-2 border-dashed border-[#059669] rounded-xl flex flex-col items-center justify-center gap-2 text-[#059669] hover:bg-[#059669]/5 transition-colors group"
                                    >
                                        <svg className="w-8 h-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="font-semibold text-sm">Add New Completed Batch</span>
                                    </button>

                                    {Array.from(new Set(completedStudentsList.map(s => s.batchName))).map((bName) => (
                                        <div key={bName} className="relative group">
                                            <button
                                                onClick={() => handleSelectExistingBatch(bName)}
                                                className="w-full h-28 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#059669] hover:shadow-md transition-all group bg-white"
                                            >
                                                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg group-hover:bg-emerald-100 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </div>
                                                <div className="text-center px-2">
                                                    <span className="font-semibold text-gray-800 text-sm block truncate w-full" title={bName}>{bName}</span>
                                                    <span className="text-xs text-gray-500 mt-0.5">{completedStudentsList.filter(s => s.batchName === bName).length} Students</span>
                                                </div>
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const ok = await confirm({
                                                        message: `"${bName}" ব্যাচ এবং এর সকল ${completedStudentsList.filter(s => s.batchName === bName).length} জন স্টুডেন্টের ডেটা স্থায়ীভাবে মুছে যাবে। নিশ্চিত?`,
                                                        variant: "danger"
                                                    });
                                                    if (!ok) return;
                                                    try {
                                                        await deleteBatch(bName);
                                                        await fetchData();
                                                    } catch (err) {
                                                        alert("Delete failed: " + (err instanceof Error ? err.message : "Unknown error"));
                                                    }
                                                }}
                                                title="Delete this batch"
                                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Running Batches Section */}
                            <div>
                                <h4 className="text-md font-bold text-gray-800 mb-4 border-b pb-2">Current Batches</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <button
                                        onClick={() => handleOpenNewBatch(true)}
                                        className="h-28 border-2 border-dashed border-blue-500 rounded-xl flex flex-col items-center justify-center gap-2 text-blue-600 hover:bg-blue-50 transition-colors group"
                                    >
                                        <svg className="w-8 h-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="font-semibold text-sm">Add New Running Batch</span>
                                    </button>

                                    {Array.from(new Set(runningStudentsList.map(s => s.batchName))).map((bName) => (
                                        <div key={bName} className="relative group">
                                            <button
                                                onClick={() => handleSelectExistingBatch(bName)}
                                                className="w-full h-28 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:shadow-md transition-all group bg-white"
                                            >
                                                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                                                    </svg>
                                                </div>
                                                <div className="text-center px-2">
                                                    <span className="font-semibold text-gray-800 text-sm block truncate w-full" title={bName}>{bName}</span>
                                                    <span className="text-xs text-gray-500 mt-0.5">{runningStudentsList.filter(s => s.batchName === bName).length} Students</span>
                                                </div>
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const ok = await confirm({
                                                        message: `"${bName}" ব্যাচ এবং এর সকল ${runningStudentsList.filter(s => s.batchName === bName).length} জন স্টুডেন্টের ডেটা স্থায়ীভাবে মুছে যাবে। নিশ্চিত?`,
                                                        variant: "danger"
                                                    });
                                                    if (!ok) return;
                                                    try {
                                                        await deleteBatch(bName);
                                                        await fetchData();
                                                    } catch (err) {
                                                        alert("Delete failed: " + (err instanceof Error ? err.message : "Unknown error"));
                                                    }
                                                }}
                                                title="Delete this batch"
                                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Batch Data Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col my-8" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-white z-10 rounded-t-xl shrink-0 gap-4">
                            <div className="w-full md:w-auto flex-1">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Add New Batch Info</h3>
                                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full max-w-md">
                                    <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Batch Name:</label>
                                    <div className="w-full relative">
                                        <input
                                            type="text"
                                            value={newBatchName}
                                            onChange={(e) => setNewBatchName(e.target.value)}
                                            placeholder="e.g. Batch_01"
                                            disabled={isEditingExisting}
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-[#059669] focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                        {isEditingExisting && <div className="text-xs text-emerald-600 absolute -bottom-5">Editing existing batch.</div>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center shrink-0">
                                <button onClick={async () => {
                                    const ok = await confirm({ message: 'Clear all grid data?', variant: "warning" });
                                    if (ok) {
                                        setGridData(initializeEmptyRows());
                                        setGridPage(0);
                                    }
                                }} className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1.5 border border-red-200 rounded">
                                    Clear Grid
                                </button>
                                {isAddingRunningBatch && (
                                    <button onClick={handleCompleteBatch} disabled={isAdding} className="text-[#059669] hover:text-[#047857] text-sm font-semibold px-3 py-1.5 border border-[#059669] rounded flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Complete Batch
                                    </button>
                                )}
                                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 bg-gray-50">
                            <table className="border-collapse bg-white shadow-sm table-fixed" style={{ width: totalGridWidth, minWidth: "100%" }}>
                                <colgroup>
                                    {GRID_COLUMN_META.map(c => (
                                        <col key={c.key} style={{ width: gridColWidths[c.key] }} />
                                    ))}
                                </colgroup>
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="bg-[#1e3a5f]">
                                        {GRID_COLUMN_META.map(c => {
                                            const frozen = FROZEN_GRID_KEYS.includes(c.key);
                                            return (
                                                <th
                                                    key={c.key}
                                                    className={`relative px-3 py-2 text-xs font-semibold text-white border border-[#2d5278] ${c.key === "__row" ? "text-center px-1" : "text-left"} ${frozen ? "md:sticky md:z-10 bg-[#1e3a5f]" : ""} ${c.key === "phone" ? "md:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.35)]" : ""}`}
                                                    style={frozen ? { left: frozenGridLeft[c.key] } : undefined}
                                                >
                                                    <span className="block truncate pr-1">{c.label}</span>
                                                    <span
                                                        onPointerDown={e => startColResize(e, c.key)}
                                                        onClick={e => e.stopPropagation()}
                                                        title="Drag to resize column"
                                                        className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none hover:bg-white/40 active:bg-white/60"
                                                    />
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map((rowData, pageIdx) => {
                                        const absoluteIdx = gridPage * PAGE_SIZE + pageIdx;
                                        return (
                                            <tr key={absoluteIdx} className="bg-white hover:bg-gray-50 transition-colors group">
                                                <td
                                                    className="p-1 border border-gray-200 text-center text-xs text-gray-400 bg-gray-50 select-none md:sticky md:z-10"
                                                    style={{ left: frozenGridLeft["__row"] }}
                                                >
                                                    {absoluteIdx + 1}
                                                </td>
                                                {COLUMNS.map(col => {
                                                    const frozen = FROZEN_GRID_KEYS.includes(col);
                                                    return (
                                                    <td
                                                        key={col}
                                                        className={`p-0 border border-gray-200${frozen ? " bg-inherit md:sticky md:z-10" : ""}${col === "phone" ? " md:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.18)]" : ""}`}
                                                        style={frozen ? { left: frozenGridLeft[col] } : undefined}
                                                    >
                                                        {col === "courseStatus" ? (
                                                            <select
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={e => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none text-[#1f2937]"
                                                            >
                                                                <option value=""></option>
                                                                {isAddingRunningBatch ? (
                                                                    <>
                                                                        <option value="Running">Running</option>
                                                                        <option value="Completed">Completed</option>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <option value="Completed">Completed</option>
                                                                        <option value="Running">Running</option>
                                                                    </>
                                                                )}
                                                                <option value="Incomplete">Incomplete</option>
                                                                <option value="Expelled">Expelled</option>
                                                            </select>
                                                        ) : col === "category" ? (
                                                            <select
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={e => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none text-[#1f2937]"
                                                            >
                                                                <option value=""></option>
                                                                <option value="Alim">Alim</option>
                                                                <option value="General">General</option>
                                                            </select>
                                                        ) : col === "bloodGroup" ? (
                                                            <input
                                                                type="text"
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={e => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none text-[#1f2937]"
                                                                placeholder="e.g. A+"
                                                            />
                                                        ) : col === "currentlyDoing" ? (
                                                            <select
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={e => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none text-[#1f2937]"
                                                            >
                                                                <option value=""></option>
                                                                <option value="Job">Job</option>
                                                                <option value="Business">Business</option>
                                                                <option value="Studying Further">Studying Further</option>
                                                            </select>
                                                        ) : col === "salary" ? (
                                                            <input
                                                                type="number"
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={(e) => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none font-medium text-emerald-700"
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={rowData[col] ?? ""}
                                                                onChange={e => handleCellChange(absoluteIdx, col, e.target.value)}
                                                                onPaste={(e) => handlePaste(e, absoluteIdx, col)}
                                                                className="w-full p-2 bg-transparent text-sm focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 outline-none"
                                                            />
                                                        )}
                                                    </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Pagination Controls */}
                            <div className="flex items-center justify-between mt-3 px-1">
                                <p className="text-xs text-gray-500">
                                    Showing rows {gridPage * PAGE_SIZE + 1}–{Math.min((gridPage + 1) * PAGE_SIZE, MAX_ROWS)} of {MAX_ROWS}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setGridPage(p => Math.max(0, p - 1))}
                                        disabled={gridPage === 0}
                                        className="px-3 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        ← Prev
                                    </button>
                                    {Array.from({ length: totalPages }).map((_, pi) => (
                                        <button
                                            key={pi}
                                            onClick={() => setGridPage(pi)}
                                            className={`w-7 h-7 text-xs font-semibold rounded ${gridPage === pi ? 'bg-[#059669] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {pi + 1}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setGridPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={gridPage === totalPages - 1}
                                        className="px-3 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl bg-white sticky bottom-0 z-10 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <span className="text-gray-500 text-sm hidden md:flex items-center mr-auto">Tip: You can paste data directly from Excel into the grid cells.</span>
                            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveBatchInfo} disabled={isAdding} className="bg-[#059669] hover:bg-[#047857] text-white px-8">
                                {isAdding ? "Saving Batch..." : "Save Batch Data"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
