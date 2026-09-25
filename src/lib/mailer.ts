import nodemailer, { type Transporter } from 'nodemailer';
import { PLATFORM_NAME } from '@/types/branding';

/**
 * Shared SMTP plumbing.
 *
 * Password reset used to build its own transporter inline; every mail the
 * portal sends now goes through here so the connection, the From rules and
 * the template are decided in one place.
 */

let cached: Transporter | null = null;

export function isMailConfigured(): boolean {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getTransporter(): Transporter {
    if (cached) return cached;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;

    cached = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER || '',
            // Gmail app passwords are shown in groups of four; people paste
            // them with the spaces still in.
            pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
        },
        tls: { rejectUnauthorized: false },
        pool: true,
        maxConnections: 3,
    });
    return cached;
}

/** From header for a course, respecting Gmail's "must match the authenticated user" rule. */
export function fromAddress(courseName: string): string {
    const smtpUser = process.env.SMTP_USER || '';
    const preferred = `"${courseName}" <${smtpUser}>`;
    const configured = process.env.SMTP_FROM;
    if (!configured) return preferred;
    if (process.env.SMTP_HOST?.includes('gmail.com') && smtpUser && !configured.includes(smtpUser)) {
        return preferred;
    }
    return configured;
}

interface TemplateOptions {
    courseName: string;
    heading: string;
    /** Already-escaped HTML paragraphs, or plain text — see escapeHtml below. */
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
    footerNote?: string;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Turns user-entered text into safe paragraphs, keeping the line breaks. */
export function paragraphs(text: string): string {
    return text
        .split(/\n{2,}/)
        .map((block) => `<p style="margin:0 0 12px;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

export function renderEmail({
    courseName,
    heading,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    footerNote,
}: TemplateOptions): string {
    const cta =
        ctaLabel && ctaUrl
            ? `<div style="text-align:center;margin:28px 0;">
                 <a href="${ctaUrl}" style="background-color:#059669;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:6px;font-size:16px;display:inline-block;">${escapeHtml(ctaLabel)}</a>
               </div>`
            : '';

    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
  <h2 style="color:#1a1a2e;margin:0 0 16px;">${escapeHtml(heading)}</h2>
  ${bodyHtml}
  ${cta}
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0;">
  <p style="color:#999;font-size:12px;margin:0;">${escapeHtml(courseName)} — ${escapeHtml(PLATFORM_NAME)}. ${escapeHtml(footerNote ?? 'This is an automated message.')}</p>
</div>`;
}

interface SendOptions {
    courseName: string;
    subject: string;
    html: string;
    /** Normal recipients. */
    to?: string[];
    /** Hidden recipients — used for anything that goes to a whole batch. */
    bcc?: string[];
}

export async function sendMail({ courseName, subject, html, to, bcc }: SendOptions): Promise<boolean> {
    if (!isMailConfigured()) return false;
    if (!to?.length && !bcc?.length) return false;

    await getTransporter().sendMail({
        from: fromAddress(courseName),
        // A mail with only Bcc looks like spam to some servers, so address it
        // to the sending mailbox and hide the real recipients behind Bcc.
        to: to?.length ? to : process.env.SMTP_USER,
        bcc: bcc?.length ? bcc : undefined,
        subject,
        html,
    });
    return true;
}

/** Recipients per message when mailing a whole batch. */
const BCC_CHUNK = 50;

/**
 * Sends one message to many students, in Bcc chunks.
 *
 * Never throws: a notice must still be saved if the mail server is having a
 * bad day, so failures are logged and reported in the return value instead.
 */
export async function sendBulkMail(options: Omit<SendOptions, 'to' | 'bcc'> & { recipients: string[] }): Promise<{
    sent: number;
    failed: number;
}> {
    const unique = [...new Set(options.recipients.filter(Boolean))];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < unique.length; i += BCC_CHUNK) {
        const chunk = unique.slice(i, i + BCC_CHUNK);
        try {
            const ok = await sendMail({ ...options, bcc: chunk });
            if (ok) sent += chunk.length;
            else failed += chunk.length;
        } catch (error) {
            failed += chunk.length;
            console.error('[mailer] bulk send failed:', error instanceof Error ? error.message : error);
        }
    }

    return { sent, failed };
}
