import "server-only";
import path from "node:path";
import ExcelJS from "exceljs";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
export interface ExportSheet {
  name: string;
  rows: Record<string, unknown>[];
}
export interface ExportData {
  title: string;
  filters: unknown;
  sheets: ExportSheet[];
  public?: boolean;
}
const safe = (v: unknown): string | number | boolean => {
  if (typeof v === "number" || typeof v === "boolean") return v;
  const s = typeof v === "string" ? v : (JSON.stringify(v) ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
export async function workbook(data: ExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ASSDI Portal";
  wb.created = new Date();
  const meta = wb.addWorksheet("Report Info");
  meta.addRows([
    ["Business Incubation", data.title],
    [
      "Generated (Asia/Dhaka)",
      new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }),
    ],
    [
      "Scope",
      data.public ? "Public aggregate report" : "Authorized internal report",
    ],
    ["Filters", JSON.stringify(data.filters)],
    ["Currency", "BDT"],
    [
      "Note",
      "Cash is a balance; profit is operating performance. Funding is not sales.",
    ],
  ]);
  meta.columns = [{ width: 30 }, { width: 100 }];
  for (const sheet of data.sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const keys = Array.from(new Set(sheet.rows.flatMap((r) => Object.keys(r))));
    ws.columns = (keys.length ? keys : ["No records"]).map((k) => ({
      header: k,
      key: k,
      width:
        k.toLowerCase().includes("note") || k === "Details"
          ? 55
          : Math.min(35, Math.max(16, k.length + 5)),
    }));
    sheet.rows.forEach((r) =>
      ws.addRow(
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)])),
      ),
    );
    ws.getRow(1).font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      name: "Noto Sans Bengali",
    };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF175A46" },
    };
    ws.eachRow((r, i) => {
      r.alignment = { vertical: "top", wrapText: true };
      if (i > 1) {
        r.font = { name: "Noto Sans Bengali", size: 10 };
        if (i % 2 === 0)
          r.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F6F2" },
          };
        r.eachCell((c) => {
          if (typeof c.value === "number")
            c.numFmt = "#,##0.00;[Red](#,##0.00)";
        });
      }
    });
    if (keys.length)
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: keys.length },
      };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const styles = StyleSheet.create({
  page: {
    fontFamily: "IncubationBangla",
    fontSize: 9,
    paddingTop: 82,
    paddingBottom: 38,
    paddingHorizontal: 30,
    color: "#163e35",
  },
  head: {
    position: "absolute",
    top: 22,
    left: 30,
    right: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#d5e4da",
    paddingBottom: 9,
  },
  title: { fontSize: 17, marginBottom: 4 },
  sub: { fontSize: 8, color: "#6b7f75" },
  footer: {
    position: "absolute",
    bottom: 17,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#73857a",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e9e3",
    paddingVertical: 7,
  },
  cell: { paddingHorizontal: 5 },
  label: { color: "#698275" },
  heading: { fontSize: 13, marginBottom: 12 },
  note: { marginVertical: 8, lineHeight: 1.6 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#e8f1ea",
    paddingVertical: 8,
  },
});
let registered = false;
export async function pdf(data: ExportData) {
  if (!registered) {
    Font.register({
      family: "IncubationBangla",
      src: path.join(process.cwd(), "public/fonts/NotoSansBengali-Regular.ttf"),
    });
    registered = true;
  }
  const sheets = data.sheets.filter((s) => s.rows.length);
  const document = (
    <Document title={data.title} author="ASSDI Portal">
      {(sheets.length
        ? sheets
        : [{ name: "Summary", rows: [{ Report: "No records in this scope" }] }]
      ).map((sheet, index) => {
        const keys = Array.from(
            new Set(sheet.rows.flatMap((r) => Object.keys(r))),
          ),
          compact =
            keys.length <= 7 &&
            !sheet.rows.some((r) =>
              Object.values(r).some((v) => v !== null && typeof v === "object"),
            );
        return (
          <Page
            key={index}
            size="A4"
            orientation={compact ? "landscape" : "portrait"}
            style={styles.page}
          >
            <View style={styles.head} fixed>
              <Text style={styles.title}>{data.title}</Text>
              <Text style={styles.sub}>
                {sheet.name} •{" "}
                {new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}{" "}
                • BDT
              </Text>
            </View>
            <Text style={styles.heading}>{sheet.name}</Text>
            <Text style={styles.sub}>
              Filters: {JSON.stringify(data.filters)}
            </Text>
            {sheet.rows.some((r) => typeof r["Net Profit"] === "number") && (
              <View style={{ marginVertical: 15 }}>
                <Text style={styles.note}>
                  টিমভিত্তিক নিট লাভ / ক্ষতি (BDT)
                </Text>
                {sheet.rows.slice(0, 12).map((r, i) => {
                  const value = Number(r["Net Profit"] || 0),
                    max = Math.max(
                      1,
                      ...sheet.rows.map((x) =>
                        Math.abs(Number(x["Net Profit"] || 0)),
                      ),
                    );
                  return (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 7,
                      }}
                    >
                      <Text style={{ width: "22%", fontSize: 8 }}>
                        {String(r.Team || i + 1)}
                      </Text>
                      <View
                        style={{
                          width: "62%",
                          height: 12,
                          backgroundColor: "#edf2ee",
                        }}
                      >
                        <View
                          style={{
                            width: `${(Math.abs(value) / max) * 100}%`,
                            height: 12,
                            backgroundColor: value >= 0 ? "#348969" : "#bd6954",
                          }}
                        />
                      </View>
                      <Text
                        style={{ width: "16%", paddingLeft: 9, fontSize: 9 }}
                      >
                        {value.toLocaleString("en-IN")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            {compact ? (
              <>
                <View style={styles.tableHead} fixed>
                  {keys.map((k) => (
                    <Text
                      key={k}
                      style={[styles.cell, { width: `${100 / keys.length}%` }]}
                    >
                      {k}
                    </Text>
                  ))}
                </View>
                {sheet.rows.map((r, i) => (
                  <View key={i} style={styles.row} wrap={false}>
                    {keys.map((k) => (
                      <Text
                        key={k}
                        style={[
                          styles.cell,
                          { width: `${100 / keys.length}%` },
                        ]}
                      >
                        {typeof r[k] === "number"
                          ? Number(r[k]).toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })
                          : typeof r[k] === "object" && r[k] !== null
                            ? JSON.stringify(r[k])
                            : String(r[k] ?? "—")}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            ) : (
              sheet.rows.map((r, i) => (
                <View
                  key={i}
                  style={{
                    marginTop: 12,
                    borderBottomWidth: 0.5,
                    borderBottomColor: "#dce7df",
                    paddingBottom: 10,
                  }}
                >
                  {Object.entries(r).map(([k, v]) => (
                    <View
                      key={k}
                      style={{ flexDirection: "row", marginBottom: 4 }}
                    >
                      <Text style={[styles.label, { width: "27%" }]}>{k}</Text>
                      <Text style={{ width: "73%" }}>
                        {typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v ?? "—")}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            )}
            <Text
              style={styles.footer}
              fixed
              render={({ pageNumber, totalPages }) =>
                `Business Incubation • ${data.public ? "Public report" : "Internal report"} • ${pageNumber} / ${totalPages}`
              }
            />
          </Page>
        );
      })}
    </Document>
  );
  return renderToBuffer(document);
}
