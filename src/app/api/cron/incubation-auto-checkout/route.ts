import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAutoCheckout } from "@/lib/incubation/auto-checkout";
export const dynamic = "force-dynamic";
/**
 * Closes Business Incubation field sessions still open after 23:00 Asia/Dhaka of their
 * check-in day; checkOut is stored as that 23:00. Idempotent. Needs x-cron-secret.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "",
    given = req.headers.get("x-cron-secret") || "";
  if (
    secret.length < 16 ||
    Buffer.byteLength(secret) !== Buffer.byteLength(given) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(given))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runAutoCheckout());
  } catch (error) {
    console.error("[incubation] auto checkout failed:", error);
    return NextResponse.json({ error: "Auto checkout failed" }, { status: 500 });
  }
}
