import { describe, it, expect, vi } from "vitest";
import {
  autoCheckoutAt,
  autoCheckoutStale,
  isAutoCheckoutDue,
  AUTO_CHECKOUT_ACTOR,
} from "./auto-checkout";

// Dhaka wall-clock time -> instant (Asia/Dhaka is a fixed UTC+6).
const dhaka = (s: string) => new Date(`${s}+06:00`);

describe("autoCheckoutAt", () => {
  it("is 23:00 Dhaka of the check-in day", () => {
    expect(autoCheckoutAt(dhaka("2026-11-24T09:15:00")).toISOString()).toBe(
      "2026-11-24T17:00:00.000Z",
    );
    expect(autoCheckoutAt(dhaka("2026-11-24T22:59:59")).toISOString()).toBe(
      dhaka("2026-11-24T23:00:00").toISOString(),
    );
  });
  it("uses the Dhaka day, not the UTC day", () => {
    // 01:30 Dhaka on the 25th is still the 24th in UTC.
    expect(autoCheckoutAt(dhaka("2026-11-25T01:30:00")).toISOString()).toBe(
      dhaka("2026-11-25T23:00:00").toISOString(),
    );
    expect(autoCheckoutAt(dhaka("2026-11-25T00:00:00")).toISOString()).toBe(
      dhaka("2026-11-25T23:00:00").toISOString(),
    );
  });
  it("moves a check-in at or after 23:00 to the next day's 23:00", () => {
    expect(autoCheckoutAt(dhaka("2026-11-24T23:00:00")).toISOString()).toBe(
      dhaka("2026-11-25T23:00:00").toISOString(),
    );
    expect(autoCheckoutAt(dhaka("2026-11-24T23:45:00")).toISOString()).toBe(
      dhaka("2026-11-25T23:00:00").toISOString(),
    );
  });
  it("handles month and year ends", () => {
    expect(autoCheckoutAt(dhaka("2026-12-31T23:30:00")).toISOString()).toBe(
      dhaka("2027-01-01T23:00:00").toISOString(),
    );
  });
  it("is due only once the cut-off has passed", () => {
    const checkIn = dhaka("2026-11-24T10:00:00");
    expect(isAutoCheckoutDue(checkIn, dhaka("2026-11-24T22:59:59"))).toBe(false);
    expect(isAutoCheckoutDue(checkIn, dhaka("2026-11-24T23:00:00"))).toBe(true);
    expect(isAutoCheckoutDue(checkIn, dhaka("2026-11-27T08:00:00"))).toBe(true);
  });
});

type S = {
  id: string;
  courseId: string;
  programId: string;
  userId: string;
  userName: string;
  checkIn: Date;
  checkOut: Date | null;
  startAreaId: string;
  endAreaId: string | null;
  version: number;
  autoCheckout: boolean;
  program: { settings: unknown };
};
function fakeTx(sessions: S[]) {
  const audits: any[] = [],
    trackEnds: any[] = [];
  const tx = {
    incubationFieldSession: {
      findMany: vi.fn(async ({ where }: any) =>
        sessions
          .filter(
            (s) =>
              s.checkOut === null &&
              (!where.userId || s.userId === where.userId) &&
              (!where.id || s.id === where.id) &&
              s.checkIn <= where.checkIn.lte,
          )
          .map((s) => ({ ...s })),
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const s = sessions.find(
          (s) => s.id === where.id && s.checkOut === null && s.version === where.version,
        );
        if (!s) return { count: 0 };
        Object.assign(s, {
          checkOut: data.checkOut,
          endAreaId: data.endAreaId,
          autoCheckout: data.autoCheckout,
          version: s.version + data.version.increment,
        });
        return { count: 1 };
      }),
    },
    fieldTrack: {
      // One open track per field session, found first, then ended and summarised.
      findMany: vi.fn(async ({ where }: any) => [{ id: `track-${where.incubationSessionId}`, where }]),
      updateMany: vi.fn(async (args: any) => {
        trackEnds.push(args);
        return { count: 1 };
      }),
      update: vi.fn(async () => ({})),
    },
    fieldTrackPosition: { findMany: vi.fn(async () => []) },
    incubationAudit: {
      create: vi.fn(async ({ data }: any) => {
        audits.push(data);
        return data;
      }),
    },
  };
  return { tx: tx as any, audits, trackEnds };
}
const session = (over: Partial<S>): S => ({
  id: "s1",
  courseId: "c1",
  programId: "p1",
  userId: "u1",
  userName: "Student",
  checkIn: dhaka("2026-11-24T10:00:00"),
  checkOut: null,
  startAreaId: "area-1",
  endAreaId: null,
  version: 1,
  autoCheckout: false,
  program: { settings: { maxFieldHours: null } },
  ...over,
});

describe("autoCheckoutStale", () => {
  it("closes a forgotten session at 23:00 of its day, even when run much later", async () => {
    const sessions = [session({})];
    const { tx, audits, trackEnds } = fakeTx(sessions);
    const closed = await autoCheckoutStale(tx, {}, dhaka("2026-11-26T07:00:00"));
    expect(closed).toHaveLength(1);
    expect(sessions[0].checkOut?.toISOString()).toBe(dhaka("2026-11-24T23:00:00").toISOString());
    expect(sessions[0].autoCheckout).toBe(true);
    expect(sessions[0].endAreaId).toBe("area-1");
    expect(sessions[0].version).toBe(2);
    expect(trackEnds[0]).toEqual({
      where: { id: { in: ["track-s1"] }, endedAt: null },
      data: {
        endedAt: sessions[0].checkOut,
        endReason: "auto_checkout",
        tokenRevokedAt: sessions[0].checkOut,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "field.auto_checkout",
      entityId: "s1",
      courseId: "c1",
      programId: "p1",
      actorId: AUTO_CHECKOUT_ACTOR.id,
      after: { autoCheckout: true, overLimit: false },
    });
  });

  it("leaves sessions whose cut-off has not passed", async () => {
    const sessions = [session({ checkIn: dhaka("2026-11-24T23:10:00") })];
    const { tx, audits } = fakeTx(sessions);
    expect(await autoCheckoutStale(tx, {}, dhaka("2026-11-25T08:00:00"))).toEqual([]);
    expect(sessions[0].checkOut).toBeNull();
    expect(audits).toHaveLength(0);
  });

  it("is idempotent: a second run closes nothing more", async () => {
    const sessions = [session({})];
    const { tx, audits } = fakeTx(sessions);
    const now = dhaka("2026-11-24T23:05:00");
    await autoCheckoutStale(tx, {}, now);
    expect(await autoCheckoutStale(tx, {}, now)).toEqual([]);
    expect(audits).toHaveLength(1);
  });

  it("loses the race gracefully when the session was checked out meanwhile", async () => {
    const sessions = [session({})];
    const { tx, audits, trackEnds } = fakeTx(sessions);
    // Simulate a manual check-out landing between the read and the guarded update.
    tx.incubationFieldSession.updateMany.mockImplementationOnce(async () => ({ count: 0 }));
    expect(await autoCheckoutStale(tx, {}, dhaka("2026-11-24T23:05:00"))).toEqual([]);
    expect(audits).toHaveLength(0);
    expect(trackEnds).toHaveLength(0);
  });

  it("flags sessions over the configured max field hours for review", async () => {
    const sessions = [
      session({ id: "long", program: { settings: { maxFieldHours: 8 } } }),
      session({
        id: "short",
        userId: "u2",
        checkIn: dhaka("2026-11-24T18:00:00"),
        program: { settings: { maxFieldHours: 8 } },
      }),
    ];
    const { tx, audits } = fakeTx(sessions);
    const closed = await autoCheckoutStale(tx, {}, dhaka("2026-11-24T23:01:00"));
    expect(closed.map((c) => [c.id, c.overLimit])).toEqual([
      ["long", true],
      ["short", false],
    ]);
    expect(audits[0].reason).toMatch(/review required/);
    expect(audits[1].reason).not.toMatch(/review required/);
  });

  it("only touches the scoped user", async () => {
    const sessions = [session({}), session({ id: "s2", userId: "u2" })];
    const { tx } = fakeTx(sessions);
    const closed = await autoCheckoutStale(tx, { userId: "u2" }, dhaka("2026-11-25T09:00:00"));
    expect(closed.map((c) => c.id)).toEqual(["s2"]);
    expect(sessions[0].checkOut).toBeNull();
  });
});
