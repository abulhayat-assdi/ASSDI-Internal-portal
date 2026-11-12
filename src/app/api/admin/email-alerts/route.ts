export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { isMailConfigured, paragraphs, renderEmail, sendMail } from "@/lib/mailer";
import { EMAIL_NOTIFICATIONS_FEATURE } from "@/lib/notifications";
import { rateLimit, HOUR } from "@/lib/rateLimit";
import {
    emailAlertSettingsSchema,
    getEmailAlertSettings,
    saveEmailAlertSettings,
} from "@/lib/emailAlerts/settings";

/** Recipients of leave alerts are part of leave management, so it sits with that permission. */
function canManage(user: Parameters<typeof isAdmin>[0]) {
    return isAdmin(user) || hasRequiredPermission(user, "admin_leave");
}

/**
 * GET /api/admin/email-alerts?kind=&limit=
 * Settings, whether mail can go out at all, and the recent email log.
 */
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canManage(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const params = new URL(req.url).searchParams;
    const kind = params.get("kind") || undefined;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 500);

    const [settings, course, logs] = await Promise.all([
        getEmailAlertSettings(courseId),
        withCourseContext({ courseId, isSuperAdmin: true }, (tx) =>
            tx.course.findUnique({ where: { id: courseId }, select: { settings: true } })
        ),
        withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.emailLog.findMany({
                where: { courseId, ...(kind ? { kind } : {}) },
                orderBy: { createdAt: "desc" },
                take: limit,
                select: { id: true, kind: true, recipients: true, subject: true, status: true, error: true, createdAt: true },
            })
        ),
    ]);

    return NextResponse.json({
        settings,
        mailConfigured: isMailConfigured(),
        featureEnabled: isFeatureEnabled(course?.settings, EMAIL_NOTIFICATIONS_FEATURE),
        logs,
    });
}

/** PUT /api/admin/email-alerts — save the settings. */
export async function PUT(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canManage(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = emailAlertSettingsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    await saveEmailAlertSettings(user.courseId, parsed.data, user.id);
    return NextResponse.json({ settings: parsed.data });
}

const testSchema = z.object({ to: z.string().trim().toLowerCase().email("ইমেইল ঠিকানা সঠিক নয়") });

/** POST /api/admin/email-alerts — send a test email to one address. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId || !canManage(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isMailConfigured()) {
        return NextResponse.json({ error: "সার্ভারে SMTP সেট করা নেই।" }, { status: 400 });
    }
    if (!rateLimit(`email-alert-test:${user.id}`, 10, HOUR).ok) {
        return NextResponse.json({ error: "অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন।" }, { status: 429 });
    }
    const parsed = testSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ইনপুট সঠিক নয়।" }, { status: 400 });
    }

    const courseId = user.courseId;
    const course = await withCourseContext({ courseId, isSuperAdmin: true }, (tx) =>
        tx.course.findUnique({ where: { id: courseId }, select: { name: true } })
    );
    const courseName = course?.name ?? "Portal";
    try {
        await sendMail({
            courseName,
            to: [parsed.data.to],
            subject: "টেস্ট ইমেইল — Email Alerts",
            html: renderEmail({
                courseName,
                heading: "টেস্ট ইমেইল",
                bodyHtml: paragraphs("এই মেইলটি পেলে বুঝবেন পোর্টাল থেকে ইমেইল ঠিকমতো যাচ্ছে।"),
            }),
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            { error: `পাঠানো যায়নি: ${error instanceof Error ? error.message : "unknown error"}` },
            { status: 502 }
        );
    }
}
