import type { NextRequest } from "next/server";
import { trackPositions } from "@/lib/tracking/server";
import { insist } from "@/lib/incubation/domain";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff, or the student who owns the track: ordered positions for the trail. */
export async function GET(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const trackId = req.nextUrl.searchParams.get("trackId") || "";
    insist(trackId, "trackId is required.");
    return ok(await trackPositions(actor, trackId));
  } catch (e) {
    return trackingFailure(e);
  }
}
