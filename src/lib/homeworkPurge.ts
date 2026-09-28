import { unlink } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { normalizeStoredPath, resolveStoredFile } from "@/lib/fileAccess";

export interface HomeworkPurgeResult {
    submissions: number;
    assignments: number;
    /** Stored paths of the files to remove once the transaction has committed. */
    filePaths: string[];
}

/** Every stored file path a submission points at (multi-file `files` plus the legacy single file). */
function pathsOf(sub: { files: unknown; storagePath: string | null }): string[] {
    const out: string[] = [];
    if (sub.storagePath) out.push(sub.storagePath);
    if (Array.isArray(sub.files)) {
        for (const f of sub.files) {
            const p = (f as { storagePath?: unknown } | null)?.storagePath;
            if (typeof p === "string" && p) out.push(p);
        }
    }
    return out;
}

/**
 * Permanently removes a batch's homework: every submission its students made
 * (soft-deleted ones included) and every assignment folder made for that
 * batch. Folders shared across all batches ("all") are left alone. Students'
 * personal records are untouched.
 *
 * Rows go inside the caller's transaction; the files must be removed with
 * {@link deleteHomeworkFiles} after it commits, so a rolled-back transaction
 * never leaves rows pointing at deleted files.
 */
export async function purgeBatchHomework(
    tx: Prisma.TransactionClient,
    courseId: string,
    batchName: string
): Promise<HomeworkPurgeResult> {
    const submissions = await tx.homeworkSubmission.findMany({
        where: { courseId, studentBatchName: batchName },
        select: { files: true, storagePath: true },
    });
    const filePaths = submissions.flatMap(pathsOf);

    const deletedSubmissions = await tx.homeworkSubmission.deleteMany({
        where: { courseId, studentBatchName: batchName },
    });
    // Shares cascade with their assignment.
    const deletedAssignments = await tx.homeworkAssignment.deleteMany({
        where: { courseId, batchName },
    });

    return {
        submissions: deletedSubmissions.count,
        assignments: deletedAssignments.count,
        filePaths,
    };
}

/** Best-effort removal of uploaded homework files. Only touches uploads/homework/. */
export async function deleteHomeworkFiles(paths: string[]): Promise<number> {
    let removed = 0;
    for (const raw of new Set(paths)) {
        const normalized = normalizeStoredPath(raw);
        if (!normalized || !normalized.startsWith("homework/")) continue;
        try {
            const file = await resolveStoredFile(normalized);
            if (!file) continue;
            await unlink(file.absolutePath);
            removed += 1;
        } catch (error) {
            console.warn(`[HomeworkPurge] could not remove ${normalized}:`, error);
        }
    }
    return removed;
}
