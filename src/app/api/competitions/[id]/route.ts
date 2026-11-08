import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseTrackingSettings } from "@/lib/tracking/core";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, canManageCompetitions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser(req);
    const courseId = user?.courseId || req.headers.get("x-course-id");
    if (!courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const competition = await withCourseContext(
      { courseId, isSuperAdmin: false },
      (tx) =>
        tx.competition.findUnique({
          where: { id, courseId, kind: "form" },
        }),
    );

    if (!competition) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(competition);
  } catch (error) {
    console.error("Failed to fetch competition:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser(req);
    if (!user || !canManageCompetitions(user) || !user.courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const form = await withCourseContext(
      { courseId, isSuperAdmin: false },
      (tx) =>
        tx.competition.findFirst({
          where: { id, courseId, kind: "form" },
          select: { id: true },
        }),
    );
    if (!form)
      return NextResponse.json(
        { error: "এই item-এর নিজস্ব workspace ব্যবহার করুন।" },
        { status: 404 },
      );

    const body = await req.json();
    const trackingInput = parseTrackingSettings(body);

    const competition = await withCourseContext(
      { courseId, isSuperAdmin: false },
      async (tx) => {
        // Switching tracking off ends open tracks; the app gets 410 and stops.
        if (trackingInput.trackingEnabled === false)
          await tx.fieldTrack.updateMany({
            where: { competitionId: id, endedAt: null },
            data: { endedAt: new Date(), endReason: "tracking_disabled", tokenRevokedAt: new Date() },
          });
        return tx.competition.update({
          where: { id, courseId, kind: "form" },
          data: {
            title: body.title,
            description: body.description,
            batchName: body.batchName,
            schema: body.schema,
            isActive: body.isActive,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : undefined,
            ...trackingInput,
          },
        });
      },
    );

    return NextResponse.json(competition);
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Tracking interval must be a whole number of seconds between 30 and 3600." },
        { status: 400 },
      );
    console.error("Failed to update competition:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser(req);
    if (!user || !canManageCompetitions(user) || !user.courseId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const form = await withCourseContext(
      { courseId, isSuperAdmin: false },
      (tx) =>
        tx.competition.findFirst({
          where: { id, courseId, kind: "form" },
          select: { id: true },
        }),
    );
    if (!form)
      return NextResponse.json(
        { error: "এই item-এর নিজস্ব workspace ব্যবহার করুন।" },
        { status: 404 },
      );

    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
      tx.competition.delete({
        where: { id, courseId, kind: "form" },
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete competition:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
