export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withCourseContext } from '@/lib/db';
import crypto from 'crypto';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { HOUR, MINUTE, limitFromEnv, rateLimit, rateLimitByIp } from '@/lib/rateLimit';
import { getBrandingForCourseId } from '@/lib/branding';
import { escapeHtml, renderEmail, sendMail } from '@/lib/mailer';
import { loginUrlForUser, portalOriginForUser } from '@/lib/portalUrls';

const requestSchema = z.object({
    email: z.string().email(),
});

const resetSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const TOKEN_EXPIRY_HOURS = 2;

/**
 * POST /api/auth/reset-password
 * Body: { email }
 * Sends a password reset email with a time-limited token.
 */
export async function POST(req: NextRequest) {
    // Each accepted request sends mail, so this is an email-bomb vector as
    // much as an enumeration one: cap the sender and the target separately.
    const limited = rateLimitByIp(req, 'reset-password', limitFromEnv('RESET_IP', 30), HOUR,
        'অনেক বেশি রিসেট অনুরোধ। এক ঘণ্টা পর আবার চেষ্টা করুন।');
    if (limited) return limited;

    try {
        const body = await req.json();
        const parsed = requestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const { email } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // Per-address cap, so one inbox can't be flooded from many IPs.
        // Answers success either way — never reveal whether the account exists.
        // Kept tight: this one is per mailbox, not per network, so it cannot
        // lock out a shared connection — and it is the actual email-bomb guard.
        if (!rateLimit(`reset-password:addr:${normalizedEmail}`, limitFromEnv('RESET_EMAIL', 5), HOUR).ok) {
            return NextResponse.json({ success: true });
        }

        // Email is globally unique across the platform — this lookup bypasses
        // course-scoped RLS since the requester isn't necessarily on that
        // user's course subdomain.
        const user = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
            tx.user.findUnique({ where: { email: normalizedEmail, deletedAt: null } })
        );

        if (!user) {
            return NextResponse.json({ success: true }); // Don't reveal user existence
        }

        // PasswordResetToken has no course_id / RLS policy — keyed by userId only.
        // Invalidate any existing tokens for this user
        await prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        });

        // Create new token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token: rawToken,
                expiresAt,
            },
        });

        // The mail is signed with the user's own course, not a fixed one —
        // a reset link for a telesales student must not read "Sales & Marketing".
        const brand = await getBrandingForCourseId(user.courseId ?? null);
        const courseName = brand.name;

        // The link opens on the user's own host (course subdomain / admin host),
        // not the root domain — the root has no sign-in to return to afterwards.
        const resetUrl = `${await portalOriginForUser(user)}/reset-password?token=${rawToken}`;

        try {
            const delivered = await sendMail({
                courseName,
                to: [user.email],
                subject: `Reset Your ${courseName} Password`,
                html: renderEmail({
                    courseName,
                    heading: 'Password Reset Request',
                    bodyHtml: [
                        `<p style="margin:0 0 12px;">Hello ${escapeHtml(user.displayName)},</p>`,
                        `<p style="margin:0 0 12px;">We received a request to reset your ${escapeHtml(courseName)} (Internal Portal) password.</p>`,
                        `<p style="margin:0 0 12px;">Click the button below to set a new password. This link expires in <strong>${TOKEN_EXPIRY_HOURS} hours</strong>.</p>`,
                    ].join(''),
                    ctaLabel: 'Reset Password',
                    ctaUrl: resetUrl,
                    footerNote: "If you didn't request this, you can safely ignore this email.",
                }),
            });
            // No SMTP credentials configured — same outcome as a send failure,
            // so fall through to the manual-reset path below.
            if (!delivered) throw new Error('SMTP is not configured');
        } catch (smtpError: any) {
            console.error('[Reset Password] SMTP send failed:', smtpError?.message || smtpError);
            // Log reset URL to server console so admin can manually share it
            console.warn(`[Reset Password] MANUAL RESET URL for ${user.email}:\n${resetUrl}`);
            return NextResponse.json(
                { error: 'Email delivery failed. Please contact the admin to reset your password manually.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Reset Password API] Request error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/auth/reset-password
 * Body: { token, password }
 * Validates the token and updates the password.
 */
export async function PATCH(req: NextRequest) {
    // The token is 256 bits of randomness, but cap guessing anyway.
    const limited = rateLimitByIp(req, 'reset-password-confirm', limitFromEnv('RESET_CONFIRM', 60), 15 * MINUTE);
    if (limited) return limited;

    try {
        const body = await req.json();
        const parsed = resetSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.message }, { status: 400 });
        }

        const { token, password } = parsed.data;

        // PasswordResetToken has no course_id / RLS policy — keyed by token only.
        const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            return NextResponse.json(
                { error: 'This reset link is invalid or has expired. Please request a new one.' },
                { status: 400 }
            );
        }

        // Hash new password and update. The token itself is the credential
        // here (not a course session), so this bypasses course-scoped RLS.
        const passwordHash = await hashPassword(password);

        const user = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const updated = await tx.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash },
                select: { courseId: true, role: true },
            });
            await tx.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            });
            return updated;
        });

        // A password change must invalidate any session still running on the
        // old password — otherwise an attacker who is already logged in keeps
        // their access for the rest of the 30-day JWT window.
        await prisma.activeSession.deleteMany({ where: { userId: resetToken.userId } });

        // Tell the page where to send the user next; links mailed before the
        // host fix land on the root domain, which has no sign-in.
        return NextResponse.json({ success: true, loginUrl: await loginUrlForUser(user) });
    } catch (error) {
        console.error('[Reset Password API] Reset error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
