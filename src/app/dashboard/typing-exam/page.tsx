"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Batch = { id: string; name: string };

type ExamEntry = {
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
  createdByRole: string;
  createdAt: string;
  attemptCount: number;
};

const emptyForm = {
  title: "",
  description: "",
  accessType: "INTERNAL" as "INTERNAL" | "PUBLIC",
  batchNames: [] as string[],
  durationSeconds: 60,
  maxAttempts: 1,
  passWpm: 40,
  passAccuracy: 90,
  failWpm: 20,
  failAccuracy: 75,
  textSource: "BANK" as "CUSTOM" | "BANK",
  textLanguage: "en",
  customText: "",
  publicPassword: "",
  scheduleStart: "",
  scheduleEnd: "",
};

export default function TypingExamAdminPage() {
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  function toggleBatch(name: string) {
    setForm((f) => ({
      ...f,
      batchNames: f.batchNames.includes(name)
        ? f.batchNames.filter((b) => b !== name)
        : [...f.batchNames, name],
    }));
  }

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
    setForm(emptyForm);
    setFormError("");
    setCreatedLink("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    const res = await fetch("/api/typing-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">টাইপিং টেস্ট এক্সাম</h1>
          <p className="text-gray-500 text-sm mt-1">
            এক্সাম তৈরি করুন, স্টুডেন্ট বা পাবলিকের জন্য শেয়ার করুন এবং রেজাল্ট দেখুন।
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          + নতুন এক্সাম তৈরি করুন
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          ডেটা লোড হয়নি: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 py-10 text-center">লোড হচ্ছে...</div>
      ) : exams.length === 0 ? (
        <div className="text-gray-400 py-10 text-center">এখনো কোনো এক্সাম তৈরি হয়নি।</div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{exam.title}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      exam.accessType === "PUBLIC"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    {exam.attemptCount} টি Attempt
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
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
                  <button
                    onClick={() => copyLink(`${window.location.origin}/typing-exam/${exam.publicSlug}`)}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors font-medium"
                  >
                    🔗 লিংক কপি
                  </button>
                )}
                <Link
                  href={`/dashboard/typing-exam/${exam.id}`}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  📊 রেজাল্ট দেখুন
                </Link>
                <button
                  onClick={() => toggleActive(exam)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    exam.isActive
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {exam.isActive ? "বন্ধ করুন" : "চালু করুন"}
                </button>
                <button
                  disabled={deletingId === exam.id}
                  onClick={() => deleteExam(exam.id, exam.title)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors font-medium"
                >
                  {deletingId === exam.id ? "..." : "🗑️ মুছুন"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-800">নতুন এক্সাম তৈরি করুন</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {createdLink ? (
              <div className="p-5 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-800 font-medium mb-2">
                    ✓ এক্সাম তৈরি হয়েছে! এই লিংকটি শেয়ার করুন:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={createdLink}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <button
                      onClick={() => copyLink(createdLink)}
                      className="text-sm px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium whitespace-nowrap"
                    >
                      {copied ? "✓ কপি হয়েছে" : "কপি করুন"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-xl transition-colors"
                >
                  বন্ধ করুন
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">শিরোনাম *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="যেমন: Batch 12 — টাইপিং স্পিড টেস্ট"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">বিবরণ (ঐচ্ছিক)</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={form.accessType === "INTERNAL"}
                        onChange={() => setForm((f) => ({ ...f, accessType: "INTERNAL" }))}
                      />
                      Internal (নির্দিষ্ট ব্যাচ)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={form.accessType === "PUBLIC"}
                        onChange={() => setForm((f) => ({ ...f, accessType: "PUBLIC" }))}
                      />
                      Public (ওপেন লিংক)
                    </label>
                  </div>
                </div>

                {form.accessType === "INTERNAL" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ব্যাচ নির্বাচন করুন *</label>
                    {batches.length === 0 ? (
                      <p className="text-xs text-gray-400">কোনো active ব্যাচ পাওয়া যায়নি।</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {batches.map((b) => (
                          <label
                            key={b.id}
                            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              form.batchNames.includes(b.name)
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={form.batchNames.includes(b.name)}
                              onChange={() => toggleBatch(b.name)}
                            />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Retry Password *</label>
                    <input
                      required
                      type="text"
                      value={form.publicPassword}
                      onChange={(e) => setForm((f) => ({ ...f, publicPassword: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="দ্বিতীয়বার Attempt দিতে এই পাসওয়ার্ড লাগবে"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">সময়সীমা (সেকেন্ড) *</label>
                    <input
                      required
                      type="number"
                      min={10}
                      value={form.durationSeconds}
                      onChange={(e) => setForm((f) => ({ ...f, durationSeconds: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      সর্বোচ্চ Attempt (স্টুডেন্ট) *
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={form.maxAttempts}
                      onChange={(e) => setForm((f) => ({ ...f, maxAttempts: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Source</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={form.textSource === "BANK"}
                        onChange={() => setForm((f) => ({ ...f, textSource: "BANK" }))}
                      />
                      Bank থেকে (র‍্যান্ডম)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={form.textSource === "CUSTOM"}
                        onChange={() => setForm((f) => ({ ...f, textSource: "CUSTOM" }))}
                      />
                      Custom (নিজে লিখুন)
                    </label>
                  </div>
                  {form.textSource === "BANK" ? (
                    <select
                      value={form.textLanguage}
                      onChange={(e) => setForm((f) => ({ ...f, textLanguage: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="en">English</option>
                      <option value="bn">বাংলা</option>
                    </select>
                  ) : (
                    <textarea
                      required
                      value={form.customText}
                      onChange={(e) => setForm((f) => ({ ...f, customText: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="এক্সামের জন্য প্যাসেজ লিখুন..."
                    />
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">রেজাল্ট থ্রেশহোল্ড</p>
                  <p className="text-xs text-gray-400 mb-2">
                    উভয় মেট্রিক Pass বারের উপরে থাকলে PASS, যেকোনো একটি Fail বারের নিচে নামলে FAIL, বাকিটা AVERAGE।
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pass WPM *</label>
                      <input
                        required
                        type="number"
                        value={form.passWpm}
                        onChange={(e) => setForm((f) => ({ ...f, passWpm: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pass Accuracy % *</label>
                      <input
                        required
                        type="number"
                        value={form.passAccuracy}
                        onChange={(e) => setForm((f) => ({ ...f, passAccuracy: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fail WPM *</label>
                      <input
                        required
                        type="number"
                        value={form.failWpm}
                        onChange={(e) => setForm((f) => ({ ...f, failWpm: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fail Accuracy % *</label>
                      <input
                        required
                        type="number"
                        value={form.failAccuracy}
                        onChange={(e) => setForm((f) => ({ ...f, failAccuracy: Number(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">শুরু (ঐচ্ছিক)</label>
                    <input
                      type="datetime-local"
                      value={form.scheduleStart}
                      onChange={(e) => setForm((f) => ({ ...f, scheduleStart: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">শেষ (ঐচ্ছিক)</label>
                    <input
                      type="datetime-local"
                      value={form.scheduleEnd}
                      onChange={(e) => setForm((f) => ({ ...f, scheduleEnd: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {saving ? "তৈরি হচ্ছে..." : "এক্সাম তৈরি করুন"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
