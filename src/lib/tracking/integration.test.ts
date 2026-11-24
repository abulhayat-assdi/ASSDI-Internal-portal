import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startIncubationTestDatabase } from "../../../test/incubation-database";
import type { TrackingActor } from "./server";

let fixture: Awaited<ReturnType<typeof startIncubationTestDatabase>>,
  prisma: (typeof import("@/lib/db"))["prisma"],
  tracking: typeof import("./server");

const student: TrackingActor = {
  id: "stu",
  email: "stu@test.local",
  displayName: "Student",
  role: "student",
  courseId: "course-t",
};
const other: TrackingActor = { ...student, id: "other", email: "other@test.local" };
const staff: TrackingActor = {
  id: "staff",
  email: "staff@test.local",
  displayName: "Staff",
  role: "admin",
  courseId: "course-t",
  permissions: ["admin_competitions"],
};
const ORIGIN = "https://demo.tasm-skill.asf.bd";
const fix = (offsetSec: number, extra: Record<string, unknown> = {}) => ({
  latitude: 23.81,
  longitude: 90.41,
  accuracy: 12,
  capturedAt: new Date(Date.now() + offsetSec * 1000).toISOString(),
  ...extra,
});

beforeAll(async () => {
  fixture = await startIncubationTestDatabase(61000 + (process.pid % 3000));
  process.env.DATABASE_URL = fixture.url;
  prisma = (await import("@/lib/db")).prisma;
  tracking = await import("./server");
  await prisma.course.create({
    data: {
      id: "course-t",
      slug: "tracking",
      name: "Tracking",
      settings: { features: { competitions: true, business_incubation: true } },
    },
  });
  await prisma.batch.create({ data: { id: "b1", courseId: "course-t", name: "B1" } });
  for (const [id, roll] of [
    ["stu", "1"],
    ["other", "2"],
  ]) {
    await prisma.user.create({
      data: {
        id,
        courseId: "course-t",
        email: `${id}@test.local`,
        displayName: id,
        passwordHash: "unused",
        role: "student",
        studentBatchName: "B1",
        studentRoll: roll,
      },
    });
    await prisma.batchStudent.create({
      data: { id: `s-${id}`, courseId: "course-t", batchId: "b1", batchName: "B1", roll, name: `Name ${id}` },
    });
  }
  await prisma.competitionGroup.create({
    data: { courseId: "course-t", batchName: "B1", groupName: "Team Alpha", members: [{ roll: "1", name: "Name stu", role: "leader" }] },
  });
  const base = { courseId: "course-t", schema: [], startDate: new Date(Date.now() - 3600000) };
  await prisma.competition.createMany({
    data: [
      { ...base, id: "c-track", title: "Field Sales", batchName: "B1", trackingEnabled: true, trackingIntervalSeconds: 45 },
      { ...base, id: "c-two", title: "Second", batchName: "B1", trackingEnabled: true },
      { ...base, id: "c-off", title: "No tracking", batchName: "B1" },
      { ...base, id: "c-other", title: "Other batch", batchName: "B2", trackingEnabled: true },
      { ...base, id: "c-ended", title: "Ended", batchName: "B1", trackingEnabled: true, endDate: new Date(Date.now() - 60000) },
      { ...base, id: "c-inc", title: "Incubation", batchName: null, kind: "business_incubation", trackingEnabled: true },
    ],
  });
}, 120000);
afterAll(async () => {
  await prisma?.$disconnect();
  await fixture?.stop();
});

describe("competition field tracking", () => {
  it("refuses competitions that are not trackable for this student", async () => {
    const status = (id: string) =>
      tracking.startCompetitionTrack(student, id, ORIGIN).then(
        () => 200,
        (e) => e.status,
      );
    expect(await status("c-off")).toBe(409);
    expect(await status("c-ended")).toBe(409);
    expect(await status("c-other")).toBe(403);
    expect(await status("c-inc")).toBe(409);
    expect(await status("missing")).toBe(404);
    await expect(tracking.startCompetitionTrack(staff, "c-track", ORIGIN)).rejects.toMatchObject({ status: 403 });
  });

  it("starts, ingests with dedupe and window, and serves live data and trails", async () => {
    const started = await tracking.startCompetitionTrack(student, "c-track", ORIGIN);
    expect(started.ingestUrl).toBe(ORIGIN + "/api/tracking/ingest");
    expect(started.intervalSeconds).toBe(45);
    expect(started.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await prisma.fieldTrack.findUniqueOrThrow({ where: { id: started.track.id } });
    expect(row.tokenHash).not.toBe(started.token);
    expect(row.label).toBe("Team Alpha");
    expect(row.userName).toBe("Name stu");

    const a = fix(-30, { battery: 77 }),
      b = fix(-10, { battery: 76, speed: 1.2 });
    const first = await tracking.ingest(started.token, {
      trackId: started.track.id,
      positions: [a, b, b, fix(-3 * 3600)],
    });
    expect(first).toEqual({ accepted: 2, duplicates: 1, rejected: 1 });
    const again = await tracking.ingest(started.token, { trackId: started.track.id, positions: [a] });
    expect(again).toEqual({ accepted: 0, duplicates: 1, rejected: 0 });

    // A wrong trackId or an unknown token is 401.
    await expect(tracking.ingest(started.token, { trackId: "nope", positions: [a] })).rejects.toMatchObject({ status: 401 });
    await expect(
      tracking.ingest("x".repeat(43), { trackId: started.track.id, positions: [a] }),
    ).rejects.toMatchObject({ status: 401 });

    const live = await tracking.liveTracks(staff, "c-track");
    expect(live.tracks).toHaveLength(1);
    expect(live.tracks[0]).toMatchObject({
      userName: "Name stu",
      batchName: "B1",
      label: "Team Alpha",
      battery: 76,
      stale: false,
      status: "fresh",
    });
    expect(live.tracks[0].lastPosition?.capturedAt?.toISOString()).toBe(b.capturedAt);
    await expect(tracking.liveTracks(student, "c-track")).rejects.toMatchObject({ status: 403 });

    const trail = await tracking.trackPositions(student, started.track.id);
    expect(trail.positions.map((p) => p.capturedAt.toISOString())).toEqual([a.capturedAt, b.capturedAt]);
    await expect(tracking.trackPositions(other, started.track.id)).rejects.toMatchObject({ status: 403 });
    expect((await tracking.trackPositions(staff, started.track.id)).positions).toHaveLength(2);
  });

  it("closes the previous open track, stops with 410 afterwards and resumes with a new token", async () => {
    const first = await prisma.fieldTrack.findFirstOrThrow({ where: { userId: "stu", endedAt: null } });
    const second = await tracking.startCompetitionTrack(student, "c-two", ORIGIN);
    const old = await prisma.fieldTrack.findUniqueOrThrow({ where: { id: first.id } });
    expect(old.endReason).toBe("replaced");
    expect(old.tokenRevokedAt).not.toBeNull();

    const resumed = await tracking.resumeTrack(student, { trackId: second.track.id }, ORIGIN);
    expect(resumed.token).not.toBe(second.token);
    await expect(
      tracking.ingest(second.token, { trackId: second.track.id, positions: [fix(-1)] }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(tracking.resumeTrack(other, { trackId: second.track.id }, ORIGIN)).rejects.toMatchObject({ status: 404 });

    await expect(tracking.stopTrack(other, second.track.id)).rejects.toMatchObject({ status: 403 });
    const stopped = await tracking.stopTrack(student, second.track.id);
    expect(stopped.track.endReason).toBe("stopped");
    await expect(
      tracking.ingest(resumed.token, { trackId: second.track.id, positions: [fix(-1)] }),
    ).rejects.toMatchObject({ status: 410, reason: "ended" });
  });

  it("ends a track whose token has expired on the next upload", async () => {
    const t = await tracking.startCompetitionTrack(other, "c-track", ORIGIN);
    await prisma.fieldTrack.update({ where: { id: t.track.id }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } });
    await expect(
      tracking.ingest(t.token, { trackId: t.track.id, positions: [fix(-1)] }),
    ).rejects.toMatchObject({ status: 410, reason: "expired" });
    const row = await prisma.fieldTrack.findUniqueOrThrow({ where: { id: t.track.id } });
    expect(row.endReason).toBe("expired");
    expect(row.endedAt).not.toBeNull();
  });

  it("saves the walking summary when a track ends and reports it per day", async () => {
    const t = await tracking.startCompetitionTrack(other, "c-two", ORIGIN);
    // Four fixes ~222 m apart, 30 s apart: a straight walk of ~666 m.
    const positions = [-100, -70, -40, -10].map((sec, i) => fix(sec, { latitude: 23.81 + i * 0.002 }));
    await tracking.ingest(t.token, { trackId: t.track.id, positions });

    const open = await tracking.dayReport(staff, "c-two");
    const live = open.rows.find((r) => r.userId === "other")!;
    expect(live.status).toBe("fresh");
    expect(live.lastEndedAt).toBeNull();
    expect(live.distanceMeters).toBeGreaterThan(600);
    expect(live.distanceMeters).toBeLessThan(700);

    await tracking.stopTrack(other, t.track.id);
    const saved = await prisma.fieldTrack.findUniqueOrThrow({ where: { id: t.track.id } });
    expect(saved.distanceMeters).toBe(live.distanceMeters);
    expect(saved.pointCount).toBe(4);
    expect(saved.stopCount).toBe(0);
    expect(saved.summaryAt).not.toBeNull();

    // Ended tracks leave the live map but stay in the day report.
    expect((await tracking.liveTracks(staff, "c-two")).tracks.find((x) => x.id === t.track.id)).toBeUndefined();
    const report = await tracking.dayReport(staff, "c-two", open.today);
    expect(report.days).toContain(open.today);
    const row = report.rows.find((r) => r.userId === "other")!;
    expect(row).toMatchObject({ status: "ended", sessions: 1, distanceMeters: saved.distanceMeters });
    expect(row.lastEndedAt).not.toBeNull();

    // The saved numbers survive the positions being deleted.
    await prisma.fieldTrackPosition.deleteMany({ where: { trackId: t.track.id } });
    const after = await tracking.dayReport(staff, "c-two", open.today);
    expect(after.rows.find((r) => r.userId === "other")!.distanceMeters).toBe(saved.distanceMeters);

    const empty = await tracking.dayReport(staff, "c-two", "2020-01-01");
    expect(empty.rows).toEqual([]);
    await expect(tracking.dayReport(staff, "c-two", "2020-13-40")).rejects.toMatchObject({ status: 400 });
    await expect(tracking.dayReport(student, "c-two")).rejects.toMatchObject({ status: 403 });
  });

  it("serves a whole day of sessions for the day trail", async () => {
    const today = (await tracking.dayReport(staff, "c-track")).today;
    const day = await tracking.dayPositions(staff, "c-track", "stu", today);
    expect(day.tracks.length).toBeGreaterThan(0);
    expect(day.tracks[0].positions.length).toBeGreaterThan(0);
    await expect(tracking.dayPositions(other, "c-track", "stu", today)).rejects.toMatchObject({ status: 403 });
    expect((await tracking.dayPositions(student, "c-track", "stu", today)).tracks.length).toBe(day.tracks.length);
  });

  it("deletes positions older than 90 days", async () => {
    const track = await prisma.fieldTrack.findFirstOrThrow({ where: { userId: "stu" } });
    await prisma.fieldTrackPosition.create({
      data: {
        courseId: "course-t",
        trackId: track.id,
        capturedAt: new Date(Date.now() - 91 * 86400000),
        latitude: 1,
        longitude: 1,
        accuracy: 1,
      },
    });
    const removed = await prisma.$transaction((tx) => tracking.purgeOldPositions(tx));
    expect(removed).toBe(1);
  });
});
