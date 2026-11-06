import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth";
import { competitionDirectory } from "@/lib/competitionDirectory";
import { failure } from "@/lib/incubation/http";
import type { Actor } from "@/lib/incubation/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const a = await getServerSessionUser();
    if (!a?.courseId || a.role !== "student")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await competitionDirectory(a as Actor, true));
  } catch (e) {
    return failure(e);
  }
}
