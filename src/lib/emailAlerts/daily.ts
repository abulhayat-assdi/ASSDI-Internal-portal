import type { AttendanceStatus } from '@prisma/client';
import { withCourseContext } from '../db';
import { isFeatureEnabled } from '../features';
import { escapeHtml, isMailConfigured, paragraphs, renderEmail } from '../mailer';
import { EMAIL_NOTIFICATIONS_FEATURE } from '../notifications';
import { bulletList, dhakaToday, detailsTable, leavePeriod, portalUrl, type AlertCourse } from './common';
import { getEmailAlertSettings, type EmailAlertSettings } from './settings';
import { cleanAddresses, sendAlertOnce, type SendOnceResult } from './send';

/**
 * The daily email-alert sweep (07:00 Asia/Dhaka, see instrumentation.ts):
 *
 *  1. Attendance streaks — a student LATE or ABSENT at N consecutive roll
 *     calls of their batch gets one email per streak; a longer absence streak
 *     is escalated to staff (and optionally the guardian).
 *  2. Leave requests still pending after the configured hours → staff.
 *  3. Who is on approved leave today → staff.
 *
 * "Consecutive" means the batch's own roll-call days, not calendar days, so
 * Fridays and holidays in between do not break or extend a streak. Days the
 * student was EXCUSED or on approved leave are skipped: they neither count
 * nor break the streak. A day with no record for the student (not on that
 * roll call) is skipped the same way.
 *
 * Each email is keyed by student + the date the streak started, so the same
 * streak is mailed once even though it is seen again every morning.
 */

/** Roll calls older than this are not looked at. */
const LOOKBACK_DAYS = 45;
/** A batch whose last roll call is older than this has no "current" streak. */
const STALE_BATCH_DAYS = 7;

export interface StreakResult {
    type: 'LATE' | 'ABSENT';
    count: number;
    /** Date of the first (oldest) day of the streak. */
    startDate: string;
    /** Date of the most recent day of the streak. */
    endDate: string;
    dates: string[];
}

/**
 * The student's current streak, walking back from the batch's latest roll call.
 *
 * `days` is newest first. `status` null = the student had no record that day.
 * Pure, so it can be unit-tested.
 */
export function currentStreak(
    days: { date: string; status: AttendanceStatus | null; onLeave?: boolean }[]
): StreakResult | null {
    let type: 'LATE' | 'ABSENT' | null = null;
    const dates: string[] = [];
    for (const day of days) {
        if (day.status === null || day.status === 'EXCUSED' || day.onLeave) continue;
        if (day.status !== 'LATE' && day.status !== 'ABSENT') break;
        if (type === null) type = day.status;
        else if (day.status !== type) break;
        dates.push(day.date);
    }
    if (!type || !dates.length) return null;
    return { type, count: dates.length, startDate: dates[dates.length - 1], endDate: dates[0], dates: [...dates].reverse() };
}

function shiftDate(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export interface CourseDailyResult {
    courseId: string;
    courseName: string;
    skipped?: 'disabled';
    sent: number;
    failed: number;
}

function tallyInto(result: CourseDailyResult, r: SendOnceResult) {
    if (r === 'sent') result.sent++;
    else if (r === 'failed') result.failed++;
}

async function runStreaks(course: AlertCourse, settings: EmailAlertSettings, today: string, result: CourseDailyResult) {
    const wantsAny =
        settings.lateStreakToStudent ||
        settings.absentStreakToStudent ||
        settings.escalationToStaff ||
        settings.escalationToGuardian;
    if (!wantsAny) return;

    const from = shiftDate(today, -LOOKBACK_DAYS);
    const data = await withCourseContext({ courseId: course.id, isSuperAdmin: false }, async (tx) => {
        const batches = await tx.batch.findMany({
            where: { courseId: course.id, status: 'active' },
            select: { id: true },
        });
        const batchIds = batches.map((b) => b.id);
        if (!batchIds.length) return null;

        const sessions = await tx.attendanceSession.findMany({
            where: { courseId: course.id, batchId: { in: batchIds }, date: { gte: from, lte: today } },
            select: { id: true, batchId: true, date: true },
            orderBy: { date: 'desc' },
        });
        if (!sessions.length) return null;

        const [records, students, logins, leaves] = await Promise.all([
            tx.attendanceRecord.findMany({
                where: { courseId: course.id, sessionId: { in: sessions.map((s) => s.id) } },
                select: { sessionId: true, studentId: true, status: true },
            }),
            tx.batchStudent.findMany({
                where: { courseId: course.id, batchId: { in: batchIds }, courseStatus: 'Running' },
                select: {
                    id: true,
                    batchId: true,
                    batchName: true,
                    roll: true,
                    name: true,
                    phone: true,
                    email: true,
                    guardianName: true,
                    guardianEmail: true,
                },
            }),
            tx.user.findMany({
                where: { courseId: course.id, role: 'student', deletedAt: null },
                select: { email: true, studentBatchName: true, studentRoll: true },
            }),
            tx.studentLeaveRequest.findMany({
                where: { courseId: course.id, status: 'APPROVED', endDate: { gte: from } },
                select: { studentBatchName: true, studentRoll: true, startDate: true, endDate: true },
            }),
        ]);
        return { sessions, records, students, logins, leaves };
    });
    if (!data) return;

    const sessionsByBatch = new Map<string, { id: string; date: string }[]>();
    for (const s of data.sessions) {
        const list = sessionsByBatch.get(s.batchId) ?? [];
        list.push({ id: s.id, date: s.date });
        sessionsByBatch.set(s.batchId, list);
    }
    const status = new Map<string, AttendanceStatus>();
    for (const r of data.records) status.set(`${r.sessionId}::${r.studentId}`, r.status);

    const loginEmail = new Map(data.logins.map((u) => [`${u.studentBatchName}::${u.studentRoll}`, u.email]));
    const leavesByStudent = new Map<string, { startDate: string; endDate: string }[]>();
    for (const l of data.leaves) {
        const key = `${l.studentBatchName}::${l.studentRoll}`;
        const list = leavesByStudent.get(key) ?? [];
        list.push(l);
        leavesByStudent.set(key, list);
    }

    const staleBefore = shiftDate(today, -STALE_BATCH_DAYS);
    const escalated: string[] = [];

    for (const student of data.students) {
        const sessions = sessionsByBatch.get(student.batchId);
        if (!sessions?.length || sessions[0].date < staleBefore) continue;

        const key = `${student.batchName}::${student.roll}`;
        const leaves = leavesByStudent.get(key) ?? [];
        const streak = currentStreak(
            sessions.map((s) => ({
                date: s.date,
                status: status.get(`${s.id}::${student.id}`) ?? null,
                onLeave: leaves.some((l) => l.startDate <= s.date && s.date <= l.endDate),
            }))
        );
        if (!streak) continue;

        const studentTo = cleanAddresses([loginEmail.get(key), student.email]).slice(0, 1);
        const datesText = streak.dates.join(', ');
        const isLate = streak.type === 'LATE';

        const studentThreshold = isLate ? settings.lateStreakDays : settings.absentStreakDays;
        const studentEnabled = isLate ? settings.lateStreakToStudent : settings.absentStreakToStudent;
        if (studentEnabled && streak.count >= studentThreshold) {
            const subject = isLate
                ? `আপনি পরপর ${streak.count} দিন দেরিতে এসেছেন`
                : `আপনি পরপর ${streak.count} দিন অনুপস্থিত`;
            tallyInto(
                result,
                await sendAlertOnce({
                    courseId: course.id,
                    courseName: course.name,
                    kind: isLate ? 'streak_late' : 'streak_absent',
                    dedupeKey: `streak_${isLate ? 'late' : 'absent'}:${student.id}:${streak.startDate}`,
                    to: studentTo,
                    subject,
                    html: renderEmail({
                        courseName: course.name,
                        heading: isLate ? 'দেরিতে উপস্থিতির সতর্কতা' : 'অনুপস্থিতির সতর্কতা',
                        bodyHtml: paragraphs(
                            [
                                `${student.name} (রোল ${student.roll}),`,
                                isLate
                                    ? `আপনি পরপর ${streak.count}টি ক্লাসে দেরিতে এসেছেন (${datesText})।`
                                    : `আপনি পরপর ${streak.count}টি ক্লাসে অনুপস্থিত ছিলেন (${datesText})।`,
                                isLate
                                    ? 'অনুগ্রহ করে সময়মতো ক্লাসে আসুন।'
                                    : 'নিয়মিত ক্লাসে আসুন। অসুস্থতা বা জরুরি কারণে না আসতে পারলে পোর্টাল থেকে ছুটির আবেদন করুন।',
                                'হাজিরায় ভুল থাকলে পোর্টাল থেকে সংশোধনের আবেদন করতে পারেন।',
                            ].join('\n')
                        ),
                        ctaLabel: 'আমার উপস্থিতি দেখুন',
                        ctaUrl: portalUrl(course.slug, '/student-dashboard/attendance'),
                    }),
                })
            );
        }

        if (streak.type !== 'ABSENT' || streak.count < settings.escalationDays) continue;

        if (settings.escalationToStaff && settings.staffRecipients.length) {
            const r = await sendAlertOnce({
                courseId: course.id,
                courseName: course.name,
                kind: 'streak_escalation',
                dedupeKey: `streak_escalation:${student.id}:${streak.startDate}`,
                to: settings.staffRecipients,
                subject: `টানা ${streak.count} দিন অনুপস্থিত — ${student.name} (${student.batchName}, রোল ${student.roll})`,
                html: renderEmail({
                    courseName: course.name,
                    heading: `টানা ${streak.count} দিন অনুপস্থিত`,
                    bodyHtml:
                        detailsTable([
                            ['নাম', student.name],
                            ['ব্যাচ', student.batchName],
                            ['রোল', student.roll],
                            ['ফোন', student.phone],
                            ['অভিভাবক', student.guardianName],
                            ['অনুপস্থিত', datesText],
                        ]) + paragraphs('ছাত্রের সাথে যোগাযোগ করে কারণ জেনে নিন।'),
                    ctaLabel: 'উপস্থিতি রিপোর্ট',
                    ctaUrl: portalUrl(course.slug, '/dashboard/admin/attendance-report'),
                    footerNote: 'Email Alerts সেটিংসে আপনার ঠিকানা যুক্ত থাকায় এই মেইল পেয়েছেন।',
                }),
            });
            tallyInto(result, r);
            if (r === 'sent') escalated.push(student.id);
        }

        if (settings.escalationToGuardian && student.guardianEmail) {
            tallyInto(
                result,
                await sendAlertOnce({
                    courseId: course.id,
                    courseName: course.name,
                    kind: 'streak_guardian',
                    dedupeKey: `streak_guardian:${student.id}:${streak.startDate}`,
                    to: [student.guardianEmail],
                    subject: `${student.name} টানা ${streak.count} দিন ক্লাসে অনুপস্থিত`,
                    html: renderEmail({
                        courseName: course.name,
                        heading: 'অভিভাবকের প্রতি বার্তা',
                        bodyHtml: paragraphs(
                            [
                                `${student.guardianName ? `সম্মানিত ${student.guardianName},` : 'সম্মানিত অভিভাবক,'}`,
                                `আপনার সন্তান/পোষ্য ${student.name} (${student.batchName}, রোল ${student.roll}) পরপর ${streak.count}টি ক্লাসে অনুপস্থিত ছিলেন (${datesText})।`,
                                'অনুগ্রহ করে খোঁজ নিন এবং প্রয়োজনে প্রতিষ্ঠানের সাথে যোগাযোগ করুন।',
                            ].join('\n')
                        ),
                        footerNote: 'ছাত্রের তথ্য ফর্মে আপনার ইমেইল দেওয়া থাকায় এই মেইল পেয়েছেন।',
                    }),
                })
            );
        }
    }
}

async function runLeaveDigests(course: AlertCourse, settings: EmailAlertSettings, today: string, result: CourseDailyResult) {
    if (!settings.staffRecipients.length) return;
    if (!settings.leavePendingReminder && !settings.onLeaveTodayDigest) return;

    const cutoff = new Date(Date.now() - settings.pendingReminderHours * 3_600_000);
    const { pending, onLeave } = await withCourseContext({ courseId: course.id, isSuperAdmin: false }, async (tx) => ({
        pending: settings.leavePendingReminder
            ? await tx.studentLeaveRequest.findMany({
                  where: { courseId: course.id, status: 'PENDING', createdAt: { lte: cutoff } },
                  orderBy: { createdAt: 'asc' },
                  take: 200,
              })
            : [],
        onLeave: settings.onLeaveTodayDigest
            ? await tx.studentLeaveRequest.findMany({
                  where: { courseId: course.id, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
                  orderBy: [{ studentBatchName: 'asc' }, { studentRoll: 'asc' }],
                  take: 500,
              })
            : [],
    }));

    const row = (l: (typeof pending)[number]) =>
        `${escapeHtml(l.studentBatchName)} · রোল ${escapeHtml(l.studentRoll)} · <strong>${escapeHtml(l.studentName)}</strong> — ${escapeHtml(leavePeriod(l))}`;

    if (pending.length) {
        tallyInto(
            result,
            await sendAlertOnce({
                courseId: course.id,
                courseName: course.name,
                kind: 'leave_pending',
                dedupeKey: `leave_pending:${today}`,
                to: settings.staffRecipients,
                subject: `${pending.length}টি ছুটির আবেদন এখনো অপেক্ষমাণ`,
                html: renderEmail({
                    courseName: course.name,
                    heading: 'অপেক্ষমাণ ছুটির আবেদন',
                    bodyHtml:
                        `<p style="margin:0 0 12px;">${settings.pendingReminderHours} ঘণ্টার বেশি সময় ধরে সিদ্ধান্তের অপেক্ষায়:</p>` +
                        bulletList(pending.map(row)),
                    ctaLabel: 'আবেদনগুলো দেখুন',
                    ctaUrl: portalUrl(course.slug, '/dashboard/student-leaves'),
                    footerNote: 'দৈনিক স্বয়ংক্রিয় রিমাইন্ডার।',
                }),
            })
        );
    }

    if (onLeave.length) {
        tallyInto(
            result,
            await sendAlertOnce({
                courseId: course.id,
                courseName: course.name,
                kind: 'on_leave_today',
                dedupeKey: `on_leave_today:${today}`,
                to: settings.staffRecipients,
                subject: `আজ ছুটিতে: ${onLeave.length} জন (${today})`,
                html: renderEmail({
                    courseName: course.name,
                    heading: `আজ যারা ছুটিতে (${today})`,
                    bodyHtml: bulletList(onLeave.map(row)),
                    ctaLabel: 'পোর্টালে দেখুন',
                    ctaUrl: portalUrl(course.slug, '/dashboard/leave-status'),
                    footerNote: 'দৈনিক স্বয়ংক্রিয় রিপোর্ট।',
                }),
            })
        );
    }
}

/** Runs the sweep for every live course. Never throws — one bad course must not stop the rest. */
export async function runDailyEmailAlerts(now = new Date()): Promise<CourseDailyResult[]> {
    if (!isMailConfigured()) return [];
    const today = dhakaToday(now);

    const courses = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.course.findMany({
            where: { status: { in: ['ACTIVE', 'TRIAL'] } },
            select: { id: true, slug: true, name: true, settings: true },
        })
    );

    const results: CourseDailyResult[] = [];
    for (const course of courses) {
        const result: CourseDailyResult = { courseId: course.id, courseName: course.name, sent: 0, failed: 0 };
        if (!isFeatureEnabled(course.settings, EMAIL_NOTIFICATIONS_FEATURE)) {
            results.push({ ...result, skipped: 'disabled' });
            continue;
        }
        try {
            const settings = await getEmailAlertSettings(course.id);
            await runStreaks(course, settings, today, result);
            await runLeaveDigests(course, settings, today, result);
        } catch (error) {
            console.error(`[email-alerts] ${course.slug} failed:`, error instanceof Error ? error.message : error);
        }
        results.push(result);
    }
    return results;
}
