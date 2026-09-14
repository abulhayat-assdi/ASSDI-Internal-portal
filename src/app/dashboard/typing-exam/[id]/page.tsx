"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  result: "PASS" | "AVERAGE" | "FAIL";
  submittedAt: string;
};

const resultBadge: Record<Attempt["result"], string> = {
  PASS: "bg-green-100 text-green-700",
  AVERAGE: "bg-amber-100 text-amber-700",
  FAIL: "bg-red-100 text-red-600",
};

function toCsv(exam: Exam, attempts: Attempt[]): string {
  const header = ["Name", "Roll", "Batch", "WPM", "Accuracy", "Result", "Submitted At"];
  const rows = attempts.map((a) => [
    a.name,
    a.roll,
    a.batchName || "Public",
    String(a.wpm),
    String(a.accuracy),
    a.result,
    new Date(a.submittedAt).toISOString(),
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
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

  function exportCsv() {
    if (!exam) return;
    const csv = toCsv(exam, attempts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exam.title.replace(/[^\w\-]+/g, "_")}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            onClick={exportCsv}
            disabled={attempts.length === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
          >
            ⬇ CSV Export
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
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Roll</th>
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
                  <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{a.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.roll || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.batchName || "Public"}</td>
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
