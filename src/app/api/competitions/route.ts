import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, canManageCompetitions } from "@/lib/auth";
import { competitionDirectory } from "@/lib/competitionDirectory";
import { failure } from "@/lib/incubation/http";
import type { Actor } from "@/lib/incubation/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || !user.courseId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const courseId = user.courseId;

    return NextResponse.json(await competitionDirectory(user as Actor));
  } catch (error) {
    console.error("Failed to fetch competitions:", error);
    return failure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || !canManageCompetitions(user) || !user.courseId) {
      return NextResponse.json(
        {
          error: "Forbidden: Only Teachers and Admins can create competitions.",
        },
        { status: 403 },
      );
    }
    const courseId = user.courseId;

    const body = await req.json();
    if (body.kind && body.kind !== "form")
      return NextResponse.json(
        { error: "Business Incubation-এর setup ব্যবহার করুন।" },
        { status: 400 },
      );

    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!body.batchName || !body.batchName.trim()) {
      return NextResponse.json(
        { error: "Batch Name is required" },
        { status: 400 },
      );
    }

    const competition = await withCourseContext(
      { courseId, isSuperAdmin: false },
      (tx) =>
        tx.competition.create({
          data: {
            courseId,
            title: body.title.trim(),
            description: body.description ? body.description.trim() : "",
            batchName: body.batchName.trim(),
            schema: body.schema || [],
            isActive: body.isActive ?? true,
            startDate: body.startDate ? new Date(body.startDate) : new Date(),
            endDate: body.endDate ? new Date(body.endDate) : null,
          },
        }),
    );

    return NextResponse.json(competition);
  } catch (error: any) {
    console.error("Failed to create competition:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
