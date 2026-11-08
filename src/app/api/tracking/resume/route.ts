import type { NextRequest } from "next/server";
import { z } from "zod";
import { requestOrigin } from "@/lib/tracking/core";
import { resumeTrack } from "@/lib/tracking/server";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Not in the original contract (addition): re-issues the token of the student's own
 * open track so the app can pick it up again (reinstall, or started from a browser).
 * Body {trackId} or {incubationSessionId} (the student's open incubation track).
 * Same response shape as /api/tracking/start.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const target = z
      .object({
        trackId: z.string().min(1).max(100).optional(),
        incubationSessionId: z.string().min(1).max(100).optional(),
      })
      .parse(await req.json());
    return ok(await resumeTrack(actor, target, requestOrigin(req.headers)));
  } catch (e) {
    return trackingFailure(e);
  }
}
