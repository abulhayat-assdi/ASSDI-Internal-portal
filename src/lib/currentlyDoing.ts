// "Currently Doing" is stored as the Prisma enum CurrentlyDoing
// (Job | Business | StudyingFurther | Nothing). The UI historically used the
// label "Studying Further" as the option value, which the API returns as
// "StudyingFurther" — so the dropdown lost the value on reload. This module is
// the single place that reconciles the spellings. It is client-safe (no Prisma).

export type CurrentlyDoingValue = "Job" | "Business" | "StudyingFurther";

/**
 * Canonical value for a raw "currently doing" string, or "" when empty or
 * unrecognised. Legacy "Nothing" is displayed as "Studying Further" everywhere,
 * so it folds into StudyingFurther.
 */
export function normalizeCurrentlyDoing(value: unknown): CurrentlyDoingValue | "" {
    if (typeof value !== "string") return "";
    const key = value.toLowerCase().replace(/[\s_-]+/g, "");
    if (key === "job") return "Job";
    if (key === "business") return "Business";
    if (key === "studyingfurther" || key === "furtherstudy" || key === "furtherstudies" || key === "studying" || key === "nothing") {
        return "StudyingFurther";
    }
    return "";
}

export function isStudyingFurther(value: unknown): boolean {
    return normalizeCurrentlyDoing(value) === "StudyingFurther";
}

/** Human label for display; falls back to the raw value, or "" when empty. */
export function currentlyDoingLabel(value: unknown): string {
    const v = normalizeCurrentlyDoing(value);
    if (v === "StudyingFurther") return "Studying Further";
    if (v) return v;
    return typeof value === "string" ? value : "";
}
