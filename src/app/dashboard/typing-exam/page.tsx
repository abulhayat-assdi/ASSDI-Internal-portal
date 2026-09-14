"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  X,
  Link2,
  Copy,
  Check,
  BarChart3,
  Power,
  Trash2,
  Users,
  Pencil,
  Keyboard,
  AlertTriangle,
} from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, fadeUp, staggerContainer, modalBackdrop, modalPanel } from "@/components/typing-exam/ui";
import ExamForm, { emptyExamFormValues, type ExamFormValues, type Batch } from "./_components/ExamForm";

type ExamEntry = {
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
  publicSlug: string | null;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  attemptCount: number;
};

export default function TypingExamAdminPage() {
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const reduceMotion = useReducedMotion();

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const res = await fetch("/api/typing-exam");
    if (res.ok) {
      const data = await res.json();
      setExams(data.exams);
      setBatches(data.batches);
    } else {
      const data = await res.json().catch(() => ({}));
      setFetchError(data.error || `Error ${res.status}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  async function toggleActive(exam: ExamEntry) {
    await fetch(`/api/typing-exam/${exam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !exam.isActive }),
    });
    fetchExams();
  }

  async function deleteExam(id: string, title: string) {
    if (!confirm(`"${title}" এক্সামটি স্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত?`)) return;
    setDeletingId(id);
    await fetch(`/api/typing-exam/${id}`, { method: "DELETE" });
    setDeletingId(null);
    fetchExams();
  }

  function openCreateForm() {
    setFormError("");
    setCreatedLink("");
    setShowForm(true);
  }

  async function handleCreateSubmit(values: ExamFormValues) {
    setFormError("");
    setSaving(true);

    const res = await fetch("/api/typing-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(data.error || `Error ${res.status}`);
      return;
    }

    if (data.accessType === "PUBLIC" && data.publicSlug) {
      setCreatedLink(`${window.location.origin}/typing-exam/${data.publicSlug}`);
    } else {
      setShowForm(false);
    }
    fetchExams();
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AmbientOrbs />

      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="no-gradient text-2xl font-bold text-slate-800">টাইপিং টেস্ট এক্সাম</h1>
          <p className="text-slate-500 text-sm mt-1">
            এক্সাম তৈরি করুন, স্টুডেন্ট বা পাবলিকের জন্য শেয়ার করুন এবং রেজাল্ট দেখুন।
          </p>
        </div>
        <motion.button
          onClick={openCreateForm}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="cursor-pointer inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-brand-600/20 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          নতুন এক্সাম তৈরি করুন
        </motion.button>
      </motion.div>

      {fetchError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
          ডেটা লোড হয়নি: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
        </div>
      ) : exams.length === 0 ? (
        <div className={`${GLASS_PANEL} rounded-2xl p-14 text-center`}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Keyboard className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <p className="text-slate-500 text-sm">এখনো কোনো এক্সাম তৈরি হয়নি।</p>
        </div>
      ) : (
        <motion.div
          variants={reduceMotion ? undefined : staggerContainer}
          initial={reduceMotion ? undefined : "hidden"}
          animate={reduceMotion ? undefined : "show"}
          className="space-y-3"
        >
          {exams.map((exam) => (
            <motion.div
              key={exam.id}
              variants={reduceMotion ? undefined : fadeUp}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              className={`${GLASS_PANEL} rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-shadow hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{exam.title}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      exam.accessType === "PUBLIC"
                        ? "bg-violet-100 text-violet-700"
                        : "bg-blue-100 text-blue-700"
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    {exam.attemptCount} টি Attempt
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {exam.accessType === "INTERNAL"
                    ? exam.batchNames.length > 0
                      ? `ব্যাচ: ${exam.batchNames.join(", ")}`
                      : "কোনো ব্যাচ নির্বাচিত নেই"
                    : exam.publicSlug
                    ? `/typing-exam/${exam.publicSlug}`
                    : "Public"}
                  {" · "}তৈরি করেছেন: {exam.createdByName || "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {exam.accessType === "PUBLIC" && exam.publicSlug && (
                  <motion.button
                    whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                    onClick={() => copyLink(`${window.location.origin}/typing-exam/${exam.publicSlug}`)}
                    className="cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors font-medium"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    লিংক কপি
                  </motion.button>
                )}
                <Link
                  href={`/dashboard/typing-exam/${exam.id}`}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
                  রেজাল্ট দেখুন
                </Link>
                <Link
                  href={`/dashboard/typing-exam/${exam.id}/edit`}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  এডিট
                </Link>
                <motion.button
                  whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                  onClick={() => toggleActive(exam)}
                  className={`cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    exam.isActive
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" strokeWidth={2} />
                  {exam.isActive ? "বন্ধ করুন" : "চালু করুন"}
                </motion.button>
                <motion.button
                  whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                  disabled={deletingId === exam.id}
                  onClick={() => deleteExam(exam.id, exam.title)}
                  className="cursor-pointer flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  {deletingId === exam.id ? "..." : "মুছুন"}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            variants={reduceMotion ? undefined : modalBackdrop}
            initial={reduceMotion ? undefined : "hidden"}
            animate={reduceMotion ? undefined : "show"}
            exit={reduceMotion ? undefined : "exit"}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-start justify-center overflow-y-auto py-8 px-4"
          >
            <motion.div
              variants={reduceMotion ? undefined : modalPanel}
              className={`${GLASS_PANEL} bg-white/95 rounded-2xl shadow-2xl w-full max-w-2xl`}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="no-gradient text-lg font-bold text-slate-800">নতুন এক্সাম তৈরি করুন</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>

              {createdLink ? (
                <div className="p-5 space-y-4">
                  <motion.div
                    initial={reduceMotion ? undefined : { scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 22 }}
                    className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"
                  >
                    <p className="flex items-center gap-1.5 text-sm text-emerald-800 font-medium mb-2">
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      এক্সাম তৈরি হয়েছে! এই লিংকটি শেয়ার করুন:
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={createdLink}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                      <motion.button
                        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                        onClick={() => copyLink(createdLink)}
                        className="cursor-pointer text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium whitespace-nowrap"
                      >
                        {copied ? "✓ কপি হয়েছে" : "কপি করুন"}
                      </motion.button>
                    </div>
                  </motion.div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="cursor-pointer w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              ) : (
                <ExamForm
                  mode="create"
                  initialValues={emptyExamFormValues}
                  batches={batches}
                  onSubmit={handleCreateSubmit}
                  saving={saving}
                  error={formError}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
