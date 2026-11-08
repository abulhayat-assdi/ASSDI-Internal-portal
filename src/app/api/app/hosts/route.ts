import { NextResponse } from "next/server";
import type { Course } from "@prisma/client";
import { withCourseContext } from "@/lib/db";
import { isCourseUsable } from "@/lib/course";

export const dynamic = "force-dynamic";

/**
 * Hosts the Android app may trust (load in-app and expose the AsmApp bridge to).
 *
 * Course portals and students' deployed mini-sites share the same subdomain
 * namespace (<name>.<base domain>). A student site is arbitrary uploaded HTML, so
 * the app must never treat "any subdomain" as trusted: it trusts only the root
 * domain plus the slugs listed here. Course slugs are already public (the root
 * course directory lists them), so this exposes nothing new.
 */
export async function GET() {
  try {
    const root = (
      process.env.BASE_DOMAIN ||
      process.env.NEXT_PUBLIC_BASE_DOMAIN ||
      "tasm-skill.asf.bd"
    ).toLowerCase();
    const courses = await withCourseContext(
      { courseId: null, isSuperAdmin: true },
      (tx) => tx.course.findMany(),
    );
    const slugs = courses
      .filter((c: Course) => isCourseUsable(c))
      .map((c) => c.slug.toLowerCase())
      .sort();
    return NextResponse.json(
      { root, courses: slugs, hosts: slugs.map((s) => `${s}.${root}`) },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
