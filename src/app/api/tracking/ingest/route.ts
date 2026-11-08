import { NextResponse, type NextRequest } from "next/server";
import { bearerToken } from "@/lib/tracking/core";
import { ingest } from "@/lib/tracking/server";
import { NO_STORE, ok, trackingFailure } from "@/lib/tracking/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;

/**
 * Location batches from the Android app. Authenticated only by the per-track
 * bearer token (no cookie); listed as a public route in src/middleware.ts.
 */
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") || 0) > MAX_BYTES)
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: NO_STORE },
      );
    const token = bearerToken(req.headers.get("authorization"));
    if (!token)
      return NextResponse.json(
        { error: "Missing or invalid token." },
        { status: 401, headers: NO_STORE },
      );
    const raw = await req.text();
    if (raw.length > MAX_BYTES)
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: NO_STORE },
      );
    return ok(await ingest(token, JSON.parse(raw)));
  } catch (e) {
    return trackingFailure(e);
  }
}
