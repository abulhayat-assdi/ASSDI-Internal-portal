"use client";

import React from "react";

interface Props {
  schema: any[];
  formData: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  /** Field ids that are shown but cannot be edited (e.g. the date on a correction). */
  lockedFieldIds?: string[];
  /** Latest allowed value for date questions (YYYY-MM-DD). */
  maxDate?: string;
}

const inputClass =
  "w-full bg-white text-slate-900 border border-slate-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-sm placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed";

/** Renders a competition form's questions from its schema. */
export default function CompetitionFormFields({ schema, formData, onChange, lockedFieldIds = [], maxDate }: Props) {
  const setField = (fieldId: string, value: any) => onChange({ ...formData, [fieldId]: value });

  const setRepeaterCell = (fieldId: string, index: number, subFieldId: string, value: any) => {
    const arr = [...(formData[fieldId] || [])];
    arr[index] = { ...(arr[index] || {}), [subFieldId]: value };
    setField(fieldId, arr);
  };

  return (
    <div className="space-y-5">
      {schema.map((field: any) => {
        const locked = lockedFieldIds.includes(field.id);
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>

            {field.type === "short_text" && (
              <input
                type={field.validation === "number" ? "number" : "text"}
                className={inputClass}
                value={formData[field.id] !== undefined ? formData[field.id] : ""}
                placeholder={field.placeholder || ""}
                onChange={(e) => setField(field.id, e.target.value)}
                onWheel={(e) => field.validation === "number" && (e.target as HTMLElement).blur()}
                required={field.required}
                disabled={locked}
              />
            )}

            {field.type === "long_text" && (
              <textarea
                className={inputClass}
                rows={6}
                value={formData[field.id] || ""}
                placeholder={field.placeholder || ""}
                onChange={(e) => setField(field.id, e.target.value)}
                required={field.required}
                disabled={locked}
              />
            )}

            {field.type === "dropdown" && (
              <select
                className={inputClass}
                value={formData[field.id] || ""}
                onChange={(e) => setField(field.id, e.target.value)}
                required={field.required}
                disabled={locked}
              >
                <option value="">-- Select Option --</option>
                {field.options?.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === "mcq" && (
              <div className="space-y-2 pt-1">
                {field.options?.map((opt: string) => (
                  <label key={opt} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                    <input
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={formData[field.id] === opt}
                      onChange={(e) => setField(field.id, e.target.value)}
                      required={field.required}
                      disabled={locked}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-800">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {field.type === "date" && (
              <input
                type="date"
                className={inputClass}
                value={formData[field.id] || ""}
                max={maxDate}
                onChange={(e) => setField(field.id, e.target.value)}
                required={field.required}
                disabled={locked}
              />
            )}

            {field.type === "rating" && (
              <div className="flex justify-center items-center gap-3 sm:gap-4 py-4 bg-slate-50 border border-slate-200 rounded-xl my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={locked}
                    className={`text-4xl sm:text-5xl transition-transform hover:scale-125 active:scale-95 ${
                      formData[field.id] >= star ? "text-amber-400 drop-shadow" : "text-slate-300"
                    }`}
                    onClick={() => setField(field.id, star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            )}

            {field.type === "repeater" && (
              <div className="mt-2 space-y-4">
                {(formData[field.id] || []).map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative shadow-sm">
                    <button
                      type="button"
                      onClick={() => setField(field.id, (formData[field.id] || []).filter((_: any, i: number) => i !== idx))}
                      className="absolute top-3 right-3 text-red-600 hover:text-red-700 text-xs font-bold bg-red-100 px-2.5 py-1 rounded-md border border-red-200 transition"
                    >
                      Remove
                    </button>
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                      Item #{idx + 1}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {field.subFields?.map((sub: any) => (
                        <div key={sub.id}>
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            {sub.label} {sub.required && <span className="text-red-500">*</span>}
                          </label>
                          {sub.type === "short_text" && (
                            <input
                              type={sub.validation === "number" ? "number" : "text"}
                              className="w-full bg-white text-slate-900 border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              value={item?.[sub.id] || ""}
                              placeholder={sub.placeholder || ""}
                              onChange={(e) => setRepeaterCell(field.id, idx, sub.id, e.target.value)}
                              onWheel={(e) => sub.validation === "number" && (e.target as HTMLElement).blur()}
                              required={sub.required}
                            />
                          )}
                          {sub.type === "dropdown" && (
                            <select
                              className="w-full bg-white text-slate-900 border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              value={item?.[sub.id] || ""}
                              onChange={(e) => setRepeaterCell(field.id, idx, sub.id, e.target.value)}
                              required={sub.required}
                            >
                              <option value="">-- Select --</option>
                              {sub.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setField(field.id, [...(formData[field.id] || []), {}])}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-emerald-300 transition flex items-center gap-2"
                >
                  <span>+</span> Add Item
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
