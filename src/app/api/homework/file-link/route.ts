import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { submissionAccess } from "@/lib/homeworkAccess";
import { FILE_LINK_TTL_SECONDS, signHomeworkFileLink, submissionFilePath } from "@/lib/homeworkFileLink";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/homework/file-link — { submissionId, fileIndex }
 * → { url, expiresAt }: a 60-minute public link to that one file, for the
 * Microsoft Office Online viewer. Only someone who may view the submission
 * can mint one.
 */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const courseId = user.courseId;

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
    const fileIndex = Number.isInteger(body?.fileIndex) ? body.fileIndex : 0;
    if (!submissionId) return NextResponse.json({ error: "submissionId required" }, { status: 400 });

    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const sub = await tx.homeworkSubmission.findFirst({ where: { id: submissionId, courseId, deletedAt: null } });
            if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
            const access = await submissionAccess(tx, user, sub);
            if (!access.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

            const files = Array.isArray(sub.files) && sub.files.length
                ? (sub.files as { storagePath?: string; url?: string; fileName?: string }[])
                : [{ storagePath: sub.storagePath ?? "", url: sub.fileUrl ?? "", fileName: sub.fileName ?? "" }];
            const file = files[fileIndex];
            if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
            const stored = submissionFilePath(file, sub.studentUid);
            if (!stored) return NextResponse.json({ error: "This attachment has an invalid storage location." }, { status: 400 });

            const token = await signHomeworkFileLink(stored);
            // The viewer picks the renderer from the URL's extension, so the
            // link ends with the real file name.
            const name = encodeURIComponent(path.posix.basename(stored));
            const proto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
            const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host).split(",")[0].trim();
            return NextResponse.json({
                url: `${proto}://${host}/api/file/shared/${token}/${name}`,
                expiresAt: new Date(Date.now() + FILE_LINK_TTL_SECONDS * 1000).toISOString(),
            });
        });
    } catch (error) {
        console.error("[Homework file-link]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
