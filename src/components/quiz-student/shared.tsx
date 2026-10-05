"use client";

import { useEffect, useState } from "react";

export type OptionLabelStyle = "LETTERS" | "NUMBERS" | "ROMAN";
export type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

export interface StudentOption {
  id: string;
  textHtml: string;
}

export interface StudentQuestion {
  id: string;
  type: QuestionType;
  bodyHtml: string;
  marks: number;
  options: StudentOption[];
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];

export function optionLabel(style: OptionLabelStyle | string, index: number): string {
  if (style === "NUMBERS") return String(index + 1);
  if (style === "ROMAN") return ROMAN[index] ?? String(index + 1);
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

/** Tailwind has no typography plugin here, so style server-sanitized quiz HTML locally. */
export const HTML_CLASS =
  "break-words [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg " +
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-3 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 " +
  "[&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-1.5 [&_th]:border [&_th]:border-slate-200 [&_th]:p-1.5 [&_a]:text-brand-600 [&_a]:underline";

/** Renders server-sanitized quiz HTML (bodyHtml / textHtml / explanationHtml). */
export function Html({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`${HTML_CLASS} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} সেকেন্ড`;
  if (s === 0) return `${m} মিনিট`;
  return `${m} মিনিট ${s} সেকেন্ড`;
}

export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Friendly Bangla message for the quiz API's error codes. */
export function quizErrorMessage(code: string | undefined): string {
  switch (code) {
    case "not-found":
      return "কুইজটি পাওয়া যায়নি অথবা আপনার ব্যাচের জন্য নয়।";
    case "not-open":
      return "কুইজটি এখনো শুরু হয়নি। নির্ধারিত সময়ে আবার চেষ্টা করুন।";
    case "closed":
      return "কুইজটির সময় শেষ হয়ে গেছে।";
    case "attempts-exhausted":
      return "এই কুইজের সব চেষ্টা (attempt) আপনি ব্যবহার করে ফেলেছেন।";
    case "invalid-code":
      return "কোডটি সঠিক নয় অথবা সেশনটি শেষ হয়ে গেছে।";
    case "not-your-batch":
      return "এই লাইভ কুইজটি আপনার ব্যাচের জন্য নয়।";
    default:
      return "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।";
  }
}

/** Seconds left until `deadlineMs` (epoch ms), ticking every 250ms. Null when no deadline. */
export function useSecondsLeft(deadlineMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineMs == null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadlineMs]);
  if (deadlineMs == null) return null;
  return Math.max(0, (deadlineMs - now) / 1000);
}

export function Spinner({ label = "লোড হচ্ছে..." }: { label?: string }) {
  return (
    <div className="text-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto" />
      <p className="text-slate-400 mt-3 text-sm">{label}</p>
    </div>
  );
}
