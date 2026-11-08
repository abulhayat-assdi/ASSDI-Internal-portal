import type { NextRequest } from "next/server";
import { liveTracks } from "@/lib/tracking/server";
import { insist } from "@/lib/incubation/domain";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff: open tracks plus those ended in the last 12 h for one competition. */
export async function GET(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const competitionId = req.nextUrl.searchParams.get("competitionId") || "";
    insist(competitionId, "competitionId is required.");
    return ok(await liveTracks(actor, competitionId));
  } catch (e) {
    return trackingFailure(e);
  }
}
