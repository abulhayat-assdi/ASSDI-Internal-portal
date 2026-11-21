/**
 * English Levels 4–6: no new keys — fluency, speed, stamina and real
 * workplace writing on top of everything Levels 1–3 taught.
 */
import { EN_NUMBERS } from "./en-levels-2-3";
import { buildLevel, levelKeys } from "./level-builder";

const ALL_KEYS = levelKeys(EN_NUMBERS);

export const EN_WORDS = buildLevel(
  {
    id: "en-4",
    mode: "en",
    number: 4,
    title: "Words & Sentences",
    description: "সবচেয়ে বেশি ব্যবহৃত শব্দ, গুলিয়ে যাওয়া অক্ষরের নির্ভুলতা, আর সম্পূর্ণ বাক্য।",
    units: [
      {
        title: "Common Words",
        lessons: [
          { title: "Top 100 Words", kind: "words", newKeys: [], pool: 100 },
          { title: "Top 300 Words", kind: "words", newKeys: [], pool: 300 },
          { title: "Longer Words", kind: "words", newKeys: [], pool: 1500 },
        ],
      },
      {
        title: "Accuracy",
        lessons: [
          { title: "R and T, B and N", kind: "accuracy", newKeys: [], focus: ["r", "t", "b", "n"] },
          { title: "M and N, E and I", kind: "accuracy", newKeys: [], focus: ["m", "n", "e", "i"] },
          { title: "Double Letters", kind: "accuracy", newKeys: [], focus: ["ee", "ll", "ss", "oo", "tt", "pp", "ff", "rr", "mm", "cc"] },
        ],
      },
      {
        title: "Sentences",
        lessons: [
          { title: "Simple Sentences", kind: "sentences", newKeys: [] },
          { title: "Sentences with Punctuation", kind: "sentences", newKeys: [], focus: ["punctuation"] },
          { title: "Words & Sentences Review", kind: "review", newKeys: [] },
          { title: "Assessment 4", kind: "assessment", newKeys: [], seconds: 60 },
        ],
      },
    ],
  },
  ALL_KEYS,
);

export const EN_SPEED = buildLevel(
  {
    id: "en-5",
    mode: "en",
    number: 5,
    title: "Speed Building",
    description: "একই লাইন বারবার টাইপ করে গতি বাড়ানো, তারপর ২–৩ মিনিট টানা টাইপ করার অভ্যাস।",
    units: [
      {
        title: "Sprints",
        lessons: [
          { title: "Short Sprints", kind: "sprint", newKeys: [] },
          { title: "Phrase Repeats", kind: "sprint", newKeys: [] },
          { title: "Paragraph Sprint", kind: "sentences", newKeys: [] },
        ],
      },
      {
        title: "Endurance",
        lessons: [
          { title: "Two-Minute Run", kind: "endurance", newKeys: [], seconds: 120 },
          { title: "Three-Minute Run", kind: "endurance", newKeys: [], seconds: 180 },
        ],
      },
      {
        title: "Wrapping Up",
        lessons: [
          { title: "Speed Review", kind: "review", newKeys: [] },
          { title: "Assessment 5", kind: "assessment", newKeys: [], seconds: 180 },
        ],
      },
    ],
  },
  ALL_KEYS,
);

export const EN_PROFESSIONAL = buildLevel(
  {
    id: "en-6",
    mode: "en",
    number: 6,
    title: "Professional Typing",
    description: "অফিসের আসল লেখা — ইমেইল, কাস্টমার রিপ্লাই, কভার লেটার, মার্কেটিং কপি, রিপোর্ট।",
    units: [
      {
        title: "Workplace Writing",
        lessons: [
          { title: "Business Email", kind: "professional", newKeys: [], topic: "email" },
          { title: "Customer Reply", kind: "professional", newKeys: [], topic: "customer" },
          { title: "Cover Letter", kind: "professional", newKeys: [], topic: "cover-letter" },
          { title: "Marketing Copy", kind: "professional", newKeys: [], topic: "marketing" },
          { title: "Report Summary", kind: "professional", newKeys: [], topic: "report" },
        ],
      },
      {
        title: "Real Articles",
        lessons: [
          { title: "Articles: Marketing", kind: "professional", newKeys: [], topic: "articles:Marketing" },
          { title: "Articles: Technology", kind: "professional", newKeys: [], topic: "articles:Technology" },
          { title: "Articles: Entrepreneurship", kind: "professional", newKeys: [], topic: "articles:Entrepreneurship" },
        ],
      },
      {
        title: "Wrapping Up",
        lessons: [{ title: "Assessment 6", kind: "assessment", newKeys: [], seconds: 180, topic: "mixed" }],
      },
    ],
  },
  ALL_KEYS,
);
