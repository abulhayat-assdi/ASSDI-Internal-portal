import { NextResponse, type NextRequest } from "next/server";
import { apkDownloadPath, readAppRelease } from "@/lib/appRelease";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Latest Android release, polled by the app to offer an in-app update.
 * Public (no session): the app checks before anyone logs in. Contract:
 * docs/ANDROID_PORTAL_APP_PLAN.md, "In-app updates".
 */
export async function GET(req: NextRequest) {
  const release = await readAppRelease();
  if (!release)
    return NextResponse.json({ error: "No release published." }, { status: 404, headers: NO_STORE });
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  return NextResponse.json(
    {
      versionCode: release.versionCode,
      versionName: release.versionName,
      minVersionCode: release.minVersionCode,
      apkUrl: `${proto}://${host}${apkDownloadPath(release)}`,
      sha256: release.sha256.toLowerCase(),
      size: release.size,
      notes: release.notes,
      publishedAt: release.publishedAt ?? null,
    },
    { headers: NO_STORE },
  );
}
