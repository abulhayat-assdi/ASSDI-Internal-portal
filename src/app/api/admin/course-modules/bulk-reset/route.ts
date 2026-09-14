export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { modulesData } from "@/data/modules";

// Resets title + description + curriculum for every module in this course that
// has a matching entry in modulesData (matched by slug first, then seedKey).
// Modules with no matching data file entry are left untouched.
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isAdmin(caller) || !caller.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const results = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const dbModules = await tx.courseModule.findMany({
            where: { courseId },
            orderBy: { order: "asc" },
        });

        const out: { slug: string; status: string }[] = [];

        for (const row of dbModules) {
            const dataKey = modulesData[row.slug] ? row.slug : modulesData[row.seedKey] ? row.seedKey : null;

            if (!dataKey) {
                out.push({ slug: row.slug, status: "skipped (no data file)" });
                continue;
            }

            const data = modulesData[dataKey];
            await tx.courseModule.update({
                where: { id: row.id, courseId },
                data: { title: data.title, description: data.description, curriculum: data.modules as unknown as Prisma.InputJsonValue },
            });

            out.push({ slug: row.slug, status: `updated from '${dataKey}'` });
        }

        return out;
    });

    return NextResponse.json({ results });
}
