"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AmbientOrbs, GLASS_PANEL, fadeUp } from "@/components/typing-exam/ui";
import ExamForm, { type ExamFormValues, type Batch } from "../../_components/ExamForm";

export default function EditTypingExamPage() {
  const params = useParams<{ id: string }>();
  const examId = params.id;
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [initialValues, setInitialValues] = useState<ExamFormValues | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const [examRes, listRes] = await Promise.all([
      fetch(`/api/typing-exam/${examId}`),
      fetch("/api/typing-exam"),
    ]);

    if (!examRes.ok) {
      const data = await examRes.json().catch(() => ({}));
      setFetchError(data.error || `Error ${examRes.status}`);
      setLoading(false);
      return;
    }
    const exam = await examRes.json();

    if (listRes.ok) {
      const listData = await listRes.json();
      setBatches(listData.batches ?? []);
    }

    setInitialValues({
      title: exam.title ?? "",
      description: exam.description ?? "",
      accessType: exam.accessType === "PUBLIC" ? "PUBLIC" : "INTERNAL",
      batchNames: exam.batchNames ?? [],
      durationSeconds: exam.durationSeconds ?? 60,
      passWpm: exam.passWpm ?? 40,
      passAccuracy: exam.passAccuracy ?? 90,
      failWpm: exam.failWpm ?? 20,
      failAccuracy: exam.failAccuracy ?? 75,
      textSource: exam.textSource === "CUSTOM" ? "CUSTOM" : "BANK",
      textLanguage: exam.textLanguage ?? "en",
      // CUSTOM exams keep their text in examText; leave blank for BANK exams
      // since re-saving without a change should not force a re-pick.
      customText: exam.textSource === "CUSTOM" ? exam.examText ?? "" : "",
      // Never populate from retryPasswordHash — blank means "leave unchanged".
      retryPassword: "",
      scheduleStart: exam.scheduleStart ? toLocalInputValue(exam.scheduleStart) : "",
      scheduleEnd: exam.scheduleEnd ? toLocalInputValue(exam.scheduleEnd) : "",
    });

    setLoading(false);
  }, [examId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(values: ExamFormValues) {
    setFormError("");
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: values.title,
      description: values.description,
      durationSeconds: values.durationSeconds,
      batchNames: values.batchNames,
      passWpm: values.passWpm,
      passAccuracy: values.passAccuracy,
      failWpm: values.failWpm,
      failAccuracy: values.failAccuracy,
      textSource: values.textSource,
      textLanguage: values.textLanguage,
      customText: values.customText,
      scheduleStart: values.scheduleStart || null,
      scheduleEnd: values.scheduleEnd || null,
    };
    if (values.retryPassword.trim()) {
      payload.retryPassword = values.retryPassword;
    }

    const res = await fetch(`/api/typing-exam/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(data.error || `Error ${res.status}`);
      return;
    }

    router.push("/dashboard/typing-exam");
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (fetchError || !initialValues) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
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
    <div className="p-6 max-w-3xl mx-auto">
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
        className="mb-6"
      >
        <h1 className="no-gradient text-2xl font-bold text-slate-800">এক্সাম এডিট করুন</h1>
        <p className="text-slate-500 text-sm mt-1">তথ্য পরিবর্তন করে সংরক্ষণ করুন।</p>
      </motion.div>

      <motion.div
        variants={reduceMotion ? undefined : fadeUp}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        className={`${GLASS_PANEL} rounded-2xl overflow-hidden`}
      >
        <ExamForm
          mode="edit"
          initialValues={initialValues}
          batches={batches}
          onSubmit={handleSubmit}
          saving={saving}
          error={formError}
        />
      </motion.div>
    </div>
  );
}

/** ISO datetime string -> value usable by <input type="datetime-local"> (local time, no seconds/timezone). */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
