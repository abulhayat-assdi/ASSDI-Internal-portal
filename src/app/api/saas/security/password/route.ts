export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।"),
});

/** POST — change own super-admin password (must know the current one) */
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }

    const ok = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const me = await tx.user.findUnique({ where: { id: caller.id } });
        if (!me) return false;
        const valid = await bcrypt.compare(parsed.data.currentPassword, me.passwordHash);
        if (!valid) return "wrong";
        await tx.user.update({
            where: { id: caller.id },
            data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
        });
        return true;
    });

    if (ok === "wrong") return NextResponse.json({ error: "বর্তমান পাসওয়ার্ড ভুল।" }, { status: 401 });
    if (!ok) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ success: true });
}
