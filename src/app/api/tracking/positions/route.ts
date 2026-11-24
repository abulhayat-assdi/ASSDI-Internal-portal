import type { NextRequest } from "next/server";
import { dayPositions, trackPositions } from "@/lib/tracking/server";
import { insist } from "@/lib/incubation/domain";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Staff, or the student who owns the track: ordered positions for the trail.
 * ?trackId=… for one session, or ?competitionId=…&userId=…&date=YYYY-MM-DD for a whole day.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const q = req.nextUrl.searchParams;
    const trackId = q.get("trackId") || "";
    if (trackId) return ok(await trackPositions(actor, trackId));
    const competitionId = q.get("competitionId") || "";
    insist(competitionId, "trackId or competitionId is required.");
    return ok(await dayPositions(actor, competitionId, q.get("userId") || "", q.get("date")));
  } catch (e) {
    return trackingFailure(e);
  }
}
