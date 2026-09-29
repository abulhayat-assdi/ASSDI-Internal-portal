"use client";

import type { CourseBranding } from "@/types/branding";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BLOOD_GROUPS, CATEGORIES, T_SHIRT_SIZES, BD_DISTRICTS,
} from "@/lib/form-data/student-form-constants";

type Student = { roll: string; name: string };
type FormData = {
  roll: string; name: string; phone: string; nidBirthNo: string;
  dob: string; email: string; bloodGroup: string; fatherName: string;
  motherName: string; presentAddress: string; permanentAddress: string;
  guardianName: string; guardianPhone: string; lastInstitute: string;
  latestDegree: string; gpaResult: string; currentDistrict: string;
  homeDistrict: string; category: string; tShirtSize: string;
  courseGoal: string;
};
const EMPTY: FormData = {
  roll:"",name:"",phone:"",nidBirthNo:"",dob:"",email:"",bloodGroup:"",
  fatherName:"",motherName:"",presentAddress:"",permanentAddress:"",
  guardianName:"",guardianPhone:"",lastInstitute:"",latestDegree:"",
  gpaResult:"",currentDistrict:"",homeDistrict:"",category:"",tShirtSize:"",
  courseGoal:"",
};

const input = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-300";
const select = "w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all appearance-none cursor-pointer";
const label = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

function Sel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}

function Section({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="no-gradient text-xs font-bold text-slate-600 uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">{children}</div>
    </div>
  );
}

export default function StudentFormClient({ brand }: { brand: CourseBranding }) {
  const { slug } = useParams<{ slug: string }>();
  const [batchName, setBatchName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formClosed, setFormClosed] = useState(false);

  useEffect(() => {
    fetch(`/api/student-form/${slug}`)
      .then(async (r) => {
        if (r.status === 403) { setFormClosed(true); return; }
        if (!r.ok) { setError("ফর্মটি পাওয়া যায়নি।"); return; }
        const d = await r.json();
        setBatchName(d.batchName);
        setStudents(d.students);
      })
      .catch(() => setError("সার্ভারে সংযোগ করতে পারা যাচ্ছে না।"))
      .finally(() => setLoading(false));
  }, [slug]);

  function onRoll(roll: string) {
    const s = students.find((x) => x.roll === roll);
    setForm((p) => ({ ...p, roll, name: s?.name ?? "" }));
  }
  function set(f: keyof FormData, v: string) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const res = await fetch(`/api/student-form/${slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) { setSuccess(true); return; }
    const d = await res.json().catch(() => ({}));
    setError(d.error || "কিছু একটা সমস্যা হয়েছে।");
  }

  // Loading
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">লোড হচ্ছে...</p>
      </div>
    </div>
  );

  if (formClosed) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center border border-slate-100">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="no-gradient text-lg font-bold text-slate-700 mb-1">ফর্মটি বন্ধ আছে</p>
        <p className="text-slate-400 text-sm">এই ফর্মটি এখন জমা নেওয়া বন্ধ।</p>
      </div>
    </div>
  );

  if (error && !batchName) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center border border-slate-100">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="no-gradient text-lg font-bold text-slate-700 mb-1">ফর্ম পাওয়া যায়নি</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-sm w-full text-center border border-slate-100">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="no-gradient text-xl font-bold text-slate-800 mb-1">সফলভাবে জমা হয়েছে!</p>
        <p className="text-slate-500 text-sm mb-1">আপনার তথ্য সফলভাবে জমা দেওয়া হয়েছে।</p>
        <p className="text-slate-400 text-xs">অ্যাডমিন যাচাই করার পরে আপনার তথ্য আপডেট হবে।</p>
      </div>
    </div>
  );

  const req = <span className="text-red-400">*</span>;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="bg-[#0f2744]">
        <div className="max-w-2xl mx-auto px-5 py-8 text-center">
          <p className="no-gradient text-emerald-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
            Sales &amp; Marketing Institute
          </p>
          <p className="no-gradient text-white text-2xl sm:text-3xl font-extrabold leading-tight">
            Student Information Form
          </p>
          {batchName && (
            <span className="inline-block mt-3 px-4 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">
              ব্যাচ: {batchName}
            </span>
          )}
          <p className="no-gradient text-slate-400 text-xs mt-3">
            সকল তথ্য সঠিকভাবে পূরণ করুন &bull; সব ফিল্ড আবশ্যক
          </p>
        </div>
      </div>

      {/* ── Divider strip ───────────────────────────────────────────── */}
      <div className="h-1 bg-gradient-to-r from-[#0f2744] via-emerald-500 to-[#0f2744]" />

      {/* ── Form ────────────────────────────────────────────────────── */}
      <form onSubmit={submit} className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-10">

        {/* মূল তথ্য */}
        <Section dot="bg-[#0f2744]" title="মূল তথ্য">
          <div>
            <label className={label}>রোল নম্বর {req}</label>
            <Sel>
              <select value={form.roll} onChange={(e) => onRoll(e.target.value)} required className={select}>
                <option value="">-- রোল সিলেক্ট করুন --</option>
                {students.map((s) => <option key={s.roll} value={s.roll}>{s.roll}</option>)}
              </select>
            </Sel>
          </div>
          <div>
            <label className={label}>নাম</label>
            <input type="text" value={form.name} readOnly
              placeholder="রোল সিলেক্ট করলে নাম আসবে"
              className={`${input} bg-slate-50 cursor-not-allowed font-semibold text-slate-600`} />
          </div>
        </Section>

        {/* ব্যক্তিগত তথ্য */}
        <Section dot="bg-violet-500" title="ব্যক্তিগত তথ্য">
          <div>
            <label className={label}>ফোন নম্বর {req}</label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone",e.target.value)} required className={input} placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className={label}>NID / জন্ম নিবন্ধন নম্বর {req}</label>
            <input type="text" value={form.nidBirthNo} onChange={(e) => set("nidBirthNo",e.target.value)} required className={input} placeholder="NID বা জন্ম নিবন্ধন নম্বর" />
          </div>
          <div>
            <label className={label}>জন্ম তারিখ {req}</label>
            <input type="date" value={form.dob} onChange={(e) => set("dob",e.target.value)} required className={input} />
          </div>
          <div>
            <label className={label}>ই-মেইল {req}</label>
            <input type="email" value={form.email} onChange={(e) => set("email",e.target.value)} required className={input} placeholder="example@gmail.com" />
          </div>
          <div>
            <label className={label}>ব্লাড গ্রুপ {req}</label>
            <Sel>
              <select value={form.bloodGroup} onChange={(e) => set("bloodGroup",e.target.value)} required className={select}>
                <option value="">-- সিলেক্ট করুন --</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Sel>
          </div>
          <div>
            <label className={label}>ক্যাটাগরি {req}</label>
            <Sel>
              <select value={form.category} onChange={(e) => set("category",e.target.value)} required className={select}>
                <option value="">-- সিলেক্ট করুন --</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Sel>
          </div>
          <div>
            <label className={label}>টি-শার্ট সাইজ {req}</label>
            <Sel>
              <select value={form.tShirtSize} onChange={(e) => set("tShirtSize",e.target.value)} required className={select}>
                <option value="">-- সিলেক্ট করুন --</option>
                {T_SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Sel>
          </div>
        </Section>

        {/* পারিবারিক তথ্য */}
        <Section dot="bg-orange-500" title="পারিবারিক তথ্য">
          <div>
            <label className={label}>পিতার নাম {req}</label>
            <input type="text" value={form.fatherName} onChange={(e) => set("fatherName",e.target.value)} required className={input} placeholder="পিতার সম্পূর্ণ নাম" />
          </div>
          <div>
            <label className={label}>মাতার নাম {req}</label>
            <input type="text" value={form.motherName} onChange={(e) => set("motherName",e.target.value)} required className={input} placeholder="মাতার সম্পূর্ণ নাম" />
          </div>
          <div>
            <label className={label}>অভিভাবকের নাম {req}</label>
            <input type="text" value={form.guardianName} onChange={(e) => set("guardianName",e.target.value)} required className={input} placeholder="অভিভাবকের নাম" />
          </div>
          <div>
            <label className={label}>অভিভাবকের ফোন নম্বর {req}</label>
            <input type="tel" value={form.guardianPhone} onChange={(e) => set("guardianPhone",e.target.value)} required className={input} placeholder="01XXXXXXXXX" />
          </div>
        </Section>

        {/* ঠিকানা */}
        <Section dot="bg-cyan-500" title="ঠিকানা">
          <div className="sm:col-span-2">
            <label className={label}>বর্তমান ঠিকানা {req}</label>
            <textarea value={form.presentAddress} onChange={(e) => set("presentAddress",e.target.value)} required rows={2} className={`${input} resize-none`} placeholder="বর্তমান ঠিকানা লিখুন" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>স্থায়ী ঠিকানা {req}</label>
            <textarea value={form.permanentAddress} onChange={(e) => set("permanentAddress",e.target.value)} required rows={2} className={`${input} resize-none`} placeholder="স্থায়ী ঠিকানা লিখুন" />
          </div>
          <div>
            <label className={label}>বর্তমান জেলা {req}</label>
            <Sel>
              <select value={form.currentDistrict} onChange={(e) => set("currentDistrict",e.target.value)} required className={select}>
                <option value="">-- জেলা সিলেক্ট করুন --</option>
                {BD_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Sel>
          </div>
          <div>
            <label className={label}>স্থায়ী জেলা {req}</label>
            <Sel>
              <select value={form.homeDistrict} onChange={(e) => set("homeDistrict",e.target.value)} required className={select}>
                <option value="">-- জেলা সিলেক্ট করুন --</option>
                {BD_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Sel>
          </div>
        </Section>

        {/* শিক্ষাগত তথ্য */}
        <Section dot="bg-emerald-500" title="শিক্ষাগত তথ্য">
          <div className="sm:col-span-2">
            <label className={label}>সর্বশেষ শিক্ষা প্রতিষ্ঠান {req}</label>
            <input type="text" value={form.lastInstitute} onChange={(e) => set("lastInstitute",e.target.value)} required className={input} placeholder="প্রতিষ্ঠানের নাম ও ঠিকানা" />
          </div>
          <div>
            <label className={label}>সর্বোচ্চ ডিগ্রি {req}</label>
            <input type="text" value={form.latestDegree} onChange={(e) => set("latestDegree",e.target.value)} required className={input} placeholder="SSC, HSC, Alim, Dawra..." />
          </div>
          <div>
            <label className={label}>GPA / ফলাফল {req}</label>
            <input type="text" value={form.gpaResult} onChange={(e) => set("gpaResult",e.target.value)} required className={input} placeholder="5.00, Mumtaz, A+..." />
          </div>
        </Section>

        {/* কোর্সের লক্ষ্য */}
        <Section dot="bg-rose-500" title="কোর্সের পরবর্তী লক্ষ্য">
          <div className="sm:col-span-2">
            <label className={label}>এই কোর্স শেষ করে আপনি কি করতে চান? {req}</label>
            <textarea value={form.courseGoal} onChange={(e) => set("courseGoal",e.target.value)} required rows={4}
              className={`${input} resize-none`} placeholder="আপনার লক্ষ্য ও পরিকল্পনা বিস্তারিত লিখুন..." />
          </div>
        </Section>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !form.roll}
          className="w-full bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-colors shadow-md shadow-emerald-900/10 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              জমা হচ্ছে...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ফর্ম জমা দিন
            </>
          )}
        </button>

        <p className="text-center text-slate-400 text-xs pb-2">
          {brand.name} &bull; Student Information Form
        </p>
      </form>
    </div>
  );
}
