import { NextResponse } from "next/server";

// Menu entry for staff (Trainer or Admin permission): the launcher decides the role.
export function GET() {
  return new NextResponse(null, { status: 302, headers: { Location: "/api/pronunciation/launch?as=staff", "Cache-Control": "no-store" } });
}
