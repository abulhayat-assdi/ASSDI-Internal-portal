import { NextRequest, NextResponse } from "next/server";
import { publicReport } from "@/lib/incubation/public";
import { failure } from "@/lib/incubation/http";
import { workbook, pdf } from "@/lib/incubation/artifacts";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const courseId = req.headers.get("x-course-id");
    if (!courseId)
      return NextResponse.json(
        { error: "Open the report from the course's own address." },
        { status: 404 },
      );
    const { token } = await params,
      q = req.nextUrl.searchParams;
    const report = await publicReport(courseId, token, {
      from: q.get("from") || undefined,
      to: q.get("to") || undefined,
      teamId: q.get("teamId") || undefined,
      categoryId: q.get("categoryId") || undefined,
      productId: q.get("productId") || undefined,
      batchName: q.get("batchName") || undefined,
      areaId: q.get("areaId") || undefined,
    });
    const format = q.get("format");
    if (format === "xlsx" || format === "pdf") {
      const data = {
        title: report.program.name,
        filters: report.filters,
        public: true,
        sheets: [
          {
            name: "Overall Results",
            rows: Object.entries(report.totals).map(([Metric, Value]) => ({
              Metric,
              BDT: Value / 100,
            })),
          },
          {
            name: "Team Results",
            rows: report.summaries.map((s) => ({
              Team: s.teamName,
              "Net Sales": s.revenue / 100,
              Expenses: s.expenses / 100,
              "Gross Profit": s.grossProfit / 100,
              "Net Profit": s.netProfit / 100,
              "Stock Value": s.stockValue / 100,
            })),
          },
          {
            name: "Daily Sales",
            rows: report.trend.map((t) => ({
              Date: t.date,
              Revenue: t.revenue,
            })),
          },
        ],
      };
      const buffer = format === "xlsx" ? await workbook(data) : await pdf(data);
      return new NextResponse(Uint8Array.from(buffer), {
        headers: {
          "Content-Type":
            format === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf",
          "Content-Disposition": `attachment; filename="Public_Incubation_Report.${format}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
