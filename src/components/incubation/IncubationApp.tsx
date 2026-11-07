"use client";
import { useRouter } from "next/navigation";
import StudentWorkspace from "./StudentWorkspace";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Sprout,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Settings2,
  Wallet,
  Package,
  ChartNoAxesCombined,
  MapPin,
  ClipboardCheck,
  BookOpen,
  History,
  Table2,
  RefreshCw,
  X,
  Check,
  FileText,
  Users,
  Send,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  KIND_LABELS,
  FINANCIAL_KINDS,
  todayDhaka,
  lineTotal,
  type EntryData,
  type RecordKind,
  type Product,
} from "@/lib/incubation/domain";
import { buildReport, type ReportFilters } from "@/lib/incubation/report";
import {
  allowedTransitions,
  isProgramLocked,
  STATUS_LABELS,
  transitionNeedsReason,
} from "@/lib/incubation/lifecycle";
import "./incubation.css";
import RecordSnapshot from "./RecordSnapshot";
import BulkSheetEditor from "./BulkSheetEditor";
import MonitorPanel from "./MonitorPanel";
import ResultsCard from "./ResultsCard";
import { rankTeams } from "@/lib/incubation/results";
import NotificationBell from "./NotificationBell";
import {
  FieldCorrectionEditor,
  FieldCorrectionReviews,
} from "./FieldCorrections";

type Row = Record<string, any>;
type Editor = {
  type:
    "program" | "team" | "catalog" | "sprint" | "record" | "correct" | "review";
  data: Row;
  original?: Row;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
const stamp = (v: string) =>
  new Date(v).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const label = (kind: string) => KIND_LABELS[kind as RecordKind] || kind;
const blankProgram = () => ({
  name: "",
  description: "",
  startDate: todayDhaka(),
  endDate: "",
  batchNames: [],
  staffIds: [],
  status: "draft",
  settings: {
    sessions: [],
    sessionsRequired: false,
    segments: [],
    objections: [],
    fgdRequiredCount: 1,
    whyBoughtRequired: false,
    salesReminder: true,
    fgdEveryDays: null,
    sprintDays: "",
    enforceCategory: true,
    maxFieldHours: "",
    trackingMinutes: 5,
    retentionDays: 30,
    expenseTypes: [
      "Transportation",
      "Packaging & Bags",
      "Marketing & Print",
      "Other",
    ],
  },
});
function Field({ name, children }: { name: string; children: ReactNode }) {
  const nodes = Children.toArray(children);
  const single =
    nodes.length === 1 &&
    isValidElement(nodes[0]) &&
    typeof nodes[0].type === "string" &&
    ["input", "select", "textarea"].includes(nodes[0].type);
  if (!single)
    return (
      <div className="inc-field" role="group" aria-label={name}>
        <span>{name}</span>
        {children}
      </div>
    );
  const child = nodes[0] as ReactElement<{ "aria-label"?: string }>;
  return (
    <label className="inc-field">
      <span>{name}</span>
      {cloneElement(child, { "aria-label": child.props["aria-label"] || name })}
    </label>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`inc-status ${value}`}>
      {(
        {
          posted: "জমা হয়েছে",
          pending: "অনুমোদনের অপেক্ষায়",
          transfer_pending: "গ্রহণের অপেক্ষায়",
          approved: "অনুমোদিত",
          rejected: "প্রত্যাখ্যাত",
          void: "বাতিল",
          active: "চলমান",
          draft: "খসড়া",
          closing: "হিসাব মেলানো",
          closed: "সমাপ্ত",
          archived: "আর্কাইভ",
          cancelled: "বাতিল",
          scheduled: "আসন্ন",
          running: "চলমান",
          ended: "সময় শেষ",
        } as Row
      )[value] || value}
    </span>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="inc-empty">
      <Sprout size={36} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function GridTable({
  columns,
  rows,
  pageSize = 25,
}: {
  columns: { title: string; render: (r: Row) => ReactNode }[];
  rows: Row[];
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / pageSize) - 1),
  );
  return (
    <>
      <div className="inc-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice(current * pageSize, (current + 1) * pageSize)
              .map((r, i) => (
                <tr key={r.id || i}>
                  {columns.map((c, j) => (
                    <td key={j}>{c.render(r)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="এই তালিকায় এখনো ডাটা নেই" />}
      </div>
      <div className="inc-pager">
        <span>
          {rows.length} রেকর্ড • পৃষ্ঠা {current + 1}/
          {Math.max(1, Math.ceil(rows.length / pageSize))}
        </span>
        <div className="inc-row">
          <button
            className="inc-btn"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            আগের
          </button>
          <button
            className="inc-btn"
            disabled={(current + 1) * pageSize >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            পরের
          </button>
        </div>
      </div>
    </>
  );
}
export default function IncubationApp({
  student = false,
  competitionId,
  create = false,
}: {
  student?: boolean;
  competitionId?: string;
  create?: boolean;
}) {
  const router = useRouter();
  const [createOpened, setCreateOpened] = useState(false);
  const [bundle, setBundle] = useState<Row | null>(null),
    [programId, setProgramId] = useState(""),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [filters, setFilters] = useState<ReportFilters>({}),
    [sheet, setSheet] = useState("sale"),
    [search, setSearch] = useState(""),
    [share, setShare] = useState("");
  const [personId, setPersonId] = useState("");
  const [fieldForm, setFieldForm] = useState<Row>({
      areaId: "",
      steps: 0,
      carried: [],
      proofId: "",
    }),
    [positionHistory, setPositionHistory] = useState<Row[]>([]);
  const load = useCallback(
    async (selected = programId) => {
      setError("");
      setLoading(true);
      try {
        const r = await fetch(
            `/api/incubation${selected ? `?programId=${encodeURIComponent(selected)}` : competitionId ? `?competitionId=${encodeURIComponent(competitionId)}` : ""}`,
            { cache: "no-store" },
          ),
          d = await r.json();
        if (!r.ok) throw Error(d.error);
        setBundle(d);
        if (d.program && d.program.id !== selected) setProgramId(d.program.id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [programId, competitionId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (create && bundle?.manager && !createOpened) {
      setCreateOpened(true);
      setEditor({ type: "program", data: blankProgram() });
    }
  }, [create, bundle, createOpened]);
  const send = async (action: string, payload: Row, selected = programId) => {
    const r = await fetch("/api/incubation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        programId: selected || undefined,
        payload,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  };
  const act = async (action: string, payload: Row) => {
    setBusy(true);
    setError("");
    try {
      const r = await send(action, payload);
      if (action === "share")
        setShare(
          r.token ? `${location.origin}/incubation/report/${r.token}` : "",
        );
      setMessage("পরিবর্তন সংরক্ষিত হয়েছে।");
      await load();
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choose = (id: string) => {
    setProgramId(id);
    setTab("overview");
    setFilters({});
    setShare("");
    setMessage("");
    setFieldForm({ areaId: "", steps: 0, carried: [], proofId: "" });
    setPersonId("");
    setPositionHistory([]);
  };
  const products = useMemo<Product[]>(
      () => bundle?.catalog?.filter((c: Row) => c.kind === "product") || [],
      [bundle?.catalog],
    ),
    categories =
      bundle?.catalog?.filter((c: Row) => c.kind === "category") || [],
    areas = bundle?.catalog?.filter((c: Row) => c.kind === "area") || [];
  const teamName = (id: string) =>
    bundle?.teams?.find((t: Row) => t.id === id)?.name || "অন্য টিম";
  const productName = (id: string) =>
    products.find((p: Row) => p.id === id)?.name || id;
  const { report, reportError } = useMemo(() => {
    try {
      return {
        report: bundle?.records
          ? buildReport(
              bundle.reportEntries || bundle.records,
              products,
              bundle.teams,
              filters,
            )
          : null,
        reportError: "",
      };
    } catch (e) {
      return { report: null, reportError: (e as Error).message };
    }
  }, [bundle, filters, products]);
  const liveRanking = useMemo(() => {
    if (!bundle?.manager || !bundle?.records || bundle?.member) return [];
    try {
      const full = buildReport(bundle.records, products, bundle.teams, {});
      return rankTeams(
        full.summaries
          .filter(
            (s) => bundle.teams.find((t: Row) => t.id === s.teamId)?.active || s.revenue !== 0,
          )
          .map((s) => ({
            teamId: s.teamId,
            teamName: s.teamName,
            revenue: s.revenue,
            netProfit: s.netProfit,
            grossProfit: s.grossProfit,
          })),
      );
    } catch {
      return [];
    }
  }, [bundle, products]);
  const records = useMemo(
    () =>
      bundle?.records?.filter(
        (r: Row) =>
          (!filters.teamId ||
            r.teamId === filters.teamId ||
            r.targetTeamId === filters.teamId) &&
          (!filters.batchName ||
            bundle.teams.some(
              (t: Row) =>
                t.batchName === filters.batchName &&
                (t.id === r.teamId || t.id === r.targetTeamId),
            )) &&
          (!filters.from || r.date >= filters.from) &&
          (!filters.to || r.date <= filters.to) &&
          (!filters.categoryId ||
            r.data.categoryId === filters.categoryId ||
            r.data.lines?.some((l: Row) =>
              products.some(
                (p: Row) =>
                  p.id === l.productId && p.parentId === filters.categoryId,
              ),
            )) &&
          (!filters.productId ||
            r.data.lines?.some(
              (l: Row) => l.productId === filters.productId,
            )) &&
          (!filters.areaId || r.data.areaId === filters.areaId),
      ) || [],
    [bundle, filters, products],
  );
  const ownField = bundle?.fields?.find(
    (f: Row) => f.userId === bundle?.actor?.id && !f.checkOut,
  );
  const gps = () =>
    new Promise<Row>((resolve, reject) => {
      if (!navigator.geolocation) return reject(Error("এই ডিভাইসে GPS নেই।"));
      navigator.geolocation.getCurrentPosition(
        (p) =>
          resolve({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            capturedAt: new Date(p.timestamp).toISOString(),
          }),
        () => reject(Error("GPS পাওয়া যায়নি। Location চালু করে অনুমতি দিন।")),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  const fieldAction = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      const position = await gps(),
        r = await fetch("/api/incubation/field", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            programId,
            position,
            areaId: fieldForm.areaId,
            carried: fieldForm.carried,
            steps: Number(fieldForm.steps) || 0,
            proofId: fieldForm.proofId || undefined,
          }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMessage(
        action === "checkin" ? "মাঠ সেশন শুরু হয়েছে।" : "মাঠ সেশন শেষ হয়েছে।",
      );
      if (action === "checkout")
        setFieldForm({
          areaId: fieldForm.areaId,
          steps: 0,
          carried: [],
          proofId: "",
        });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openFieldId = ownField?.id,
    trackingMinutes = bundle?.program?.settings?.trackingMinutes;
  useEffect(() => {
    if (!openFieldId || !trackingMinutes) return;
    const timer = setInterval(
      () => {
        if (document.hidden) return;
        void gps()
          .then((position) =>
            fetch("/api/incubation/field", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "ping", programId, position }),
            }),
          )
          .catch(() => {});
      },
      Math.max(1, trackingMinutes) * 60000,
    );
    return () => clearInterval(timer);
  }, [openFieldId, programId, trackingMinutes]);
  useEffect(() => {
    if (!programId) return;
    const timer = setInterval(() => {
      if (!document.hidden && !editor && !busy) void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [programId, load, editor, busy]);
  const upload = async (file: File, teamId: string) => {
    if (file.type.startsWith("image/")) {
      const originalName = file.name;
      const compress = (await import("browser-image-compression")).default;
      const compressed = await compress(file, {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
      });
      file = new File(
        [compressed],
        originalName.replace(/\.[^.]+$/, "") + ".jpg",
        { type: "image/jpeg" },
      );
    }
    const form = new FormData();
    form.set("file", file);
    form.set("programId", programId);
    form.set("teamId", teamId);
    const r = await fetch("/api/incubation/files", {
        method: "POST",
        body: form,
      }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  };
  const uploadEditor = async (file?: File) => {
    if (!file || !editor) return;
    setBusy(true);
    try {
      const f = await upload(
        file,
        editor.data.teamId || bundle?.member?.teamId || "",
      );
      setEditor((e) =>
        e
          ? {
              ...e,
              data: { ...e.data, data: { ...e.data.data, voucherId: f.id } },
            }
          : e,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const newRecord = (kind: RecordKind = "sale") =>
    setEditor({
      type: "record",
      data: {
        teamId: bundle?.member?.teamId || bundle?.teams?.[0]?.id || "",
        kind,
        date: todayDhaka(),
        requestKey: crypto.randomUUID(),
        targetTeamId: "",
        data: {
          lines: [{ productId: "", quantity: "1", unitPrice: "", cash: "" }],
          amount: "",
          note: "",
          reason: "",
          findings: ["", "", ""],
          actions: ["", "", ""],
        },
      },
    });
  const editRecord = (r: Row) =>
    setEditor({
      type: "correct",
      original: r,
      data: {
        ...r,
        data: JSON.parse(JSON.stringify(r.data)),
        reason: "",
        void: false,
      },
    });
  const setValue = (key: string, value: any) =>
    setEditor((e) => (e ? { ...e, data: { ...e.data, [key]: value } } : e));
  const setData = (key: string, value: any) =>
    setEditor((e) =>
      e
        ? { ...e, data: { ...e.data, data: { ...e.data.data, [key]: value } } }
        : e,
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const d = editor.data;
      let action: string = editor.type,
        payload: Row = d;
      if (editor.type === "program") {
        payload = {
          ...d,
          endDate: d.endDate || null,
          settings: {
            ...d.settings,
            sessions: (d.settings.sessions || [])
              .map((v: string) => v.trim())
              .filter(Boolean),
            segments: (d.settings.segments || [])
              .map((v: string) => v.trim())
              .filter(Boolean),
            objections: (d.settings.objections || [])
              .map((v: string) => v.trim())
              .filter(Boolean),
            fgdRequiredCount: Number(d.settings.fgdRequiredCount || 1),
            salesReminder: d.settings.salesReminder !== false,
            fgdEveryDays:
              d.settings.fgdEveryDays === "" || d.settings.fgdEveryDays == null
                ? null
                : Number(d.settings.fgdEveryDays),
            sprintDays: Number(d.settings.sprintDays),
            maxFieldHours:
              d.settings.maxFieldHours === "" ||
              d.settings.maxFieldHours === null
                ? null
                : Number(d.settings.maxFieldHours),
            trackingMinutes: Number(d.settings.trackingMinutes),
            retentionDays: Number(d.settings.retentionDays),
          },
        };
        delete payload.id;
      }
      if (editor.type === "catalog")
        payload = { ...d, parentId: d.parentId || null };
      if (editor.type === "record" || editor.type === "correct") {
        const kind = d.kind as RecordKind,
          raw: Row = { ...d.data };
        if (
          [
            "purchase",
            "sale",
            "supplier_return",
            "transfer",
            "customer_refund",
            "damage",
          ].includes(kind)
        )
          raw.lines = raw.lines?.map((l: Row) => ({
            productId: l.productId,
            quantity: String(l.quantity),
            ...(kind !== "damage"
              ? { unitPrice: String(l.unitPrice || "0") }
              : {}),
            ...(kind === "sale" && l.cash !== "" && l.cash !== undefined
              ? { cash: String(l.cash) }
              : {}),
          }));
        else delete raw.lines;
        if (!["fund", "repayment", "expense", "cash_count"].includes(kind))
          delete raw.amount;
        if (kind !== "fgd") {
          delete raw.findings;
          delete raw.actions;
        }
        for (const key of Object.keys(raw))
          if (raw[key] === "") delete raw[key];
        if (editor.type === "record")
          payload = {
            teamId: d.teamId,
            targetTeamId: kind === "transfer" ? d.targetTeamId : null,
            kind,
            date: d.date,
            data: raw,
            requestKey: d.requestKey,
          };
        else
          payload = {
            recordId: d.id,
            version: d.version,
            date: d.date,
            data: raw,
            reason: d.reason,
            void: d.void || false,
          };
      }
      if (editor.type === "review") {
        action = d.reviewType;
        payload = {
          ...(action === "review_correction"
            ? { id: d.id }
            : { recordId: d.id }),
          approve: d.approve,
          reason: d.reason,
          voucherId: d.data?.voucherId || undefined,
        };
      }
      const result = await send(
        action,
        payload,
        editor.type === "program" ? d.id || "" : programId,
      );
      setEditor(null);
      setMessage(
        editor.type === "correct" && !bundle?.manager
          ? "সংশোধন অনুরোধ পাঠানো হয়েছে।"
          : "সফলভাবে সংরক্ষিত হয়েছে।",
      );
      if (editor.type === "program" && !programId)
        router.push("/dashboard/competitions/" + result.competitionId);
      else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (format: string, scope?: string) => {
    setBusy(true);
    try {
      const q = new URLSearchParams({
        programId,
        format,
        ...(scope ? { sheet: scope } : {}),
        ...(personId ? { personId } : {}),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });
      const r = await fetch(`/api/incubation/export?${q}`);
      if (!r.ok) throw Error((await r.json()).error);
      const blob = await r.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `Business_Incubation_${todayDhaka()}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportButtons = (scope?: string) => (
    <div
      className="inc-row"
      style={{ justifyContent: "end", margin: "12px 0" }}
    >
      {["xlsx", "pdf"].map((format) => (
        <button
          key={format}
          className="inc-btn"
          disabled={busy || !!reportError}
          onClick={() => download(format, scope)}
        >
          <Download size={15} />
          {format === "xlsx" ? "Excel" : "PDF"}
        </button>
      ))}
    </div>
  );
  const pending =
    (bundle?.fieldCorrections?.filter((c: Row) => c.status === "pending")
      .length || 0) +
    (bundle?.corrections?.filter((c: Row) => c.status === "pending").length ||
      0) +
    (bundle?.records?.filter((r: Row) =>
      ["pending", "transfer_pending"].includes(r.status),
    ).length || 0);
  const notices = (
    <>
      {error && (
        <div role="alert" className="inc-notice inc-error">
          {error}
        </div>
      )}
      {reportError && (
        <div role="alert" className="inc-notice inc-error">
          {reportError}
        </div>
      )}
      {message && (
        <div role="status" className="inc-notice inc-row inc-between">
          {message}
          <button aria-label="বন্ধ করুন" onClick={() => setMessage("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
  const filtersUI = (
    <div className="inc-filters">
      <Field name="ব্যাচ">
        <select
          value={filters.batchName || ""}
          onChange={(e) =>
            setFilters({ ...filters, batchName: e.target.value, teamId: "" })
          }
        >
          <option value="">সব ব্যাচ</option>
          {bundle?.program?.batchNames.map((n: string) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Field>
      <Field name="স্প্রিন্ট">
        <select
          value={
            bundle?.sprints?.find(
              (s: Row) =>
                filters.from === s.startDate &&
                filters.to === s.endDate &&
                filters.teamId === s.teamId &&
                filters.categoryId === s.categoryId,
            )?.id || ""
          }
          onChange={(e) => {
            const s = bundle?.sprints.find((s: Row) => s.id === e.target.value);
            setFilters(
              s
                ? {
                    ...filters,
                    batchName: "",
                    teamId: s.teamId,
                    from: s.startDate,
                    to: s.endDate,
                    categoryId: s.categoryId,
                    productId: "",
                  }
                : {},
            );
          }}
        >
          <option value="">কাস্টম সময় / সব</option>
          {bundle?.sprints?.map((s: Row) => (
            <option key={s.id} value={s.id}>
              {teamName(s.teamId)} • {s.startDate}–{s.endDate}
            </option>
          ))}
        </select>
      </Field>
      <Field name="শুরু">
        <input
          aria-label="শুরুর তারিখ"
          type="date"
          value={filters.from || ""}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
      </Field>
      <Field name="শেষ">
        <input
          aria-label="শেষ তারিখ"
          type="date"
          value={filters.to || ""}
          min={filters.from}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
      </Field>
      <Field name="টিম">
        <select
          value={filters.teamId || ""}
          onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
        >
          <option value="">সব টিম</option>
          {bundle?.teams?.map((t: Row) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field name="ক্যাটাগরি">
        <select
          value={filters.categoryId || ""}
          onChange={(e) =>
            setFilters({
              ...filters,
              categoryId: e.target.value,
              productId: "",
            })
          }
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((t: Row) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field name="পণ্য">
        <select
          value={filters.productId || ""}
          onChange={(e) =>
            setFilters({ ...filters, productId: e.target.value })
          }
        >
          <option value="">সব পণ্য</option>
          {products
            .filter(
              (p: Row) =>
                !filters.categoryId || p.parentId === filters.categoryId,
            )
            .map((p: Row) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </Field>
      <Field name="ব্রড এরিয়া">
        <select
          value={filters.areaId || ""}
          onChange={(e) => setFilters({ ...filters, areaId: e.target.value })}
        >
          <option value="">সব এলাকা</option>
          {areas.map((a: Row) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <button
        className="inc-btn"
        onClick={() => setFilters({})}
        title="ফিল্টার রিসেট"
      >
        <RefreshCw size={15} />
      </button>
    </div>
  );
  const recordsTable = (rows: Row[]) => (
    <GridTable
      rows={rows}
      columns={[
        {
          title: "তারিখ / জমার সময়",
          render: (r) => (
            <>
              <b>{r.date}</b>
              <div className="inc-sub">
                দিন{" "}
                {Math.floor(
                  (Date.parse(r.date) - Date.parse(bundle?.program.startDate)) /
                    86400000,
                ) + 1}
              </div>
              <div className="inc-sub">{stamp(r.createdAt)}</div>
            </>
          ),
        },
        {
          title: "টিম",
          render: (r) => (
            <>
              {teamName(r.teamId)}
              {r.targetTeamId && (
                <div className="inc-sub">→ {teamName(r.targetTeamId)}</div>
              )}
            </>
          ),
        },
        {
          title: "তথ্য",
          render: (r) => (
            <div className="wrap">
              {r.data.lines?.map((l: Row, i: number) => (
                <div key={i}>
                  {productName(l.productId)} × {l.quantity}{" "}
                  {l.unitPrice && `• ৳${l.unitPrice}`}
                </div>
              ))}
              {r.data.amount && money(Math.round(Number(r.data.amount) * 100))}
              {r.kind === "fgd" && r.data.findings?.join(" • ")}
              {r.kind === "insight" && r.data.segment}
            </div>
          ),
        },
        {
          title: "ভাউচার",
          render: (r) =>
            r.data.voucherId ? (
              <a
                href={`/api/incubation/files/${r.data.voucherId}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText size={17} />
              </a>
            ) : (
              "—"
            ),
        },
        { title: "অবস্থা", render: (r) => <Badge value={r.status} /> },
        {
          title: "সংশোধন",
          render: (r) => (
            <div className="inc-row">
              <span className="inc-sub">{Math.max(0, r.version - 1)} বার</span>
              {r.status === "posted" &&
                (bundle?.manager ||
                  bundle?.member?.isLead ||
                  (!FINANCIAL_KINDS.includes(r.kind) &&
                    r.enteredBy === bundle?.actor?.id)) && (
                  <button className="inc-btn" onClick={() => editRecord(r)}>
                    {bundle?.manager ? "এডিট" : "অনুরোধ"}
                  </button>
                )}
            </div>
          ),
        },
      ]}
    />
  );
  const reconciliation =
    bundle?.manager && bundle?.program
      ? [
          ...bundle.teams.flatMap((t: Row) => [
            ...(!t.members.some((m: Row) => m.isLead)
              ? [{ team: t.name, issue: "টিম লিডার নেই" }]
              : []),
            ...(!bundle.sprints.some(
              (sp: Row) =>
                sp.teamId === t.id &&
                sp.startDate <= todayDhaka() &&
                sp.endDate >= todayDhaka(),
            )
              ? [{ team: t.name, issue: "আজকের sprint নেই" }]
              : []),
          ]),
          ...bundle.ledger.summaries.flatMap((v: Row) => [
            ...(v.cash < 0
              ? [
                  {
                    team: teamName(v.teamId),
                    issue: "ক্যাশ হিসাব ঋণাত্মক: " + money(v.cash),
                  },
                ]
              : []),
            ...(v.variance
              ? [
                  {
                    team: teamName(v.teamId),
                    issue:
                      "বিক্রির মূল্য ও পাওয়া টাকা পার্থক্য: " +
                      money(v.variance),
                  },
                ]
              : []),
            ...(v.cashDifference
              ? [
                  {
                    team: teamName(v.teamId),
                    issue: "গণনার সময় ক্যাশের অমিল: " + money(v.cashDifference),
                  },
                ]
              : []),
            ...(v.principalOutstanding
              ? [
                  {
                    team: teamName(v.teamId),
                    issue:
                      "মূল ফান্ড ফেরত বাকি: " + money(v.principalOutstanding),
                  },
                ]
              : []),
          ]),
          ...bundle.fields
            .filter((f: Row) => !f.checkOut)
            .map((f: Row) => ({
              team: teamName(f.teamId),
              issue: f.userName + " — checkout বাকি: " + stamp(f.checkIn),
            })),
          ...bundle.records
            .filter((r: Row) =>
              ["pending", "transfer_pending"].includes(r.status),
            )
            .map((r: Row) => ({
              team: teamName(r.teamId),
              issue: label(r.kind) + " — " + r.status,
            })),
        ]
      : [];
  const editorUI = (
    <>
      {editor && (
        <div
          className="inc-modal-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditor(null);
          }}
        >
          <form className="inc-modal" onSubmit={submit}>
            <div className="inc-modal-head inc-row inc-between">
              <div>
                <div className="inc-eyebrow" style={{ color: "#558568" }}>
                  BUSINESS INCUBATION
                </div>
                <h2 style={{ margin: "6px 0 0" }}>
                  {
                    {
                      program: "প্রোগ্রাম সেটআপ",
                      team: "টিম তৈরি / সম্পাদনা",
                      catalog: "ক্যাটালগ",
                      sprint: "স্প্রিন্ট ও ক্যাটাগরি",
                      record: label(editor.data.kind),
                      correct: bundle?.manager
                        ? "ডাটা সম্পাদনা"
                        : "সংশোধন অনুরোধ",
                      review: "অনুরোধ পর্যালোচনা",
                    }[editor.type]
                  }
                </h2>
              </div>
              <button
                type="button"
                aria-label="ফর্ম বন্ধ করুন"
                className="inc-btn"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="inc-modal-body">
              {error && (
                <div role="alert" className="inc-notice inc-error">
                  {error}
                </div>
              )}
              {editor.type === "program" && (
                <>
                  <div className="inc-form-grid">
                    <Field name="প্রোগ্রামের নাম">
                      <input
                        required
                        value={editor.data.name}
                        onChange={(e) => setValue("name", e.target.value)}
                      />
                    </Field>
                    <Field name="অবস্থা">
                      <select
                        value={editor.data.status}
                        onChange={(e) => setValue("status", e.target.value)}
                      >
                        {(editor.data.id
                          ? [
                              bundle?.program?.status || "draft",
                              ...allowedTransitions(bundle?.program?.status || "draft"),
                            ]
                          : ["draft", "active"]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s] || s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field name="শুরুর তারিখ">
                      <input
                        required
                        type="date"
                        value={editor.data.startDate}
                        onChange={(e) => setValue("startDate", e.target.value)}
                      />
                    </Field>
                    <Field name="শেষের তারিখ (ঐচ্ছিক)">
                      <input
                        type="date"
                        min={editor.data.startDate}
                        value={editor.data.endDate}
                        onChange={(e) => setValue("endDate", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field name="বিবরণ">
                    <textarea
                      value={editor.data.description}
                      onChange={(e) => setValue("description", e.target.value)}
                    />
                  </Field>
                  {editor.data.id && isProgramLocked(bundle?.program?.status || "") && (
                    <div className="inc-notice">
                      এই প্রোগ্রাম এখন &quot;{STATUS_LABELS[bundle?.program?.status] || bundle?.program?.status}&quot;।
                      শুধু অবস্থা বদলানো যাবে; অন্য তথ্য বদলাতে আগে কারণসহ আবার চালু করুন।
                    </div>
                  )}
                  {(editor.data.status === "closed" ||
                    (editor.data.id &&
                      transitionNeedsReason(bundle?.program?.status || "", editor.data.status))) && (
                    <Field
                      name={
                        editor.data.status === "closed"
                          ? "অসম্পূর্ণ হিসাব থাকলে বন্ধ করার ব্যাখ্যা"
                          : "অবস্থা বদলের কারণ (বাধ্যতামূলক)"
                      }
                    >
                      <textarea
                        value={editor.data.reason || ""}
                        onChange={(e) => setValue("reason", e.target.value)}
                      />
                    </Field>
                  )}
                  <div className="inc-form-grid">
                    <Field name="ব্যাচ নির্বাচন">
                      <div className="inc-checklist">
                        {(
                          bundle?.batches ||
                          bundle?.programs?.flatMap((p: Row) =>
                            p.batchNames.map((batchName: string) => ({
                              batchName,
                            })),
                          ) ||
                          []
                        )
                          .filter(
                            (b: Row, i: number, a: Row[]) =>
                              a.findIndex(
                                (x) => x.batchName === b.batchName,
                              ) === i,
                          )
                          .map((b: Row) => (
                            <label key={b.batchName}>
                              <input
                                type="checkbox"
                                checked={editor.data.batchNames.includes(
                                  b.batchName,
                                )}
                                onChange={(e) =>
                                  setValue(
                                    "batchNames",
                                    e.target.checked
                                      ? [...editor.data.batchNames, b.batchName]
                                      : editor.data.batchNames.filter(
                                          (x: string) => x !== b.batchName,
                                        ),
                                  )
                                }
                              />
                              {b.batchName}
                            </label>
                          ))}
                      </div>
                    </Field>
                    <Field name="সমন্বয়কারী শিক্ষক (সব শিক্ষক পরিচালনা করতে পারবেন)">
                      <div className="inc-checklist">
                        {bundle?.staff?.map((s: Row) => (
                          <label key={s.id}>
                            <input
                              type="checkbox"
                              checked={editor.data.staffIds.includes(s.id)}
                              onChange={(e) =>
                                setValue(
                                  "staffIds",
                                  e.target.checked
                                    ? [...editor.data.staffIds, s.id]
                                    : editor.data.staffIds.filter(
                                        (x: string) => x !== s.id,
                                      ),
                                )
                              }
                            />
                            {s.displayName}
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <div className="inc-form-grid">
                    {[
                      ["sprintDays", "স্প্রিন্টের দিন (নিজে দিন)", true],
                      ["maxFieldHours", "মাঠের সর্বোচ্চ ঘণ্টা (ঐচ্ছিক)", false],
                      [
                        "trackingMinutes",
                        "পেজ খোলা থাকলে GPS আপডেটের মিনিট",
                        true,
                      ],
                      ["retentionDays", "GPS ইতিহাস সংরক্ষণের দিন", true],
                    ].map(([key, title, required]) => (
                      <Field key={String(key)} name={String(title)}>
                        <input
                          type="number"
                          min={key === "maxFieldHours" ? 0.25 : 1}
                          max={
                            key === "trackingMinutes"
                              ? 60
                              : key === "retentionDays"
                                ? 730
                                : key === "maxFieldHours"
                                  ? 168
                                  : 365
                          }
                          step={key === "maxFieldHours" ? 0.25 : 1}
                          required={!!required}
                          value={editor.data.settings[String(key)] ?? ""}
                          onChange={(e) =>
                            setValue("settings", {
                              ...editor.data.settings,
                              [String(key)]: e.target.value,
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={editor.data.settings.enforceCategory}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          enforceCategory: e.target.checked,
                        })
                      }
                    />
                    শুধু নির্ধারিত স্প্রিন্টের ক্যাটাগরিতে কেনা যাবে
                  </label>
                  <div className="inc-form-grid">
                    {[
                      ["sessions", "বিক্রির session"],
                      ["segments", "Customer segments"],
                      ["objections", "প্রধান objections"],
                    ].map(([key, title]) => (
                      <Field key={key} name={title + " (প্রতি লাইনে একটি)"}>
                        <textarea
                          value={(editor.data.settings[key] || []).join("\n")}
                          onChange={(e) =>
                            setValue("settings", {
                              ...editor.data.settings,
                              [key]: e.target.value.split("\n"),
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <Field name="বাধ্যতামূলক FGD finding/action সংখ্যা">
                    <select
                      value={editor.data.settings.fgdRequiredCount || 1}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          fgdRequiredCount: Number(e.target.value),
                        })
                      }
                    >
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={!!editor.data.settings.sessionsRequired}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          sessionsRequired: e.target.checked,
                        })
                      }
                    />
                    বিক্রির session বাধ্যতামূলক
                  </label>
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={!!editor.data.settings.whyBoughtRequired}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          whyBoughtRequired: e.target.checked,
                        })
                      }
                    />
                    Insight-এ “কেন কিনেছে” বাধ্যতামূলক
                  </label>
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={editor.data.settings.salesReminder !== false}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          salesReminder: e.target.checked,
                        })
                      }
                    />
                    আগের দিনের বিক্রির এন্ট্রি না থাকলে লিডার ও শিক্ষককে রিমাইন্ডার দিন
                  </label>
                  <Field name="FGD রিমাইন্ডার: প্রতি কত দিনে অন্তত একটি FGD (ফাঁকা = বন্ধ)">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={editor.data.settings.fgdEveryDays ?? ""}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          fgdEveryDays: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field name="খরচের ধরন (প্রতি লাইনে একটি)">
                    <textarea
                      value={editor.data.settings.expenseTypes.join("\n")}
                      onChange={(e) =>
                        setValue("settings", {
                          ...editor.data.settings,
                          expenseTypes: e.target.value.split("\n"),
                        })
                      }
                    />
                  </Field>
                  <div className="inc-notice">
                    কেনার ভাউচার সবসময় বাধ্যতামূলক। আজ/আগামীকালের পরে আগের দিনের
                    জমা অনুমোদনের জন্য যাবে। লাভ টিমের কাছে থাকবে।
                  </div>
                </>
              )}
              {editor.type === "team" && (
                <>
                  <Field name="ব্যাচ">
                    <select
                      required
                      value={editor.data.batchName || ""}
                      onChange={(e) =>
                        setEditor((x) =>
                          x
                            ? {
                                ...x,
                                data: {
                                  ...x.data,
                                  batchName: e.target.value,
                                  studentIds: [],
                                  leadId: "",
                                },
                              }
                            : x,
                        )
                      }
                    >
                      <option value="">ব্যাচ বাছুন</option>
                      {bundle?.program.batchNames.map((n: string) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  {!editor.data.id && (
                    <Field name="আগের Competition গ্রুপ থেকে কপি (ঐচ্ছিক)">
                      <select
                        value=""
                        onChange={(e) => {
                          const g = bundle?.groupTemplates?.find(
                            (g: Row) => g.id === e.target.value,
                          );
                          if (!g) return;
                          const members = (g.members || []) as Row[];
                          const selected = (bundle?.roster || []).filter(
                            (s: Row) =>
                              s.batchName === g.batchName &&
                              members.some(
                                (m) => String(m.roll) === String(s.roll),
                              ),
                          );
                          setEditor((x) =>
                            x
                              ? {
                                  ...x,
                                  data: {
                                    ...x.data,
                                    batchName: g.batchName,
                                    name: g.groupName,
                                    studentIds: selected.map((s: Row) => s.id),
                                    leadId:
                                      selected.find((s: Row) =>
                                        members.some(
                                          (m) =>
                                            String(m.roll) === String(s.roll) &&
                                            m.isLeader,
                                        ),
                                      )?.id || "",
                                  },
                                }
                              : x,
                          );
                        }}
                      >
                        <option value="">
                          গ্রুপ বাছুন—পরে সদস্য ও লিডার যাচাই করুন
                        </option>
                        {bundle?.groupTemplates
                          ?.filter(
                            (g: Row) => g.batchName === editor.data.batchName,
                          )
                          .map((g: Row) => (
                            <option key={g.id} value={g.id}>
                              {g.groupName}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                  <Field name="টিমের নাম">
                    <input
                      required
                      value={editor.data.name}
                      onChange={(e) => setValue("name", e.target.value)}
                    />
                  </Field>
                  <Field name="বিদ্যমান শিক্ষার্থী থেকে সদস্য নির্বাচন">
                    <div className="inc-checklist">
                      {bundle?.roster
                        ?.filter(
                          (s: Row) => s.batchName === editor.data.batchName,
                        )
                        .map((s: Row) => {
                          const taken = bundle.teams.some(
                            (t: Row) =>
                              t.id !== editor.data.id &&
                              t.members.some((m: Row) => m.studentId === s.id),
                          );
                          return (
                            <label key={s.id}>
                              <input
                                type="checkbox"
                                disabled={taken}
                                checked={editor.data.studentIds.includes(s.id)}
                                onChange={(e) => {
                                  setValue(
                                    "studentIds",
                                    e.target.checked
                                      ? [...editor.data.studentIds, s.id]
                                      : editor.data.studentIds.filter(
                                          (x: string) => x !== s.id,
                                        ),
                                  );
                                  if (
                                    !e.target.checked &&
                                    editor.data.leadId === s.id
                                  )
                                    setValue("leadId", "");
                                }}
                              />
                              {s.batchName} · {s.roll} · {s.name}
                              {taken && " (অন্য টিমে আছে)"}
                            </label>
                          );
                        })}
                    </div>
                  </Field>
                  <Field name="টিম লিডার">
                    <select
                      required
                      value={editor.data.leadId || ""}
                      onChange={(e) => setValue("leadId", e.target.value)}
                    >
                      <option value="">সদস্য থেকে বাছুন</option>
                      {bundle?.roster
                        ?.filter((s: Row) =>
                          editor.data.studentIds.includes(s.id),
                        )
                        .map((s: Row) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.roll})
                          </option>
                        ))}
                    </select>
                  </Field>
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={editor.data.active}
                      onChange={(e) => setValue("active", e.target.checked)}
                    />
                    সক্রিয় টিম
                  </label>
                </>
              )}
              {editor.type === "catalog" && (
                <>
                  <Field name="নাম">
                    <input
                      required
                      value={editor.data.name}
                      onChange={(e) => setValue("name", e.target.value)}
                    />
                  </Field>
                  {editor.data.kind === "product" && (
                    <>
                      <Field name="ক্যাটাগরি">
                        <select
                          required
                          value={editor.data.parentId || ""}
                          onChange={(e) => setValue("parentId", e.target.value)}
                        >
                          <option value="">বাছুন</option>
                          {categories.map((c: Row) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field name="ভ্যারিয়েন্ট (ঐচ্ছিক)">
                        <input
                          value={editor.data.variant || ""}
                          onChange={(e) => setValue("variant", e.target.value)}
                          placeholder="যেমন: 100g / লাল / বড়"
                        />
                      </Field>
                      <Field name="একক">
                        <input
                          required
                          value={editor.data.unit}
                          onChange={(e) => setValue("unit", e.target.value)}
                          placeholder="piece / kg / packet"
                        />
                      </Field>
                      <label className="inc-row">
                        <input
                          type="checkbox"
                          checked={editor.data.fractional}
                          onChange={(e) =>
                            setValue("fractional", e.target.checked)
                          }
                        />
                        ভগ্নাংশ পরিমাণ দেওয়া যাবে
                      </label>
                    </>
                  )}
                  <label className="inc-row">
                    <input
                      type="checkbox"
                      checked={editor.data.active}
                      onChange={(e) => setValue("active", e.target.checked)}
                    />
                    সক্রিয়
                  </label>
                </>
              )}
              {editor.type === "sprint" && (
                <>
                  <div className="inc-form-grid">
                    <Field name="টিম">
                      <select
                        required
                        value={editor.data.teamId}
                        onChange={(e) => setValue("teamId", e.target.value)}
                      >
                        {bundle?.teams.map((t: Row) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field name="ক্যাটাগরি">
                      <select
                        required
                        value={editor.data.categoryId}
                        onChange={(e) => setValue("categoryId", e.target.value)}
                      >
                        <option value="">বাছুন</option>
                        {categories.map((c: Row) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field name="শুরু">
                      <input
                        required
                        type="date"
                        value={editor.data.startDate}
                        onChange={(e) => {
                          const d = new Date(`${e.target.value}T00:00:00Z`);
                          d.setUTCDate(
                            d.getUTCDate() +
                              Number(bundle?.program.settings.sprintDays) -
                              1,
                          );
                          setEditor((x) =>
                            x
                              ? {
                                  ...x,
                                  data: {
                                    ...x.data,
                                    startDate: e.target.value,
                                    endDate: d.toISOString().slice(0, 10),
                                  },
                                }
                              : x,
                          );
                        }}
                      />
                    </Field>
                    <Field name="শেষ">
                      <input
                        required
                        type="date"
                        min={editor.data.startDate}
                        value={editor.data.endDate}
                        onChange={(e) => setValue("endDate", e.target.value)}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    className="inc-btn"
                    onClick={() => {
                      const d = new Date(`${editor.data.startDate}T00:00:00Z`);
                      d.setUTCDate(
                        d.getUTCDate() +
                          Number(bundle?.program.settings.sprintDays) -
                          1,
                      );
                      setValue("endDate", d.toISOString().slice(0, 10));
                    }}
                  >
                    প্রোগ্রামের {bundle?.program.settings.sprintDays} দিন
                    অনুযায়ী শেষ তারিখ দিন
                  </button>
                </>
              )}
              {(editor.type === "record" || editor.type === "correct") && (
                <>
                  <div className={editor.original ? "inc-form-grid" : ""}>
                    {editor.original && (
                      <aside className="inc-old">
                        <h3>আগের তথ্য — অপরিবর্তনযোগ্য</h3>
                        <dl>
                          <dt>তারিখ / ধরন</dt>
                          <dd>
                            {editor.original.date} ·{" "}
                            {label(editor.original.kind)}
                          </dd>
                          {editor.original.data.lines?.map(
                            (l: Row, i: number) => (
                              <div key={i}>
                                <dt>{productName(l.productId)}</dt>
                                <dd>
                                  {l.quantity} × ৳{l.unitPrice || 0}
                                  {l.cash !== undefined &&
                                    ` / পাওয়া ৳${l.cash}`}
                                </dd>
                              </div>
                            ),
                          )}
                          <dt>টাকা / কারণ / নোট</dt>
                          <dd>
                            {editor.original.data.amount || ""}
                            <br />
                            {editor.original.data.reason}
                            <br />
                            {editor.original.data.note}
                          </dd>
                          <dt>Findings / Actions / Insights</dt>
                          <dd>
                            <RecordSnapshot
                              record={{
                                data: {
                                  findings: editor.original.data.findings,
                                  actions: editor.original.data.actions,
                                  segment: editor.original.data.segment,
                                  objections: editor.original.data.objections,
                                  whyBought: editor.original.data.whyBought,
                                  bestArea: editor.original.data.bestArea,
                                },
                              }}
                              products={products}
                            />
                          </dd>
                          <dt>সংস্করণ</dt>
                          <dd>{editor.original.version}</dd>
                        </dl>
                      </aside>
                    )}
                    <div style={{ display: "grid", gap: 16 }}>
                      <div className="inc-form-grid">
                        <Field name="টিম">
                          <select
                            required
                            disabled={student || editor.type === "correct"}
                            value={editor.data.teamId}
                            onChange={(e) => setValue("teamId", e.target.value)}
                          >
                            {bundle?.teams.map((t: Row) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field name="ব্যবসার তারিখ">
                          <input
                            type="date"
                            required
                            min={bundle?.program.startDate}
                            max={todayDhaka()}
                            value={editor.data.date}
                            onChange={(e) => setValue("date", e.target.value)}
                          />
                        </Field>
                      </div>
                      {[
                        "purchase",
                        "sale",
                        "supplier_return",
                        "transfer",
                        "customer_refund",
                        "damage",
                      ].includes(editor.data.kind) && (
                        <div className="inc-lines">
                          <h3>
                            {editor.original
                              ? "সংশোধিত পণ্যের তথ্য"
                              : "পণ্যের তথ্য"}
                          </h3>
                          {editor.data.data.lines?.map((l: Row, i: number) => (
                            <div className="inc-line" key={i}>
                              <Field name="পণ্য / ভ্যারিয়েন্ট">
                                <select
                                  required
                                  value={l.productId}
                                  onChange={(e) =>
                                    setData(
                                      "lines",
                                      editor.data.data.lines.map(
                                        (x: Row, j: number) =>
                                          i === j
                                            ? {
                                                ...x,
                                                productId: e.target.value,
                                              }
                                            : x,
                                      ),
                                    )
                                  }
                                >
                                  <option value="">পণ্য বাছুন</option>
                                  {products
                                    .filter(
                                      (p: Row) =>
                                        editor.type === "correct" ||
                                        ![
                                          "sale",
                                          "supplier_return",
                                          "transfer",
                                          "damage",
                                        ].includes(editor.data.kind) ||
                                        (bundle?.ledger?.stocks[
                                          editor.data.teamId + "|" + p.id
                                        ]?.quantity || 0) -
                                          (bundle?.ledger?.reserved?.[
                                            editor.data.teamId + "|" + p.id
                                          ] || 0) >
                                          0,
                                    )
                                    .map((p: Row) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                        {p.variant ? " · " + p.variant : ""} (
                                        {p.unit})
                                        {editor.data.kind === "sale"
                                          ? " · উপলব্ধ " +
                                            ((bundle?.ledger?.stocks[
                                              editor.data.teamId + "|" + p.id
                                            ]?.quantity || 0) -
                                              (bundle?.ledger?.reserved?.[
                                                editor.data.teamId + "|" + p.id
                                              ] || 0)) /
                                              1000
                                          : ""}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                              <Field name="পরিমাণ">
                                <input
                                  required
                                  type="number"
                                  step="0.001"
                                  min="0.001"
                                  value={l.quantity}
                                  onChange={(e) =>
                                    setData(
                                      "lines",
                                      editor.data.data.lines.map(
                                        (x: Row, j: number) =>
                                          i === j
                                            ? { ...x, quantity: e.target.value }
                                            : x,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              {editor.data.kind !== "damage" && (
                                <Field
                                  name={
                                    editor.data.kind === "sale"
                                      ? "বিক্রয় মূল্য / একক"
                                      : editor.data.kind === "customer_refund"
                                        ? "রিফান্ড / একক"
                                        : editor.data.kind ===
                                              "supplier_return" ||
                                            editor.data.kind === "transfer"
                                          ? "ফেরত মূল্য / একক"
                                          : "ক্রয় মূল্য / একক"
                                  }
                                >
                                  <input
                                    required
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={l.unitPrice || ""}
                                    onChange={(e) =>
                                      setData(
                                        "lines",
                                        editor.data.data.lines.map(
                                          (x: Row, j: number) =>
                                            i === j
                                              ? {
                                                  ...x,
                                                  unitPrice: e.target.value,
                                                }
                                              : x,
                                        ),
                                      )
                                    }
                                  />
                                </Field>
                              )}
                              {editor.data.kind === "sale" && (
                                <Field name="পাওয়া টাকা (ঐচ্ছিক)">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="ফাঁকা = মোট"
                                    value={l.cash ?? ""}
                                    onChange={(e) =>
                                      setData(
                                        "lines",
                                        editor.data.data.lines.map(
                                          (x: Row, j: number) =>
                                            i === j
                                              ? { ...x, cash: e.target.value }
                                              : x,
                                        ),
                                      )
                                    }
                                  />
                                </Field>
                              )}
                              <button
                                type="button"
                                aria-label="পণ্যের লাইন মুছুন"
                                className="inc-btn"
                                onClick={() =>
                                  setData(
                                    "lines",
                                    editor.data.data.lines.filter(
                                      (_: Row, j: number) => i !== j,
                                    ),
                                  )
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="inc-btn"
                            onClick={() =>
                              setData("lines", [
                                ...(editor.data.data.lines || []),
                                {
                                  productId: "",
                                  quantity: "1",
                                  unitPrice: "",
                                  cash: "",
                                },
                              ])
                            }
                          >
                            <Plus size={14} />
                            আরেকটি পণ্য
                          </button>
                        </div>
                      )}
                      {editor.data.kind === "transfer" && (
                        <Field name="গ্রহণকারী টিম">
                          <select
                            required
                            value={editor.data.targetTeamId || ""}
                            onChange={(e) =>
                              setValue("targetTeamId", e.target.value)
                            }
                            disabled={editor.type === "correct"}
                          >
                            <option value="">টিম বাছুন</option>
                            {(bundle?.transferTeams || bundle?.teams)
                              ?.filter((t: Row) => t.id !== editor.data.teamId)
                              .map((t: Row) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                      )}
                      {editor.data.kind === "customer_refund" && (
                        <>
                          <Field name="মূল বিক্রির রেকর্ড">
                            <select
                              required
                              value={editor.data.data.sourceId || ""}
                              onChange={(e) =>
                                setData("sourceId", e.target.value)
                              }
                            >
                              <option value="">বিক্রি বাছুন</option>
                              {bundle?.records
                                ?.filter(
                                  (r: Row) =>
                                    r.kind === "sale" &&
                                    r.status === "posted" &&
                                    r.teamId === editor.data.teamId,
                                )
                                .map((r: Row) => (
                                  <option key={r.id} value={r.id}>
                                    {r.date} •{" "}
                                    {r.data.lines
                                      ?.map((l: Row) =>
                                        productName(l.productId),
                                      )
                                      .join(", ")}{" "}
                                    ({r.id.slice(0, 6)})
                                  </option>
                                ))}
                            </select>
                          </Field>
                          <label className="inc-row">
                            <input
                              type="checkbox"
                              checked={editor.data.data.saleable !== false}
                              onChange={(e) =>
                                setData("saleable", e.target.checked)
                              }
                            />
                            ফেরত পণ্য বিক্রিযোগ্য স্টকে ফিরবে
                          </label>
                        </>
                      )}
                      {["sale", "insight"].includes(editor.data.kind) && (
                        <Field name="ব্রড এরিয়া">
                          <select
                            required={editor.data.kind === "sale"}
                            value={editor.data.data.areaId || ""}
                            onChange={(e) => setData("areaId", e.target.value)}
                          >
                            <option value="">বাছুন</option>
                            {areas.map((a: Row) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      {["expense", "fund", "repayment", "cash_count"].includes(
                        editor.data.kind,
                      ) && (
                        <Field name="টাকার পরিমাণ">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={editor.data.data.amount || ""}
                            onChange={(e) => setData("amount", e.target.value)}
                          />
                        </Field>
                      )}
                      {editor.data.kind === "sale" && (
                        <div className="inc-form-grid">
                          <Field name="প্রোগ্রামের দিন">
                            <input
                              readOnly
                              value={
                                Math.floor(
                                  (Date.parse(editor.data.date + "T00:00:00Z") -
                                    Date.parse(
                                      bundle?.program.startDate + "T00:00:00Z",
                                    )) /
                                    86400000,
                                ) + 1
                              }
                            />
                          </Field>
                          <Field name="বিক্রির session">
                            <select
                              required={
                                !!bundle?.program.settings.sessionsRequired
                              }
                              value={editor.data.data.session || ""}
                              onChange={(e) =>
                                setData("session", e.target.value)
                              }
                            >
                              <option value="">বাছুন / প্রযোজ্য নয়</option>
                              {(bundle?.program.settings.sessions || []).map(
                                (v: string) => (
                                  <option key={v}>{v}</option>
                                ),
                              )}
                            </select>
                          </Field>
                        </div>
                      )}
                      {editor.data.kind === "fund" && (
                        <Field name="ফান্ডের রাউন্ড / reference">
                          <input
                            value={editor.data.data.round || ""}
                            onChange={(e) => setData("round", e.target.value)}
                          />
                        </Field>
                      )}
                      {editor.data.kind === "expense" && (
                        <Field name="খরচের ধরন">
                          <select
                            required
                            value={editor.data.data.expenseType || ""}
                            onChange={(e) =>
                              setData("expenseType", e.target.value)
                            }
                          >
                            <option value="">বাছুন</option>
                            {bundle?.program.settings.expenseTypes.map(
                              (s: string) => (
                                <option key={s}>{s}</option>
                              ),
                            )}
                          </select>
                        </Field>
                      )}
                      {editor.data.kind === "fgd" &&
                        [0, 1, 2].map((i) => (
                          <div className="inc-form-grid" key={i}>
                            <Field name={`Finding ${i + 1}`}>
                              <textarea
                                required={
                                  i <
                                  (bundle?.program.settings.fgdRequiredCount ||
                                    1)
                                }
                                value={editor.data.data.findings?.[i] || ""}
                                onChange={(e) =>
                                  setData(
                                    "findings",
                                    (
                                      editor.data.data.findings || ["", "", ""]
                                    ).map((s: string, j: number) =>
                                      i === j ? e.target.value : s,
                                    ),
                                  )
                                }
                              />
                            </Field>
                            <Field name={`Action ${i + 1}`}>
                              <textarea
                                required={
                                  i <
                                  (bundle?.program.settings.fgdRequiredCount ||
                                    1)
                                }
                                value={editor.data.data.actions?.[i] || ""}
                                onChange={(e) =>
                                  setData(
                                    "actions",
                                    (
                                      editor.data.data.actions || ["", "", ""]
                                    ).map((s: string, j: number) =>
                                      i === j ? e.target.value : s,
                                    ),
                                  )
                                }
                              />
                            </Field>
                          </div>
                        ))}
                      {editor.data.kind === "insight" &&
                        [
                          ["segment", "সেরা customer segment"],
                          ["objections", "প্রধান আপত্তি"],
                          ["whyBought", "কেন কিনেছে"],
                          ["bestArea", "সেরা বিক্রির এলাকা"],
                        ].map(([key, title]) => (
                          <Field key={key} name={title}>
                            {["segment", "objections"].includes(key) &&
                            (
                              bundle?.program.settings[
                                key === "segment" ? "segments" : "objections"
                              ] || []
                            ).length > 0 ? (
                              <select
                                required
                                value={editor.data.data[key] || ""}
                                onChange={(e) => setData(key, e.target.value)}
                              >
                                <option value="">বাছুন</option>
                                {bundle?.program.settings[
                                  key === "segment" ? "segments" : "objections"
                                ].map((v: string) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            ) : (
                              <textarea
                                required={
                                  key !== "whyBought" ||
                                  !!bundle?.program.settings.whyBoughtRequired
                                }
                                value={editor.data.data[key] || ""}
                                onChange={(e) => setData(key, e.target.value)}
                              />
                            )}
                          </Field>
                        ))}
                      {FINANCIAL_KINDS.includes(editor.data.kind) && (
                        <Field
                          name={
                            editor.data.kind === "purchase"
                              ? "ভাউচার (বাধ্যতামূলক)"
                              : "ভাউচার / প্রমাণ (ঐচ্ছিক)"
                          }
                        >
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={(e) => uploadEditor(e.target.files?.[0])}
                          />
                          {editor.data.data.voucherId && (
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={`/api/incubation/files/${editor.data.data.voucherId}`}
                            >
                              ✓ আপলোড হয়েছে • দেখুন
                            </a>
                          )}
                        </Field>
                      )}
                      <Field name="কারণ / টাকার পার্থক্যের ব্যাখ্যা">
                        <textarea
                          required={editor.data.kind === "repayment"}
                          value={editor.data.data.reason || ""}
                          onChange={(e) => setData("reason", e.target.value)}
                        />
                      </Field>
                      <Field name="নোট">
                        <textarea
                          value={editor.data.data.note || ""}
                          onChange={(e) => setData("note", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                  {editor.type === "correct" && (
                    <>
                      <Field name="কেন সংশোধন প্রয়োজন (বাধ্যতামূলক)">
                        <textarea
                          required
                          minLength={3}
                          value={editor.data.reason}
                          onChange={(e) => setValue("reason", e.target.value)}
                        />
                      </Field>
                      <label className="inc-row">
                        <input
                          type="checkbox"
                          checked={editor.data.void}
                          onChange={(e) => setValue("void", e.target.checked)}
                        />
                        এই এন্ট্রি বাতিলের অনুরোধ (ইতিহাস সংরক্ষিত থাকবে)
                      </label>
                    </>
                  )}
                </>
              )}
              {editor.type === "review" && (
                <>
                  <div className="inc-form-grid">
                    <section className="inc-old">
                      <h3>আগের / জমা তথ্য</h3>
                      <p>
                        {editor.original?.date} ·{" "}
                        {label(editor.original?.kind || "")}
                      </p>
                      <RecordSnapshot
                        record={editor.original}
                        products={products}
                      />
                    </section>
                    {editor.data.comparison && (
                      <section className="inc-old">
                        <h3>প্রস্তাবিত সংশোধন</h3>
                        <RecordSnapshot
                          record={editor.data.comparison}
                          products={products}
                        />
                      </section>
                    )}
                  </div>
                  {(!student || editor.data.reviewType === "accept_transfer") &&
                  editor.data.status !== "approved" &&
                  editor.data.status !== "rejected" ? (
                    <>
                      <Field name="সিদ্ধান্ত">
                        <select
                          value={String(editor.data.approve)}
                          onChange={(e) =>
                            setValue("approve", e.target.value === "true")
                          }
                        >
                          <option value="true">অনুমোদন / গ্রহণ</option>
                          <option value="false">প্রত্যাখ্যান</option>
                        </select>
                      </Field>
                      <Field name="পর্যালোচনার নোট">
                        <textarea
                          required
                          minLength={3}
                          value={editor.data.reason}
                          onChange={(e) => setValue("reason", e.target.value)}
                        />
                      </Field>
                      {editor.data.reviewType === "accept_transfer" &&
                        editor.data.approve && (
                          <Field name="গ্রহণের ভাউচার / হস্তান্তর প্রমাণ (বাধ্যতামূলক)">
                            <input
                              type="file"
                              required={!editor.data.data?.voucherId}
                              accept="image/*,application/pdf"
                              onChange={(e) =>
                                uploadEditor(e.target.files?.[0])
                              }
                            />
                            {editor.data.data?.voucherId && "✓ আপলোড হয়েছে"}
                          </Field>
                        )}
                    </>
                  ) : (
                    <p className="inc-sub">
                      অনুরোধের অবস্থা: {editor.data.status || "pending"}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="inc-modal-foot">
              <button
                type="button"
                className="inc-btn"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                বন্ধ করুন
              </button>
              {!(
                editor.type === "review" &&
                ((student && editor.data.reviewType !== "accept_transfer") ||
                  ["approved", "rejected"].includes(editor.data.status))
              ) && (
                <button
                  type="submit"
                  className="inc-btn primary"
                  disabled={busy}
                >
                  <Check size={16} />
                  {busy
                    ? "সংরক্ষণ হচ্ছে…"
                    : editor.type === "correct" && !bundle?.manager
                      ? "অনুরোধ পাঠান"
                      : "সংরক্ষণ করুন"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
  const kpis = report ? (
    <div className="inc-kpis">
      {[
        {
          title: "মোট বিক্রি",
          value: report.totals.revenue,
          sub: "নির্বাচিত সময়ের নিট বিক্রয়মূল্য",
          icon: ChartNoAxesCombined,
        },
        {
          title: "নিট লাভ / ক্ষতি",
          value: report.totals.netProfit,
          sub: "বিক্রিত পণ্যের খরচ ও অন্যান্য খরচ বাদে",
          icon: Wallet,
        },
        {
          title: "স্টকের মূল্য",
          value: report.totals.stockValue,
          sub: "শেষ তারিখে ক্রয়মূল্য অনুযায়ী",
          icon: Package,
        },
        {
          title: "হাতে থাকার হিসাব",
          value: report.totals.cash,
          sub: "শেষ তারিখ পর্যন্ত হিসাবকৃত ক্যাশ",
          icon: Wallet,
        },
      ].map((k, i) => (
        <div key={k.title} className={`inc-kpi ${i === 1 ? "feature" : ""}`}>
          <div className="inc-row inc-between">
            <label>{k.title}</label>
            <k.icon size={17} />
          </div>
          <strong className={k.value < 0 ? "inc-negative" : ""}>
            {money(k.value)}
          </strong>
          <small>{k.sub}</small>
        </div>
      ))}
    </div>
  ) : null;
  if (student)
    return (
      <StudentWorkspace
        bundle={bundle}
        error={error}
        message={message}
        busy={busy}
        refresh={() => load()}
        onRecord={newRecord}
        onEdit={editRecord}
        onAccept={(r) =>
          setEditor({
            type: "review",
            original: r,
            data: {
              id: r.id,
              teamId: bundle?.member?.teamId,
              reviewType: "accept_transfer",
              approve: true,
              reason: "",
              data: {},
            },
          })
        }
        onField={fieldAction}
        fieldForm={fieldForm}
        setFieldForm={setFieldForm}
        onUpload={upload}
        onError={setError}
      >
        {editorUI}
      </StudentWorkspace>
    );
  return (
    <div className="inc">
      <header className="inc-head">
        <div className="inc-row inc-between">
          <div>
            <div className="inc-eyebrow">FIELD EXPERIENCE · REAL BUSINESS</div>
            <h1>{bundle?.program?.name || "Business Incubation"}</h1>
            <p className="inc-sub">
              {bundle?.program
                ? `${bundle.program.startDate} থেকে ${bundle.program.endDate || "চলমান"} • ${bundle.member ? `${teamName(bundle.member.teamId)} — ${bundle.member.isLead ? "টিম লিডার" : "সদস্য"}` : "প্রোগ্রাম পরিচালনা ও ব্যবসার অন্তর্দৃষ্টি"}`
                : "দল গড়ুন। বাজার বুঝুন। বাস্তব অভিজ্ঞতায় ব্যবসা শিখুন।"}
            </p>
          </div>
          <div className="inc-row">
            {programId ? (
              <>
                <button
                  className="inc-btn"
                  onClick={() => router.push("/dashboard/competitions")}
                >
                  <ArrowLeft size={15} />
                  প্রোগ্রাম
                </button>
                {bundle?.program && <Badge value={bundle.program.status} />}
                <NotificationBell programId={programId} />
                <button
                  className="inc-btn"
                  disabled={busy || loading}
                  onClick={() => load()}
                  title="রিফ্রেশ"
                >
                  <RefreshCw size={16} />
                </button>
              </>
            ) : (
              bundle?.manager && (
                <button
                  className="inc-btn"
                  onClick={() =>
                    setEditor({ type: "program", data: blankProgram() })
                  }
                >
                  <Plus size={17} />
                  নতুন প্রোগ্রাম
                </button>
              )
            )}
          </div>
        </div>
      </header>
      <div style={{ marginTop: 18 }}>{notices}</div>
      {loading && !bundle && (
        <div className="inc-kpis">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="inc-skeleton" />
          ))}
        </div>
      )}
      {!programId && bundle && (
        <>
          <div
            className="inc-row inc-between"
            style={{ margin: "25px 0 16px" }}
          >
            <h2>আপনার প্রোগ্রামসমূহ</h2>
            <span className="inc-sub">
              {bundle.programs?.length || 0}টি প্রোগ্রাম
            </span>
          </div>
          <div className="inc-grid">
            {bundle.programs?.map((p: Row) => (
              <button
                className="inc-program"
                key={p.id}
                onClick={() => choose(p.id)}
              >
                <div className="inc-row inc-between">
                  <span className="inc-icon">
                    <Sprout size={22} />
                  </span>
                  <Badge value={p.status} />
                </div>
                <h2>{p.name}</h2>
                <p className="inc-sub">
                  {p.description || "টিম, স্টক ও ব্যবসার ফলাফল এক জায়গায়।"}
                </p>
                <div className="inc-row inc-between" style={{ marginTop: 20 }}>
                  <small>
                    {p.batchNames.join(" · ")}
                    <br />
                    {p.startDate}
                  </small>
                  <ArrowUpRight size={22} />
                </div>
              </button>
            ))}
          </div>
          {!bundle.programs?.length && (
            <div className="inc-card">
              <Empty title="নতুন অভিজ্ঞতার শুরু এখানেই">
                {bundle.manager
                  ? "নতুন প্রোগ্রাম তৈরি করে ব্যাচ, টিম ও ক্যাটাগরি নির্ধারণ করুন। কোনো পুরোনো তথ্য আমদানি করা হবে না।"
                  : "আপনার ব্যাচের প্রোগ্রাম চালু হলে এখানে দেখা যাবে।"}
              </Empty>
            </div>
          )}
        </>
      )}
      {programId && bundle?.program && (
        <>
          <nav className="inc-tabs" aria-label="Business Incubation বিভাগ">
            {[
              ["overview", "ড্যাশবোর্ড", ChartNoAxesCombined],
              ["entries", "ডাটা শিট", Table2],
              ["field", "মাঠ ও GPS", MapPin],
              ["learning", "FGD ও Insights", BookOpen],
              ["reviews", "অনুরোধ", ClipboardCheck],
              ["reports", "রিপোর্ট", FileText],
              ["reconcile", "হিসাব যাচাই", ClipboardCheck],
              ["history", "ইতিহাস", History],
              ...(bundle.manager ? [["setup", "সেটআপ", Settings2]] : []),
            ].map(([key, title, Icon]: any) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                <Icon size={16} />
                {title}
                {key === "reviews" && pending > 0 && (
                  <span className="inc-count">{pending}</span>
                )}
              </button>
            ))}
          </nav>
          {bundle.program.status === "draft" && (
            <div className="inc-notice">
              প্রোগ্রামটি খসড়া অবস্থায় আছে। টিম, পণ্য ও স্প্রিন্ট প্রস্তুত করে
              সেটআপ থেকে সক্রিয় করুন।
            </div>
          )}
          {tab === "overview" && (
            <>
              <MonitorPanel issues={bundle.monitor} />
              {filtersUI}
              {!reportError && (
                <>
                  {report?.productScope && (
                    <div className="inc-notice">
                      পণ্য/ক্যাটাগরি ফিল্টারে পণ্যবিহীন খরচ ও ফান্ড অন্তর্ভুক্ত
                      নয়। পূর্ণ ক্যাশ ও নিট লাভ দেখতে সব ক্যাটাগরি বাছুন।
                    </div>
                  )}
                  {kpis}
                  <div className="inc-grid">
                    <section className="inc-card">
                      <div className="inc-row inc-between">
                        <h2>বিক্রির অগ্রগতি</h2>
                        <span className="inc-sub">দিন অনুযায়ী • টাকা</span>
                      </div>
                      {report?.trend.length ? (
                        <div className="inc-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={report.trend}>
                              <defs>
                                <linearGradient
                                  id="incRevenue"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="0%"
                                    stopColor="#24876b"
                                    stopOpacity={0.28}
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor="#24876b"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <CartesianGrid
                                strokeDasharray="3 5"
                                vertical={false}
                                stroke="#e3ece5"
                              />
                              <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip />
                              <Area
                                isAnimationActive={false}
                                dataKey="revenue"
                                name="বিক্রি"
                                stroke="#1a8564"
                                fill="url(#incRevenue)"
                                strokeWidth={3}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <Empty title="বিক্রির তথ্য জমা হলে চার্ট দেখা যাবে" />
                      )}
                    </section>
                    <section className="inc-card">
                      <h2>টিমের তুলনামূলক ফলাফল</h2>
                      {report?.summaries.some((s) => s.revenue) ? (
                        <div className="inc-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={report.summaries.map((s) => ({
                                name: s.teamName,
                                profit: s.netProfit / 100,
                              }))}
                            >
                              <CartesianGrid
                                strokeDasharray="3 5"
                                vertical={false}
                              />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar
                                isAnimationActive={false}
                                dataKey="profit"
                                name="নিট লাভ"
                                fill="#538d6d"
                                radius={[5, 5, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <Empty title="টিমের ফলাফল এখানে দেখা যাবে" />
                      )}
                    </section>
                  </div>
                  <div className="inc-grid" style={{ marginTop: 18 }}>
                    <section className="inc-card">
                      <h2>বর্তমান দায়িত্ব</h2>
                      <div className="inc-timeline">
                        {bundle.sprints
                          .filter(
                            (s: Row) =>
                              s.startDate <= todayDhaka() &&
                              s.endDate >= todayDhaka(),
                          )
                          .map((s: Row) => (
                            <div className="inc-timeline-item" key={s.id}>
                              <h3>{teamName(s.teamId)}</h3>
                              <p>
                                {
                                  categories.find(
                                    (c: Row) => c.id === s.categoryId,
                                  )?.name
                                }
                              </p>
                              <small className="inc-sub">
                                {s.startDate} — {s.endDate}
                              </small>
                            </div>
                          ))}
                        {!bundle.sprints.length && (
                          <p className="inc-sub">
                            এখনো স্প্রিন্ট নির্ধারণ করা হয়নি।
                          </p>
                        )}
                      </div>
                    </section>
                    <section className="inc-card">
                      <h2>হিসাব ও মনোযোগের বিষয়</h2>
                      <div className="inc-steps">
                        <div className="inc-step">
                          <b>১</b>
                          <div>
                            প্রতিষ্ঠানে মূল ফান্ড ফেরত বাকি
                            <strong style={{ display: "block", marginTop: 5 }}>
                              {money(report?.totals.principalOutstanding || 0)}
                            </strong>
                          </div>
                        </div>
                        <div className="inc-step">
                          <b>২</b>
                          <div>
                            বিক্রির মূল্য ও পাওয়া টাকার পার্থক্য
                            <strong style={{ display: "block", marginTop: 5 }}>
                              {money(report?.totals.variance || 0)}
                            </strong>
                          </div>
                        </div>
                        <div className="inc-step">
                          <b>৩</b>
                          <div>
                            অপেক্ষায় থাকা অনুরোধ
                            <strong style={{ display: "block", marginTop: 5 }}>
                              {pending}টি
                            </strong>
                          </div>
                        </div>
                      </div>
                      <p className="inc-sub" style={{ marginTop: 20 }}>
                        মূল ফান্ড ফেরতের পর লাভ টিমের কাছেই থাকবে। ক্যাশের
                        পার্থক্য কারণসহ মিলিয়ে নিতে হবে।
                      </p>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          {tab === "entries" && (
            <>
              {filtersUI}
              {exportButtons(sheet)}
              {bundle.manager && (
                <div style={{ marginBottom: 15 }}>
                  <BulkSheetEditor
                    records={records.filter((r: Row) => r.kind === sheet)}
                    products={products}
                    programId={programId}
                    onSaved={() => load()}
                    onError={setError}
                  />
                </div>
              )}
              <div className="inc-row inc-between" style={{ marginBottom: 16 }}>
                <h2>রেসপন্স ও লেনদেনের শিট</h2>
                {(!student || (bundle.member?.isLead && sheet !== "fund")) && (
                  <button
                    className="inc-btn primary"
                    disabled={!bundle.teams.length}
                    onClick={() =>
                      newRecord(
                        (FINANCIAL_KINDS.includes(sheet as RecordKind)
                          ? sheet
                          : "sale") as RecordKind,
                      )
                    }
                  >
                    <Plus size={16} />
                    নতুন এন্ট্রি
                  </button>
                )}
              </div>
              <div className="inc-toolbar">
                {FINANCIAL_KINDS.map((k) => (
                  <button
                    key={k}
                    className={`inc-btn ${sheet === k ? "primary" : ""}`}
                    onClick={() => setSheet(k)}
                  >
                    {label(k)}
                  </button>
                ))}
                <button
                  className={`inc-btn ${sheet === "inventory" ? "primary" : ""}`}
                  onClick={() => setSheet("inventory")}
                >
                  স্টক
                </button>
              </div>
              <div className="inc-row" style={{ marginBottom: 15 }}>
                <Search size={16} />
                <input
                  placeholder="পণ্য, টিম, তারিখ বা নোট খুঁজুন…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ maxWidth: 400 }}
                />
              </div>
              {sheet === "inventory" ? (
                <GridTable
                  rows={report?.inventory || []}
                  columns={[
                    { title: "টিম", render: (r) => r.teamName },
                    { title: "পণ্য", render: (r) => r.productName },
                    { title: "একক", render: (r) => r.unit },
                    { title: "কেনা", render: (r) => r.procured / 1000 },
                    { title: "বিক্রি", render: (r) => r.sold / 1000 },
                    { title: "ফেরত", render: (r) => r.returned / 1000 },
                    { title: "নষ্ট", render: (r) => r.damaged / 1000 },
                    {
                      title: "অবশিষ্ট",
                      render: (r) => <b>{r.quantity / 1000}</b>,
                    },
                    { title: "মূল্য", render: (r) => money(r.value) },
                  ]}
                />
              ) : (
                recordsTable(
                  records.filter(
                    (r: Row) =>
                      r.kind === sheet &&
                      JSON.stringify({
                        ...r,
                        team: teamName(r.teamId),
                        products: r.data.lines?.map((l: Row) =>
                          productName(l.productId),
                        ),
                      })
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ),
                )
              )}
            </>
          )}
          {tab === "learning" && (
            <>
              <div className="inc-row inc-between" style={{ marginBottom: 18 }}>
                <h2>মাঠের অভিজ্ঞতা থেকে শেখা</h2>
                <div className="inc-row">
                  <button
                    className="inc-btn primary"
                    onClick={() => newRecord("fgd")}
                  >
                    <Plus size={15} />
                    FGD
                  </button>
                  <button
                    className="inc-btn"
                    onClick={() => newRecord("insight")}
                  >
                    <Plus size={15} />
                    Market Insight
                  </button>
                </div>
              </div>
              {filtersUI}
              <Field name="ব্যক্তিভিত্তিক FGD / Insights">
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                >
                  <option value="">সব সদস্য</option>
                  {Array.from(
                    new Map<string, string>(
                      (bundle.records as Row[])
                        .filter((r) => ["fgd", "insight"].includes(r.kind))
                        .map((r) => [r.enteredBy, r.enteredByName]),
                    ).entries(),
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              {exportButtons("learning")}
              <div className="inc-grid" style={{ marginTop: 16 }}>
                {records
                  .filter(
                    (r: Row) =>
                      ["fgd", "insight"].includes(r.kind) &&
                      (!personId || r.enteredBy === personId),
                  )
                  .map((r: Row) => (
                    <section className="inc-card" key={r.id}>
                      <div className="inc-row inc-between">
                        <h2>{label(r.kind)}</h2>
                        <span className="inc-sub">{r.date}</span>
                      </div>
                      <p className="inc-sub">
                        {teamName(r.teamId)} · {r.enteredByName}
                      </p>
                      {r.kind === "fgd" ? (
                        <div className="inc-form-grid">
                          <div>
                            <h3>Findings</h3>
                            {r.data.findings?.map((s: string, i: number) => (
                              <p key={i}>
                                {i + 1}. {s}
                              </p>
                            ))}
                          </div>
                          <div>
                            <h3>Next actions</h3>
                            {r.data.actions?.map((s: string, i: number) => (
                              <p key={i}>
                                {i + 1}. {s}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <dl>
                          {[
                            ["সেরা সেগমেন্ট", r.data.segment],
                            ["আপত্তি", r.data.objections],
                            ["কেন কিনেছে", r.data.whyBought],
                            ["সেরা এলাকা", r.data.bestArea],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <dt className="inc-sub">{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {(bundle.manager || r.enteredBy === bundle.actor.id) && (
                        <button
                          className="inc-btn"
                          style={{ marginTop: 12 }}
                          onClick={() => editRecord(r)}
                        >
                          সংশোধন
                        </button>
                      )}
                    </section>
                  ))}
              </div>
              {!records.some((r: Row) =>
                ["fgd", "insight"].includes(r.kind),
              ) && <Empty title="আপনার প্রথম FGD বা Insight জমা দিন" />}
            </>
          )}
          {tab === "field" && (
            <>
              <FieldCorrectionEditor
                bundle={bundle}
                onSaved={() => load()}
                onError={setError}
              />
              {filtersUI}
              <Field name="ব্যক্তিভিত্তিক মাঠের কাজ">
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                >
                  <option value="">সব সদস্য</option>
                  {Array.from(
                    new Map<string, string>(
                      (bundle.fields as Row[]).map((f: Row) => [
                        f.userId,
                        f.userName,
                      ]),
                    ).entries(),
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              {exportButtons("field")}
              <div className="inc-notice">
                ওয়েবসাইটে GPS check-in/out ও পেজ খোলা থাকলে আপডেট চলে। ফোন লক
                অবস্থার tracking-এর Android অ্যাপের পরিকল্পনা আলাদা রয়েছে; এখানে
                locked-screen tracking চালু হয়েছে বলে দেখানো হচ্ছে না।
              </div>
              {student && (
                <section className="inc-card" style={{ marginBottom: 20 }}>
                  <div className="inc-row inc-between">
                    <h2>
                      {ownField ? "আপনার মাঠ সেশন চলছে" : "মাঠে কাজ শুরু করুন"}
                    </h2>
                    {ownField && <Badge value="active" />}
                  </div>
                  <div className="inc-form-grid">
                    <Field
                      name={ownField ? "ফেরার ব্রড এরিয়া" : "কাজের ব্রড এরিয়া"}
                    >
                      <select
                        value={fieldForm.areaId}
                        onChange={(e) =>
                          setFieldForm({ ...fieldForm, areaId: e.target.value })
                        }
                      >
                        <option value="">নির্বাচন করুন</option>
                        {areas
                          .filter((a: Row) => a.active)
                          .map((a: Row) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {ownField && (
                      <Field name="হাঁটার স্টেপ">
                        <input
                          type="number"
                          min="0"
                          max="200000"
                          value={fieldForm.steps}
                          onChange={(e) =>
                            setFieldForm({
                              ...fieldForm,
                              steps: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}
                  </div>
                  {!ownField && (
                    <div style={{ margin: "15px 0" }}>
                      <h3>সঙ্গে নেওয়া পণ্য</h3>
                      {fieldForm.carried.map((l: Row, i: number) => (
                        <div
                          className="inc-row"
                          style={{ marginTop: 10 }}
                          key={i}
                        >
                          <select
                            style={{ flex: 2 }}
                            value={l.productId}
                            onChange={(e) =>
                              setFieldForm({
                                ...fieldForm,
                                carried: fieldForm.carried.map(
                                  (x: Row, j: number) =>
                                    i === j
                                      ? { ...x, productId: e.target.value }
                                      : x,
                                ),
                              })
                            }
                          >
                            <option value="">পণ্য বাছুন</option>
                            {products.map((p: Row) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            style={{ flex: 1 }}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={l.quantity}
                            onChange={(e) =>
                              setFieldForm({
                                ...fieldForm,
                                carried: fieldForm.carried.map(
                                  (x: Row, j: number) =>
                                    i === j
                                      ? { ...x, quantity: e.target.value }
                                      : x,
                                ),
                              })
                            }
                          />
                          <button
                            className="inc-btn"
                            onClick={() =>
                              setFieldForm({
                                ...fieldForm,
                                carried: fieldForm.carried.filter(
                                  (_: Row, j: number) => i !== j,
                                ),
                              })
                            }
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="inc-btn"
                        style={{ marginTop: 10 }}
                        onClick={() =>
                          setFieldForm({
                            ...fieldForm,
                            carried: [
                              ...fieldForm.carried,
                              { productId: "", quantity: "1" },
                            ],
                          })
                        }
                      >
                        <Plus size={15} />
                        পণ্য যোগ করুন
                      </button>
                    </div>
                  )}
                  {ownField && (
                    <Field name="Pedometer প্রমাণ (ঐচ্ছিক)">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setBusy(true);
                            try {
                              const a = await upload(f, bundle.member.teamId);
                              setFieldForm({ ...fieldForm, proofId: a.id });
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }
                        }}
                      />
                    </Field>
                  )}
                  <button
                    className="inc-btn primary"
                    style={{ marginTop: 16 }}
                    disabled={busy || !fieldForm.areaId}
                    onClick={() =>
                      fieldAction(ownField ? "checkout" : "checkin")
                    }
                  >
                    <MapPin size={16} />
                    {busy
                      ? "GPS ও সেশন যাচাই হচ্ছে…"
                      : ownField
                        ? "Check-out করুন"
                        : "GPS দিয়ে Check-in করুন"}
                  </button>
                </section>
              )}
              <GridTable
                rows={bundle.fields.filter(
                  (f: Row) =>
                    (!personId || f.userId === personId) &&
                    (!filters.batchName ||
                      bundle.teams.some(
                        (t: Row) =>
                          t.id === f.teamId &&
                          t.batchName === filters.batchName,
                      )) &&
                    (!filters.areaId || f.startAreaId === filters.areaId) &&
                    (!filters.teamId || f.teamId === filters.teamId) &&
                    (!filters.from ||
                      todayDhaka(new Date(f.checkIn)) >= filters.from) &&
                    (!filters.to ||
                      todayDhaka(new Date(f.checkIn)) <= filters.to),
                )}
                columns={[
                  {
                    title: "শিক্ষার্থী",
                    render: (r) => (
                      <>
                        <b>{r.userName}</b>
                        <div className="inc-sub">{teamName(r.teamId)}</div>
                      </>
                    ),
                  },
                  { title: "শুরু", render: (r) => stamp(r.checkIn) },
                  {
                    title: "শেষ / ঘণ্টা",
                    render: (r) =>
                      r.checkOut ? (
                        <>
                          {stamp(r.checkOut)}
                          <br />
                          {(
                            (Date.parse(r.checkOut) - Date.parse(r.checkIn)) /
                            3600000
                          ).toFixed(2)}{" "}
                          ঘণ্টা
                        </>
                      ) : (
                        <Badge value="active" />
                      ),
                  },
                  {
                    title: "ব্রড এরিয়া",
                    render: (r) =>
                      areas.find((a: Row) => a.id === r.startAreaId)?.name ||
                      "—",
                  },
                  { title: "স্টেপ", render: (r) => r.steps },
                  {
                    title: "সর্বশেষ GPS",
                    render: (r) => {
                      const p = r.pings?.[0];
                      return p ? (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                        >
                          {stamp(p.capturedAt)}
                          <br />
                          <small>
                            ±{p.accuracy}m{" "}
                            {Date.now() - Date.parse(p.capturedAt) > 600000
                              ? "• পুরোনো"
                              : ""}
                          </small>
                        </a>
                      ) : (
                        "—"
                      );
                    },
                  },
                  {
                    title: "ইতিহাস",
                    render: (r) => (
                      <button
                        className="inc-btn"
                        onClick={async () => {
                          try {
                            const resp = await fetch(
                                `/api/incubation/field?programId=${programId}&sessionId=${r.id}`,
                              ),
                              d = await resp.json();
                            if (!resp.ok) throw Error(d.error);
                            setPositionHistory(d.positions);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        দেখুন
                      </button>
                    ),
                  },
                ]}
              />
              {positionHistory.length > 0 && (
                <section className="inc-card" style={{ marginTop: 16 }}>
                  <h2>অবস্থানের ইতিহাস</h2>
                  <GridTable
                    rows={positionHistory}
                    columns={[
                      { title: "সময়", render: (r) => stamp(r.capturedAt) },
                      {
                        title: "অবস্থান",
                        render: (r) => (
                          <a
                            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.latitude}, {r.longitude}
                          </a>
                        ),
                      },
                      { title: "Accuracy", render: (r) => `${r.accuracy} m` },
                    ]}
                  />
                </section>
              )}
            </>
          )}
          {tab === "reviews" && (
            <>
              <FieldCorrectionReviews
                bundle={bundle}
                onSaved={() => load()}
                onError={setError}
              />
              <div className="inc-notice">
                অনুমোদন না হওয়া পর্যন্ত আগের তথ্য কার্যকর থাকে। অনুমোদনের সময়
                স্টক ও সংশ্লিষ্ট হিসাব আবার যাচাই হয়।
              </div>
              <h2>সংশোধন অনুরোধ</h2>
              <GridTable
                rows={bundle.corrections}
                columns={[
                  {
                    title: "টিম / রেকর্ড",
                    render: (r) => (
                      <>
                        {teamName(
                          bundle.records.find((x: Row) => x.id === r.recordId)
                            ?.teamId,
                        )}
                        <br />
                        <small>{r.recordId.slice(0, 8)}</small>
                      </>
                    ),
                  },
                  { title: "আবেদনকারী", render: (r) => r.requestedByName },
                  {
                    title: "কারণ",
                    render: (r) => <div className="wrap">{r.reason}</div>,
                  },
                  {
                    title: "অবস্থা",
                    render: (r) => <Badge value={r.status} />,
                  },
                  {
                    title: "তুলনা / পর্যালোচনা",
                    render: (r) => (
                      <button
                        className="inc-btn"
                        onClick={() =>
                          setEditor({
                            type: "review",
                            original: r.before,
                            data: {
                              ...r,
                              reviewType: "review_correction",
                              approve: true,
                              reason: "",
                              comparison: r.proposed,
                            },
                          })
                        }
                      >
                        বিস্তারিত
                      </button>
                    ),
                  },
                ]}
              />
              <h2 style={{ marginTop: 26 }}>দেরিতে জমা ও টিমে হস্তান্তর</h2>
              <GridTable
                rows={bundle.records.filter((r: Row) =>
                  ["pending", "transfer_pending", "rejected"].includes(
                    r.status,
                  ),
                )}
                columns={[
                  { title: "তারিখ", render: (r) => r.date },
                  { title: "টিম", render: (r) => teamName(r.teamId) },
                  { title: "ধরন", render: (r) => label(r.kind) },
                  {
                    title: "কারণ",
                    render: (r) => <div className="wrap">{r.data.reason}</div>,
                  },
                  {
                    title: "অবস্থা",
                    render: (r) => <Badge value={r.status} />,
                  },
                  {
                    title: "পর্যালোচনা",
                    render: (r) =>
                      r.status !== "rejected" &&
                      ((r.status === "pending" && !student) ||
                        (r.status === "transfer_pending" &&
                          (bundle.manager ||
                            (bundle.member?.isLead &&
                              bundle.member.teamId === r.targetTeamId)))) ? (
                        <button
                          className="inc-btn"
                          onClick={() =>
                            setEditor({
                              type: "review",
                              original: r,
                              data: {
                                id: r.id,
                                teamId: r.targetTeamId || r.teamId,
                                reviewType:
                                  r.status === "pending"
                                    ? "review_late"
                                    : "accept_transfer",
                                approve: true,
                                reason: "",
                                data: {},
                              },
                            })
                          }
                        >
                          পর্যালোচনা
                        </button>
                      ) : (
                        "—"
                      ),
                  },
                ]}
              />
            </>
          )}
          {tab === "reports" && (
            <>
              {bundle.manager && (
                <ResultsCard
                  published={bundle.results}
                  live={liveRanking}
                  busy={busy}
                  onPublish={(note) => act("publish_results", { note })}
                  onWithdraw={() => act("withdraw_results", {})}
                />
              )}
              {filtersUI}
              <Field name="ব্যক্তি — শুধু মাঠের কাজ, FGD ও Insights">
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                >
                  <option value="">সব সদস্য</option>
                  {Array.from(
                    new Map<string, string>([
                      ...bundle.fields.map((f: Row) => [f.userId, f.userName]),
                      ...bundle.records
                        .filter((r: Row) => ["fgd", "insight"].includes(r.kind))
                        .map((r: Row) => [r.enteredBy, r.enteredByName]),
                    ] as [string, string][]),
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="inc-row inc-between" style={{ marginBottom: 18 }}>
                <h2>ব্যবসার রিপোর্ট</h2>
                <div className="inc-row">
                  <button
                    className="inc-btn"
                    disabled={busy || !!reportError}
                    onClick={() => download("xlsx")}
                  >
                    <Download size={15} />
                    Excel
                  </button>
                  <button
                    className="inc-btn primary"
                    disabled={busy || !!reportError}
                    onClick={() => download("pdf")}
                  >
                    <Download size={15} />
                    PDF
                  </button>
                </div>
              </div>
              {kpis}
              {!reportError && (
                <GridTable
                  rows={report?.summaries || []}
                  columns={[
                    { title: "টিম", render: (r) => <b>{r.teamName}</b> },
                    { title: "বিক্রি", render: (r) => money(r.revenue) },
                    { title: "খরচ", render: (r) => money(r.expenses) },
                    {
                      title: "লাভ / ক্ষতি",
                      render: (r) => (
                        <b className={r.netProfit < 0 ? "inc-negative" : ""}>
                          {money(r.netProfit)}
                        </b>
                      ),
                    },
                    { title: "ক্যাশ", render: (r) => money(r.cash) },
                    { title: "স্টক", render: (r) => money(r.stockValue) },
                    {
                      title: "মূল ফান্ড বাকি",
                      render: (r) => money(r.principalOutstanding),
                    },
                    {
                      title: "ক্যাশের পার্থক্য",
                      render: (r) => money(r.variance),
                    },
                  ]}
                />
              )}
              {bundle.manager && (
                <section className="inc-card" style={{ marginTop: 20 }}>
                  <h2>পাবলিক রিপোর্ট শেয়ার</h2>
                  <p className="inc-sub">
                    প্রকাশ করলে টিমভিত্তিক ফলাফল ও চার্ট দেখা যাবে। GPS,
                    ব্যক্তিগত তথ্য, ভাউচার ও সংশোধনের ইতিহাস পাবলিক হবে না। নতুন
                    লিংক তৈরি করলে পুরোনো লিংক বন্ধ হয়ে যাবে।
                  </p>
                  <div className="inc-row" style={{ margin: "15px 0" }}>
                    <button
                      className="inc-btn primary"
                      disabled={busy}
                      onClick={() => act("share", { enabled: true })}
                    >
                      <ExternalLink size={15} />
                      {bundle.program.publicEnabled
                        ? "নতুন লিংক তৈরি"
                        : "প্রকাশ করুন"}
                    </button>
                    {bundle.program.publicEnabled && (
                      <button
                        className="inc-btn danger"
                        disabled={busy}
                        onClick={() => act("share", { enabled: false })}
                      >
                        পাবলিক লিংক বন্ধ করুন
                      </button>
                    )}
                  </div>
                  {share && (
                    <div className="inc-share">
                      <a href={share} target="_blank" rel="noreferrer">
                        {share}
                      </a>
                      <button
                        className="inc-btn"
                        style={{ marginLeft: 12 }}
                        onClick={() => navigator.clipboard.writeText(share)}
                      >
                        কপি
                      </button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {tab === "reconcile" && (
            <section className="inc-card">
              <h2>Reconciliation ও করণীয়</h2>
              <p className="inc-sub">
                স্টক ও লাভ source records থেকে গণনা হয়। ক্যাশ গণনা তার সেই সময়ের
                expected balance-এর সঙ্গে মেলে।
              </p>
              <GridTable
                rows={reconciliation}
                columns={[
                  { title: "টিম", render: (r) => r.team },
                  { title: "যাচাই / করণীয়", render: (r) => r.issue },
                ]}
              />
            </section>
          )}
          {tab === "history" && (
            <GridTable
              rows={bundle.history}
              columns={[
                { title: "সময়", render: (r) => stamp(r.createdAt) },
                { title: "কে", render: (r) => r.actorName },
                { title: "কাজ", render: (r) => r.action },
                {
                  title: "কারণ",
                  render: (r) => <div className="wrap">{r.reason || "—"}</div>,
                },
                {
                  title: "আগে / পরে",
                  render: (r) => (
                    <details>
                      <summary>পরিবর্তন দেখুন</summary>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          maxWidth: 460,
                          fontSize: 11,
                        }}
                      >
                        <b>আগে:</b>
                        <pre>{JSON.stringify(r.before, null, 2)}</pre>
                        <b>পরে:</b>
                        <pre>{JSON.stringify(r.after, null, 2)}</pre>
                      </div>
                    </details>
                  ),
                },
              ]}
            />
          )}
          {tab === "setup" && bundle.manager && (
            <div className="inc-grid">
              <section className="inc-card">
                <div className="inc-row inc-between">
                  <h2>প্রোগ্রাম ও নিয়ম</h2>
                  <button
                    className="inc-btn"
                    onClick={() =>
                      setEditor({
                        type: "program",
                        data: {
                          ...bundle.program,
                          endDate: bundle.program.endDate || "",
                          settings: {
                            ...bundle.program.settings,
                            maxFieldHours:
                              bundle.program.settings.maxFieldHours ?? "",
                          },
                        },
                      })
                    }
                  >
                    <Settings2 size={15} />
                    এডিট
                  </button>
                </div>
                <p>{bundle.program.description}</p>
                <p className="inc-sub">
                  ব্যাচ: {bundle.program.batchNames.join(" · ")}
                  <br />
                  স্প্রিন্ট: {bundle.program.settings.sprintDays} দিন
                  <br />
                  মাঠে সর্বোচ্চ সময়:{" "}
                  {bundle.program.settings.maxFieldHours ?? "নির্ধারিত নয়"}
                  <br />
                  কেনার ভাউচার: বাধ্যতামূলক
                </p>
              </section>
              <section className="inc-card">
                <div className="inc-row inc-between">
                  <h2>টিম ও সদস্য</h2>
                  <button
                    className="inc-btn primary"
                    onClick={() =>
                      setEditor({
                        type: "team",
                        data: {
                          name: "",
                          studentIds: [],
                          leadId: "",
                          active: true,
                        },
                      })
                    }
                  >
                    <Plus size={15} />
                    টিম
                  </button>
                </div>
                {bundle.teams.map((t: Row) => (
                  <div
                    className="inc-row inc-between"
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #e6eee8",
                    }}
                    key={t.id}
                  >
                    <div>
                      <b>{t.name}</b>
                      <p className="inc-sub">
                        {t.members.length} সদস্য · লিডার:{" "}
                        {t.members.find((m: Row) => m.isLead)?.name || "—"}
                      </p>
                    </div>
                    <button
                      className="inc-btn"
                      onClick={() =>
                        setEditor({
                          type: "team",
                          data: {
                            id: t.id,
                            name: t.name,
                            batchName: t.batchName,
                            studentIds: t.members.map((m: Row) => m.studentId),
                            leadId: t.members.find((m: Row) => m.isLead)
                              ?.studentId,
                            active: t.active,
                          },
                        })
                      }
                    >
                      এডিট
                    </button>
                  </div>
                ))}
              </section>
              {["category", "product", "area"].map((kind) => (
                <section className="inc-card" key={kind}>
                  <div className="inc-row inc-between">
                    <h2>
                      {
                        {
                          category: "ক্যাটাগরি",
                          product: "পণ্য ও একক",
                          area: "ব্রড এরিয়া",
                        }[kind]
                      }
                    </h2>
                    <button
                      className="inc-btn"
                      onClick={() =>
                        setEditor({
                          type: "catalog",
                          data: {
                            kind,
                            name: "",
                            parentId: "",
                            unit: "piece",
                            fractional: false,
                            active: true,
                          },
                        })
                      }
                    >
                      <Plus size={15} />
                      যোগ করুন
                    </button>
                  </div>
                  {bundle.catalog
                    .filter((c: Row) => c.kind === kind)
                    .map((c: Row) => (
                      <div
                        className="inc-row inc-between"
                        key={c.id}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #e9efea",
                        }}
                      >
                        <span>
                          {c.name}{" "}
                          {!c.active && (
                            <small className="inc-sub">(নিষ্ক্রিয়)</small>
                          )}{" "}
                          {kind === "product" && (
                            <small className="inc-sub"> · {c.unit}</small>
                          )}
                        </span>
                        <button
                          className="inc-btn"
                          onClick={() =>
                            setEditor({ type: "catalog", data: { ...c } })
                          }
                        >
                          এডিট
                        </button>
                      </div>
                    ))}
                </section>
              ))}
              <section className="inc-card">
                <div className="inc-row inc-between">
                  <h2>ক্যাটাগরি রোটেশন</h2>
                  <button
                    className="inc-btn primary"
                    onClick={() =>
                      setEditor({
                        type: "sprint",
                        data: {
                          teamId: bundle.teams[0]?.id || "",
                          categoryId: "",
                          startDate: todayDhaka(),
                          endDate: "",
                        },
                      })
                    }
                  >
                    <Plus size={15} />
                    স্প্রিন্ট
                  </button>
                </div>
                <div className="inc-timeline" style={{ marginTop: 20 }}>
                  {bundle.sprints.map((s: Row) => (
                    <div className="inc-timeline-item" key={s.id}>
                      <b>
                        {teamName(s.teamId)} →{" "}
                        {
                          categories.find((c: Row) => c.id === s.categoryId)
                            ?.name
                        }
                      </b>
                      <p className="inc-sub">
                        {s.startDate} — {s.endDate}
                      </p>
                      <button
                        className="inc-btn"
                        onClick={() =>
                          setEditor({ type: "sprint", data: { ...s } })
                        }
                      >
                        এডিট
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
      {editorUI}
    </div>
  );
}
