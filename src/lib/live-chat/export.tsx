import "server-only";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { need } from "./access";
import { metricLabels } from "./domain";
Font.register({
  family: "ChatBengali",
  src: path.join(process.cwd(), "public/fonts/live-chat/NotoSansBengali.ttf"),
});
const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "ChatBengali",
    fontSize: 9,
    color: "#172c43",
  },
  heading: { fontSize: 20, marginBottom: 12 },
  sub: { fontSize: 8, color: "#64748b", marginBottom: 12 },
  row: { padding: 8, borderBottomWidth: 0.5, borderBottomColor: "#dce5ed" },
  label: { fontSize: 10, marginBottom: 4 },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    fontSize: 8,
    color: "#64748b",
  },
});
type Data = {
  basis: string;
  generatedAt: Date;
  period: { from: Date; to: Date };
  timezone: string;
  metrics: Record<string, unknown>;
  rows: Record<string, unknown>[];
  agents: Record<string, unknown>[];
  daily: Record<string, unknown>[];
  evaluations: Record<string, unknown>[];
  filters: Record<string, unknown>;
};
const scalar = (v: unknown) =>
  typeof v === "number"
    ? Number.isInteger(v)
      ? String(v)
      : v.toFixed(2)
    : v instanceof Date
      ? v.toISOString()
      : v == null
        ? ""
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
export async function spreadsheet(data: Data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ASM Live Chat Training";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "key", width: 32 },
    { header: "Value", key: "value", width: 90 },
  ];
  for (const [key, value] of Object.entries({
    basis: data.basis,
    generatedAt: data.generatedAt,
    from: data.period.from,
    to: data.period.to,
    timezone: data.timezone,
    filters: data.filters,
    ...data.metrics,
  }))
    summary.addRow({
      key: metricLabels[key] || key,
      value: typeof value === "number" ? value : scalar(value),
    });
  for (const [name, rows] of [
    ["Conversations", data.rows],
    ["Agents", data.agents],
    ["Daily", data.daily],
    ["QA evaluations", data.evaluations],
  ] as const) {
    const sheet = workbook.addWorksheet(name);
    const keys = Object.keys(rows[0] || {});
    sheet.columns = keys.map((key) => ({ header: key, key, width: 24 }));
    for (const row of rows)
      sheet.addRow(
        Object.fromEntries(
          keys.map((key) => [
            key,
            typeof row[key] === "number" ? row[key] : scalar(row[key]),
          ]),
        ),
      );
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    if (keys.length)
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(rows.length + 1, 1), column: keys.length },
      };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
export async function reportPdf(data: Data) {
  need(
    data.rows.length <= 1000,
    "PDF exports support 1,000 conversations. Narrow the date range or use Excel.",
    413,
  );
  return renderToBuffer(
    <Document title="Live Chat Training Report">
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>Live Chat Training Report</Text>
        <Text style={styles.sub}>
          {data.period.from.toISOString()} to {data.period.to.toISOString()} ·{" "}
          {data.timezone}
          {"\n"}Generated: {data.generatedAt.toISOString()}
          {"\n"}
          {data.basis}
        </Text>
        {Object.entries(data.metrics).map(([key, value]) => (
          <Text key={key}>
            {metricLabels[key] || key}: {scalar(value)}
          </Text>
        ))}
        <Text style={{ ...styles.label, marginTop: 16 }}>
          Filters: {scalar(data.filters)}
        </Text>
        <Text style={{ ...styles.label, marginTop: 16 }}>
          Agent performance / এজেন্টের ফলাফল
        </Text>
        {data.agents.map((a) => (
          <View key={String(a.agentId)} style={styles.row}>
            <Text>
              {scalar(a.name)} · Roll: {scalar(a.roll)}
            </Text>
            <Text>
              Assigned: {scalar(a.assigned)} · Answered: {scalar(a.answered)} ·
              Resolved: {scalar(a.resolved)}
            </Text>
            <Text>
              AHT (s): {scalar(a.aht)} · QA: {scalar(a.qa)} · Online (s):{" "}
              {scalar(a.onlineSeconds)}
            </Text>
          </View>
        ))}
        <Text style={{ ...styles.label, marginTop: 16 }}>
          QA & coaching / মূল্যায়ন
        </Text>
        {data.evaluations.map((e) => (
          <View key={String(e.id)} style={styles.row}>
            <Text>
              {scalar(e.agentId)} · {scalar(e.total)}/100 ·{" "}
              {e.released ? "Released" : "Held"}
            </Text>
            <Text>{scalar(e.feedback)}</Text>
            {!!e.privateNote && (
              <Text>Private teacher note: {scalar(e.privateNote)}</Text>
            )}
          </View>
        ))}
        <Text style={{ ...styles.label, marginTop: 16 }}>
          Conversations / কথোপকথন
        </Text>
        {data.rows.map((row) => (
          <View style={styles.row} key={String(row.id)}>
            <Text>
              {scalar(row.customerName)} · {scalar(row.status)}
            </Text>
            <Text>{scalar(row.id)}</Text>
            <Text>
              {scalar(row.createdAt)} · {scalar(row.resolution)}
            </Text>
            <Text>{scalar(row.closingNote)}</Text>
          </View>
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ASM Training · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  );
}
export async function transcriptPdf(
  c: { id: string; customerName: string; status: string },
  messages: {
    senderName: string;
    text: string;
    createdAt: Date;
    kind: string;
  }[],
) {
  return renderToBuffer(
    <Document title="Chat Transcript">
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>
          Chat Transcript / চ্যাট ট্রান্সক্রিপ্ট
        </Text>
        <Text style={styles.sub}>
          {c.id} · {c.customerName} · {c.status}
          {"\n"}Generated: {new Date().toISOString()}
        </Text>
        {messages.map((m, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.label}>
              {m.senderName} · {m.kind} · {m.createdAt.toISOString()}
            </Text>
            <Text>{m.text}</Text>
          </View>
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Internal training · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  );
}
