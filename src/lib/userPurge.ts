import "server-only";
import { unlink } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { normalizeStoredPath, resolveStoredFile } from "@/lib/fileAccess";
import { listDeploymentFolders, removeSiteFolder } from "@/lib/deploymentSite";

/**
 * Removing an account's files from disk when the account (or its whole
 * course) is permanently deleted.
 *
 * Homework submissions and leave requests reference the student by id but
 * have no foreign key, so the database never cascaded them, and deployments
 * cascade only their rows — the files of all three stayed on the server
 * forever. The purge functions delete those rows inside the caller's
 * transaction and return what to remove from disk; call
 * {@link removePurgedFiles} only after the transaction commits.
 *
 * Only paths that provably belong to the account are removed: homework under
 * homework/<that user's id>/, leave attachments under student-leaves/ that no
 * other request points at, and deployment folders under student-sites/.
 * Profile photos are not touched — they are shared with the batch roster.
 */

export interface PurgedFiles {
    /** Stored upload paths (relative, as saved in the DB). */
    filePaths: string[];
    /** Absolute deployment folders. */
    siteFolders: string[];
}

function submissionPaths(sub: { files: unknown; storagePath: string | null }): string[] {
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

/** Homework paths are only trusted inside the author's own folder. */
function ownedHomeworkPath(raw: string, ownerId: string): string | null {
    const p = normalizeStoredPath(raw);
    if (!p) return null;
    const m = /^(?:uploads\/)?homework\/([^/]+)\//.exec(p);
    return m && m[1] === ownerId ? p : null;
}

function leavePath(raw: string): string | null {
    const p = normalizeStoredPath(raw);
    return p && /^(?:uploads\/)?student-leaves\//.test(p) ? p : null;
}

async function purgeByStudents(
    tx: Prisma.TransactionClient,
    where: { studentUid?: string; courseId?: string }
): Promise<string[]> {
    const submissions = await tx.homeworkSubmission.findMany({ where, select: { files: true, storagePath: true, studentUid: true } });
    const homework = submissions
        .flatMap((s) => submissionPaths(s).map((p) => ownedHomeworkPath(p, s.studentUid)))
        .filter((p): p is string => !!p);
    await tx.homeworkSubmission.deleteMany({ where });

    const leaves = await tx.studentLeaveRequest.findMany({ where, select: { attachmentUrl: true } });
    const leaveFiles = leaves.map((l) => (l.attachmentUrl ? leavePath(l.attachmentUrl) : null)).filter((p): p is string => !!p);
    await tx.studentLeaveRequest.deleteMany({ where });

    // A leave attachment is only removed if nothing that survives still uses it.
    const stillUsed = leaveFiles.length
        ? await tx.studentLeaveRequest.findMany({
            where: { attachmentUrl: { in: leaves.map((l) => l.attachmentUrl).filter((u): u is string => !!u) } },
            select: { attachmentUrl: true },
        })
        : [];
    const used = new Set(stillUsed.map((l) => (l.attachmentUrl ? leavePath(l.attachmentUrl) : null)));

    return [...homework, ...leaveFiles.filter((p) => !used.has(p))];
}

/** Call inside the transaction, before deleting the user row. */
export async function purgeUserData(tx: Prisma.TransactionClient, userId: string): Promise<PurgedFiles> {
    const siteFolders = await listDeploymentFolders(tx, { userId });
    const filePaths = await purgeByStudents(tx, { studentUid: userId });
    return { filePaths, siteFolders };
}

/** Call inside the transaction, before deleting the course row. */
export async function purgeCourseData(tx: Prisma.TransactionClient, courseId: string): Promise<PurgedFiles> {
    const siteFolders = await listDeploymentFolders(tx, { courseId });
    const filePaths = await purgeByStudents(tx, { courseId });
    return { filePaths, siteFolders };
}

/** Best-effort removal after commit. Returns how many files/folders went. */
export async function removePurgedFiles(purged: PurgedFiles): Promise<number> {
    let removed = 0;
    for (const p of new Set(purged.filePaths)) {
        try {
            const file = await resolveStoredFile(p);
            if (!file) continue;
            await unlink(file.absolutePath);
            removed += 1;
        } catch (error) {
            console.warn(`[UserPurge] could not remove ${p}:`, error);
        }
    }
    for (const folder of new Set(purged.siteFolders)) {
        await removeSiteFolder(folder);
        removed += 1;
    }
    return removed;
}
