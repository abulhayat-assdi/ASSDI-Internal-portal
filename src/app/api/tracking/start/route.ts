import type { NextRequest } from "next/server";
import { z } from "zod";
import { requestOrigin } from "@/lib/tracking/core";
import { startCompetitionTrack } from "@/lib/tracking/server";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Student starts field tracking for a (non-incubation) competition. */
export async function POST(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const { competitionId } = z
      .object({ competitionId: z.string().min(1).max(100) })
      .parse(await req.json());
    return ok(
      await startCompetitionTrack(actor, competitionId, requestOrigin(req.headers)),
    );
  } catch (e) {
    return trackingFailure(e);
  }
}
