/**
 * The fixed typing tests. Timed tests run for `seconds`; page tests end
 * when the text is typed (with `seconds` as the time limit).
 */
import { buildPracticeText } from "@/lib/typing-game/practice/text";
import type { PracticeLanguage } from "@/lib/typing-game/practice/transform";

export type TestKind = "timed" | "page" | "job";

export interface TypingTest {
  id: string;
  kind: TestKind;
  title: string;
  description: string;
  seconds: number;
  /** Page tests: words to type. */
  words?: number;
}

export const TYPING_TESTS: TypingTest[] = [
  { id: "time-1", kind: "timed", title: "1 Minute Test", description: "দ্রুত গতি যাচাই", seconds: 60 },
  { id: "time-3", kind: "timed", title: "3 Minute Test", description: "সবচেয়ে জনপ্রিয় স্ট্যান্ডার্ড টেস্ট", seconds: 180 },
  { id: "time-5", kind: "timed", title: "5 Minute Test", description: "গতি আর ধৈর্য দুটোই", seconds: 300 },
  { id: "page-1", kind: "page", title: "1 Page Test", description: "প্রায় ২৫০ শব্দ — যত দ্রুত সম্ভব শেষ করুন", seconds: 900, words: 250 },
  { id: "page-2", kind: "page", title: "2 Page Test", description: "প্রায় ৫০০ শব্দ", seconds: 1800, words: 500 },
  { id: "page-3", kind: "page", title: "3 Page Test", description: "প্রায় ৭৫০ শব্দ", seconds: 2700, words: 750 },
  { id: "job-10", kind: "job", title: "Job Test Practice", description: "চাকরির টাইপিং পরীক্ষার মতো ১০ মিনিট টানা", seconds: 600 },
];

export function findTest(id: string): TypingTest | null {
  return TYPING_TESTS.find((t) => t.id === id) ?? null;
}

/** Fresh text for one run: real articles as written (capitals, punctuation, numbers). */
export function testText(test: TypingTest, language: PracticeLanguage, seed: number): string {
  const words = test.words ?? Math.ceil((test.seconds / 60) * 160) + 20;
  return buildPracticeText({
    language,
    difficulty: "expert",
    overrides: { case: "original", punctuation: "full", numbers: true },
    words,
    seed,
  }).text;
}
