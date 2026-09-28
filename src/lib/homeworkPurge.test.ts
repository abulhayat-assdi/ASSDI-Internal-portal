import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, access } from "fs/promises";
import os from "os";
import path from "path";
import type { Prisma } from "@prisma/client";
import { purgeBatchHomework, deleteHomeworkFiles } from "./homeworkPurge";

describe("purgeBatchHomework", () => {
    it("deletes the batch's submissions and folders and reports every stored file", async () => {
        const tx = {
            homeworkSubmission: {
                findMany: vi.fn().mockResolvedValue([
                    { storagePath: "uploads/homework/u1/a.pdf", files: null },
                    {
                        storagePath: null,
                        files: [{ storagePath: "uploads/homework/u2/b.pdf" }, { storagePath: "uploads/homework/u2/c.png" }, {}],
                    },
                    { storagePath: null, files: null },
                ]),
                deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
            },
            homeworkAssignment: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        };

        const result = await purgeBatchHomework(tx as unknown as Prisma.TransactionClient, "course1", "Batch_12");

        expect(result).toEqual({
            submissions: 3,
            assignments: 2,
            filePaths: ["uploads/homework/u1/a.pdf", "uploads/homework/u2/b.pdf", "uploads/homework/u2/c.png"],
        });
        // Scoped to this course and batch only — folders for "all" batches are untouched.
        expect(tx.homeworkSubmission.deleteMany).toHaveBeenCalledWith({
            where: { courseId: "course1", studentBatchName: "Batch_12" },
        });
        expect(tx.homeworkAssignment.deleteMany).toHaveBeenCalledWith({
            where: { courseId: "course1", batchName: "Batch_12" },
        });
    });
});

describe("deleteHomeworkFiles", () => {
    let dir: string;
    const original = process.env.LOCAL_STORAGE_PATH;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), "hw-purge-"));
        process.env.LOCAL_STORAGE_PATH = dir;
    });
    afterEach(async () => {
        if (original === undefined) delete process.env.LOCAL_STORAGE_PATH;
        else process.env.LOCAL_STORAGE_PATH = original;
        await rm(dir, { recursive: true, force: true });
    });

    const exists = (p: string) => access(path.join(dir, p)).then(() => true, () => false);

    it("removes homework files and never touches anything else", async () => {
        await mkdir(path.join(dir, "uploads/homework/u1"), { recursive: true });
        await mkdir(path.join(dir, "uploads/resources"), { recursive: true });
        await writeFile(path.join(dir, "uploads/homework/u1/a.pdf"), "x");
        await writeFile(path.join(dir, "uploads/resources/keep.pdf"), "x");

        const removed = await deleteHomeworkFiles([
            "uploads/homework/u1/a.pdf",
            "uploads/homework/u1/a.pdf", // duplicate reference
            "uploads/homework/u1/missing.pdf", // already gone
            "uploads/resources/keep.pdf", // not homework
            "../../etc/passwd", // traversal
        ]);

        expect(removed).toBe(1);
        expect(await exists("uploads/homework/u1/a.pdf")).toBe(false);
        expect(await exists("uploads/resources/keep.pdf")).toBe(true);
    });
});
