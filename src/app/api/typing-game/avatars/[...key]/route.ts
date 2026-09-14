import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequestOrBearer } from "@/lib/auth";
import { R2KeyError, parseR2Key } from "@/lib/typing-game/r2/keys";
import { isSignable } from "@/lib/typing-game/r2/visibility";
import { mimeTypeFor, readPrivateAsset } from "@/lib/typing-game/server/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/typing-game/avatars/[...key]
 *
 * Replaces the source project's `GET /api/r2/signed-url` (Cloudflare R2
 * presigned download URLs) now that avatars are plain files on the shared
 * local-storage volume instead of R2 objects. Same access rule as upstream:
 * any authenticated ASM user may read any avatar (avatars are
 * private-from-the-public-internet, not private-between-students) — see
 * `src/lib/typing-game/r2/visibility.ts`'s `SIGNABLE_PREFIXES`. Path shape
 * mirrors ASM's own `src/app/api/uploads/[...path]/route.ts`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const sessionUser = await getSessionUserFromRequestOrBearer(request);
  if (!sessionUser) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });
  }

  const { key: segments } = await params;
  const rawKey = ["avatars", ...segments].join("/");

  try {
    const key = parseR2Key(rawKey);
    if (!isSignable(key)) {
      return NextResponse.json({ error: "INVALID_KEY", message: "File not available" }, { status: 400 });
    }
    const data = await readPrivateAsset(key);
    if (!data) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mimeTypeFor(key),
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    if (err instanceof R2KeyError) {
      return NextResponse.json({ error: "INVALID_KEY", message: "File not available" }, { status: 400 });
    }
    console.error("[typing-game/avatars] Error:", err);
    return NextResponse.json({ error: "READ_FAILED", message: "Storage unavailable" }, { status: 500 });
  }
}
