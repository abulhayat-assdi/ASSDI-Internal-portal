// Bundled passage bank for the Typing Test Exam feature. Independent from
// src/lib/typing-game/content — this assessment tool owns its own text.
//
// Public import path is unchanged (`@/lib/typing-exam/content`) even though
// this used to be a single file — this directory's index re-exports
// everything so no API route call site needs to change.

import type { ExamPassage, ExamTextLanguage } from "./types";
import { generalPassages } from "./general";
import { bangladeshPassages } from "./bangladesh";
import { aiPassages } from "./ai";
import { technologyPassages } from "./technology";
import { techIndustryPassages } from "./tech-industry";
import { marketingPassages } from "./marketing";
import { salesMarketingPassages } from "./sales-marketing";
import { marketingIndustryPassages } from "./marketing-industry";
import { aiInMarketingPassages } from "./ai-in-marketing";
import { metaMarketingPassages } from "./meta-marketing";
import { marketingImportancePassages } from "./marketing-importance";
import { aiAutomationPassages } from "./ai-automation";
import { skillDevelopmentPassages } from "./skill-development";
import { businessInsightPassages } from "./business-insight";
import { marketingKnowledgePassages } from "./marketing-knowledge";
import { digitalTransformationPassages } from "./digital-transformation";
import { ecommercePassages } from "./ecommerce";
import { entrepreneurshipPassages } from "./entrepreneurship";
import { leadershipPassages } from "./leadership";
import { productivityPassages } from "./productivity";
import { educationInstitutesPassages } from "./education-institutes";

export type { ExamPassage, ExamTextLanguage };

export const ALL_PASSAGES: ExamPassage[] = [
  ...generalPassages,
  ...bangladeshPassages,
  ...aiPassages,
  ...technologyPassages,
  ...techIndustryPassages,
  ...marketingPassages,
  ...salesMarketingPassages,
  ...marketingIndustryPassages,
  ...aiInMarketingPassages,
  ...metaMarketingPassages,
  ...marketingImportancePassages,
  ...aiAutomationPassages,
  ...skillDevelopmentPassages,
  ...businessInsightPassages,
  ...marketingKnowledgePassages,
  ...digitalTransformationPassages,
  ...ecommercePassages,
  ...entrepreneurshipPassages,
  ...leadershipPassages,
  ...productivityPassages,
  ...educationInstitutesPassages,
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Resolve one fixed passage for a BANK-sourced exam. Picked once at
 * creation/edit time. `category` is optional and unused by the UI today —
 * shaped in now so a future admin category filter needs no route change.
 */
export function pickBankPassage(language: ExamTextLanguage, category?: string): string {
  let pool = ALL_PASSAGES.filter((p) => p.language === language);
  if (category) {
    const scoped = pool.filter((p) => p.category === category);
    if (scoped.length > 0) pool = scoped;
  }
  if (pool.length === 0) pool = ALL_PASSAGES.filter((p) => p.language === "en");
  return pickRandom(pool).text;
}

export const EXAM_TEXT_LANGUAGES: { value: ExamTextLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "bn", label: "বাংলা" },
];

export const EXAM_TEXT_CATEGORIES: string[] = Array.from(new Set(ALL_PASSAGES.map((p) => p.category))).sort();
