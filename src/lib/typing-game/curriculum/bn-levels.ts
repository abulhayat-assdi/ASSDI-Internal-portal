/**
 * Bangla track (Bijoy and Avro share it). Organised by letters, not key
 * positions, because Avro has no fixed key per letter. Level names stay
 * in English. Opens once English Level 1's Final Assessment is passed.
 */
import { buildLevel, levelKeys } from "./level-builder";
import { BN_CONSONANT_GROUPS, BN_DIGITS, BN_HASANTA } from "./bangla";

const [KA, CA, TTA, TA, PA, OTHERS, NUKTA] = BN_CONSONANT_GROUPS;

export const BN_LETTERS = buildLevel({
  id: "bn-1",
  mode: "bn",
  number: 1,
  title: "Vowels & Consonants",
  description: "স্বরবর্ণ আর ব্যঞ্জনবর্ণ — প্রতিটা অক্ষর কোথায় আর কীভাবে টাইপ হয়।",
  units: [
    {
      title: "Vowels",
      lessons: [
        { title: "অ আ ই ঈ", kind: "keys", newKeys: ["অ", "আ", "ই", "ঈ", " "] },
        { title: "উ ঊ ঋ", kind: "keys", newKeys: ["উ", "ঊ", "ঋ"] },
        { title: "এ ঐ ও ঔ", kind: "keys", newKeys: ["এ", "ঐ", "ও", "ঔ"] },
      ],
    },
    {
      title: "Consonants",
      lessons: [
        { title: "ক খ গ ঘ ঙ", kind: "keys", newKeys: KA },
        { title: "চ ছ জ ঝ ঞ", kind: "keys", newKeys: CA },
        { title: "ট ঠ ড ঢ ণ", kind: "keys", newKeys: TTA },
        { title: "ত থ দ ধ ন", kind: "keys", newKeys: TA },
        { title: "প ফ ব ভ ম", kind: "keys", newKeys: PA },
        { title: "য র ল শ ষ স হ", kind: "keys", newKeys: OTHERS },
        { title: "ড় ঢ় য় ং ঃ ঁ ৎ", kind: "keys", newKeys: [...NUKTA, "ং", "ঃ", "ঁ", "ৎ"] },
        { title: "Letters Review", kind: "review", newKeys: [] },
      ],
    },
    {
      title: "Wrapping Up",
      lessons: [{ title: "Bangla Assessment 1", kind: "assessment", newKeys: [], seconds: 60 }],
    },
  ],
});

export const BN_VOWEL_SIGNS = buildLevel(
  {
    id: "bn-2",
    mode: "bn",
    number: 2,
    title: "Vowel Signs",
    description: "কার-চিহ্ন (া ি ী ু ূ ৃ ে ৈ ো ৌ) — ব্যঞ্জনের সাথে মিলিয়ে শব্দ।",
    units: [
      {
        title: "Kar Signs",
        lessons: [
          { title: "া and ি", kind: "keys", newKeys: ["া", "ি"] },
          { title: "ী ু ূ", kind: "keys", newKeys: ["ী", "ু", "ূ"] },
          { title: "ৃ ে ৈ", kind: "keys", newKeys: ["ৃ", "ে", "ৈ"] },
          { title: "ো and ৌ", kind: "keys", newKeys: ["ো", "ৌ"] },
          { title: "Vowel Signs Review", kind: "review", newKeys: [] },
        ],
      },
      { title: "Wrapping Up", lessons: [{ title: "Bangla Assessment 2", kind: "assessment", newKeys: [], seconds: 60 }] },
    ],
  },
  levelKeys(BN_LETTERS),
);

export const BN_CONJUNCTS = buildLevel(
  {
    id: "bn-3",
    mode: "bn",
    number: 3,
    title: "Conjuncts",
    description: "হসন্ত দিয়ে যুক্তাক্ষর — ক্ষ, ক্ত, ন্ত, স্ত, ত্র, প্র, রেফ ও ফলা।",
    units: [
      {
        title: "Joining Letters",
        lessons: [
          { title: "Hasanta and Phala", kind: "keys", newKeys: [BN_HASANTA] },
          { title: "Common Conjuncts", kind: "accuracy", newKeys: [], focus: [BN_HASANTA] },
          { title: "Conjuncts Review", kind: "review", newKeys: [] },
        ],
      },
      { title: "Wrapping Up", lessons: [{ title: "Bangla Assessment 3", kind: "assessment", newKeys: [], seconds: 60 }] },
    ],
  },
  levelKeys(BN_VOWEL_SIGNS),
);

export const BN_NUMBERS = buildLevel(
  {
    id: "bn-4",
    mode: "bn",
    number: 4,
    title: "Numbers & Punctuation",
    description: "বাংলা সংখ্যা ০–৯, দাঁড়ি, কমা, প্রশ্ন ও বিস্ময়চিহ্ন, টাকার চিহ্ন।",
    units: [
      {
        title: "Numbers",
        lessons: [
          { title: "০ to ৪", kind: "keys", newKeys: BN_DIGITS.slice(0, 5) },
          { title: "৫ to ৯", kind: "keys", newKeys: BN_DIGITS.slice(5) },
        ],
      },
      {
        title: "Punctuation",
        lessons: [
          { title: "। , ? !", kind: "keys", newKeys: ["।", ",", "?", "!"] },
          { title: "- : ; ( ) ৳ %", kind: "keys", newKeys: ["-", ":", ";", "(", ")", "৳", "%"] },
          { title: "Numbers & Punctuation Review", kind: "review", newKeys: [] },
        ],
      },
      { title: "Wrapping Up", lessons: [{ title: "Bangla Assessment 4", kind: "assessment", newKeys: [], seconds: 60 }] },
    ],
  },
  levelKeys(BN_CONJUNCTS),
);

export const BN_FLUENCY = buildLevel(
  {
    id: "bn-5",
    mode: "bn",
    number: 5,
    title: "Words & Sentences",
    description: "বেশি ব্যবহৃত শব্দ, সম্পূর্ণ বাক্য আর টানা টাইপিং।",
    units: [
      {
        title: "Fluency",
        lessons: [
          { title: "Common Words", kind: "words", newKeys: [], pool: 300 },
          { title: "Sentences", kind: "sentences", newKeys: [] },
          { title: "Sentence Sprints", kind: "sprint", newKeys: [] },
          { title: "Two-Minute Run", kind: "endurance", newKeys: [], seconds: 120 },
        ],
      },
      { title: "Wrapping Up", lessons: [{ title: "Bangla Assessment 5", kind: "assessment", newKeys: [], seconds: 180 }] },
    ],
  },
  levelKeys(BN_NUMBERS),
);

export const BN_PROFESSIONAL = buildLevel(
  {
    id: "bn-6",
    mode: "bn",
    number: 6,
    title: "Professional Bangla",
    description: "দরখাস্ত, নোটিশ, অফিসের চিঠি, কাস্টমার রিপ্লাই আর আসল আর্টিকেল।",
    units: [
      {
        title: "Workplace Writing",
        lessons: [
          { title: "Applications", kind: "professional", newKeys: [], topic: "application" },
          { title: "Notices", kind: "professional", newKeys: [], topic: "notice" },
          { title: "Customer Replies", kind: "professional", newKeys: [], topic: "customer" },
          { title: "Office Letters", kind: "professional", newKeys: [], topic: "letter" },
          { title: "Real Articles", kind: "professional", newKeys: [], topic: "articles:*" },
        ],
      },
      { title: "Wrapping Up", lessons: [{ title: "Bangla Assessment 6", kind: "assessment", newKeys: [], seconds: 180, topic: "mixed" }] },
    ],
  },
  levelKeys(BN_FLUENCY),
);

export const BANGLA_LEVELS = [BN_LETTERS, BN_VOWEL_SIGNS, BN_CONJUNCTS, BN_NUMBERS, BN_FLUENCY, BN_PROFESSIONAL];
