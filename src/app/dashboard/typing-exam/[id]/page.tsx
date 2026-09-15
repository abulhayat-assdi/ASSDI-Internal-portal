"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Download, Copy, Check, Link2, Users, AlertTriangle, ClipboardList } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, RESULT_META, fadeUp, staggerContainer } from "@/components/typing-exam/ui";

type Exam = {
  id: string;
  title: string;
  description: string;
  accessType: "INTERNAL" | "PUBLIC";
  batchNames: string[];
  isActive: boolean;
  durationSeconds: number;
  passWpm: number;
  passAccuracy: number;
  failWpm: number;
  failAccuracy: number;
  textSource: "CUSTOM" | "BANK";
  textLanguage: string;
  textCategory: string | null;
  publicSlug: string | null;
  createdByName: string;
  createdAt: string;
};

type Attempt = {
  id: string;
  takerType: "STUDENT" | "PUBLIC";
  name: string;
  roll: string;
  batchName: string | null;
  phone: string | null;
  attemptNumber: number;
  wpm: number;
  accuracy: number;
  correctChars: number;
  totalChars: number;
  durationTakenSeconds: number;
  result: "PASS" | "AVERAGE" | "FAIL";
  submittedAt: string;
};

/** "5 Sep 26" */
function formatSheetDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

/** "5:10:44 PM" */
function formatSheetTime(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

function exportToExcel(exam: Exam, attempts: Attempt[]) {
  const wb = XLSX.utils.book_new();
  const sheetData: (string | number)[][] = [];

  sheetData.push([exam.title]);
  sheetData.push([
    `Access Type: ${exam.accessType === "PUBLIC" ? "Public" : "Internal"}`,
    `Total Submissions: ${attempts.length}`,
    `Generated on: ${new Date().toLocaleString()}`,
  ]);
  sheetData.push([]);

  sheetData.push([
    "Type",
    "Try",
    "Name",
    "Roll",
    "Mobile Number",
    "Batch",
    "WPM",
    "Accuracy (%)",
    "Correct Chars",
    "Total Typed Chars",
    "Time Taken (sec)",
    "Result",
    "Date",
    "Time",
  ]);

  attempts.forEach((a) => {
    const submittedAt = new Date(a.submittedAt);
    sheetData.push([
      a.takerType === "STUDENT" ? "Student" : "Public",
      a.attemptNumber,
      a.name || "-",
      a.roll || "-",
      a.phone || "-",
      a.batchName || "-",
      a.wpm,
      a.accuracy,
      a.correctChars,
      a.totalChars,
      a.durationTakenSeconds,
      a.result,
      formatSheetDate(submittedAt),
      formatSheetTime(submittedAt),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 10 }, // Type
    { wch: 6 },  // Try
    { wch: 22 }, // Name
    { wch: 12 }, // Roll
    { wch: 16 }, // Mobile Number
    { wch: 18 }, // Batch
    { wch: 8 },  // WPM
    { wch: 12 }, // Accuracy
    { wch: 13 }, // Correct Chars
    { wch: 15 }, // Total Typed Chars
    { wch: 14 }, // Time Taken
    { wch: 10 }, // Result
    { wch: 11 }, // Date
    { wch: 13 }, // Time
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Results");
  const safeTitle = exam.title.replace(/[^\w\-]+/g, "_").slice(0, 60);
  XLSX.writeFile(wb, `${safeTitle}_results_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export default function TypingExamResultsPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const reduceMotion = useReducedMotion();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const [examRes, attemptsRes] = await Promise.all([
      fetch(`/api/typing-exam/${examId}`),
      fetch(`/api/typing-exam/${examId}/attempts`),
    ]);

    if (!examRes.ok) {
      const data = await examRes.json().catch(() => ({}));
      setFetchError(data.error || `Error ${examRes.status}`);
      setLoading(false);
      return;
    }
    setExam(await examRes.json());

    if (attemptsRes.ok) {
      setAttempts(await attemptsRes.json());
    }
    setLoading(false);
  }, [examId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/typing-exam/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    if (!exam) return;
    exportToExcel(exam, attempts);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (fetchError || !exam) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <AmbientOrbs />
        <div className={`${GLASS_PANEL} rounded-2xl p-8 flex items-center gap-3 text-sm text-red-700`}>
          <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2} />
          ডেটা লোড হয়নি: {fetchError || "Exam পাওয়া যায়নি"}
        </div>
        <Link href="/dashboard/typing-exam" className="text-brand-700 text-sm mt-4 inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          এক্সাম তালিকায় ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AmbientOrbs />

      <Link
        href="/dashboard/typing-exam"
        className="text-brand-700 text-sm mb-4 inline-flex items-center gap-1 hover:text-brand-800 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
        এক্সাম তালিকায় ফিরে যান
      </Link>

      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`${GLASS_PANEL} rounded-2xl p-5 mb-6`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="no-gradient text-xl font-bold text-slate-800">{exam.title}</h1>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                  exam.accessType === "PUBLIC" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {exam.accessType === "PUBLIC" ? <Link2 className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                {exam.accessType === "PUBLIC" ? "Public" : "Internal"}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  exam.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {exam.isActive ? "চালু" : "বন্ধ"}
              </span>
            </div>
            {exam.description && <p className="text-sm text-slate-500 mt-1">{exam.description}</p>}
          </div>

          <motion.button
            onClick={handleExport}
            disabled={attempts.length === 0}
            whileHover={reduceMotion || attempts.length === 0 ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion || attempts.length === 0 ? undefined : { scale: 0.97 }}
            className="cursor-pointer flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Excel ডাউনলোড
          </motion.button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-xs text-slate-400">Pass বার</p>
            <p className="text-slate-700 font-medium">{exam.passWpm} WPM / {exam.passAccuracy}%</p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-xs text-slate-400">Fail বার</p>
            <p className="text-slate-700 font-medium">{exam.failWpm} WPM / {exam.failAccuracy}%</p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-xs text-slate-400">সময়সীমা</p>
            <p className="text-slate-700 font-medium">{exam.durationSeconds} সেকেন্ড</p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-xs text-slate-400">Text</p>
            <p className="text-slate-700 font-medium">
              {exam.textSource === "BANK"
                ? `Bank (${exam.textLanguage === "bn" ? "বাংলা" : "English"} · ${exam.textCategory || "Random"})`
                : "Custom"}
            </p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-xs text-slate-400">{exam.accessType === "INTERNAL" ? "ব্যাচ" : "মোট Attempt"}</p>
            <p className="text-slate-700 font-medium">
              {exam.accessType === "INTERNAL" ? exam.batchNames.join(", ") || "—" : attempts.length}
            </p>
          </div>
        </div>

        {exam.accessType === "PUBLIC" && exam.publicSlug && (
          <div className="mt-4 flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
            <span className="text-sm text-violet-700 flex-1 truncate">/typing-exam/{exam.publicSlug}</span>
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              onClick={() => copyLink(exam.publicSlug!)}
              className="cursor-pointer flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium whitespace-nowrap"
            >
              {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
              {copied ? "কপি হয়েছে" : "কপি করুন"}
            </motion.button>
          </div>
        )}
      </motion.div>

      <h2 className="no-gradient text-lg font-bold text-slate-800 mb-3">Attempts ({attempts.length})</h2>

      {attempts.length === 0 ? (
        <div className={`${GLASS_PANEL} rounded-2xl p-14 text-center`}>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <ClipboardList className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <p className="text-slate-400 text-sm">এখনো কোনো Attempt জমা পড়েনি।</p>
        </div>
      ) : (
        <div className={`${GLASS_PANEL} rounded-2xl overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Try</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Roll</th>
                <th className="px-4 py-3 font-medium">Mobile Number</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">WPM</th>
                <th className="px-4 py-3 font-medium">Accuracy</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Submitted At</th>
              </tr>
            </thead>
            <motion.tbody
              variants={reduceMotion ? undefined : staggerContainer}
              initial={reduceMotion ? undefined : "hidden"}
              animate={reduceMotion ? undefined : "show"}
            >
              {attempts.map((a) => (
                <motion.tr
                  key={a.id}
                  variants={reduceMotion ? undefined : fadeUp}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">#{a.attemptNumber}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">{a.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.roll || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {a.batchName || (a.takerType === "PUBLIC" ? "Public" : "—")}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.wpm}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{a.accuracy}%</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${RESULT_META[a.result].badge}`}>
                      {RESULT_META[a.result].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(a.submittedAt).toLocaleString("bn-BD")}
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  );
}
