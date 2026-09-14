// Original seed passages (pre-expansion). Kept as a small always-available
// fallback category alongside the larger topical categories.
import type { ExamPassage } from "./types";

function wc(text: string): number {
  return text.trim().split(/\s+/).length;
}

const ENGLISH_TEXTS: string[] = [
  "The quick brown fox jumps over the lazy dog while the morning sun rises slowly over the quiet hills. Learning to type quickly and accurately takes regular practice and a calm, focused mind.",
  "Technology has changed the way people learn, work, and communicate with each other. Students who practice typing every day usually notice a steady improvement in both their speed and accuracy over time.",
  "A good typist keeps their eyes on the screen instead of the keyboard, trusting their fingers to find the right keys. This habit, built through patient practice, saves a great deal of time in the long run.",
  "Reading widely and typing regularly are two habits that strengthen each other. The more a person reads, the more familiar words become, and familiar words are always easier and faster to type correctly.",
  "Success in any skill comes from consistent effort rather than occasional bursts of energy. Typing is no different: a few focused minutes of daily practice will outperform one long session every few weeks.",
  "Clear communication starts with clear writing, and clear writing depends on being able to get your thoughts onto the screen without your hands slowing you down. That is exactly what typing practice builds.",
];

const BANGLA_TEXTS: string[] = [
  "সকালের সূর্য ধীরে ধীরে পাহাড়ের ওপর দিয়ে উঠে আসে এবং চারদিক আলোয় ভরে যায়। নিয়মিত অনুশীলনের মাধ্যমে দ্রুত ও নির্ভুলভাবে টাইপ করা শেখা সম্ভব।",
  "প্রযুক্তি মানুষের শেখার, কাজ করার এবং যোগাযোগ করার পদ্ধতি সম্পূর্ণভাবে বদলে দিয়েছে। যারা প্রতিদিন টাইপিং অনুশীলন করে তাদের গতি ও নির্ভুলতা উভয়ই ধীরে ধীরে বৃদ্ধি পায়।",
  "একজন দক্ষ টাইপিস্ট কীবোর্ডের দিকে না তাকিয়ে স্ক্রিনের দিকে তাকিয়ে থাকেন এবং তার আঙুলের ওপর আস্থা রাখেন। এই অভ্যাস দীর্ঘমেয়াদে অনেক সময় বাঁচিয়ে দেয়।",
  "নিয়মিত পড়াশোনা এবং নিয়মিত টাইপিং অনুশীলন একে অপরকে শক্তিশালী করে। যত বেশি পড়া হয়, তত বেশি শব্দ পরিচিত হয়ে ওঠে, আর পরিচিত শব্দ সবসময় দ্রুত টাইপ করা যায়।",
  "যেকোনো দক্ষতায় সাফল্য আসে ধারাবাহিক পরিশ্রম থেকে, হঠাৎ করে করা কাজ থেকে নয়। প্রতিদিন অল্প সময় অনুশীলন করলে তা মাসে একবার দীর্ঘ অনুশীলনের চেয়ে অনেক বেশি কার্যকর হয়।",
  "স্পষ্ট যোগাযোগ শুরু হয় স্পষ্ট লেখার মাধ্যমে, আর স্পষ্ট লেখা নির্ভর করে দ্রুত ও সঠিকভাবে টাইপ করার সক্ষমতার ওপর। নিয়মিত অনুশীলনই এই দক্ষতা গড়ে তোলে।",
];

export const generalPassages: ExamPassage[] = [
  ...ENGLISH_TEXTS.map((text, i) => ({
    id: `en-general-${String(i + 1).padStart(3, "0")}`,
    language: "en" as const,
    category: "General",
    title: `General Practice ${i + 1}`,
    wordCount: wc(text),
    text,
  })),
  ...BANGLA_TEXTS.map((text, i) => ({
    id: `bn-general-${String(i + 1).padStart(3, "0")}`,
    language: "bn" as const,
    category: "General",
    title: `সাধারণ অনুশীলন ${i + 1}`,
    wordCount: wc(text),
    text,
  })),
];
