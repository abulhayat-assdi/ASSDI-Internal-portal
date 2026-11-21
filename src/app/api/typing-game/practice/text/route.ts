/**
 * GET /api/typing-game/practice/text — one run's practice text.
 *
 * Query: lang=en|bn, difficulty=beginner|intermediate|pro|expert,
 *        words=<n> (target length), category?, article? (article id),
 *        seed? and optional custom toggles case/punct/numbers.
 * Read-only: reshapes articles from the bundled bank, stores nothing.
 */
import { getSession, unauthorized } from "@/lib/typing-game/server/auth";
import { buildPracticeText } from "@/lib/typing-game/practice/text";
import {
  isDifficulty,
  isLanguage,
  type CaseMode,
  type PunctuationMode,
  type TransformOptions,
} from "@/lib/typing-game/practice/transform";

const CASES: CaseMode[] = ["lower", "sentence", "title", "mixed", "original"];
const PUNCTS: PunctuationMode[] = ["none", "basic", "standard", "full"];

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return unauthorized();

  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") ?? "en";
  const difficulty = q.get("difficulty") ?? "beginner";
  if (!isLanguage(lang) || !isDifficulty(difficulty)) {
    return Response.json({ error: "BAD_REQUEST", message: "Unknown language or difficulty" }, { status: 400 });
  }

  const overrides: Partial<TransformOptions> = {};
  const c = q.get("case");
  if (c && (CASES as string[]).includes(c)) overrides.case = c as CaseMode;
  const p = q.get("punct");
  if (p && (PUNCTS as string[]).includes(p)) overrides.punctuation = p as PunctuationMode;
  const n = q.get("numbers");
  if (n === "1" || n === "0") overrides.numbers = n === "1";

  const seedRaw = Number(q.get("seed"));
  const seed = Number.isInteger(seedRaw) && seedRaw > 0 ? seedRaw : Math.floor(Math.random() * 1e9) + 1;

  const result = buildPracticeText({
    language: lang,
    difficulty,
    overrides,
    category: q.get("category"),
    articleId: q.get("article"),
    words: Number(q.get("words") ?? 100),
    seed,
  });
  return Response.json({ ...result, seed });
}
