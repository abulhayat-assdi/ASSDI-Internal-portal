import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { failure } from "@/lib/incubation/http";
import { insist } from "@/lib/incubation/domain";
import { TrackGoneError, type TrackingActor } from "./server";

export const NO_STORE = { "Cache-Control": "no-store" };

export async function trackingActor(req: NextRequest): Promise<TrackingActor> {
  const user = await getSessionUser(req);
  insist(user?.courseId, "Unauthorized", 401);
  return user as TrackingActor;
}

export function ok(data: unknown) {
  return NextResponse.json(data, { headers: NO_STORE });
}

export function trackingFailure(error: unknown) {
  if (error instanceof TrackGoneError)
    return NextResponse.json(
      { stop: true, reason: error.reason, error: error.message },
      { status: 410, headers: NO_STORE },
    );
  return failure(error);
}
