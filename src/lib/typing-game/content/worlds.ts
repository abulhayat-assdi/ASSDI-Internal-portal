/**
 * The 16 adventure worlds (M4 seed data). English + Bangla UI metadata;
 * typing content language stays per-challenge (see prompt sets).
 *
 * `tier` groups worlds into a Beginner -> Intermediate -> Advanced
 * curriculum for the Adventure Map's sectioned layout and the sequential
 * world-unlock gate in server/games.ts (a world only opens once the
 * previous world, by `order`, is fully complete). Purely a TS-side
 * grouping/labeling concern — no DB schema change needed, since
 * server/games.ts already imports WORLDS directly rather than querying it.
 */
export type WorldTier = "beginner" | "intermediate" | "advanced";

export interface World {
  slug: string;
  order: number;
  tier: WorldTier;
  name: { en: string; bn: string };
  description: { en: string; bn: string };
}

export const WORLDS: World[] = [
  { slug: "keyboard-village", order: 1, tier: "beginner", name: { en: "Keyboard Village", bn: "কিবোর্ড গ্রাম" }, description: { en: "Meet every key on the board.", bn: "বোর্ডের প্রতিটি কী-এর সাথে পরিচিত হোন।" } },
  { slug: "finger-forest", order: 2, tier: "beginner", name: { en: "Finger Forest", bn: "আঙুলের বন" }, description: { en: "Map fingers to their keys.", bn: "কোন আঙুলে কোন কী তা শিখুন।" } },
  { slug: "letter-valley", order: 3, tier: "beginner", name: { en: "Letter Valley", bn: "অক্ষর উপত্যকা" }, description: { en: "Chase letters through the valley.", bn: "উপত্যকা জুড়ে অক্ষর ধরুন।" } },
  { slug: "word-city", order: 4, tier: "beginner", name: { en: "Word City", bn: "শব্দের শহর" }, description: { en: "Build the city one word at a time.", bn: "একটি একটি শব্দে শহর গড়ুন।" } },
  { slug: "sentence-kingdom", order: 5, tier: "beginner", name: { en: "Sentence Kingdom", bn: "বাক্য রাজ্য" }, description: { en: "Serve the kingdom with sentences.", bn: "বাক্য দিয়ে রাজ্যের সেবা করুন।" } },
  { slug: "speed-arena", order: 6, tier: "intermediate", name: { en: "Speed Arena", bn: "গতির ময়দান" }, description: { en: "Prove your pace against the clock.", bn: "ঘড়ির সাথে গতির প্রমাণ দিন।" } },
  { slug: "sky-frontier", order: 7, tier: "intermediate", name: { en: "Sky Frontier", bn: "আকাশ সীমান্ত" }, description: { en: "Fly high on word streams.", bn: "শব্দস্রোতে ভেসে উঁচুতে উড়ুন।" } },
  { slug: "jungle-escape", order: 8, tier: "intermediate", name: { en: "Jungle Escape", bn: "জঙ্গল থেকে পলায়ন" }, description: { en: "Type your way out of the wild.", bn: "টাইপ করে বন থেকে বেরিয়ে আসুন।" } },
  { slug: "desert-rally", order: 9, tier: "intermediate", name: { en: "Desert Rally", bn: "মরুভূমি র‍্যালি" }, description: { en: "Race the dunes gate by gate.", bn: "গেট পার হয়ে মরুভূমিতে দৌড়ান।" } },
  { slug: "ocean-depths", order: 10, tier: "intermediate", name: { en: "Ocean Depths", bn: "সমুদ্রের গভীর" }, description: { en: "Dive deep before oxygen runs out.", bn: "অক্সিজেন শেষ হওয়ার আগেই ডুব দিন।" } },
  { slug: "arctic-pass", order: 11, tier: "intermediate", name: { en: "Arctic Pass", bn: "তুষার গিরিপথ" }, description: { en: "Stay accurate in the cold rush.", bn: "ঠান্ডা ঝড়ে নির্ভুল থাকুন।" } },
  { slug: "space-station", order: 12, tier: "advanced", name: { en: "Space Station", bn: "মহাকাশ স্টেশন" }, description: { en: "Restore systems with commands.", bn: "কমান্ড দিয়ে সিস্টেম চালু করুন।" } },
  { slug: "cyber-city", order: 13, tier: "advanced", name: { en: "Cyber City", bn: "সাইবার শহর" }, description: { en: "Hack the neon grid precisely.", bn: "নিয়ন গ্রিড নির্ভুলভাবে হ্যাক করুন।" } },
  { slug: "volcano-zone", order: 14, tier: "advanced", name: { en: "Volcano Zone", bn: "আগ্নেয়গিরি অঞ্চল" }, description: { en: "Outrun the rising lava waves.", bn: "উঠন্ত লাভা থেকে পালান।" } },
  { slug: "castle-siege", order: 15, tier: "advanced", name: { en: "Castle Siege", bn: "দুর্গ অবরোধ" }, description: { en: "Defend the walls word by word.", bn: "শব্দে শব্দে প্রাচীর রক্ষা করুন।" } },
  { slug: "grand-arena", order: 16, tier: "advanced", name: { en: "Grand Arena", bn: "মহা ময়দান" }, description: { en: "Champions prove everything here.", bn: "চ্যাম্পিয়নরা এখানে সব প্রমাণ করে।" } },
];
