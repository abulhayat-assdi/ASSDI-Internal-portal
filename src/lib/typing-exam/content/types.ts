// Shared types for the typing-exam passage bank.

export type ExamTextLanguage = "en" | "bn";

export interface ExamPassage {
  /** Stable id, e.g. "en-ai-004". Never reuse an id once a passage exists. */
  id: string;
  language: ExamTextLanguage;
  /** Free-form category label (not an enum) — new categories need no type change. */
  category: string;
  /** Short human label, useful for a future admin category-filter dropdown. */
  title: string;
  /** Precomputed word count (split on whitespace), avoids recomputing on every pick. */
  wordCount: number;
  text: string;
}
