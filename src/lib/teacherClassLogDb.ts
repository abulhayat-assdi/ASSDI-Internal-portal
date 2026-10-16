import type { Prisma } from "@prisma/client";
import { rangesOverlap } from "@/lib/teacherClassLog";

/**
 * The same teacher's class on the same day that shares time with the given
 * slot, or null. A teacher cannot be in two classes at once, whichever batch
 * they are for; other teachers' classes never count.
 */
export async function findOverlappingClass(
    tx: Prisma.TransactionClient,
    args: {
        courseId: string;
        teacherUid: string;
        date: string;
        startTime: string;
        endTime: string;
        /** The entry being edited, so it does not clash with itself. */
        excludeId?: string;
    }
) {
    const sameDay = await tx.teacherClassLog.findMany({
        where: {
            courseId: args.courseId,
            teacherUid: args.teacherUid,
            date: args.date,
            ...(args.excludeId ? { id: { not: args.excludeId } } : {}),
        },
        select: { batchName: true, subjectName: true, startTime: true, endTime: true },
    });
    return sameDay.find((c) => rangesOverlap(args.startTime, args.endTime, c.startTime, c.endTime)) ?? null;
}
