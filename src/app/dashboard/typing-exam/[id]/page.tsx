"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

type Exam = {
  id: string;
  title: string;
  description: string;
  accessType: "INTERNAL" | "PUBLIC";
  batchNames: string[];
  isActive: boolean;
  durationSeconds: number;
  maxAttempts: number;
  passWpm: number;
  passAccuracy: number;
  failWpm: number;
  failAccuracy: number;
  textSource: "CUSTOM" | "BANK";
  textLanguage: string;
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

const resultBadge: Record<Attempt["result"], string> = {
  PASS: "bg-green-100 text-green-700",
  AVERAGE: "bg-amber-100 text-amber-700",
  FAIL: "bg-red-100 text-red-600",
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
    return <div className="p-6 max-w-5xl mx-auto text-gray-400 py-10 text-center">লোড হচ্ছে...</div>;
  }

  if (fetchError || !exam) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          ডেটা লোড হয়নি: {fetchError || "Exam পাওয়া যায়নি"}
        </div>
        <Link href="/dashboard/typing-exam" className="text-blue-600 text-sm mt-4 inline-block">
          ← এক্সাম তালিকায় ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/dashboard/typing-exam" className="text-blue-600 text-sm mb-4 inline-block">
        ← এক্সাম তালিকায় ফিরে যান
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800">{exam.title}</h1>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  exam.accessType === "PUBLIC" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {exam.accessType === "PUBLIC" ? "Public" : "Internal"}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  exam.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {exam.isActive ? "চালু" : "বন্ধ"}
              </span>
            </div>
            {exam.description && <p className="text-sm text-gray-500 mt-1">{exam.description}</p>}
          </div>

          <button
            onClick={handleExport}
            disabled={attempts.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:bg-transparent transition-colors font-medium whitespace-nowrap"
          >
            ⬇ Excel ডাউনলোড
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div>
            <p className="text-xs text-gray-400">Pass বার</p>
            <p className="text-gray-700 font-medium">{exam.passWpm} WPM / {exam.passAccuracy}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Fail বার</p>
            <p className="text-gray-700 font-medium">{exam.failWpm} WPM / {exam.failAccuracy}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">সময়সীমা</p>
            <p className="text-gray-700 font-medium">{exam.durationSeconds} সেকেন্ড</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">
              {exam.accessType === "INTERNAL" ? "ব্যাচ" : "সর্বোচ্চ Attempt (স্টুডেন্ট)"}
            </p>
            <p className="text-gray-700 font-medium">
              {exam.accessType === "INTERNAL" ? exam.batchNames.join(", ") || "—" : exam.maxAttempts}
            </p>
          </div>
        </div>

        {exam.accessType === "PUBLIC" && exam.publicSlug && (
          <div className="mt-4 flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
            <span className="text-sm text-purple-700 flex-1 truncate">
              /typing-exam/{exam.publicSlug}
            </span>
            <button
              onClick={() => copyLink(exam.publicSlug!)}
              className="text-xs px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium whitespace-nowrap"
            >
              {copied ? "✓ কপি হয়েছে" : "কপি করুন"}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-3">Attempts ({attempts.length})</h2>

      {attempts.length === 0 ? (
        <div className="text-gray-400 py-10 text-center">এখনো কোনো Attempt জমা পড়েনি।</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
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
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">#{a.attemptNumber}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{a.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.roll || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.batchName || (a.takerType === "PUBLIC" ? "Public" : "—")}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.wpm}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.accuracy}%</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultBadge[a.result]}`}>
                      {a.result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(a.submittedAt).toLocaleString("bn-BD")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
