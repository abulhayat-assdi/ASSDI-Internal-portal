import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  raw: {} as Record<string, unknown>,
  verifyThrows: false,
  updateCount: 1,
  updateMany: vi.fn(),
  signJWT: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    activeSession: {
      updateMany: (args: unknown) => {
        mocks.updateMany(args);
        return Promise.resolve({ count: mocks.updateCount });
      },
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getSessionUser: async () => mocks.user,
  verifyJWT: async () => {
    if (mocks.verifyThrows) throw new Error("bad");
    return mocks.raw;
  },
  signJWT: async (claims: unknown) => {
    mocks.signJWT(claims);
    return "fresh-token";
  },
}));

import { POST } from "./route";

const HOUR = 3600;
const nowSec = () => Math.floor(Date.now() / 1000);
const req = (cookie?: string) =>
  new NextRequest("https://demo.tasm-skill.asf.bd/api/auth/refresh", {
    method: "POST",
    headers: cookie ? { cookie: `__session=${cookie}` } : {},
  });

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    mocks.user = { id: "u1", role: "student", courseId: "c1" };
    mocks.raw = {
      id: "u1",
      role: "student",
      courseId: "c1",
      email: "s@x",
      displayName: "S",
      sub: "u1",
      pg_role: "authenticated",
      iat: nowSec() - 20 * HOUR,
      exp: nowSec() + 10 * 24 * HOUR,
    };
    mocks.verifyThrows = false;
    mocks.updateCount = 1;
    mocks.updateMany.mockClear();
    mocks.signJWT.mockClear();
  });

  it("rejects a request without a session cookie", async () => {
    const r = await POST(req());
    expect(r.status).toBe(401);
  });

  it("rejects a session the normal checks no longer honour", async () => {
    mocks.user = null;
    const r = await POST(req("old"));
    expect(r.status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("never extends an impersonated session", async () => {
    mocks.raw.impersonatedBy = "root@x";
    const r = await POST(req("tok"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ refreshed: false, reason: "impersonation" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("does not re-issue a token younger than 12 hours", async () => {
    mocks.raw.iat = nowSec() - 2 * HOUR;
    const r = await POST(req("tok"));
    expect(await r.json()).toMatchObject({ refreshed: false, reason: "recent" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("slides an older live session by 30 days and sets a fresh cookie", async () => {
    const r = await POST(req("tok"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.refreshed).toBe(true);
    const days = (Date.parse(body.expiresAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    // Only a live row is touched.
    const where = mocks.updateMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    // Original claims are re-signed without the old iat/exp/sub/pg_role.
    const claims = mocks.signJWT.mock.calls[0][0];
    expect(claims).toMatchObject({ id: "u1", role: "student", courseId: "c1" });
    expect(claims).not.toHaveProperty("iat");
    expect(claims).not.toHaveProperty("exp");
    const cookie = r.headers.get("set-cookie") || "";
    expect(cookie).toContain("__session=fresh-token");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie).toContain("Max-Age=2592000");
  });

  it("does not resurrect a revoked session row", async () => {
    mocks.updateCount = 0;
    const r = await POST(req("tok"));
    expect(r.status).toBe(401);
    expect(mocks.signJWT).not.toHaveBeenCalled();
  });
});
