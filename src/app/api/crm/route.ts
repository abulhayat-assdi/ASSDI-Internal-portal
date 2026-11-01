import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { identity } from "@/lib/customer-service/access";
import {
  bootstrap,
  provision,
  read,
  mutate,
} from "@/lib/customer-service/service";
import { CrmError, scoped } from "@/lib/customer-service/db";
import { DomainError, csvCell } from "@/lib/customer-service/domain";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function failure(e: unknown) {
  if (e instanceof CrmError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      },
      { status: 400 },
    );
  if (e instanceof DomainError)
    return NextResponse.json({ error: e.message }, { status: 400 });
  const code = (e as { code?: string })?.code;
  if (code === "P2002")
    return NextResponse.json(
      { error: "This record already exists. Refresh and try again." },
      { status: 409 },
    );
  return NextResponse.json(
    { error: "Customer service is temporarily unavailable. Please retry." },
    { status: 503 },
  );
}
export async function GET(req: NextRequest) {
  try {
    const ctx = await identity(req),
      q = req.nextUrl.searchParams,
      kind = q.get("kind") || "bootstrap";
    if (kind === "bootstrap") return NextResponse.json(await bootstrap(ctx));
    if (kind === "health") {
      if (!ctx.admin) throw new CrmError(403, "CRM administrator required");
      await scoped(ctx.courseId, "", async (tx) => {
        const role = await tx.$queryRaw<
          { rolsuper: boolean; rolbypassrls: boolean }[]
        >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
        if (role[0]?.rolsuper || role[0]?.rolbypassrls)
          throw new CrmError(
            503,
            "CRM runtime role must be subject to row-level security",
          );
        await tx.workspace.count({ where: { courseId: ctx.courseId } });
      });
      return NextResponse.json({ status: "ready" });
    }
    const w = q.get("workspaceId");
    if (!w) throw new CrmError(400, "Select a workspace");
    const data = await read(ctx, w, kind === "export" ? "report" : kind, q);
    if (kind === "export") {
      const report = data as Awaited<ReturnType<typeof read>> & {
        basis: string;
        rows: Record<string, unknown>[];
        range: unknown;
        filters: unknown;
        metrics: Record<string, unknown>;
        created: Record<string, unknown>[];
        agents: Record<string, unknown>[];
        breakdowns: Record<string, { name: string; count: number }[]>;
      };
      const lines = [
        ["Report basis", report.basis],
        ["Range", JSON.stringify(report.range)],
        ["Filters", JSON.stringify(report.filters)],
        ...Object.entries(report.metrics),
        [],
        [
          "Complaint ID",
          "Created",
          "Resolved",
          "Creator",
          "Resolver",
          "Status",
          "Queue",
          "Calling number",
          "Issue",
          "Overall deadline",
          "Remarks",
        ],
        ...report.rows.map((c) => [
          c.code,
          c.createdAt,
          c.resolvedAt,
          c.creatorId,
          c.resolverId,
          c.status,
          c.queue,
          c.callingNumber,
          c.issueType,
          c.dueAt,
          c.remarks,
        ]),
      ];
      lines.push(
        [],
        ["Creation cohort"],
        ["Complaint ID", "Created", "Creator", "Status", "Calling number"],
        ...report.created.map((c) => [
          c.code,
          c.createdAt,
          c.creatorId,
          c.status,
          c.callingNumber,
        ]),
      );
      lines.push(
        [],
        ["Agent operations"],
        [
          "Agent",
          "Created",
          "Contacts",
          "Escalated",
          "Resolved",
          "Average TAT (ms)",
        ],
        ...report.agents.map((a) => [
          a.id,
          a.complaints,
          a.interactions,
          a.escalations,
          a.resolved,
          a.average,
        ]),
      );
      for (const [kind, rows] of Object.entries(report.breakdowns))
        lines.push(
          [],
          [kind + " breakdown", "Count"],
          ...rows.map((r) => [r.name, r.count]),
        );
      if (q.get("format") === "xlsx") {
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("CRM report");
        for (const row of lines) sheet.addRow(row.map((v) => String(v ?? "")));
        sheet.columns.forEach((c) => {
          c.width = 24;
        });
        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="crm-report.xlsx"',
          },
        });
      }
      return new NextResponse(
        lines.map((row) => row.map(csvCell).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="crm-report.csv"',
          },
        },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !==
        (req.headers.get("x-forwarded-host") || req.headers.get("host"))
    )
      throw new CrmError(403, "Cross-origin request blocked");
    if (Number(req.headers.get("content-length") || 0) > 100000)
      throw new CrmError(413, "Request too large");
    const ctx = await identity(req);
    const body = await req.json();
    if (JSON.stringify(body).length > 100000)
      throw new CrmError(413, "Request too large");
    if (body.action === "provision")
      return NextResponse.json(await provision(ctx, body.data));
    // A unique-code collision or concurrent replay rolls back the entire transaction before retry.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return NextResponse.json(await mutate(ctx, body));
      } catch (e) {
        if (
          (e as { code?: string })?.code !== "P2002" ||
          body.action !== "create" ||
          attempt === 2
        )
          throw e;
      }
    }
    throw new CrmError(409, "Please retry");
  } catch (e) {
    return failure(e);
  }
}
