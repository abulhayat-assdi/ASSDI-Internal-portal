export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import type { AttendanceStatus } from "@prisma/client";
import { LOW_ATTENDANCE_THRESHOLD, isLowAttendance, tally, type AttendanceTally } from "@/lib/attendance";
import { countStudentsWithoutLogin } from "@/lib/notifications";

/** An exam average below this counts as a warning sign. */
const FAILING_EXAM_PERCENTAGE = 40;

export interface StudentReportRow {
    roll: string;
    name: string;
    batchName: string;
    phone: string;
    attendance: AttendanceTally;
    homeworkCount: number;
    lastHomeworkDate: string | null;
    examAverage: number | null;
    examCount: number;
    /** Empty when nothing is wrong. */
    risks: string[];
}

export interface BatchReportRow {
    batchName: string;
    students: number;
    attendanceAverage: number | null;
    homeworkSubmissions: number;
    examAverage: number | null;
    atRisk: number;
}

function average(values: number[]): number | null {
    if (!values.length) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/**
 * GET /api/reports/overview?batchName=&from=&to=&threshold=
 *
 * One read of the four things the portal already records — attendance,
 * homework, exam results and the roster — rolled up per student and per
 * batch. Exam results and homework are keyed by (batch, roll) rather than by
 * a student id, which is how those tables have always stored them.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(user) && !hasRequiredPermission(user, "reports")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const thresholdRaw = Number(searchParams.get("threshold"));
    const threshold =
        Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw <= 100
            ? thresholdRaw
            : LOW_ATTENDANCE_THRESHOLD;

    const dateStringFilter = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const batchFilter = batchName && batchName !== "ALL" ? { batchName } : {};

        const [students, sessions, homework, exams] = await Promise.all([
            tx.batchStudent.findMany({
                where: { courseId, ...batchFilter, courseStatus: "Running" },
                select: { id: true, roll: true, name: true, batchName: true, phone: true },
            }),
            tx.attendanceSession.findMany({
                where: { courseId, ...batchFilter, ...(dateStringFilter ? { date: dateStringFilter } : {}) },
                select: { id: true },
            }),
            tx.homeworkSubmission.findMany({
                where: {
                    courseId,
                    deletedAt: null,
                    ...(batchName && batchName !== "ALL" ? { studentBatchName: batchName } : {}),
                    ...(dateStringFilter ? { submissionDate: dateStringFilter } : {}),
                },
                select: { studentRoll: true, studentBatchName: true, submissionDate: true },
            }),
            tx.examResult.findMany({
                where: {
                    courseId,
                    ...(batchName && batchName !== "ALL" ? { studentBatchName: batchName } : {}),
                    ...(dateStringFilter ? { examDate: dateStringFilter } : {}),
                },
                select: { studentRoll: true, studentBatchName: true, score: true, totalMarks: true },
            }),
        ]);

        const sessionIds = sessions.map((s) => s.id);
        const records = sessionIds.length
            ? await tx.attendanceRecord.findMany({
                  where: { courseId, sessionId: { in: sessionIds } },
                  select: { studentId: true, status: true },
              })
            : [];

        const attendanceByStudent = new Map<string, AttendanceStatus[]>();
        for (const r of records) {
            const list = attendanceByStudent.get(r.studentId);
            if (list) list.push(r.status);
            else attendanceByStudent.set(r.studentId, [r.status]);
        }

        const key = (batch: string, roll: string) => `${batch}::${roll}`;

        const homeworkByStudent = new Map<string, string[]>();
        for (const h of homework) {
            const k = key(h.studentBatchName, h.studentRoll);
            const list = homeworkByStudent.get(k);
            if (list) list.push(h.submissionDate);
            else homeworkByStudent.set(k, [h.submissionDate]);
        }

        const examsByStudent = new Map<string, number[]>();
        for (const e of exams) {
            if (!e.totalMarks) continue; // guard a bad row rather than dividing by zero
            const k = key(e.studentBatchName, e.studentRoll);
            const pct = (e.score / e.totalMarks) * 100;
            const list = examsByStudent.get(k);
            if (list) list.push(pct);
            else examsByStudent.set(k, [pct]);
        }

        const rows: StudentReportRow[] = students.map((s) => {
            const k = key(s.batchName, s.roll);
            const att = tally(attendanceByStudent.get(s.id) ?? []);
            const hwDates = (homeworkByStudent.get(k) ?? []).sort();
            const examPcts = examsByStudent.get(k) ?? [];
            const examAverage = average(examPcts);

            const risks: string[] = [];
            if (isLowAttendance(att, threshold)) risks.push(`উপস্থিতি ${att.percentage}%`);
            if (hwDates.length === 0) risks.push("কোনো হোমওয়ার্ক জমা হয়নি");
            if (examAverage !== null && examAverage < FAILING_EXAM_PERCENTAGE) {
                risks.push(`পরীক্ষার গড় ${examAverage}%`);
            }

            return {
                roll: s.roll,
                name: s.name,
                batchName: s.batchName,
                phone: s.phone,
                attendance: att,
                homeworkCount: hwDates.length,
                lastHomeworkDate: hwDates.length ? hwDates[hwDates.length - 1] : null,
                examAverage,
                examCount: examPcts.length,
                risks,
            };
        });

        rows.sort(
            (a, b) =>
                a.batchName.localeCompare(b.batchName, undefined, { numeric: true }) ||
                a.roll.localeCompare(b.roll, undefined, { numeric: true })
        );

        const batchNames = [...new Set(rows.map((r) => r.batchName))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );
        const batches: BatchReportRow[] = batchNames.map((name) => {
            const inBatch = rows.filter((r) => r.batchName === name);
            return {
                batchName: name,
                students: inBatch.length,
                attendanceAverage: average(
                    inBatch.map((r) => r.attendance.percentage).filter((p): p is number => p !== null)
                ),
                homeworkSubmissions: inBatch.reduce((sum, r) => sum + r.homeworkCount, 0),
                examAverage: average(
                    inBatch.map((r) => r.examAverage).filter((p): p is number => p !== null)
                ),
                atRisk: inBatch.filter((r) => r.risks.length > 0).length,
            };
        });

        // Students with no login never receive an email notification and
        // cannot see any of this themselves — worth showing next to the rest.
        const withoutLogin = await countStudentsWithoutLogin(courseId);

        return NextResponse.json({
            range: { from: from ?? null, to: to ?? null },
            threshold,
            totals: {
                students: rows.length,
                batches: batches.length,
                sessions: sessions.length,
                attendanceAverage: average(
                    rows.map((r) => r.attendance.percentage).filter((p): p is number => p !== null)
                ),
                homeworkSubmissions: homework.length,
                examAverage: average(
                    rows.map((r) => r.examAverage).filter((p): p is number => p !== null)
                ),
                atRisk: rows.filter((r) => r.risks.length > 0).length,
                withoutLogin,
            },
            batches,
            students: rows,
        });
    });
}
