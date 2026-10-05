"use client";

import RichTextEditor from "@/components/ui/RichTextEditor";
import { optionLabel, type Batch, type LabelStyle, type QuizSettings } from "../types";
import { Seg, Switch, fieldClass, labelClass } from "../ui";

type Props = { s: QuizSettings; onChange: (s: QuizSettings) => void; batches: Batch[] };

export default function SettingsForm({ s, onChange, batches }: Props) {
    const set = <K extends keyof QuizSettings>(k: K, v: QuizSettings[K]) => onChange({ ...s, [k]: v });
    const allSelected = s.batchNames.includes("all");

    function toggleBatch(name: string) {
        if (name === "all") return set("batchNames", allSelected ? [] : ["all"]);
        const base = s.batchNames.filter((b) => b !== "all");
        set("batchNames", base.includes(name) ? base.filter((b) => b !== name) : [...base, name]);
    }

    const chip = (active: boolean) =>
        `cursor-pointer text-sm px-3 py-1.5 rounded-lg border transition-colors ${active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`;

    return (
        <div className="space-y-5">
            <div>
                <label className={labelClass}>শিরোনাম *</label>
                <input value={s.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} placeholder="যেমন: Batch 12 — Excel MCQ Test" />
            </div>
            <div>
                <label className={labelClass}>বিবরণ / নির্দেশনা (ঐচ্ছিক)</label>
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                    <RichTextEditor value={s.descriptionHtml} onChange={(h) => set("descriptionHtml", h)} placeholder="স্টুডেন্টদের জন্য নির্দেশনা..." />
                </div>
            </div>

            <div>
                <label className={labelClass}>ব্যাচ *</label>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => toggleBatch("all")} className={chip(allSelected)}>সব ব্যাচ</button>
                    {batches.map((b) => (
                        <button type="button" key={b.id} onClick={() => toggleBatch(b.name)} className={chip(!allSelected && s.batchNames.includes(b.name))}>{b.name}</button>
                    ))}
                </div>
                {batches.length === 0 && <p className="text-xs text-slate-400 mt-1">কোনো active ব্যাচ পাওয়া যায়নি।</p>}
            </div>

            <div>
                <label className={labelClass}>অপশন লেবেল স্টাইল</label>
                <Seg<LabelStyle>
                    value={s.optionLabelStyle}
                    onChange={(v) => set("optionLabelStyle", v)}
                    options={[{ value: "LETTERS", label: "A B C" }, { value: "NUMBERS", label: "1 2 3" }, { value: "ROMAN", label: "i ii iii" }]}
                />
                <div className="mt-2 flex gap-2 text-sm">
                    {[0, 1, 2, 3].map((i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">{optionLabel(s.optionLabelStyle, i)}.</span>
                    ))}
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <Switch checked={s.shuffleQuestions} onChange={(v) => set("shuffleQuestions", v)} label="প্রশ্ন শাফল করুন" />
                <Switch checked={s.shuffleOptions} onChange={(v) => set("shuffleOptions", v)} label="অপশন শাফল করুন" />
                <Switch checked={s.allowBacktrack} onChange={(v) => set("allowBacktrack", v)} label="আগের প্রশ্নে ফিরে যাওয়া যাবে" />
                <Switch checked={s.practiceModeAllowed} onChange={(v) => set("practiceModeAllowed", v)} label="Practice mode চালু" hint="রেজাল্টে গণনা হবে না" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                    <label className={labelClass}>সময় (মিনিট)</label>
                    <input type="number" min={1} value={s.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className={fieldClass} placeholder="সীমাহীন" />
                </div>
                <div>
                    <label className={labelClass}>সর্বোচ্চ Attempt</label>
                    <input type="number" min={1} value={s.maxAttempts} onChange={(e) => set("maxAttempts", Math.max(1, Number(e.target.value) || 1))} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>ভুলে নেগেটিভ মার্ক</label>
                    <input type="number" min={0} step={0.25} value={s.negativeMarkPerWrong} onChange={(e) => set("negativeMarkPerWrong", Math.max(0, Number(e.target.value) || 0))} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>পাস %</label>
                    <input type="number" min={0} max={100} value={s.passPercentage} onChange={(e) => set("passPercentage", e.target.value)} className={fieldClass} placeholder="—" />
                </div>
            </div>

            <div>
                <label className={labelClass}>রেজাল্ট প্রকাশ</label>
                <Seg
                    value={s.resultReleaseMode}
                    onChange={(v) => set("resultReleaseMode", v)}
                    options={[{ value: "IMMEDIATE", label: "জমা দেওয়ার সাথে সাথে" }, { value: "HELD", label: "আটকে রাখুন (Held)" }]}
                />
                {s.resultReleaseMode === "HELD" && (
                    <div className="mt-3 max-w-xs">
                        <label className={labelClass}>নির্ধারিত প্রকাশের সময় (ঐচ্ছিক)</label>
                        <input type="datetime-local" value={s.resultReleaseAt} onChange={(e) => set("resultReleaseAt", e.target.value)} className={fieldClass} />
                        <p className="text-xs text-slate-400 mt-1">খালি রাখলে রেজাল্ট পেজ থেকে ম্যানুয়ালি Release করতে হবে।</p>
                    </div>
                )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <Switch checked={s.showLeaderboard} onChange={(v) => set("showLeaderboard", v)} label="লিডারবোর্ড দেখান" />
                <Switch checked={s.leaderboardShowNames} onChange={(v) => set("leaderboardShowNames", v)} label="লিডারবোর্ডে নাম দেখান" hint="বন্ধ থাকলে নাম গোপন থাকবে" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>শুরুর সময় (ঐচ্ছিক)</label>
                    <input type="datetime-local" value={s.scheduleStart} onChange={(e) => set("scheduleStart", e.target.value)} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>শেষ সময় (ঐচ্ছিক)</label>
                    <input type="datetime-local" value={s.scheduleEnd} onChange={(e) => set("scheduleEnd", e.target.value)} className={fieldClass} />
                </div>
            </div>
        </div>
    );
}
