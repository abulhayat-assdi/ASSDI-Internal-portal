/**
 * Builds a run's words and sentences from the site's English article bank.
 * Deterministic for a seed: the start route sends this to the browser and
 * the finish route rebuilds the identical content to replay the run.
 * Server side only (the article bank is large).
 */
import { englishArticles, englishWordBank } from "@/lib/typing-game/curriculum/word-bank";
import { mulberry32, type ArcadeContent } from "./core";

const WORDS_PER_TIER = 160;
const SENTENCES_PER_TIER = 40;
const PRINTABLE = /^[\x20-\x7E]+$/;
const PUNCT = [",", ".", ";", ":", "!", "?"];

let pools: { words: string[][]; sentences: string[][] } | null = null;

function buildPools() {
  if (pools) return pools;
  const bank = englishWordBank();
  const t0 = bank.filter((w) => w.length >= 3 && w.length <= 4).slice(0, 700);
  const t1 = bank.filter((w) => w.length >= 5 && w.length <= 6).slice(0, 900);
  const t2 = bank.filter((w) => w.length >= 7 && w.length <= 9).slice(0, 1100);

  const s0: string[] = [];
  const s1: string[] = [];
  const s2: string[] = [];
  const seen = new Set<string>();
  for (const texts of Object.values(englishArticles())) {
    for (const text of texts) {
      for (const raw of text.match(/[^.!?]+[.!?]/g) ?? []) {
        const s = raw.replace(/\s+/g, " ").trim();
        if (!PRINTABLE.test(s) || seen.has(s) || /^[^A-Za-z]/.test(s)) continue;
        seen.add(s);
        const simple = s.toLowerCase().replace(/[^a-z ,.]/g, "").replace(/\s+/g, " ").trim();
        if (simple.length >= 18 && simple.length <= 44 && /[a-z]$|\.$/.test(simple)) s0.push(simple);
        if (s.length >= 35 && s.length <= 72) s1.push(s);
        if (s.length >= 60 && s.length <= 115) s2.push(s);
      }
    }
  }
  pools = { words: [t0, t1, t2], sentences: [s0, s1, s2] };
  return pools;
}

function sample<T>(list: T[], n: number, rnd: () => number): T[] {
  const a = list.slice();
  const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) {
    const j = Math.floor(rnd() * a.length);
    out.push(a[j]);
    a[j] = a[a.length - 1];
    a.pop();
  }
  return out;
}

export function buildArcadeContent(seed: number): ArcadeContent {
  const p = buildPools();
  // A different stream from the game's own RNG.
  const rnd = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const w0 = sample(p.words[0], WORDS_PER_TIER, rnd);
  const w1 = sample(p.words[1], WORDS_PER_TIER, rnd);
  const w2 = sample(p.words[2], WORDS_PER_TIER, rnd);
  // Tier 3: real words with capitals, punctuation or numbers mixed in.
  const w3 = sample([...p.words[1], ...p.words[2]], WORDS_PER_TIER, rnd).map((w) => {
    const r = rnd();
    if (r < 0.4) return w[0].toUpperCase() + w.slice(1);
    if (r < 0.75) return w + PUNCT[Math.floor(rnd() * PUNCT.length)];
    if (r < 0.9) return `${w}${Math.floor(rnd() * 90) + 10}`;
    return w.toUpperCase().slice(0, 5);
  });
  return {
    words: [w0, w1, w2, w3],
    sentences: p.sentences.map((s) => sample(s, SENTENCES_PER_TIER, rnd)),
  };
}
