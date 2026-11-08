import type { NextRequest } from "next/server";
import { z } from "zod";
import { stopTrack } from "@/lib/tracking/server";
import { ok, trackingActor, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The owning student, or staff, ends a track and revokes its token. */
export async function POST(req: NextRequest) {
  try {
    const actor = await trackingActor(req);
    const { trackId } = z
      .object({ trackId: z.string().min(1).max(100) })
      .parse(await req.json());
    return ok(await stopTrack(actor, trackId));
  } catch (e) {
    return trackingFailure(e);
  }
}
