import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runIncubationReminders } from "@/lib/incubation/reminders";
export const dynamic = "force-dynamic";
/** Daily Business Incubation reminders (in-app + email). Needs x-cron-secret. */
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
    return NextResponse.json(await runIncubationReminders());
  } catch (error) {
    console.error("[incubation] reminders failed:", error);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
