export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platformSettings";
import { z } from "zod";

// Only files uploaded through /api/upload — the URL ends up in <img>/<link>
// tags on every public page, so it must not point at an arbitrary host.
const uploadedImageUrl = z
    .string()
    .max(2000)
    .regex(/^\/api\/uploads\/images\/[A-Za-z0-9_./-]+$/, "Invalid image URL")
    .refine((v) => !v.includes(".."), "Invalid image URL")
    .nullable()
    .optional();

const updateSchema = z.object({
    logoUrl: uploadedImageUrl,
    faviconUrl: uploadedImageUrl,
});

/** GET /api/saas/platform-settings — the institute's global logo and favicon (super_admin only) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ settings: await getPlatformSettings() });
}

/** PATCH /api/saas/platform-settings — set or clear the global logo/favicon (super_admin only) */
export async function PATCH(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }

    const patch: { logoUrl?: string | null; faviconUrl?: string | null } = {};
    if (parsed.data.logoUrl !== undefined) patch.logoUrl = parsed.data.logoUrl;
    if (parsed.data.faviconUrl !== undefined) patch.faviconUrl = parsed.data.faviconUrl;

    const settings = await updatePlatformSettings(patch, caller.id);
    return NextResponse.json({ settings });
}
