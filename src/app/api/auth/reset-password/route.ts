export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { prisma, withCourseContext } from '@/lib/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const requestSchema = z.object({
    email: z.string().email(),
});

const resetSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const TOKEN_EXPIRY_HOURS = 2;

function getTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || '';
    const rawPass = process.env.SMTP_PASS || '';
    const pass = rawPass.replace(/\s+/g, '');

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
}

/**
 * POST /api/auth/reset-password
 * Body: { email }
 * Sends a password reset email with a time-limited token.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = requestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const { email } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

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

        const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

        // Send email
        const transporter = getTransporter();
        const smtpUser = process.env.SMTP_USER || '';
        const defaultFrom = `"ASM Portal" <${smtpUser}>`;
        let fromAddress = process.env.SMTP_FROM || defaultFrom;

        // Gmail SMTP requires the sender address to match the authenticated user
        if (process.env.SMTP_HOST?.includes('gmail.com') && smtpUser && !fromAddress.includes(smtpUser)) {
            fromAddress = defaultFrom;
        }

        try {
            await transporter.sendMail({
                from: fromAddress,
                to: user.email,
                subject: 'Reset Your ASM Portal Password',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1a1a2e;">Password Reset Request</h2>
                        <p>Hello ${user.displayName},</p>
                        <p>We received a request to reset your ASM Internal Portal password.</p>
                        <p>Click the button below to set a new password. This link expires in <strong>${TOKEN_EXPIRY_HOURS} hours</strong>.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="
                                background-color: #059669;
                                color: white;
                                padding: 12px 32px;
                                text-decoration: none;
                                border-radius: 6px;
                                font-size: 16px;
                                display: inline-block;
                            ">Reset Password</a>
                        </div>
                        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="color: #999; font-size: 12px;">ASM Internal Portal &mdash; This is an automated message.</p>
                    </div>
                `,
            });
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
        const passwordHash = await bcrypt.hash(password, 12);

        await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            await tx.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash },
            });
            await tx.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Reset Password API] Reset error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
