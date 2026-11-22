import { NextResponse } from "next/server";

// Menu entry for students: hand over to the launcher, which checks access and signs them in.
export function GET() {
  return new NextResponse(null, { status: 302, headers: { Location: "/api/pronunciation/launch", "Cache-Control": "no-store" } });
}
