import { withCourseContext } from '../db';
import { paragraphs, renderEmail } from '../mailer';
import { ATTENDANCE_LABELS } from '../attendance';
import type { AttendanceStatus } from '@prisma/client';
import { detailsTable, leavePeriod, loadAlertContext, portalUrl } from './common';
import { cleanAddresses, sendAlertOnce } from './send';

/**
 * Alerts fired by something a student just did (as opposed to the daily
 * sweep in ./daily.ts). Fire-and-forget: the request has been saved already.
 */

function background(label: string, run: () => Promise<unknown>): void {
    void run().catch((e) => console.error(`[email-alerts] ${label} failed:`, e instanceof Error ? e.message : e));
}

async function studentAddress(courseId: string, batchName: string, roll: string, uid?: string): Promise<string[]> {
    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [user, roster] = await Promise.all([
            tx.user.findFirst({
                where: uid
                    ? { id: uid, courseId }
                    : { courseId, role: 'student', deletedAt: null, studentBatchName: batchName, studentRoll: roll },
                select: { email: true },
            }),
            tx.batchStudent.findUnique({
                where: { courseId_batchName_roll: { courseId, batchName, roll } },
                select: { email: true },
            }),
        ]);
        // One address is enough for a receipt; prefer the login.
        return cleanAddresses([user?.email, roster?.email]).slice(0, 1);
    });
}

export function notifyNewLeaveRequest(leave: {
    id: string;
    courseId: string;
    studentUid: string;
    studentName: string;
    studentRoll: string;
    studentBatchName: string;
    studentPhone?: string | null;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    reason: string;
    attachmentUrl?: string | null;
}): void {
    background(`leave_new ${leave.id}`, async () => {
        const ctx = await loadAlertContext(leave.courseId);
        if (!ctx) return;
        const { course, settings } = ctx;
        const period = leavePeriod(leave);

        if (settings.leaveNewToStaff && settings.staffRecipients.length) {
            const subject = `নতুন ছুটির আবেদন — ${leave.studentName} (${leave.studentBatchName}, রোল ${leave.studentRoll})`;
            await sendAlertOnce({
                courseId: course.id,
                courseName: course.name,
                kind: 'leave_new',
                dedupeKey: `leave_new:${leave.id}`,
                to: settings.staffRecipients,
                subject,
                html: renderEmail({
                    courseName: course.name,
                    heading: 'নতুন ছুটির আবেদন',
                    bodyHtml:
                        detailsTable([
                            ['নাম', leave.studentName],
                            ['ব্যাচ', leave.studentBatchName],
                            ['রোল', leave.studentRoll],
                            ['ফোন', leave.studentPhone],
                            ['সময়', period],
                            ['কারণ', leave.reason],
                            ['সংযুক্তি', leave.attachmentUrl ? 'আছে (পোর্টালে দেখুন)' : null],
                        ]) + paragraphs('পোর্টালে গিয়ে আবেদনটি মঞ্জুর বা বাতিল করুন।'),
                    ctaLabel: 'আবেদন দেখুন',
                    ctaUrl: portalUrl(course.slug, '/dashboard/student-leaves'),
                    footerNote: 'Email Alerts সেটিংসে আপনার ঠিকানা যুক্ত থাকায় এই মেইল পেয়েছেন।',
                }),
            });
        }

        if (settings.leaveConfirmToStudent) {
            const to = await studentAddress(leave.courseId, leave.studentBatchName, leave.studentRoll, leave.studentUid);
            await sendAlertOnce({
                courseId: course.id,
                courseName: course.name,
                kind: 'leave_confirm',
                dedupeKey: `leave_confirm:${leave.id}`,
                to,
                subject: 'আপনার ছুটির আবেদন জমা হয়েছে',
                html: renderEmail({
                    courseName: course.name,
                    heading: 'ছুটির আবেদন জমা হয়েছে',
                    bodyHtml: paragraphs(
                        [
                            `${leave.studentName} (রোল ${leave.studentRoll}),`,
                            `আপনার ছুটির আবেদন আমরা পেয়েছি। সময়: ${period}`,
                            'আবেদনটি এখন অপেক্ষমাণ। সিদ্ধান্ত হলে আপনাকে ইমেইলে জানানো হবে।',
                        ].join('\n')
                    ),
                    ctaLabel: 'আবেদনের অবস্থা দেখুন',
                    ctaUrl: portalUrl(course.slug, '/student-dashboard/leave'),
                }),
            });
        }
    });
}

export function notifyNewCorrectionRequest(req: {
    id: string;
    courseId: string;
    studentName: string;
    roll: string;
    batchName: string;
    date: string;
    currentStatus: AttendanceStatus;
    requestedStatus: AttendanceStatus;
    reason: string;
}): void {
    background(`correction_new ${req.id}`, async () => {
        const ctx = await loadAlertContext(req.courseId);
        if (!ctx) return;
        const { course, settings } = ctx;
        if (!settings.correctionNewToStaff || !settings.staffRecipients.length) return;

        await sendAlertOnce({
            courseId: course.id,
            courseName: course.name,
            kind: 'correction_new',
            dedupeKey: `correction_new:${req.id}`,
            to: settings.staffRecipients,
            subject: `হাজিরা সংশোধনের আবেদন — ${req.studentName} (${req.batchName}, রোল ${req.roll})`,
            html: renderEmail({
                courseName: course.name,
                heading: 'হাজিরা সংশোধনের নতুন আবেদন',
                bodyHtml:
                    detailsTable([
                        ['নাম', req.studentName],
                        ['ব্যাচ', req.batchName],
                        ['রোল', req.roll],
                        ['তারিখ', req.date],
                        ['বর্তমান', ATTENDANCE_LABELS[req.currentStatus]],
                        ['চাওয়া হয়েছে', ATTENDANCE_LABELS[req.requestedStatus]],
                        ['কারণ', req.reason],
                    ]) + paragraphs('পোর্টালে গিয়ে আবেদনটি মঞ্জুর বা বাতিল করুন।'),
                ctaLabel: 'আবেদন দেখুন',
                ctaUrl: portalUrl(course.slug, '/dashboard/admin/attendance-report/requests'),
                footerNote: 'Email Alerts সেটিংসে আপনার ঠিকানা যুক্ত থাকায় এই মেইল পেয়েছেন।',
            }),
        });
    });
}
