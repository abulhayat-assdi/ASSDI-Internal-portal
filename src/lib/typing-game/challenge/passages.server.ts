/**
 * Passages for batch challenges: 2–4 whole sentences from the English
 * article bank, 140–240 characters, plain printable ASCII. Server only.
 */
import { englishArticles } from "@/lib/typing-game/curriculum/word-bank";

const PRINTABLE = /^[\x20-\x7E]+$/;
let pool: string[] | null = null;

function build(): string[] {
  if (pool) return pool;
  const out: string[] = [];
  for (const texts of Object.values(englishArticles())) {
    for (const text of texts) {
      const sentences = (text.match(/[^.!?]+[.!?]/g) ?? []).map((s) => s.replace(/\s+/g, " ").trim());
      let cur = "";
      for (const s of sentences) {
        if (!PRINTABLE.test(s) || /^[^A-Za-z]/.test(s)) {
          cur = "";
          continue;
        }
        cur = cur ? `${cur} ${s}` : s;
        if (cur.length >= 140) {
          if (cur.length <= 240) out.push(cur);
          cur = "";
        }
      }
    }
  }
  pool = out.length ? out : ["Practice makes progress. Keep your eyes on the screen, your fingers on the home row, and type each word with care before you try to go faster."];
  return pool;
}

export function pickChallengePassage(): string {
  const list = build();
  return list[Math.floor(Math.random() * list.length)];
}
