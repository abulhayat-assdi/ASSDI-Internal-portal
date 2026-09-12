/**
 * No-op kept for callers: competitions/competition_submissions/
 * competition_form_templates/competition_groups are now managed exclusively
 * by Prisma migrations (which also own the course_id column and its RLS
 * policies) — the raw CREATE TABLE fallback this used to run predates that
 * and no longer matches the real schema, so it's gone rather than kept as
 * a wrong "IF NOT EXISTS" no-op.
 */
export async function ensureCompetitionsTablesExist() {}
