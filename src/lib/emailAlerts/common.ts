import { withCourseContext } from '../db';
import { isFeatureEnabled } from '../features';
import { isMailConfigured, escapeHtml } from '../mailer';
import { EMAIL_NOTIFICATIONS_FEATURE } from '../notifications';
import { getEmailAlertSettings, type EmailAlertSettings } from './settings';

export interface AlertCourse {
    id: string;
    slug: string;
    name: string;
    settings: unknown;
}

export function portalUrl(slug: string, path = ''): string {
    const base = (process.env.BASE_DOMAIN || process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd').toLowerCase();
    return `https://${slug}.${base}${path}`;
}

/** Today's date ("YYYY-MM-DD") in Bangladesh, whatever the server clock is. */
export function dhakaToday(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}

/**
 * Loads what every alert needs, or null when alerts are off for the course:
 * mail not configured, or the course's `email_notifications` feature is off.
 */
export async function loadAlertContext(
    courseId: string
): Promise<{ course: AlertCourse; settings: EmailAlertSettings } | null> {
    if (!isMailConfigured()) return null;
    const course = await withCourseContext({ courseId, isSuperAdmin: true }, (tx) =>
        tx.course.findUnique({
            where: { id: courseId },
            select: { id: true, slug: true, name: true, settings: true },
        })
    );
    if (!course || !isFeatureEnabled(course.settings, EMAIL_NOTIFICATIONS_FEATURE)) return null;
    return { course, settings: await getEmailAlertSettings(courseId) };
}

/** A two-column details table for staff emails. Values are escaped. */
export function detailsTable(rows: [string, string | null | undefined][]): string {
    const body = rows
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(
            ([k, v]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>` +
                `<td style="padding:6px 0;">${escapeHtml(String(v)).replace(/\n/g, '<br>')}</td></tr>`
        )
        .join('');
    return `<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px;">${body}</table>`;
}

export function bulletList(items: string[]): string {
    return `<ul style="margin:0 0 16px;padding-left:20px;">${items.map((i) => `<li style="margin:0 0 4px;">${i}</li>`).join('')}</ul>`;
}

export function leavePeriod(l: { startDate: string; endDate: string; startTime?: string | null; endTime?: string | null }): string {
    const start = l.startTime ? `${l.startDate} ${l.startTime}` : l.startDate;
    const end = l.endTime ? `${l.endDate} ${l.endTime}` : l.endDate;
    return `${start} — ${end}`;
}
