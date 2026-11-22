/**
 * The arcade games as students see them. Prices here are for display; the
 * database (arcade_games) holds the price that is actually charged.
 */
export type ArcadeSlug =
  | "meteor-shield"
  | "bubble-burst"
  | "runner-rush"
  | "turbo-racer"
  | "combo-blitz"
  | "bomb-squad"
  | "lava-climb"
  | "dragon-keep";

export interface ArcadeGameInfo {
  slug: ArcadeSlug;
  title: string;
  tagline: string;
  /** Short how-to lines (Bangla). */
  howTo: string[];
  skill: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  price: number;
  /** Two colours for the card art gradient. */
  colors: [string, string];
  /** How the score is described on the card. */
  scoreLabel: string;
}

export const ARCADE_GAMES: ArcadeGameInfo[] = [
  {
    slug: "meteor-shield",
    title: "Meteor Shield",
    tagline: "শহরের দিকে উল্কা নামছে — শব্দ টাইপ করে উড়িয়ে দাও!",
    howTo: [
      "প্রতিটা উল্কায় একটা শব্দ আছে — পুরো শব্দ টাইপ করলে উল্কা ধ্বংস।",
      "প্রথম অক্ষর চাপলেই সবচেয়ে নিচের মিলে-যাওয়া উল্কা টার্গেট হয়।",
      "মাটিতে পড়লে একটা শিল্ড যায় — ৩টা শিল্ড গেলে খেলা শেষ।",
      "প্রতিটা ওয়েভে উল্কা আরও বেশি, আরও দ্রুত।",
    ],
    skill: "গতি + ফোকাস",
    difficulty: 2,
    price: 0,
    colors: ["#1e1b4b", "#7c3aed"],
    scoreLabel: "Wave",
  },
  {
    slug: "bubble-burst",
    title: "Bubble Burst",
    tagline: "বাবল উপরে উঠছে — ফাটাও, একটাও যেন না পালায়!",
    howTo: [
      "বাবলের অক্ষর/শব্দ টাইপ করলে বাবল ফাটে।",
      "দ্রুত পরপর ফাটালে Chain বোনাস। সোনালি বাবল = ৩ গুণ পয়েন্ট।",
      "লাল বোমা-বাবল ফাটালে স্ক্রিনের সব বাবল একসাথে ফাটে।",
      "৫টা বাবল উপরে পালালে খেলা শেষ।",
    ],
    skill: "অক্ষর চেনা + রিফ্লেক্স",
    difficulty: 2,
    price: 100,
    colors: ["#0e7490", "#22d3ee"],
    scoreLabel: "Level",
  },
  {
    slug: "runner-rush",
    title: "Runner Rush",
    tagline: "থামা নেই! বাধার শব্দ টাইপ করে লাফ দাও।",
    howTo: [
      "প্রতিটা বাধার উপর একটা শব্দ — রানার পৌঁছানোর আগেই টাইপ করো।",
      "শব্দ শেষ হলে রানার লাফিয়ে পার হয়ে যায়।",
      "গতি সারাক্ষণ বাড়তে থাকে। ৩ বার ধাক্কা খেলে খেলা শেষ।",
    ],
    skill: "ধারাবাহিক গতি",
    difficulty: 3,
    price: 120,
    colors: ["#9a3412", "#fb923c"],
    scoreLabel: "Speed",
  },
  {
    slug: "turbo-racer",
    title: "Turbo Racer",
    tagline: "৩টা বট গাড়ির সাথে রেস — যত দ্রুত টাইপ, তত দ্রুত গাড়ি।",
    howTo: [
      "লেখাটা হুবহু টাইপ করো (বড় হাতের অক্ষর, যতিচিহ্নসহ) — তোমার গাড়ি এগোবে।",
      "ভুল কী চাপলে গাড়ি স্কিড করে এক মুহূর্ত থেমে যায়।",
      "প্রথম ৩-এ শেষ করলে পরের, আরও দ্রুত রেস। শেষ হলে খেলা শেষ।",
      "৮টা রেস জিতলে চ্যাম্পিয়ন!",
    ],
    skill: "বাক্য টাইপিং + নির্ভুলতা",
    difficulty: 3,
    price: 150,
    colors: ["#991b1b", "#f43f5e"],
    scoreLabel: "Race",
  },
  {
    slug: "combo-blitz",
    title: "Combo Blitz",
    tagline: "৬০ সেকেন্ড, ভুল নয় — কম্বো বাড়াও x8 পর্যন্ত!",
    howTo: [
      "প্রতিটা সঠিক কী = বর্তমান গুণক (x1 থেকে x8) পয়েন্ট।",
      "টানা ১০টা সঠিক কী-তে গুণক বাড়ে; একটা ভুলেই আবার x1।",
      "টানা ৫০টা সঠিক কী = +২ সেকেন্ড বোনাস সময়।",
    ],
    skill: "নির্ভুলতা + গতি",
    difficulty: 3,
    price: 150,
    colors: ["#a21caf", "#f472b6"],
    scoreLabel: "Best x",
  },
  {
    slug: "bomb-squad",
    title: "Bomb Squad",
    tagline: "সময় ফুরানোর আগে কোড টাইপ করে বোমা নিষ্ক্রিয় করো।",
    howTo: [
      "বোমার কোডটা হুবহু টাইপ করো — সংখ্যা, বড় হাতের অক্ষর, চিহ্নসহ।",
      "প্রতিটা ভুল কী ফিউজ আরও দ্রুত পুড়িয়ে দেয়।",
      "কোড লম্বা ও কঠিন হতে থাকে। ৩টা বোমা ফাটলে খেলা শেষ।",
    ],
    skill: "সংখ্যা ও চিহ্ন",
    difficulty: 4,
    price: 200,
    colors: ["#3f3f46", "#ef4444"],
    scoreLabel: "Level",
  },
  {
    slug: "lava-climb",
    title: "Lava Climb",
    tagline: "লাভা উঠছে! শব্দ দিয়ে টাওয়ার বানিয়ে উপরে ওঠো।",
    howTo: [
      "প্রতিটা শব্দ শেষ করলে টাওয়ারে একটা ব্লক যোগ হয়।",
      "ভুল কী চাপলে বানানো ব্লক ভেঙে যায় — শব্দটা আবার শুরু।",
      "যত উপরে, লাভা তত দ্রুত। লাভা ছুঁলেই খেলা শেষ।",
    ],
    skill: "নির্ভুলতা চাপের মধ্যে",
    difficulty: 4,
    price: 250,
    colors: ["#7c2d12", "#facc15"],
    scoreLabel: "Level",
  },
  {
    slug: "dragon-keep",
    title: "Dragon Keep",
    tagline: "ড্রাগনের মন্ত্র আটকাও, পাল্টা আঘাত করো — ৩ ধাপের বস ফাইট।",
    howTo: [
      "ড্রাগন মন্ত্র (বাক্য) ছোড়ে — কাস্ট-বার ভরার আগেই টাইপ করো।",
      "আটকালে ড্রাগনের HP কমে; যত দ্রুত, তত বেশি আঘাত।",
      "ভুল কী কাস্ট দ্রুত করে। ৩ ধাপে মন্ত্র লম্বা ও দ্রুত হয়।",
      "৩টা হার্ট — ড্রাগনের ১০০০ HP শেষ করলে জয়!",
    ],
    skill: "লম্বা বাক্য, চাপের মধ্যে",
    difficulty: 5,
    price: 300,
    colors: ["#14532d", "#84cc16"],
    scoreLabel: "Phase",
  },
];

export function findArcadeGame(slug: string): ArcadeGameInfo | undefined {
  return ARCADE_GAMES.find((g) => g.slug === slug);
}

export const ARCADE_FIRST: ArcadeSlug = "meteor-shield";
