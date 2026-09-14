"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Lock, Type, Gauge, Calendar, Link2, AlertTriangle } from "lucide-react";
import { SegmentedToggle } from "@/components/typing-exam/ui";

export type Batch = { id: string; name: string };

export type ExamFormValues = {
  title: string;
  description: string;
  accessType: "INTERNAL" | "PUBLIC";
  batchNames: string[];
  durationSeconds: number;
  passWpm: number;
  passAccuracy: number;
  failWpm: number;
  failAccuracy: number;
  textSource: "CUSTOM" | "BANK";
  textLanguage: string;
  customText: string;
  retryPassword: string;
  scheduleStart: string;
  scheduleEnd: string;
};

export const emptyExamFormValues: ExamFormValues = {
  title: "",
  description: "",
  accessType: "INTERNAL",
  batchNames: [],
  durationSeconds: 60,
  passWpm: 40,
  passAccuracy: 90,
  failWpm: 20,
  failAccuracy: 75,
  textSource: "BANK",
  textLanguage: "en",
  customText: "",
  retryPassword: "",
  scheduleStart: "",
  scheduleEnd: "",
};

const fieldClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

type ExamFormProps = {
  mode: "create" | "edit";
  initialValues: ExamFormValues;
  batches: Batch[];
  onSubmit: (values: ExamFormValues) => Promise<void>;
  saving: boolean;
  error: string;
};

export default function ExamForm({ mode, initialValues, batches, onSubmit, saving, error }: ExamFormProps) {
  const reduceMotion = useReducedMotion();
  const [values, setValues] = useState<ExamFormValues>(initialValues);

  function toggleBatch(name: string) {
    setValues((f) => ({
      ...f,
      batchNames: f.batchNames.includes(name)
        ? f.batchNames.filter((b) => b !== name)
        : [...f.batchNames, name],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  const textChanged =
    mode === "edit" &&
    (values.textSource !== initialValues.textSource ||
      values.textLanguage !== initialValues.textLanguage ||
      values.customText !== initialValues.customText);

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      {error && (
        <div className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>
      )}

      <div>
        <label className={labelClass}>শিরোনাম *</label>
        <input
          required
          value={values.title}
          onChange={(e) => setValues((f) => ({ ...f, title: e.target.value }))}
          className={fieldClass}
          placeholder="যেমন: Batch 12 — টাইপিং স্পিড টেস্ট"
        />
      </div>

      <div>
        <label className={labelClass}>বিবরণ (ঐচ্ছিক)</label>
        <textarea
          value={values.description}
          onChange={(e) => setValues((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label className={labelClass}>Access Type</label>
        {mode === "create" ? (
          <SegmentedToggle
            value={values.accessType}
            onChange={(v) => setValues((f) => ({ ...f, accessType: v }))}
            options={[
              { value: "INTERNAL", label: "Internal (নির্দিষ্ট ব্যাচ)" },
              { value: "PUBLIC", label: "Public (ওপেন লিংক)" },
            ]}
          />
        ) : (
          <div>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                values.accessType === "PUBLIC" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
              }`}
            >
              {values.accessType === "PUBLIC" ? <Link2 className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              {values.accessType === "PUBLIC" ? "Public" : "Internal"}
            </span>
            <p className="text-xs text-slate-400 mt-1.5">Access Type তৈরির পর পরিবর্তন করা যায় না।</p>
          </div>
        )}
      </div>

      {values.accessType === "INTERNAL" && (
        <div>
          <label className={`${labelClass} flex items-center gap-1.5`}>
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            ব্যাচ নির্বাচন করুন *
          </label>
          {batches.length === 0 ? (
            <p className="text-xs text-slate-400">কোনো active ব্যাচ পাওয়া যায়নি।</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {batches.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => toggleBatch(b.name)}
                  className={`cursor-pointer text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    values.batchNames.includes(b.name)
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className={`${labelClass} flex items-center gap-1.5`}>
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          {mode === "create" ? "Retry Password *" : "নতুন Retry Password (ঐচ্ছিক)"}
        </label>
        <input
          required={mode === "create"}
          type="text"
          value={values.retryPassword}
          onChange={(e) => setValues((f) => ({ ...f, retryPassword: e.target.value }))}
          className={fieldClass}
          placeholder={
            mode === "create"
              ? "দ্বিতীয়বার Attempt দিতে এই পাসওয়ার্ড লাগবে"
              : "খালি রাখলে বর্তমান পাসওয়ার্ড অপরিবর্তিত থাকবে।"
          }
        />
      </div>

      <div>
        <label className={labelClass}>সময়সীমা (সেকেন্ড) *</label>
        <input
          required
          type="number"
          min={10}
          value={values.durationSeconds}
          onChange={(e) => setValues((f) => ({ ...f, durationSeconds: Number(e.target.value) }))}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={`${labelClass} flex items-center gap-1.5`}>
          <Type className="h-3.5 w-3.5" strokeWidth={2} />
          Text Source
        </label>
        <div className="mb-2">
          <SegmentedToggle
            value={values.textSource}
            onChange={(v) => setValues((f) => ({ ...f, textSource: v }))}
            options={[
              { value: "BANK", label: "Bank থেকে (র‍্যান্ডম)" },
              { value: "CUSTOM", label: "Custom (নিজে লিখুন)" },
            ]}
          />
        </div>
        {values.textSource === "BANK" ? (
          <select
            value={values.textLanguage}
            onChange={(e) => setValues((f) => ({ ...f, textLanguage: e.target.value }))}
            className={fieldClass}
          >
            <option value="en">English</option>
            <option value="bn">বাংলা</option>
          </select>
        ) : (
          <textarea
            required
            value={values.customText}
            onChange={(e) => setValues((f) => ({ ...f, customText: e.target.value }))}
            rows={4}
            className={fieldClass}
            placeholder="এক্সামের জন্য প্যাসেজ লিখুন..."
          />
        )}
        {textChanged && (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={2} />
            Text Source পরিবর্তন করলে নতুন Passage সিলেক্ট হবে — আগের ফলাফলের সাথে তুলনীয় নাও হতে পারে।
          </p>
        )}
      </div>

      <div>
        <p className={`${labelClass} flex items-center gap-1.5`}>
          <Gauge className="h-3.5 w-3.5" strokeWidth={2} />
          রেজাল্ট থ্রেশহোল্ড
        </p>
        <p className="text-xs text-slate-400 mb-2">
          উভয় মেট্রিক Pass বারের উপরে থাকলে PASS, যেকোনো একটি Fail বারের নিচে নামলে FAIL, বাকিটা AVERAGE।
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Pass WPM *</label>
            <input
              required
              type="number"
              value={values.passWpm}
              onChange={(e) => setValues((f) => ({ ...f, passWpm: Number(e.target.value) }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Pass Accuracy % *</label>
            <input
              required
              type="number"
              value={values.passAccuracy}
              onChange={(e) => setValues((f) => ({ ...f, passAccuracy: Number(e.target.value) }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fail WPM *</label>
            <input
              required
              type="number"
              value={values.failWpm}
              onChange={(e) => setValues((f) => ({ ...f, failWpm: Number(e.target.value) }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fail Accuracy % *</label>
            <input
              required
              type="number"
              value={values.failAccuracy}
              onChange={(e) => setValues((f) => ({ ...f, failAccuracy: Number(e.target.value) }))}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={`${labelClass} flex items-center gap-1.5`}>
          <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
          শিডিউল (ঐচ্ছিক)
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">শুরু</label>
            <input
              type="datetime-local"
              value={values.scheduleStart}
              onChange={(e) => setValues((f) => ({ ...f, scheduleStart: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">শেষ</label>
            <input
              type="datetime-local"
              value={values.scheduleEnd}
              onChange={(e) => setValues((f) => ({ ...f, scheduleEnd: e.target.value }))}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={saving}
        whileHover={reduceMotion || saving ? undefined : { scale: 1.01 }}
        whileTap={reduceMotion || saving ? undefined : { scale: 0.99 }}
        className="cursor-pointer w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl shadow-md shadow-brand-600/20 transition-colors"
      >
        {mode === "create"
          ? saving
            ? "তৈরি হচ্ছে..."
            : "এক্সাম তৈরি করুন"
          : saving
          ? "সংরক্ষণ হচ্ছে..."
          : "সংরক্ষণ করুন"}
      </motion.button>
    </form>
  );
}
