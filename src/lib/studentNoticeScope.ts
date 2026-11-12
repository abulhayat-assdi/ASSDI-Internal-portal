/**
 * Batch scoping for student notices.
 *
 * A notice targets one batch by name, or every batch with "all" — the same
 * convention homework assignments use.
 */

export const ALL_BATCHES = "all";

/** Normalises a client-sent batch: blank/missing/"ALL" → "all", otherwise trimmed. */
export function normalizeNoticeBatch(value: unknown): string {
    if (typeof value !== "string") return ALL_BATCHES;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === ALL_BATCHES) return ALL_BATCHES;
    return trimmed;
}

/**
 * The `batchName` where-clause for "what students of this batch see":
 * the batch's own notices plus course-wide ones. With no batch (or "all"),
 * only course-wide notices.
 */
export function studentNoticeBatchFilter(batchName: string | null | undefined): string | { in: string[] } {
    const batch = normalizeNoticeBatch(batchName);
    return batch === ALL_BATCHES ? ALL_BATCHES : { in: [batch, ALL_BATCHES] };
}
