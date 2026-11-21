/**
 * English word bank for lesson drills, built once from the typing-exam
 * article bank and sorted by how often each word appears there (so drills
 * favour everyday words). Server side only — the bank is large.
 */
import { ALL_PASSAGES } from "@/lib/typing-exam/content";

let cache: string[] | null = null;

export function englishWordBank(): string[] {
  if (cache) return cache;
  const freq = new Map<string, number>();
  for (const p of ALL_PASSAGES) {
    if (p.language !== "en") continue;
    for (const raw of p.text.toLowerCase().split(/[^a-z]+/)) {
      if (raw.length < 2 || raw.length > 9) continue;
      freq.set(raw, (freq.get(raw) ?? 0) + 1);
    }
  }
  cache = Array.from(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
  return cache;
}
