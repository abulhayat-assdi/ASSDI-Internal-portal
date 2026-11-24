import type { NextRequest } from "next/server";
import { dayReport } from "@/lib/tracking/server";
import { insist } from "@/lib/incubation/domain";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff: per-student distance, stops and time out for one Dhaka day (default today). */
export async function GET(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const q = req.nextUrl.searchParams;
    const competitionId = q.get("competitionId") || "";
    insist(competitionId, "competitionId is required.");
    return ok(await dayReport(actor, competitionId, q.get("date")));
  } catch (e) {
    return trackingFailure(e);
  }
}
