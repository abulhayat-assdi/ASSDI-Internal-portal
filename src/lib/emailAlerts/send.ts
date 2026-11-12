import { withCourseContext } from '../db';
import { sendMail } from '../mailer';

export type EmailAlertKind =
    | 'leave_new'
    | 'leave_confirm'
    | 'leave_pending'
    | 'on_leave_today'
    | 'correction_new'
    | 'streak_late'
    | 'streak_absent'
    | 'streak_escalation'
    | 'streak_guardian';

export type SendOnceResult = 'sent' | 'failed' | 'duplicate' | 'no-recipients';

export function cleanAddresses(list: (string | null | undefined)[]): string[] {
    const out = list
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e!));
    return [...new Set(out)];
}

/**
 * Sends one alert and records it in `email_logs`.
 *
 * `dedupeKey` is unique per course: an alert already SENT under that key is
 * never sent again. A FAILED one is retried on the next call (the next cron
 * run), and its row is updated in place.
 *
 * Never throws — alerts are side effects of work that has already succeeded.
 */
export async function sendAlertOnce(opts: {
    courseId: string;
    courseName: string;
    kind: EmailAlertKind;
    dedupeKey: string;
    to: string[];
    subject: string;
    html: string;
}): Promise<SendOnceResult> {
    const { courseId, kind, dedupeKey, subject } = opts;
    const to = cleanAddresses(opts.to);
    if (!to.length) return 'no-recipients';

    const ctx = { courseId, isSuperAdmin: false };
    try {
        const existing = await withCourseContext(ctx, (tx) =>
            tx.emailLog.findUnique({
                where: { courseId_dedupeKey: { courseId, dedupeKey } },
                select: { status: true },
            })
        );
        if (existing?.status === 'SENT') return 'duplicate';

        let error: string | null = null;
        let ok = false;
        try {
            ok = await sendMail({ courseName: opts.courseName, to, subject, html: opts.html });
            if (!ok) error = 'mail not configured';
        } catch (e) {
            error = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
        }
        const status = ok ? 'SENT' : 'FAILED';

        await withCourseContext(ctx, (tx) =>
            tx.emailLog.upsert({
                where: { courseId_dedupeKey: { courseId, dedupeKey } },
                update: { status, error, recipients: to, subject, createdAt: new Date() },
                create: { courseId, kind, dedupeKey, recipients: to, subject, status, error },
            })
        );
        if (!ok) console.error(`[email-alerts] ${kind} ${dedupeKey} failed: ${error}`);
        return ok ? 'sent' : 'failed';
    } catch (e) {
        console.error(`[email-alerts] ${kind} ${dedupeKey} error:`, e instanceof Error ? e.message : e);
        return 'failed';
    }
}
