import { withCourseContext } from './db';
import { isFeatureEnabled } from './features';
import { isMailConfigured, paragraphs, renderEmail, sendBulkMail } from './mailer';

/**
 * Email notifications for things students would otherwise only discover by
 * logging in — a new notice, a new homework assignment.
 *
 * Every entry point here is fire-and-forget: the notice or assignment has
 * already been saved by the time we get called, and a mail server that is
 * down must never turn a successful save into an error for the teacher.
 */

export const EMAIL_NOTIFICATIONS_FEATURE = 'email_notifications';

function portalUrl(slug: string, path = ''): string {
    const base = (process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd').toLowerCase();
    return `https://${slug}.${base}${path}`;
}

interface CourseMailContext {
    id: string;
    slug: string;
    name: string;
    settings: unknown;
}

async function loadCourse(courseId: string): Promise<CourseMailContext | null> {
    return withCourseContext({ courseId, isSuperAdmin: true }, (tx) =>
        tx.course.findUnique({
            where: { id: courseId },
            select: { id: true, slug: true, name: true, settings: true },
        })
    );
}

/**
 * Student addresses for a course, optionally one batch.
 *
 * Two sources on purpose. `users` only has students who created a login, but
 * the roster (`batch_students`) holds everyone the admin enrolled, with the
 * address collected on the student information form. Mailing only registered
 * students would miss exactly the people a reminder is aimed at, so the two
 * are merged and de-duplicated.
 *
 * `batchName` of "all" (what the homework screens use for a course-wide
 * assignment) means everyone, same as leaving it out.
 */
async function studentEmails(courseId: string, batchName?: string | null): Promise<string[]> {
    const scoped = batchName && batchName !== 'all' ? batchName : null;

    const [users, roster] = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => [
        await tx.user.findMany({
            where: {
                courseId,
                role: 'student',
                deletedAt: null,
                ...(scoped ? { studentBatchName: scoped } : {}),
            },
            select: { email: true },
        }),
        await tx.batchStudent.findMany({
            where: {
                courseId,
                // Someone who left the course should stop hearing from it.
                courseStatus: { in: ['Running', 'Completed'] },
                ...(scoped ? { batchName: scoped } : {}),
            },
            select: { email: true },
        }),
    ]);

    const addresses = [...users, ...roster]
        .map((r) => r.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e) && e!.includes('@'));

    return [...new Set(addresses)];
}

/** How many enrolled students still have no portal login. */
export async function countStudentsWithoutLogin(courseId: string): Promise<number> {
    return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const [roster, users] = await Promise.all([
            tx.batchStudent.findMany({
                where: { courseId, courseStatus: 'Running' },
                select: { batchName: true, roll: true },
            }),
            tx.user.findMany({
                where: { courseId, role: 'student', deletedAt: null },
                select: { studentBatchName: true, studentRoll: true },
            }),
        ]);
        const registered = new Set(users.map((u) => `${u.studentBatchName}::${u.studentRoll}`));
        return roster.filter((r) => !registered.has(`${r.batchName}::${r.roll}`)).length;
    });
}

interface DispatchResult {
    skipped?: 'disabled' | 'not-configured' | 'no-recipients' | 'no-course';
    sent?: number;
    failed?: number;
}

async function dispatch(
    courseId: string,
    batchName: string | null,
    build: (course: CourseMailContext) => { subject: string; html: string }
): Promise<DispatchResult> {
    if (!isMailConfigured()) return { skipped: 'not-configured' };

    const course = await loadCourse(courseId);
    if (!course) return { skipped: 'no-course' };
    if (!isFeatureEnabled(course.settings, EMAIL_NOTIFICATIONS_FEATURE)) return { skipped: 'disabled' };

    const recipients = await studentEmails(courseId, batchName);
    if (!recipients.length) return { skipped: 'no-recipients' };

    const { subject, html } = build(course);
    return sendBulkMail({ courseName: course.name, subject, html, recipients });
}

/**
 * Runs a dispatch without making the caller wait or fail.
 *
 * The HTTP handler has already done its real work; mail is a side effect, so
 * errors are logged rather than surfaced.
 */
export function dispatchInBackground(label: string, run: () => Promise<DispatchResult>): void {
    void run()
        .then((result) => {
            if (result.skipped) console.info(`[notify] ${label} skipped: ${result.skipped}`);
            else console.info(`[notify] ${label} sent=${result.sent} failed=${result.failed}`);
        })
        .catch((error) => {
            console.error(`[notify] ${label} failed:`, error instanceof Error ? error.message : error);
        });
}

export function notifyStudentsOfNotice(notice: {
    courseId: string;
    title: string;
    description: string;
    priority?: string | null;
}): void {
    dispatchInBackground(`notice "${notice.title}"`, () =>
        dispatch(notice.courseId, null, (course) => ({
            subject:
                notice.priority === 'high'
                    ? `[জরুরি] ${notice.title}`
                    : notice.title,
            html: renderEmail({
                courseName: course.name,
                heading: notice.title,
                bodyHtml: paragraphs(notice.description),
                ctaLabel: 'পোর্টালে দেখুন',
                ctaUrl: portalUrl(course.slug, '/student-dashboard'),
                footerNote: 'আপনি এই কোর্সের ছাত্র হিসেবে এই বার্তাটি পেয়েছেন।',
            }),
        }))
    );
}

export function notifyStudentsOfAssignment(assignment: {
    courseId: string;
    title: string;
    batchName: string | null;
    deadlineDate?: string | null;
    teacherName?: string | null;
}): void {
    dispatchInBackground(`assignment "${assignment.title}"`, () =>
        dispatch(assignment.courseId, assignment.batchName, (course) => ({
            subject: `নতুন হোমওয়ার্ক: ${assignment.title}`,
            html: renderEmail({
                courseName: course.name,
                heading: `নতুন হোমওয়ার্ক: ${assignment.title}`,
                bodyHtml: paragraphs(
                    [
                        assignment.teacherName ? `শিক্ষক: ${assignment.teacherName}` : null,
                        assignment.deadlineDate ? `জমা দেওয়ার শেষ তারিখ: ${assignment.deadlineDate}` : null,
                        'পোর্টালে লগইন করে সময়মতো জমা দিন।',
                    ]
                        .filter(Boolean)
                        .join('\n')
                ),
                ctaLabel: 'হোমওয়ার্ক দেখুন',
                ctaUrl: portalUrl(course.slug, '/student-dashboard/homework'),
                footerNote: 'আপনি এই কোর্সের ছাত্র হিসেবে এই বার্তাটি পেয়েছেন।',
            }),
        }))
    );
}
