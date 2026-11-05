import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { overview, type Actor } from "@/lib/incubation/server";
import { insist, todayDhaka, type EntryData } from "@/lib/incubation/domain";
import { buildReport, reportRows } from "@/lib/incubation/report";
import { workbook, pdf, type ExportSheet } from "@/lib/incubation/artifacts";
import { failure } from "@/lib/incubation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const a = await getSessionUser(req);
    insist(a?.courseId, "Unauthorized", 401);
    const q = req.nextUrl.searchParams,
      programId = q.get("programId");
    insist(programId, "প্রোগ্রাম দিন।");
    const bundle = await overview(a as Actor, programId);
    const { program, catalog, records, teams, fields } = bundle;
    insist(
      program && catalog && records && teams && fields,
      "রিপোর্ট পাওয়া যায়নি।",
    );
    const filters = {
      from: q.get("from") || undefined,
      to: q.get("to") || undefined,
      teamId: q.get("teamId") || undefined,
      categoryId: q.get("categoryId") || undefined,
      productId: q.get("productId") || undefined,
      areaId: q.get("areaId") || undefined,
      batchName: q.get("batchName") || undefined,
      personId: q.get("personId") || undefined,
      sheet: q.get("sheet") || undefined,
    };
    const products = catalog.filter((p) => p.kind === "product"),
      report = buildReport(
        bundle.reportEntries.map((r) => ({ ...r, data: r.data as EntryData })),
        products,
        teams,
        filters,
      );
    const sheets: ExportSheet[] = [
      {
        name: "Overall Results",
        rows: Object.entries(report.totals).map(([Metric, Value]) => ({
          Metric,
          BDT: Value / 100,
        })),
      },
      {
        name: "Team Summary",
        rows: report.summaries.map((s) => ({
          Team: s.teamName,
          "Net Sales": s.revenue / 100,
          "Net Profit": s.netProfit / 100,
          Expenses: s.expenses / 100,
          "Cash Balance": s.cash / 100,
          "Stock Value": s.stockValue / 100,
          "Principal Outstanding": s.principalOutstanding / 100,
        })),
      },
    ];
    for (const kind of [
      "purchase",
      "sale",
      "supplier_return",
      "transfer",
      "customer_refund",
      "damage",
      "expense",
      "fund",
      "repayment",
      "cash_count",
      "fgd",
      "insight",
    ]) {
      const rows = report.records
        .filter(
          (r) =>
            r.kind === kind &&
            (!filters.personId ||
              !["fgd", "insight"].includes(kind) ||
              r.enteredBy === filters.personId),
        )
        .flatMap((r) =>
          reportRows(
            r,
            products,
            teams.find((t) => t.id === r.teamId)?.name || "",
          ),
        );
      sheets.push({ name: kind, rows });
    }
    sheets.push({
      name: "Inventory",
      rows: report.inventory.map((s) => ({
        Team: s.teamName,
        Product: s.productName,
        Unit: s.unit,
        Quantity: s.quantity / 1000,
        Value: s.value / 100,
      })),
    });
    const selectedFields = fields.filter(
      (f) =>
        (!filters.personId || f.userId === filters.personId) &&
        (!filters.batchName ||
          teams.some(
            (t) => t.id === f.teamId && t.batchName === filters.batchName,
          )) &&
        (!filters.teamId || f.teamId === filters.teamId) &&
        (!filters.areaId || f.startAreaId === filters.areaId) &&
        (!filters.from || todayDhaka(f.checkIn) >= filters.from) &&
        (!filters.to || todayDhaka(f.checkIn) <= filters.to),
    );
    const fieldIds = new Set(selectedFields.map((f) => f.id));
    sheets.push({
      name: "Field Sessions",
      rows: selectedFields.map((f) => ({
        Student: f.userName,
        Team: teams.find((t) => t.id === f.teamId)?.name,
        "Check In": f.checkIn.toLocaleString("en-GB", {
          timeZone: "Asia/Dhaka",
        }),
        "Check Out":
          f.checkOut?.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) ||
          "Open",
        Steps: f.steps,
        "Carried Items": f.carried,
      })),
    });
    sheets.push({
      name: "Field Corrections",
      rows: bundle.fieldCorrections
        .filter((c) => fieldIds.has(c.sessionId))
        .map((c) => ({
          "Session ID": c.sessionId,
          RequestedBy: c.requestedByName,
          Reason: c.reason,
          Status: c.status,
          Before: c.before,
          Proposed: c.proposed,
          "Review Note": c.reviewNote,
        })),
    });
    const matching = (r: (typeof records)[number]) =>
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to) &&
      (!filters.teamId ||
        r.teamId === filters.teamId ||
        r.targetTeamId === filters.teamId) &&
      (!filters.batchName ||
        teams.some(
          (t) =>
            t.batchName === filters.batchName &&
            (t.id === r.teamId || t.id === r.targetTeamId),
        )) &&
      (!filters.areaId || (r.data as EntryData).areaId === filters.areaId) &&
      (!filters.personId ||
        !["fgd", "insight"].includes(r.kind) ||
        r.enteredBy === filters.personId) &&
      (!(filters.productId || filters.categoryId) ||
        (!filters.productId &&
          (r.data as EntryData).categoryId === filters.categoryId) ||
        ((r.data as EntryData).lines || []).some(
          (l) =>
            (!filters.productId || l.productId === filters.productId) &&
            (!filters.categoryId ||
              products.find((p) => p.id === l.productId)?.parentId ===
                filters.categoryId),
        ));
    sheets.push({
      name: "Pending and Rejected",
      rows: records
        .filter((r) => r.status !== "posted" && matching(r))
        .flatMap((r) =>
          reportRows(
            { ...r, data: r.data as EntryData },
            products,
            teams.find((t) => t.id === r.teamId)?.name || "",
          ),
        ),
    });
    const matchingIds = new Set(records.filter(matching).map((r) => r.id));
    sheets.push({
      name: "Correction Requests",
      rows: bundle.corrections
        .filter((r) => matchingIds.has(r.recordId))
        .map((r) => ({
          "Record ID": r.recordId,
          RequestedBy: r.requestedByName,
          Reason: r.reason,
          Status: r.status,
          Before: r.before,
          Proposed: r.proposed,
          "Review Note": r.reviewNote,
        })),
    });
    sheets.push({
      name: "Audit History",
      rows: bundle.history
        .filter(
          (r) =>
            matchingIds.has(r.entityId) ||
            fieldIds.has(r.entityId) ||
            (!filters.teamId &&
              !filters.personId &&
              !filters.batchName &&
              !filters.categoryId &&
              !filters.productId &&
              !filters.areaId &&
              (!filters.from || todayDhaka(r.createdAt) >= filters.from) &&
              (!filters.to || todayDhaka(r.createdAt) <= filters.to)),
        )
        .map((r) => ({
          When: r.createdAt.toISOString(),
          Actor: r.actorName,
          Action: r.action,
          "Record ID": r.entityId,
          Reason: r.reason,
          Before: r.before,
          After: r.after,
        })),
    });
    const format = q.get("format");
    insist(format === "xlsx" || format === "pdf", "সঠিক export format দিন।");
    const scopeNames: Record<string, string[]> = {
      inventory: ["Inventory"],
      learning: ["fgd", "insight"],
      field: ["Field Sessions", "Field Corrections"],
      ...Object.fromEntries(
        [
          "purchase",
          "sale",
          "supplier_return",
          "transfer",
          "customer_refund",
          "damage",
          "expense",
          "fund",
          "repayment",
          "cash_count",
          "fgd",
          "insight",
        ].map((k) => [k, [k]]),
      ),
    };
    insist(
      !filters.sheet || scopeNames[filters.sheet],
      "সঠিক শিট নির্বাচন করুন।",
    );
    const data = {
        title: program.name,
        filters,
        sheets: filters.sheet
          ? sheets.filter((s) => scopeNames[filters.sheet!].includes(s.name))
          : sheets,
      },
      buffer = format === "xlsx" ? await workbook(data) : await pdf(data);
    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf",
        "Content-Disposition": `attachment; filename="Business_Incubation.${format}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
