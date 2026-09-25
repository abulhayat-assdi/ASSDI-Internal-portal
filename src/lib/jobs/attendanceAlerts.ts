import { withCourseContext } from '../db';
import { isFeatureEnabled } from '../features';
import { isMailConfigured, paragraphs, renderEmail, sendMail } from '../mailer';
import { EMAIL_NOTIFICATIONS_FEATURE } from '../notifications';
import { LOW_ATTENDANCE_THRESHOLD, tally, today } from '../attendance';
import type { AttendanceStatus, Prisma } from '@prisma/client';

/**
 * The daily attendance sweep.
 *
 * The at-risk list already existed on the reports screen, but nobody saw it
 * unless an admin went looking. This is the part that reaches out: a warning
 * to the student who is slipping, and a weekly summary to the people who can
 * do something about it.
 *
 * State lives in a `cms_content` row per course rather than a new table —
 * it is a handful of dates, and it keeps the job free of a migration.
 */

const STATE_KEY = 'attendance_alert_state';

/** How long before the same student may be warned again. */
const STUDENT_WARN_INTERVAL_DAYS = 7;
/** How long between admin digests. */
const DIGEST_INTERVAL_DAYS = 7;
/** How far back attendance is measured for these alerts. */
const WINDOW_DAYS = 30;
/** Consecutive absent days that earn a mention in the digest. */
const ABSENCE_STREAK = 3;

interface AlertState {
    lastDigestDate?: string;
    /** "batch::roll" → the date that student was last warned. */
    warnedOn?: Record<string, string>;
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export interface CourseAlertResult {
    courseId: string;
    courseName: string;
    skipped?: 'disabled' | 'no-data';
    warned: number;
    digestSent: boolean;
}

function portalUrl(slug: string, path = ''): string {
    const base = (process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd').toLowerCase();
    return `https://${slug}.${base}${path}`;
}

async function readState(courseId: string): Promise<AlertState> {
    const row = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: STATE_KEY } } })
    );
    return (row?.value as AlertState | null) ?? {};
}

async function writeState(courseId: string, state: AlertState): Promise<void> {
    // Prisma's Json input type wants an index signature; AlertState is a
    // closed shape on purpose, so it is widened only at this boundary.
    const value = state as Prisma.InputJsonValue;
    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cmsContent.upsert({
            where: { courseId_key: { courseId, key: STATE_KEY } },
            update: { value },
            create: { courseId, key: STATE_KEY, value },
        })
    );
}

async function runForCourse(course: {
    id: string;
    slug: string;
    name: string;
    settings: unknown;
}): Promise<CourseAlertResult> {
    const base = { courseId: course.id, courseName: course.name, warned: 0, digestSent: false };

    if (!isFeatureEnabled(course.settings, EMAIL_NOTIFICATIONS_FEATURE)) {
        return { ...base, skipped: 'disabled' };
    }

    const todayStr = today();
    const from = daysAgo(WINDOW_DAYS);
    const threshold = LOW_ATTENDANCE_THRESHOLD;

    const data = await withCourseContext({ courseId: course.id, isSuperAdmin: false }, async (tx) => {
        const sessions = await tx.attendanceSession.findMany({
            where: { courseId: course.id, date: { gte: from, lte: todayStr } },
            select: { id: true, date: true },
        });
        if (!sessions.length) return null;

        const records = await tx.attendanceRecord.findMany({
            where: { courseId: course.id, sessionId: { in: sessions.map((s) => s.id) } },
            select: { studentId: true, status: true, sessionId: true },
        });

        const students = await tx.batchStudent.findMany({
            where: { courseId: course.id, courseStatus: 'Running' },
            select: { id: true, roll: true, name: true, batchName: true, email: true, phone: true },
        });

        const logins = await tx.user.findMany({
            where: { courseId: course.id, role: 'student', deletedAt: null },
            select: { email: true, studentBatchName: true, studentRoll: true },
        });

        const admins = await tx.user.findMany({
            where: { courseId: course.id, role: 'admin', deletedAt: null },
            select: { email: true },
        });

        return { sessions, records, students, logins, admins };
    });

    if (!data) return { ...base, skipped: 'no-data' };

    const sessionDate = new Map(data.sessions.map((s) => [s.id, s.date]));
    const byStudent = new Map<string, { status: AttendanceStatus; date: string }[]>();
    for (const r of data.records) {
        const entry = { status: r.status, date: sessionDate.get(r.sessionId) ?? '' };
        const list = byStudent.get(r.studentId);
        if (list) list.push(entry);
        else byStudent.set(r.studentId, [entry]);
    }

    const loginEmail = new Map(
        data.logins.map((u) => [`${u.studentBatchName}::${u.studentRoll}`, u.email])
    );

    const state = await readState(course.id);
    const warnedOn = { ...(state.warnedOn ?? {}) };

    const lowStudents: { name: string; roll: string; batchName: string; phone: string; percentage: number }[] = [];
    const streakStudents: { name: string; roll: string; batchName: string; phone: string; days: number }[] = [];
    let warned = 0;

    for (const student of data.students) {
        const entries = (byStudent.get(student.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
        if (!entries.length) continue;

        const t = tally(entries.map((e) => e.status));
        const key = `${student.batchName}::${student.roll}`;

        // Consecutive absences, counted backwards from the most recent day.
        let streak = 0;
        for (let i = entries.length - 1; i >= 0; i--) {
            if (entries[i].status === 'ABSENT') streak++;
            else break;
        }
        if (streak >= ABSENCE_STREAK) {
            streakStudents.push({
                name: student.name,
                roll: student.roll,
                batchName: student.batchName,
                phone: student.phone,
                days: streak,
            });
        }

        if (t.percentage === null || t.percentage >= threshold) continue;

        lowStudents.push({
            name: student.name,
            roll: student.roll,
            batchName: student.batchName,
            phone: student.phone,
            percentage: t.percentage,
        });

        // Warn the student, but not every morning — a nag that arrives daily
        // stops being read.
        const lastWarned = warnedOn[key];
        if (lastWarned && daysBetween(lastWarned, todayStr) < STUDENT_WARN_INTERVAL_DAYS) continue;

        const to = loginEmail.get(key) ?? student.email;
        if (!to || !to.includes('@')) continue;

        const ok = await sendMail({
            courseName: course.name,
            to: [to.trim().toLowerCase()],
            subject: 'আপনার উপস্থিতি কমে যাচ্ছে',
            html: renderEmail({
                courseName: course.name,
                heading: 'উপস্থিতি সতর্কতা',
                bodyHtml: paragraphs(
                    [
                        `${student.name} (রোল ${student.roll}),`,
                        `গত ${WINDOW_DAYS} দিনে আপনার উপস্থিতির হার ${t.percentage}% — যা প্রয়োজনীয় ${threshold}%-এর নিচে।`,
                        `উপস্থিত ${t.attended}টি, অনুপস্থিত ${t.absent}টি ক্লাস।`,
                        'নিয়মিত ক্লাসে আসুন। কোনো সমস্যা থাকলে অ্যাডমিনের সাথে কথা বলুন।',
                    ].join('\n')
                ),
                ctaLabel: 'আমার উপস্থিতি দেখুন',
                ctaUrl: portalUrl(course.slug, '/student-dashboard/attendance'),
            }),
        }).catch(() => false);

        if (ok) {
            warnedOn[key] = todayStr;
            warned++;
        }
    }

    // Weekly digest to the people who can act on it.
    let digestSent = false;
    const dueForDigest =
        !state.lastDigestDate || daysBetween(state.lastDigestDate, todayStr) >= DIGEST_INTERVAL_DAYS;

    if (dueForDigest && (lowStudents.length > 0 || streakStudents.length > 0)) {
        const adminAddresses = data.admins.map((a) => a.email).filter((e) => e?.includes('@'));
        if (adminAddresses.length) {
            const list = (rows: string[]) =>
                rows.length ? `<ul style="margin:0 0 16px;padding-left:20px;">${rows.join('')}</ul>` : '';

            const lowRows = lowStudents
                .sort((a, b) => a.percentage - b.percentage)
                .map(
                    (s) =>
                        `<li>${s.batchName} · রোল ${s.roll} · ${s.name} — <strong>${s.percentage}%</strong>${s.phone ? ` · ${s.phone}` : ''}</li>`
                );
            const streakRows = streakStudents
                .sort((a, b) => b.days - a.days)
                .map(
                    (s) =>
                        `<li>${s.batchName} · রোল ${s.roll} · ${s.name} — টানা <strong>${s.days} দিন</strong> অনুপস্থিত${s.phone ? ` · ${s.phone}` : ''}</li>`
                );

            const ok = await sendMail({
                courseName: course.name,
                to: adminAddresses,
                subject: `উপস্থিতির সাপ্তাহিক রিপোর্ট — ${lowStudents.length} জন ${threshold}%-এর নিচে`,
                html: renderEmail({
                    courseName: course.name,
                    heading: 'উপস্থিতির সাপ্তাহিক রিপোর্ট',
                    bodyHtml:
                        `<p style="margin:0 0 12px;">গত ${WINDOW_DAYS} দিনের হিসাব।</p>` +
                        (lowRows.length
                            ? `<p style="margin:0 0 6px;"><strong>${threshold}%-এর নিচে (${lowRows.length} জন):</strong></p>${list(lowRows)}`
                            : '') +
                        (streakRows.length
                            ? `<p style="margin:0 0 6px;"><strong>টানা ${ABSENCE_STREAK} দিন বা তার বেশি অনুপস্থিত (${streakRows.length} জন):</strong></p>${list(streakRows)}`
                            : ''),
                    ctaLabel: 'পূর্ণ রিপোর্ট দেখুন',
                    ctaUrl: portalUrl(course.slug, '/dashboard/admin/attendance-report'),
                    footerNote: 'সাপ্তাহিক স্বয়ংক্রিয় রিপোর্ট।',
                }),
            }).catch(() => false);

            if (ok) digestSent = true;
        }
    }

    await writeState(course.id, {
        warnedOn,
        lastDigestDate: digestSent ? todayStr : state.lastDigestDate,
    });

    return { ...base, warned, digestSent };
}

/** Runs the sweep for every live course. Never throws — one bad course must not stop the rest. */
export async function runAttendanceAlerts(): Promise<CourseAlertResult[]> {
    if (!isMailConfigured()) return [];

    const courses = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.course.findMany({
            where: { status: { in: ['ACTIVE', 'TRIAL'] } },
            select: { id: true, slug: true, name: true, settings: true },
        })
    );

    const results: CourseAlertResult[] = [];
    for (const course of courses) {
        try {
            results.push(await runForCourse(course));
        } catch (error) {
            console.error(
                `[attendance-alerts] ${course.slug} failed:`,
                error instanceof Error ? error.message : error
            );
        }
    }
    return results;
}
