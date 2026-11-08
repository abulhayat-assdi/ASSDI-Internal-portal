export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, signJWT, verifyJWT, type JWTPayload } from "@/lib/auth";
import { COOKIES } from "@/lib/constants";

/** Same lifetime as a fresh login: cookie, JWT and ActiveSession all move together. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
/** A token younger than this is not re-issued (at most one DB write per half day). */
const MIN_REFRESH_AGE_MS = 12 * 60 * 60 * 1000;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * POST /api/auth/refresh — slides a still-valid session forward by another 30 days.
 *
 * Called by the portal once a day while it runs inside the ASSDI Portal Android
 * app (src/components/auth/AppSessionKeeper.tsx), so someone who keeps using the
 * app never has to pick the course and log in again. It never resurrects a dead
 * session: the normal checks (deleted/disabled account, revoked ActiveSession,
 * student marked as left) run first via getSessionUser, and an explicit logout
 * deletes both the cookie and the ActiveSession row. Impersonated sessions are
 * never extended.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIES.SESSION)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  let raw: JWTPayload & { iat?: number; exp?: number };
  try {
    raw = (await verifyJWT(token)) as JWTPayload & { iat?: number; exp?: number };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  if (raw.impersonatedBy)
    return NextResponse.json({ refreshed: false, reason: "impersonation" }, { headers: NO_STORE });

  const now = Date.now();
  const issuedAt = (raw.iat ?? 0) * 1000;
  if (now - issuedAt < MIN_REFRESH_AGE_MS)
    return NextResponse.json(
      { refreshed: false, reason: "recent", expiresAt: raw.exp ? new Date(raw.exp * 1000).toISOString() : null },
      { headers: NO_STORE },
    );

  const expiresAt = new Date(now + SESSION_MAX_AGE * 1000);
  // Only a live session row is extended; a revoked one (count 0) stays revoked.
  const updated = await prisma.activeSession.updateMany({
    where: { userId: user.id, expiresAt: { gt: new Date(now) } },
    data: { expiresAt },
  });
  if (!updated.count) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });

  // Re-sign the original claims; DB-backed fields are re-applied on every request anyway.
  const { iat, exp, sub, pg_role, ...claims } = raw;
  void [iat, exp, sub, pg_role];
  const fresh = await signJWT(claims as JWTPayload);

  const response = NextResponse.json({ refreshed: true, expiresAt: expiresAt.toISOString() }, { headers: NO_STORE });
  response.cookies.set(COOKIES.SESSION, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
