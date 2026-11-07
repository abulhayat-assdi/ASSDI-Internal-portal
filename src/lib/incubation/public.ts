import "server-only";
import { createHash } from "node:crypto";
import { withCourseContext } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/features";
import { insist, type EntryData } from "./domain";
import { buildReport, type ReportFilters } from "./report";
export async function publicReport(
  courseId: string,
  token: string,
  filters: ReportFilters = {},
) {
  insist(/^[a-f0-9]{64}$/.test(token), "Report not found.", 404);
  return withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { settings: true },
    });
    insist(
      course && isFeatureEnabled(course.settings, "business_incubation"),
      "Report not found.",
      404,
    );
    const p = await tx.incubationProgram.findFirst({
      where: {
        courseId,
        deletedAt: null,
        publicTokenHash: createHash("sha256").update(token).digest("hex"),
      },
    });
    insist(p, "Report not found or the link has been revoked.", 404);
    const [teams, records, products, categories, areas, sprints] =
      await Promise.all([
        tx.incubationTeam.findMany({
          where: { programId: p.id },
          select: { id: true, name: true, batchName: true },
        }),
        tx.incubationRecord.findMany({
          where: { programId: p.id, status: "posted" },
        }),
        tx.incubationCatalog.findMany({
          where: { programId: p.id, kind: "product" },
        }),
        tx.incubationCatalog.findMany({
          where: { programId: p.id, kind: "category" },
          select: { id: true, name: true },
        }),
        tx.incubationCatalog.findMany({
          where: { programId: p.id, kind: "area" },
          select: { id: true, name: true },
        }),
        tx.incubationSprint.findMany({
          where: { programId: p.id },
          select: {
            id: true,
            teamId: true,
            categoryId: true,
            startDate: true,
            endDate: true,
          },
        }),
      ]);
    const published = await tx.incubationResult.findFirst({
      where: { programId: p.id, withdrawnAt: null },
      orderBy: { publishedAt: "desc" },
    });
    const snapshot = published?.snapshot as
      | { asOf: string; ranking: { rank: number; teamName: string; revenue: number; netProfit: number }[] }
      | undefined;
    const report = buildReport(
      records.map((r) => ({ ...r, data: r.data as EntryData })),
      products,
      teams,
      filters,
    );
    // Public payload is an allowlist, never the staff bundle with fields hidden in CSS.
    return {
      program: {
        name: p.name,
        description: p.description,
        startDate: p.startDate,
        endDate: p.endDate,
      },
      teams,
      categories,
      areas,
      sprints,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        parentId: p.parentId,
        variant: p.variant,
      })),
      summaries: report.summaries.map((s) => ({
        teamId: s.teamId,
        teamName: s.teamName,
        revenue: s.revenue,
        grossProfit: s.grossProfit,
        netProfit: s.netProfit,
        expenses: s.expenses,
        stockValue: s.stockValue,
      })),
      totals: {
        revenue: report.totals.revenue,
        expenses: report.totals.expenses,
        netProfit: report.totals.netProfit,
        stockValue: report.totals.stockValue,
      },
      trend: report.trend,
      results: snapshot
        ? {
            metric: published!.metric,
            asOf: snapshot.asOf,
            publishedAt: published!.publishedAt.toISOString(),
            note: published!.note,
            ranking: snapshot.ranking.map((r) => ({
              rank: r.rank,
              teamName: r.teamName,
              revenue: r.revenue,
              netProfit: r.netProfit,
            })),
          }
        : null,
      filters,
      generatedAt: new Date().toISOString(),
    };
  });
}
