import { describe, it, expect, beforeAll, vi } from "vitest";
import { jwtVerify, decodeJwt, decodeProtectedHeader } from "jose";

// launch.ts pulls in the DB/course helpers; the parts tested here never touch them.
vi.mock("@/lib/db", () => ({ withCourseContext: vi.fn(), prisma: {} }));
vi.mock("@/lib/course", () => ({ extractCourseSlug: vi.fn(), getCourseBySlug: vi.fn(), isCourseUsable: vi.fn() }));

const SECRET = "test-secret-that-is-at-least-32-characters-long";

beforeAll(() => {
  process.env.PRONUNCIATION_SSO_SECRET = SECRET;
});

describe("pronunciation launch token (spec §4)", () => {
  it("carries exactly the agreed claims and is HS256, 60 s, single-use id", async () => {
    const { signLaunchToken } = await import("./launch");
    const now = Date.UTC(2026, 10, 22, 6, 0, 0);
    const token = await signLaunchToken(
      { sub: "u-1", course_id: "c-1", role: "trainee", name: "রহিম", email: "r@x.test", mobile: "01711000000", batch: "Batch-01", roll: "7" },
      now,
    );
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
    const claims = decodeJwt(token);
    expect(claims).toMatchObject({
      iss: "asm-portal", aud: "pronunciation", sub: "u-1", course_id: "c-1", role: "trainee",
      name: "রহিম", email: "r@x.test", mobile: "01711000000", batch: "Batch-01", roll: "7",
    });
    expect(claims.exp! - claims.iat!).toBe(60);
    expect(typeof claims.jti).toBe("string");
    await expect(
      jwtVerify(token, new TextEncoder().encode(SECRET), { issuer: "asm-portal", audience: "pronunciation", currentDate: new Date(now) }),
    ).resolves.toBeTruthy();
  });

  it("leaves out optional claims that are empty and gives every token its own jti", async () => {
    const { signLaunchToken } = await import("./launch");
    const a = decodeJwt(await signLaunchToken({ sub: "s", course_id: "c", role: "admin", name: "n", email: "e" }));
    const b = decodeJwt(await signLaunchToken({ sub: "s", course_id: "c", role: "admin", name: "n", email: "e" }));
    expect(a).not.toHaveProperty("mobile");
    expect(a).not.toHaveProperty("batch");
    expect(a.jti).not.toBe(b.jti);
  });

  it("refuses to sign with a missing or short secret", async () => {
    const { signLaunchToken } = await import("./launch");
    process.env.PRONUNCIATION_SSO_SECRET = "short";
    await expect(signLaunchToken({ sub: "s", course_id: "c", role: "trainee", name: "n", email: "e" })).rejects.toThrow(/PRONUNCIATION_SSO_SECRET/);
    process.env.PRONUNCIATION_SSO_SECRET = SECRET;
  });
});

describe("pronunciation role mapping", () => {
  it("students are trainees; staff need a Pronunciation permission; admin wins over trainer", async () => {
    const { pronunciationRoleFor } = await import("./launch");
    const base = { id: "u", email: "e", displayName: "n", courseId: "c" };
    expect(pronunciationRoleFor({ ...base, role: "student" })).toBe("trainee");
    expect(pronunciationRoleFor({ ...base, role: "teacher", permissions: [] })).toBeNull();
    expect(pronunciationRoleFor({ ...base, role: "teacher", permissions: ["pronunciation_trainer"] })).toBe("trainer");
    expect(pronunciationRoleFor({ ...base, role: "admin", permissions: ["pronunciation_trainer", "pronunciation_admin"] })).toBe("admin");
    expect(pronunciationRoleFor({ ...base, role: "admin", permissions: ["crm_admin"] })).toBeNull();
  });
});
