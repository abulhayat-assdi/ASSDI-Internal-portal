"use client";

import { useEffect, useState, useCallback } from "react";

type BatchFormEntry = {
  id: string;
  batchName: string;
  formSlug: string;
  isActive: boolean;
  createdAt: string;
  pendingCount: number;
};

type Submission = {
  id: string;
  batchName: string;
  roll: string;
  name: string;
  phone: string;
  nidBirthNo: string;
  dob: string;
  email: string;
  bloodGroup: string;
  fatherName: string;
  motherName: string;
  presentAddress: string;
  permanentAddress: string;
  guardianName: string;
  guardianPhone: string;
  lastInstitute: string;
  latestDegree: string;
  gpaResult: string;
  currentDistrict: string;
  homeDistrict: string;
  category: string;
  tShirtSize: string;
  courseGoal: string;
  status: string;
  submittedAt: string;
};

export default function BatchFormsAdminPage() {
  const [forms, setForms] = useState<BatchFormEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [copiedSlug, setCopiedSlug] = useState("");

  const [viewBatch, setViewBatch] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    const res = await fetch("/api/admin/batch-forms");
    if (res.ok) {
      setForms(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setFetchError(data.error || `Error ${res.status}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  async function toggleActive(batchName: string, isActive: boolean) {
    await fetch("/api/admin/batch-forms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchName, isActive }),
    });
    fetchForms();
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/student-form/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(""), 2000);
  }

  async function loadSubmissions(batchName: string, status: string) {
    setSubsLoading(true);
    const res = await fetch(
      `/api/admin/student-form-submissions?batchName=${encodeURIComponent(batchName)}&status=${status}`
    );
    if (res.ok) setSubmissions(await res.json());
    setSubsLoading(false);
  }

  function openBatch(batchName: string) {
    setViewBatch(batchName);
    setStatusFilter("pending");
    loadSubmissions(batchName, "pending");
  }

  function handleStatusFilterChange(status: string) {
    setStatusFilter(status);
    if (viewBatch) loadSubmissions(viewBatch, status);
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    const res = await fetch(`/api/admin/student-form-submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote }),
    });
    setActionLoading(null);
    if (res.ok) {
      setSelectedSub(null);
      setAdminNote("");
      if (viewBatch) loadSubmissions(viewBatch, statusFilter);
      fetchForms();
    }
  }

  const Row = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div className="flex gap-2 py-1 border-b border-gray-100 last:border-0">
        <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
        <span className="text-sm text-gray-800 break-words flex-1">{value}</span>
      </div>
    ) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Batch Form Management</h1>
        <p className="text-gray-500 text-sm mt-1">
          প্রতিটি ব্যাচের জন্য ফর্ম লিংক শেয়ার করুন এবং স্টুডেন্টদের জমা দেওয়া তথ্য Approve / Reject করুন।
        </p>
      </div>

      {fetchError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          ডেটা লোড হয়নি: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 py-10 text-center">লোড হচ্ছে...</div>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <div
              key={f.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{f.batchName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      f.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {f.isActive ? "চালু" : "বন্ধ"}
                  </span>
                  {f.pendingCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      {f.pendingCount} টি pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                  /student-form/{f.formSlug}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => copyLink(f.formSlug)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                >
                  {copiedSlug === f.formSlug ? "✓ কপি হয়েছে" : "🔗 লিংক কপি"}
                </button>
                <button
                  onClick={() => openBatch(f.batchName)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  📋 Submissions দেখুন
                </button>
                <button
                  onClick={() => toggleActive(f.batchName, !f.isActive)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    f.isActive
                      ? "border-red-200 text-red-500 hover:bg-red-50"
                      : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {f.isActive ? "ফর্ম বন্ধ করুন" : "ফর্ম চালু করুন"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submissions Panel */}
      {viewBatch && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {viewBatch} — Submissions
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  onClick={() => setViewBatch(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5">
              {subsLoading ? (
                <p className="text-gray-400 text-center py-8">লোড হচ্ছে...</p>
              ) : submissions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  কোনো {statusFilter} submission নেই।
                </p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => (
                    <div
                      key={s.id}
                      className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedSub(s); setAdminNote(""); }}
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{s.name}</span>
                        <span className="text-gray-400 text-sm ml-2">Roll: {s.roll}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(s.submittedAt).toLocaleDateString("bn-BD")}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            s.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : s.status === "rejected"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {s.status}
                        </span>
                        <span className="text-blue-500 text-sm">বিস্তারিত →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail / Approve Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedSub.name} — Roll {selectedSub.roll}
              </h2>
              <button
                onClick={() => setSelectedSub(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-1">
              <Row label="ব্যাচ" value={selectedSub.batchName} />
              <Row label="ফোন" value={selectedSub.phone} />
              <Row label="NID / জন্ম নং" value={selectedSub.nidBirthNo} />
              <Row label="জন্ম তারিখ" value={selectedSub.dob} />
              <Row label="ই-মেইল" value={selectedSub.email} />
              <Row label="ব্লাড গ্রুপ" value={selectedSub.bloodGroup} />
              <Row label="ক্যাটাগরি" value={selectedSub.category} />
              <Row label="টি-শার্ট সাইজ" value={selectedSub.tShirtSize} />
              <Row label="পিতার নাম" value={selectedSub.fatherName} />
              <Row label="মাতার নাম" value={selectedSub.motherName} />
              <Row label="অভিভাবক" value={selectedSub.guardianName} />
              <Row label="অভিভাবকের ফোন" value={selectedSub.guardianPhone} />
              <Row label="বর্তমান ঠিকানা" value={selectedSub.presentAddress} />
              <Row label="স্থায়ী ঠিকানা" value={selectedSub.permanentAddress} />
              <Row label="বর্তমান জেলা" value={selectedSub.currentDistrict} />
              <Row label="স্থায়ী জেলা" value={selectedSub.homeDistrict} />
              <Row label="শিক্ষা প্রতিষ্ঠান" value={selectedSub.lastInstitute} />
              <Row label="সর্বোচ্চ ডিগ্রি" value={selectedSub.latestDegree} />
              <Row label="GPA / ফলাফল" value={selectedSub.gpaResult} />
              <Row label="কোর্সের লক্ষ্য" value={selectedSub.courseGoal} />
            </div>

            {selectedSub.status === "pending" && (
              <div className="p-5 border-t space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Note (ঐচ্ছিক)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={2}
                    placeholder="প্রয়োজনে নোট লিখুন..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    disabled={actionLoading === selectedSub.id}
                    onClick={() => handleAction(selectedSub.id, "approve")}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2 rounded-xl transition-colors"
                  >
                    {actionLoading === selectedSub.id ? "..." : "✓ Approve"}
                  </button>
                  <button
                    disabled={actionLoading === selectedSub.id}
                    onClick={() => handleAction(selectedSub.id, "reject")}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-200 text-white font-semibold py-2 rounded-xl transition-colors"
                  >
                    {actionLoading === selectedSub.id ? "..." : "✗ Reject"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
