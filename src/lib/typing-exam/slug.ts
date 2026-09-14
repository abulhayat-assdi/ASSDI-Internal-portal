import { randomUUID } from "crypto";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Public exam link slug — globally unique across all courses. */
export function makePublicExamSlug(title: string): string {
  const base = slugify(title).slice(0, 40) || "exam";
  const rand = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base}-${rand}`;
}
