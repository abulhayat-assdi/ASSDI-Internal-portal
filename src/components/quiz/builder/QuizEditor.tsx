"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { AmbientOrbs, GLASS_PANEL } from "@/components/typing-exam/ui";
import {
    emptySettings, fromLocalInput, serializeQuestion, toLocalInput, uid, validateQuestion,
    type Batch, type QDraft, type QOption, type QuizQuestionType, type QuizSettings,
} from "../types";
import { btnPrimary } from "../ui";
import SettingsForm from "./SettingsForm";
import QuestionBuilder from "./QuestionBuilder";

type ApiQuestion = {
    id: string; type: QuizQuestionType; bodyHtml: string; marks: number; explanationHtml: string;
    tag: string | null; difficulty: string | null; timeLimitSeconds: number | null; options: QOption[]; sourceBankItemId: string | null;
};

function buildPayload(s: QuizSettings) {
    return {
        title: s.title.trim(),
        descriptionHtml: s.descriptionHtml,
        batchNames: s.batchNames,
        optionLabelStyle: s.optionLabelStyle,
        shuffleQuestions: s.shuffleQuestions,
        shuffleOptions: s.shuffleOptions,
        allowBacktrack: s.allowBacktrack,
        durationSeconds: s.durationMinutes ? Math.round(Number(s.durationMinutes) * 60) : null,
        maxAttempts: s.maxAttempts,
        practiceModeAllowed: s.practiceModeAllowed,
        negativeMarkPerWrong: s.negativeMarkPerWrong,
        passPercentage: s.passPercentage !== "" ? Number(s.passPercentage) : null,
        resultReleaseMode: s.resultReleaseMode,
        resultReleaseAt: s.resultReleaseMode === "HELD" ? fromLocalInput(s.resultReleaseAt) : null,
        showLeaderboard: s.showLeaderboard,
        leaderboardShowNames: s.leaderboardShowNames,
        scheduleStart: fromLocalInput(s.scheduleStart),
        scheduleEnd: fromLocalInput(s.scheduleEnd),
    };
}

export default function QuizEditor({ quizId }: { quizId?: string }) {
    const router = useRouter();
    const [settings, setSettings] = useState<QuizSettings>(emptySettings);
    const [questions, setQuestions] = useState<QDraft[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [attempts, setAttempts] = useState(0);
    const [loading, setLoading] = useState(Boolean(quizId));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/typing-exam")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setBatches(d.batches ?? []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!quizId) return;
        let cancelled = false;
        (async () => {
            const res = await fetch(`/api/quiz/${quizId}`);
            if (cancelled) return;
            if (!res.ok) {
                setError((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
                setLoading(false);
                return;
            }
            const q = await res.json();
            const locked = (q._count?.attempts ?? 0) > 0;
            setAttempts(q._count?.attempts ?? 0);
            setSettings({
                title: q.title, descriptionHtml: q.descriptionHtml ?? "", batchNames: q.batchNames ?? [],
                optionLabelStyle: q.optionLabelStyle, shuffleQuestions: q.shuffleQuestions, shuffleOptions: q.shuffleOptions,
                allowBacktrack: q.allowBacktrack, durationMinutes: q.durationSeconds ? String(q.durationSeconds / 60) : "",
                maxAttempts: q.maxAttempts, practiceModeAllowed: q.practiceModeAllowed, negativeMarkPerWrong: q.negativeMarkPerWrong,
                passPercentage: q.passPercentage != null ? String(q.passPercentage) : "", resultReleaseMode: q.resultReleaseMode,
                resultReleaseAt: toLocalInput(q.resultReleaseAt), showLeaderboard: q.showLeaderboard, leaderboardShowNames: q.leaderboardShowNames,
                scheduleStart: toLocalInput(q.scheduleStart), scheduleEnd: toLocalInput(q.scheduleEnd),
            });
            setQuestions(
                (q.questions as ApiQuestion[]).map((x) => ({
                    key: uid(), id: x.id, type: x.type, bodyHtml: x.bodyHtml, marks: x.marks, explanationHtml: x.explanationHtml,
                    tag: x.tag ?? "", difficulty: x.difficulty ?? "", timeLimitSeconds: x.timeLimitSeconds,
                    options: x.options ?? [], sourceBankItemId: x.sourceBankItemId ?? undefined, locked,
                }))
            );
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [quizId]);

    const locked = attempts > 0;

    async function save() {
        setError("");
        if (!settings.title.trim()) return setError("শিরোনাম দিন");
        if (settings.batchNames.length === 0) return setError("কমপক্ষে একটি ব্যাচ নির্বাচন করুন");
        for (let i = 0; i < questions.length; i++) {
            if (questions[i].locked) continue;
            const err = validateQuestion(questions[i]);
            if (err) return setError(`প্রশ্ন ${i + 1}: ${err}`);
        }
        setSaving(true);
        try {
            const base = buildPayload(settings);
            
            if (!quizId) {
                const res = await fetch("/api/quiz", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...base, questions: questions.map(serializeQuestion) }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
            } else if (!locked) {
                const res = await fetch(`/api/quiz/${quizId}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...base, questions: questions.map(serializeQuestion) }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
            } else {
                const res = await fetch(`/api/quiz/${quizId}`, {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(base),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
                const fresh = questions.filter((q) => !q.locked);
                if (fresh.length > 0) {
                    const r2 = await fetch(`/api/quiz/${quizId}/questions`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ questions: fresh.map(serializeQuestion) }),
                    });
                    if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error || `Error ${r2.status}`);
                }
            }
            toast.success(quizId ? "সেভ হয়েছে" : "কুইজ তৈরি হয়েছে (Draft) — Publish করতে লিস্ট পেজে যান");
            router.push("/dashboard/quiz");
        } catch (e) {
            setError(e instanceof Error ? e.message : "সেভ করা যায়নি");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="text-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" /></div>;

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-28">
            <AmbientOrbs />
            <Link href="/dashboard/quiz" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"><ArrowLeft className="h-4 w-4" /> কুইজ লিস্ট</Link>
            <h1 className="no-gradient text-2xl font-bold text-slate-800 mb-5">{quizId ? "কুইজ এডিট" : "নতুন কুইজ"}</h1>

            {error && <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}
            {locked && (
                <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl text-sm bg-amber-50 text-amber-800 border border-amber-200">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>এই কুইজে {attempts} টি অ্যাটেম্পট জমা পড়েছে, তাই বিদ্যমান প্রশ্নগুলো লক করা (বদলানো/মুছা/সাজানো যাবে না)। শুধু <b>নতুন প্রশ্ন যোগ</b> (ম্যানুয়াল, বাল্ক বা Question bank থেকে) এবং সেটিংস পরিবর্তন করা যাবে।</span>
                </div>
            )}

            <section className={`${GLASS_PANEL} rounded-2xl p-5 mb-6`}>
                <h2 className="no-gradient font-bold text-slate-800 mb-4">সেটিংস</h2>
                <SettingsForm s={settings} onChange={setSettings} batches={batches} />
            </section>

            <section className={`${GLASS_PANEL} rounded-2xl p-5`}>
                <h2 className="no-gradient font-bold text-slate-800 mb-4">প্রশ্ন ({questions.length})</h2>
                <QuestionBuilder questions={questions} onChange={setQuestions} style={settings.optionLabelStyle} />
            </section>

            <div className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3 flex justify-end gap-2 lg:pl-72">
                <Link href="/dashboard/quiz" className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">বাতিল</Link>
                <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? "সেভ হচ্ছে..." : quizId ? "সেভ করুন" : "কুইজ তৈরি করুন"}</button>
            </div>
        </div>
    );
}
