"use client";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  FormEvent,
  ReactNode,
} from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  Search as SearchIcon,
  Settings2,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import CrmOverview from "./CrmOverview";
import CrmTrainingCustomers, { TrainingCustomer } from "./CrmTrainingCustomers";
import {
  CrmNotifications,
  CrmBulkAssignment,
  CrmStudentProgress,
} from "./CrmOperations";
import "./crm.css";
import { localDate } from "@/lib/customer-service/domain";
type Option = {
  id: string;
  kind: string;
  label: string;
  active: boolean;
  parentId: string | null;
  settings: {
    type?: string;
    required?: boolean;
    choices?: string[];
    transactionRequired?: boolean;
  };
};
type Person = { id: string; displayName: string; role: string };
type Team = { id: string; name: string; tier: string; active: boolean };
type Member = {
  id: string;
  userId: string;
  role: string;
  teamId: string | null;
  active: boolean;
};
type Workspace = {
  id: string;
  batchId: string;
  name: string;
  role: string;
  state: string;
};
type Policy = {
  id: string;
  complaintType: string;
  issueType: string;
  primaryTag: string;
  overallMinutes: number;
  l2Minutes: number | null;
  l3Minutes: number | null;
  version: number;
  active: boolean;
};
type Setup = {
  options: Option[];
  teams: Team[];
  members: Member[];
  policies: Policy[];
  roster: Person[];
  actor: { id: string; name: string; role: string };
  workspace: Workspace;
  staffAssignments: { userId: string }[];
};
type Form = {
  callingNumber: string;
  registeredNumber: string;
  identifier: string;
  callerType: string;
  channel: string;
  complaintType: string;
  issueType: string;
  primaryTag: string;
  tags: string[];
  transactionDate: string | null;
  transactionAmount: string | null;
  transactionId: string;
  description: string;
  customFields: Record<string, string | number>;
};
type Complaint = Form & {
  id: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  ownerId: string | null;
  resolverId: string | null;
  teamId: string | null;
  status: string;
  queue: string;
  returnState: string;
  remarks: string;
  version: number;
  dueAt: string;
  firstL2At: string | null;
  firstL3At: string | null;
  l2CompletedAt: string | null;
  l2DueAt: string | null;
  l3DueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  fieldSnapshot: Option[];
};
type Follow = {
  id: string;
  complaintId: string;
  responsibleId: string;
  dueAt: string;
  note: string;
  completedAt: string | null;
};
type Detail = {
  complaint: Complaint;
  people: Person[];
  history: {
    id: string;
    action: string;
    actorName: string;
    createdAt: string;
    remark: string;
  }[];
  notes: { id: string; text: string; createdAt: string }[];
  interactions: { id: string; note: string; createdAt: string }[];
  followUps: Follow[];
};
type Report = {
  agents: {
    id: string;
    complaints: number;
    interactions: number;
    escalations: number;
    resolved: number;
    average: number | null;
  }[];
  metrics: Record<string, number | null>;
  basis: string;
  breakdowns: Record<string, { name: string; count: number }[]>;
  rows: Complaint[];
};
const empty: Form = {
  callingNumber: "",
  registeredNumber: "",
  identifier: "",
  callerType: "",
  channel: "",
  complaintType: "",
  issueType: "",
  primaryTag: "",
  tags: [],
  transactionDate: null,
  transactionAmount: null,
  transactionId: "",
  description: "",
  customFields: {},
};
const stamp = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—";
const duration = (ms: number | null) =>
  ms === null ? "N/A" : (ms / 3600000).toFixed(2) + " h";
const views = [
  "Dashboard",
  "New Complaint",
  "All Complaints",
  "My Complaints",
  "Escalations",
  "Search",
  "Training Customers",
  "Follow-ups",
  "Reports",
  "Settings",
  "Activity",
  "Profile",
  "Student Progress",
  "My Progress",
  "Distribute Work",
];
const viewSlug = (view: string) => view.toLowerCase().replaceAll(" ", "-");
async function api<T>(
  query: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const res = await fetch(
    "/api/crm?" + new URLSearchParams(query),
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || "Request failed");
  return value;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase())}
      {children}
    </label>
  );
}
function Clock({ start, end }: { start: string | null; end: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span>
      {start
        ? duration((end ? +new Date(end) : now) - +new Date(start))
        : "Not started"}
    </span>
  );
}
export default function CrmApp({
  staff = false,
  initialTab = "Dashboard",
}: {
  staff?: boolean;
  initialTab?: string;
}) {
  const branding = useBranding();
  const [trainingCustomer, setTrainingCustomer] =
    useState<TrainingCustomer | null>(null);
  const fetchGeneration = useRef(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileMenu(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileMenu) return;
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenu(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileMenu]);
  const [boot, setBoot] = useState<{
    identity: { id: string; name: string };
    admin: boolean;
    staff: boolean;
    workspaces: Workspace[];
    batches: { id: string; name: string }[];
  } | null>(null);
  const [workspace, setWorkspace] = useState(""),
    [setup, setSetup] = useState<Setup | null>(null),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const syncView = () => {
      const url = new URL(window.location.href);
      const requested = views.find(
        (view) => viewSlug(view) === url.searchParams.get("view"),
      );
      setTab(
        url.pathname.endsWith("/settings")
          ? "Settings"
          : requested || initialTab,
      );
      setDetail(null);
      setPage(1);
      setMessage("");
    };
    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, [initialTab]);
  const [rows, setRows] = useState<Complaint[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<Detail | null>(null),
    [form, setForm] = useState<Form>({ ...empty }),
    [editing, setEditing] = useState(false);
  const [search, setSearch] = useState({
      callingNumber: "",
      registeredNumber: "",
      code: "",
    }),
    [filters, setFilters] = useState<Record<string, string>>({
      from: localDate(new Date()).slice(0, 8) + "01",
      to: localDate(new Date()),
    }),
    [report, setReport] = useState<Report | null>(null),
    [applied, setApplied] = useState<Record<string, string>>(filters),
    [followUps, setFollowUps] = useState<Follow[]>([]);
  const [createMode, setCreateMode] = useState("pending");
  const [remark, setRemark] = useState(""),
    [teamId, setTeamId] = useState(""),
    [reason, setReason] = useState(""),
    [due, setDue] = useState(""),
    [assignee, setAssignee] = useState("");
  const busyRef = useRef(false),
    createRequest = useRef<string | null>(null);
  const role = setup?.actor.role || "",
    manager = role === "ADMIN" || role === "SUPERVISOR";
  const loadBoot = useCallback(async (preferred?: string) => {
    const b = await api<NonNullable<typeof boot>>();
    setBoot(b);
    let remembered = "";
    try {
      remembered = localStorage.getItem(`crm.workspace.${b.identity.id}`) || "";
    } catch {
      /* Storage is optional. */
    }
    setWorkspace((current) => {
      const selected = [preferred, current, remembered].find((id) =>
        b.workspaces.some((w) => w.id === id),
      );
      return selected || b.workspaces[0]?.id || "";
    });
  }, []);
  useEffect(() => {
    loadBoot()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [loadBoot]);
  useEffect(() => {
    if (!boot || !workspace) return;
    try {
      localStorage.setItem(`crm.workspace.${boot.identity.id}`, workspace);
    } catch {
      /* Storage is optional. */
    }
  }, [boot, workspace]);
  const loadSetup = useCallback(async () => {
    if (workspace) {
      const generation = fetchGeneration.current;
      const data = await api<Setup>({ kind: "setup", workspaceId: workspace });
      if (generation === fetchGeneration.current) setSetup(data);
    }
  }, [workspace]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setTrainingCustomer(null);
    fetchGeneration.current++;
    setSetup(null);
    setRows([]);
    setTotal(0);
    setPeople([]);
    setReport(null);
    setFollowUps([]);
    setForm({ ...empty });
    setEditing(false);
    setSearch({ callingNumber: "", registeredNumber: "", code: "" });
    setFilters((current) => ({ from: current.from, to: current.to }));
    setTeamId("");
    setReason("");
    setAssignee("");
    setPage(1);
    setMessage("");
    setError("");
    createRequest.current = null;
    if (workspace)
      api<Setup>({ kind: "setup", workspaceId: workspace })
        .then((data) => {
          if (active) setSetup(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [workspace]);
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const write = async (
    action: string,
    data?: unknown,
    extra: Record<string, unknown> = {},
  ) =>
    api<Complaint>(
      {},
      {
        workspaceId: workspace,
        action,
        data,
        requestId:
          action === "create"
            ? (createRequest.current ??
              (createRequest.current = crypto.randomUUID()))
            : crypto.randomUUID(),
        ...extra,
      },
    );
  const label = (id: string) =>
    setup?.options.find((o) => o.id === id)?.label ||
    setup?.roster.find((p) => p.id === id)?.displayName ||
    id ||
    "—";
  const person = (id: string | null) =>
    detail?.people.find((p) => p.id === id)?.displayName ||
    people.find((p) => p.id === id)?.displayName ||
    setup?.roster.find((p) => p.id === id)?.displayName ||
    id ||
    "Unassigned";
  const options = (kind: string) =>
    kind === "field" && editing && detail
      ? detail.complaint.fieldSnapshot
      : setup?.options.filter(
          (o) =>
            o.kind === kind &&
            (o.active ||
              (editing &&
                detail &&
                [
                  detail.complaint.callerType,
                  detail.complaint.channel,
                  detail.complaint.complaintType,
                  detail.complaint.issueType,
                  detail.complaint.primaryTag,
                  ...detail.complaint.tags,
                ].includes(o.id))),
        ) || [];
  const choice = (
    kind: string,
    value: string,
    onChange: (v: string) => void,
    optional = false,
  ) => (
    <select
      aria-label={kind}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={!optional}
    >
      <option value="">{optional ? "Any / none" : "Select…"}</option>
      {options(kind).map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const loadList = useCallback(async () => {
    if (!workspace) return;
    const generation = fetchGeneration.current;
    const data = await api<{
      rows: Complaint[];
      total: number;
      people: Person[];
    }>({
      kind: "list",
      workspaceId: workspace,
      ...search,
      page: String(page),
      ...(tab === "My Complaints" ? { mine: "true" } : {}),
      ...(tab === "Escalations" ? { queue: role === "L3" ? "L3" : "L2" } : {}),
    });
    if (generation !== fetchGeneration.current) return;
    setRows(data.rows);
    setPeople(data.people);
    setTotal(data.total);
  }, [workspace, search, page, tab, role]);
  useEffect(() => {
    if (
      !workspace ||
      !setup ||
      !["My Complaints", "All Complaints", "Search", "Escalations"].includes(
        tab,
      )
    )
      return;
    let pending = false;
    const refresh = async () => {
      if (pending || busyRef.current || document.visibilityState === "hidden")
        return;
      pending = true;
      try {
        await loadList();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Live list update failed");
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [workspace, setup, tab, loadList]);
  const loadReport = async () => {
    setReport(
      await api<Report>({ kind: "report", workspaceId: workspace, ...filters }),
    );
    setApplied({ ...filters });
  };
  useEffect(() => {
    if (!workspace || !setup) return;
    let active = true;
    setLoading(true);
    const work = ["Dashboard", "Reports"].includes(tab)
      ? api<Report>({
          kind: "report",
          workspaceId: workspace,
          ...filters,
        }).then((r) => {
          if (active) {
            setReport(r);
            setApplied({ ...filters });
          }
        })
      : tab === "Follow-ups"
        ? api<Follow[]>({ kind: "followups", workspaceId: workspace }).then(
            (r) => {
              if (active) setFollowUps(r);
            },
          )
        : ["My Complaints", "All Complaints", "Search", "Escalations"].includes(
              tab,
            )
          ? loadList()
          : Promise.resolve();
    work
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Filters are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, setup, tab, page]);
  const open = async (id: string) => {
    const generation = fetchGeneration.current;
    const data = await api<Detail>({
      kind: "detail",
      workspaceId: workspace,
      id,
    });
    if (generation !== fetchGeneration.current) return;
    setDetail(data);
    setEditing(false);
    setRemark("");
    setTab("Detail");
  };
  const act = async (action: string, data?: unknown) => {
    if (!detail) return;
    const updated = await write(action, data, {
      id: detail.complaint.id,
      version: detail.complaint.version,
      remark,
      teamId,
      userId: assignee,
    });
    if (!manager && role !== "AGENT" && updated.queue !== role) {
      setDetail(null);
      setTab("Escalations");
      await loadList();
    } else await open(detail.complaint.id);
    setMessage("Saved.");
  };
  const table = (items: Complaint[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {[
              "Complaint",
              "Contact",
              "Issue",
              "State / queue",
              "Handled by",
              "Updated",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <button
                  disabled={busy}
                  className="text-teal-700 font-semibold"
                  onClick={() => run(() => open(c.id))}
                >
                  {c.code}
                </button>
                <div className="text-xs text-slate-500">
                  {stamp(c.createdAt)}
                </div>
              </td>
              <td>
                {c.callingNumber}
                <div>{label(c.callerType)}</div>
              </td>
              <td>{label(c.issueType)}</td>
              <td>
                <span className={`crm-badge ${c.status.toLowerCase()}`}>
                  {c.status.replaceAll("_", " ")}
                </span>{" "}
                <span className="text-xs text-slate-400">{c.queue}</span>
                <div>{c.returnState !== "NORMAL" ? c.returnState : ""}</div>
              </td>
              <td>{person(c.ownerId)}</td>
              <td>{stamp(c.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="p-8 text-center text-slate-500">
          No complaints match this view.
        </p>
      )}
    </div>
  );
  const fetchContact = (by: "calling" | "registered") =>
    run(async () => {
      const generation = ++fetchGeneration.current;
      const result = await api<{
        source: Pick<
          Complaint,
          | "code"
          | "createdAt"
          | "callerType"
          | "channel"
          | "issueType"
          | "complaintType"
          | "registeredNumber"
        > | null;
        sourceKind?: string;
        matchedCallingNumber?: string;
        customer?: TrainingCustomer | null;
        message: string | null;
      }>({
        kind: "fetch",
        workspaceId: workspace,
        by,
        number: by === "calling" ? form.callingNumber : form.registeredNumber,
      });
      if (generation !== fetchGeneration.current) return;
      setTrainingCustomer(result.customer || null);
      if (result.source) {
        const { code, createdAt, ...prefill } = result.source;
        setForm((current) => ({
          ...current,
          ...prefill,
          callingNumber:
            current.callingNumber || result.matchedCallingNumber || "",
        }));
        setMessage(
          "Copied contact fields from " +
            (result.sourceKind === "training"
              ? "training customer "
              : "complaint ") +
            code +
            " - " +
            stamp(createdAt) +
            ". Verify before saving.",
        );
      } else setMessage(result.message || "No matching data found");
    });
  const complaintForm = (submit: (e: FormEvent) => void) => (
    <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
      <Field label="Calling number">
        <div className="flex gap-2">
          <input
            aria-label="Calling number"
            required
            disabled={busy}
            maxLength={40}
            value={form.callingNumber}
            onChange={(e) => {
              setTrainingCustomer(null);
              setForm({ ...form, callingNumber: e.target.value });
            }}
          />
          <button
            type="button"
            aria-label="Fetch Data by calling number"
            disabled={busy || !form.callingNumber.trim()}
            onClick={() => fetchContact("calling")}
          >
            Fetch Data
          </button>
        </div>
      </Field>
      <Field label="Registered number">
        <div className="flex gap-2">
          <input
            aria-label="Registered number"
            disabled={busy}
            maxLength={40}
            value={form.registeredNumber}
            onChange={(e) => {
              setTrainingCustomer(null);
              setForm({ ...form, registeredNumber: e.target.value });
            }}
          />
          <button
            type="button"
            aria-label="Fetch Data by registered number"
            disabled={busy || !form.registeredNumber.trim()}
            onClick={() => fetchContact("registered")}
          >
            Fetch Data
          </button>
        </div>
      </Field>
      {trainingCustomer && (
        <aside className="crm-training-reference md:col-span-2">
          <strong>
            {trainingCustomer.name} -{" "}
            {trainingCustomer.trainingProfile.reference}
          </strong>
          <p>{trainingCustomer.trainingProfile.scenario}</p>
          <small>
            Practice transaction reference:{" "}
            {trainingCustomer.trainingProfile.transactionReference} / Amount:{" "}
            {trainingCustomer.trainingProfile.transactionAmount}. Enter
            complaint details and transaction date yourself.
          </small>
        </aside>
      )}
      <Field label="Email / FB name / ticket ID / username">
        <input
          maxLength={200}
          value={form.identifier}
          onChange={(e) => setForm({ ...form, identifier: e.target.value })}
        />
      </Field>
      {(
        [
          "callerType",
          "channel",
          "complaintType",
          "issueType",
          "primaryTag",
        ] as const
      ).map((k) => (
        <Field
          key={k}
          label={
            {
              callerType: "Caller type",
              channel: "Channel",
              complaintType: "Complaint type",
              issueType: "Issue type",
              primaryTag: "Primary tag",
            }[k]
          }
        >
          {choice(
            k === "primaryTag" ? "tag" : k,
            form[k],
            (v) => setForm({ ...form, [k]: v }),
            k === "primaryTag",
          )}
        </Field>
      ))}
      <Field label="Additional tags">
        <select
          multiple
          value={form.tags}
          onChange={(e) =>
            setForm({
              ...form,
              tags: Array.from(e.target.selectedOptions, (o) => o.value),
            })
          }
        >
          {options("tag")
            .filter((o) => !o.parentId || o.parentId === form.primaryTag)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Transaction date">
        <input
          type="date"
          value={form.transactionDate?.slice(0, 10) || ""}
          onChange={(e) =>
            setForm({
              ...form,
              transactionDate: e.target.value
                ? e.target.value + "T00:00:00+06:00"
                : null,
            })
          }
        />
      </Field>
      <Field label="Transaction amount">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.transactionAmount || ""}
          onChange={(e) =>
            setForm({ ...form, transactionAmount: e.target.value || null })
          }
        />
      </Field>
      <Field label="Transaction ID">
        <input
          value={form.transactionId}
          onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Issue details">
          <textarea
            aria-label="Issue details"
            required
            maxLength={10000}
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </div>
      {options("field").map((o) => (
        <Field key={o.id} label={o.label + (o.settings.required ? " *" : "")}>
          {o.settings.type === "select" ? (
            <select
              required={o.settings.required}
              value={form.customFields[o.id] ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  customFields: {
                    ...form.customFields,
                    [o.id]: e.target.value,
                  },
                })
              }
            >
              <option value="">Select…</option>
              {o.settings.choices?.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              required={o.settings.required}
              type={
                o.settings.type === "number"
                  ? "number"
                  : o.settings.type === "date"
                    ? "date"
                    : "text"
              }
              value={form.customFields[o.id] ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  customFields: {
                    ...form.customFields,
                    [o.id]:
                      o.settings.type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  },
                })
              }
            />
          )}
        </Field>
      ))}
      {!editing && (
        <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
          <Field label="Submit action">
            <select
              value={createMode}
              onChange={(e) => setCreateMode(e.target.value)}
            >
              <option value="pending">Save as Pending</option>
              <option value="resolve">Submit and Resolve</option>
              <option value="escalate">Submit and Escalate</option>
            </select>
          </Field>
          {createMode !== "pending" && (
            <Field label="Solution / escalation reason">
              <textarea
                required
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </Field>
          )}
          {createMode === "resolve" && (
            <Field label="Resolution reason">
              {choice("resolutionReason", reason, setReason)}
            </Field>
          )}
          {createMode === "escalate" && (
            <Field label="L2 destination">
              <select
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              >
                <option value="">Select L2 team</option>
                {setup?.teams
                  .filter((t) => t.active && t.tier === "L2")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
      )}
      <div className="md:col-span-2">
        <button className="primary" disabled={busy}>
          {editing
            ? "Save correction"
            : createMode === "resolve"
              ? "Submit and Resolve"
              : createMode === "escalate"
                ? "Submit and Escalate"
                : "Save as Pending"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          After saving, resolve with a solution or escalate to an eligible team.
        </p>
      </div>
    </form>
  );
  const nav = [
    "Dashboard",
    ...(role === "AGENT" || manager
      ? ["New Complaint", manager ? "All Complaints" : "My Complaints"]
      : ["Escalations"]),
    "Search",
    "Training Customers",
    "Follow-ups",
    "Reports",
    ...(manager ? ["Student Progress", "Distribute Work"] : ["My Progress"]),
    ...(manager ? ["Settings", "Activity"] : []),
    "Profile",
  ];
  const icons: Record<string, typeof LayoutDashboard> = {
    Dashboard: LayoutDashboard,
    "New Complaint": Plus,
    "All Complaints": ClipboardList,
    "My Complaints": ClipboardList,
    Escalations: ArrowUpRight,
    Search: SearchIcon,
    "Follow-ups": CalendarClock,
    Reports: BarChart3,
    Settings: Settings2,
    Activity: ActivityIcon,
    Profile: UserRound,
    "Training Customers": UsersRound,
    "Student Progress": BarChart3,
    "My Progress": BarChart3,
    "Distribute Work": UsersRound,
  };
  const navigate = (next: string) => {
    const base = staff ? "/dashboard/crm" : "/student-dashboard/crm";
    const url =
      next === "Settings" && staff
        ? `${base}/settings`
        : next === "Dashboard"
          ? base
          : `${base}?view=${viewSlug(next)}`;
    window.history.pushState(null, "", url);
    setTab(next);
    setDetail(null);
    setPage(1);
    setError("");
    setMessage("");
    setMobileMenu(false);
  };
  const displayName = boot?.identity.name || "Your account";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={`crm-root${collapsed ? " crm-collapsed" : ""}${mobileMenu ? " crm-menu-open" : ""}`}
    >
      {mobileMenu && (
        <button
          className="crm-mobile-backdrop"
          aria-label="Close navigation overlay"
          onClick={() => {
            setMobileMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebarRef}
        className="crm-sidebar"
        id="crm-navigation"
        inert={isMobile && !mobileMenu}
      >
        <div className="crm-brand">
          <span className="crm-brand-mark">
            <Headphones size={20} />
          </span>
          <div className="crm-brand-copy">
            <strong>ASM CRM</strong>
            <small>
              {tab === "Settings" || tab === "Activity"
                ? "Administration"
                : "Customer service"}
            </small>
          </div>
          <button
            className="crm-sidebar-close"
            aria-label="Close navigation"
            onClick={() => {
              setMobileMenu(false);
              menuButton.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="crm-workspace-select">
          <Field label="Workspace">
            <select
              aria-label="Workspace"
              value={workspace}
              disabled={busy}
              onChange={(e) => {
                if (tab === "Detail") navigate("Search");
                const value = e.target.value;
                if (value.startsWith("batch:")) {
                  run(async () => {
                    const created = await api<Workspace>(
                      {},
                      {
                        action: "provision",
                        data: { batchId: value.slice(6) },
                      },
                    );
                    await loadBoot(created.id);
                  });
                } else setWorkspace(value);
              }}
            >
              <option value="">Select workspace</option>
              {boot?.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
              {boot?.admin &&
                boot.batches
                  .filter(
                    (b) => !boot.workspaces.some((w) => w.batchId === b.id),
                  )
                  .map((b) => (
                    <option key={b.id} value={`batch:${b.id}`}>
                      {b.name} — Set up workspace
                    </option>
                  ))}
            </select>
          </Field>
        </div>
        <p className="crm-nav-label">WORKSPACE</p>
        <nav aria-label="CRM">
          {nav.map((n) => {
            const Icon = icons[n] || ClipboardList;
            return (
              <button
                key={n}
                aria-label={n}
                title={n}
                aria-current={tab === n ? "page" : undefined}
                className={tab === n ? "active" : ""}
                onClick={() => navigate(n)}
              >
                <Icon size={18} />
                <span className="crm-nav-text">{n}</span>
              </button>
            );
          })}
        </nav>
        <div className="crm-sidebar-foot">
          <span className="crm-avatar">{initials}</span>
          <div className="crm-sidebar-foot-copy">
            <strong>{displayName}</strong>
            <small>
              {role || (staff ? "Staff" : "Student")} &middot; Asia/Dhaka
            </small>
          </div>
        </div>
      </aside>
      <div className="crm-shell-body">
        <header className="crm-topbar">
          <div className="crm-topbar-left">
            <button
              ref={menuButton}
              className="crm-icon-button"
              aria-label="Toggle navigation"
              aria-controls="crm-navigation"
              aria-expanded={isMobile ? mobileMenu : !collapsed}
              onClick={() => {
                if (window.matchMedia("(max-width: 767px)").matches)
                  setMobileMenu(!mobileMenu);
                else setCollapsed(!collapsed);
              }}
            >
              <Menu size={20} />
            </button>
            <button
              className="crm-top-search"
              onClick={() => navigate("Search")}
              aria-label="Search complaints"
            >
              <SearchIcon size={17} />
              <span>Search complaints, contacts...</span>
            </button>
          </div>
          <h1 className="sr-only">Operations workspace</h1>
          <div className="crm-topbar-right">
            {workspace && setup && (
              <CrmNotifications
                key={workspace}
                workspaceId={workspace}
                onOpen={(id) => {
                  void run(() => open(id));
                }}
              />
            )}
            <Link
              href={staff ? "/dashboard" : "/student-dashboard"}
              aria-label={`Back to ${staff ? "Staff" : "Student"} Portal`}
            >
              <ArrowLeft size={15} />
              <span>Back to {staff ? "Staff" : "Student"} Portal</span>
            </Link>
            <span className="crm-topbar-separator" />
            <div className="crm-topbar-user">
              {displayName}
              <small>
                {role || (staff ? "Staff account" : "Student account")}
              </small>
            </div>
            <span className="crm-avatar" aria-hidden="true">
              {initials}
            </span>
          </div>
        </header>
        <main className="crm-main">
          <div className="crm-content">
            <div className="crm-page-heading">
              <div>
                <h2>{tab}</h2>
                <p className="crm-breadcrumb" title={branding.name}>
                  Customer service<span>/</span>
                  {tab === "Detail" ? "Complaint details" : tab}
                </p>
              </div>
              <div className="crm-heading-actions">
                {setup && (
                  <span className="crm-workspace-state">
                    <i />
                    {setup.workspace.name}
                    <b>{setup.workspace.state}</b>
                  </span>
                )}
                {setup &&
                  (role === "AGENT" || manager) &&
                  tab !== "New Complaint" && (
                    <button
                      className="primary"
                      onClick={() => navigate("New Complaint")}
                    >
                      <Plus size={16} />
                      Create complaint
                    </button>
                  )}
              </div>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800"
              >
                {error}
                <button
                  className="ml-3"
                  onClick={() =>
                    run(async () => {
                      await loadBoot();
                      await loadSetup();
                    })
                  }
                >
                  Retry
                </button>
              </div>
            )}
            {message && (
              <div
                role="status"
                className="mb-4 rounded-lg bg-teal-50 p-4 text-teal-900"
              >
                {message}
              </div>
            )}
            {loading && (
              <p role="status" className="crm-loading">
                <LoaderCircle size={16} /> Loading workspace...
              </p>
            )}
            {!workspace && !loading && (
              <section className="crm-empty-workspace">
                <div className="crm-empty-icon">
                  <UsersRound size={30} />
                </div>
                <h3 className="font-semibold">No assigned workspace</h3>
                <p className="mt-2 text-slate-600">
                  {boot?.admin
                    ? "Select a batch from Workspace to set it up with 500 training customers and 250 pending complaints. The selected workspace applies to every CRM page."
                    : "Ask your administrator to set up your batch workspace. Eligible batch students join automatically as Agents."}
                </p>
              </section>
            )}
            {workspace && setup && (
              <>
                {["Student Progress", "My Progress"].includes(tab) && (
                  <CrmStudentProgress
                    key={workspace}
                    workspaceId={workspace}
                    onOpen={(id) => {
                      void run(() => open(id));
                    }}
                  />
                )}
                {tab === "Distribute Work" && manager && (
                  <CrmBulkAssignment
                    key={workspace}
                    workspaceId={workspace}
                    onChanged={() => {
                      void loadSetup().catch((e) => setError(e.message));
                    }}
                  />
                )}
                {["Dashboard", "Reports"].includes(tab) && (
                  <>
                    <details
                      className="crm-report-filters"
                      open={tab === "Reports" ? true : undefined}
                    >
                      <summary>
                        <SlidersHorizontal size={16} />
                        Filters
                        <span className="crm-filter-summary">
                          {applied.from} &mdash; {applied.to}
                        </span>
                        <ChevronDown size={15} className="crm-filter-chevron" />
                      </summary>
                      <form
                        className="crm-filter-grid"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(loadReport);
                        }}
                      >
                        <Field label="Date from (Dhaka)">
                          <input
                            type="date"
                            required
                            value={filters.from}
                            onChange={(e) =>
                              setFilters({ ...filters, from: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Date through (Dhaka)">
                          <input
                            type="date"
                            required
                            value={filters.to}
                            onChange={(e) =>
                              setFilters({ ...filters, to: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Preset">
                          <select
                            defaultValue="This Month"
                            onChange={(e) => {
                              if (e.target.value === "Custom") return;
                              const now = new Date(),
                                today = localDate(now),
                                local = new Date(today + "T12:00:00Z");
                              let from = today,
                                to = today;
                              const days = (n: number) =>
                                localDate(new Date(+now - n * 86400000));
                              switch (e.target.value) {
                                case "Yesterday":
                                  from = to = days(1);
                                  break;
                                case "Last 7 Days":
                                  from = days(6);
                                  break;
                                case "Last 15 Days":
                                  from = days(14);
                                  break;
                                case "Last 30 Days":
                                  from = days(29);
                                  break;
                                case "This Month":
                                  from = today.slice(0, 8) + "01";
                                  break;
                                case "Last Month":
                                  to = new Date(
                                    Date.UTC(
                                      local.getUTCFullYear(),
                                      local.getUTCMonth(),
                                      0,
                                      12,
                                    ),
                                  )
                                    .toISOString()
                                    .slice(0, 10);
                                  from = to.slice(0, 8) + "01";
                                  break;
                                case "This Week":
                                  from = days(local.getUTCDay());
                                  break;
                                case "Last Week":
                                  from = days(local.getUTCDay() + 7);
                                  to = days(local.getUTCDay() + 1);
                                  break;
                              }
                              setFilters({ ...filters, from, to });
                            }}
                          >
                            {[
                              "Today",
                              "Yesterday",
                              "Last 7 Days",
                              "Last 15 Days",
                              "Last 30 Days",
                              "This Month",
                              "Last Month",
                              "This Week",
                              "Last Week",
                              "Custom",
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </Field>
                        {[
                          "channel",
                          "issueType",
                          "complaintType",
                          "callerType",
                          "tag",
                        ].map((k) => (
                          <Field key={k} label={k}>
                            {choice(
                              k,
                              filters[k] || "",
                              (v) => setFilters({ ...filters, [k]: v }),
                              true,
                            )}
                          </Field>
                        ))}
                        <Field label="Status">
                          <select
                            value={filters.status || ""}
                            onChange={(e) =>
                              setFilters({ ...filters, status: e.target.value })
                            }
                          >
                            <option value="">All</option>
                            {[
                              "PENDING",
                              "IN_PROGRESS",
                              "RESOLVED",
                              "INVALID",
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                        {manager && (
                          <Field label="Agent (creator / actual resolver)">
                            <select
                              value={filters.agent || ""}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  agent: e.target.value,
                                })
                              }
                            >
                              <option value="">All</option>
                              {setup.roster.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.displayName}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                        <button className="primary self-end" disabled={busy}>
                          Apply
                        </button>
                      </form>
                    </details>
                    {report && (
                      <>
                        <CrmOverview
                          report={report}
                          from={applied.from}
                          to={applied.to}
                          label={label}
                        />
                        {tab === "Dashboard" && (
                          <section className="crm-panel">
                            <div className="crm-panel-title">
                              <div>
                                <h3>Recent resolutions</h3>
                                <p>Final resolutions in the selected period</p>
                              </div>
                              <button onClick={() => navigate("Reports")}>
                                View report <ArrowUpRight size={14} />
                              </button>
                            </div>
                            {table(
                              [...report.rows]
                                .sort((a, b) =>
                                  (b.resolvedAt || "").localeCompare(
                                    a.resolvedAt || "",
                                  ),
                                )
                                .slice(0, 5),
                            )}
                          </section>
                        )}
                        <p className="crm-data-note">
                          {report.basis} Weeks run Sunday 00:00 to Sunday 00:00,
                          Asia/Dhaka.
                        </p>
                        {tab === "Reports" && (
                          <section className="bg-white rounded-xl p-5">
                            <div className="flex gap-3 mb-5">
                              {["csv", "xlsx"].map((format) => (
                                <a
                                  key={format}
                                  className="underline text-teal-700"
                                  href={
                                    "/api/crm?" +
                                    new URLSearchParams({
                                      kind: "export",
                                      workspaceId: workspace,
                                      ...applied,
                                      format,
                                    })
                                  }
                                >
                                  Download {format.toUpperCase()}
                                </a>
                              ))}
                            </div>
                            {Object.entries(report.breakdowns).map(
                              ([key, values]) => (
                                <details key={key} className="mb-3">
                                  <summary>{key} · creation cohort</summary>
                                  {values.map((v) => (
                                    <p key={v.name}>
                                      {label(v.name)}: {v.count}
                                    </p>
                                  ))}
                                </details>
                              ),
                            )}
                            <h3 className="font-semibold my-4">
                              Agent operations
                            </h3>
                            <div className="overflow-x-auto">
                              <table>
                                <thead>
                                  <tr>
                                    {[
                                      "Agent",
                                      "Created",
                                      "Contacts",
                                      "Escalated",
                                      "Resolved",
                                      "Average TAT",
                                    ].map((h) => (
                                      <th key={h}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {report.agents.map((a) => (
                                    <tr key={a.id}>
                                      <td>{person(a.id)}</td>
                                      <td>{a.complaints}</td>
                                      <td>{a.interactions}</td>
                                      <td>{a.escalations}</td>
                                      <td>{a.resolved}</td>
                                      <td>{duration(a.average)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <h3 className="font-semibold my-4">
                              Final resolutions in selected period
                            </h3>
                            {table(report.rows)}
                          </section>
                        )}
                      </>
                    )}
                  </>
                )}
                {tab === "New Complaint" && (
                  <section className="bg-white p-6 rounded-xl">
                    {complaintForm((e) => {
                      e.preventDefault();
                      run(async () => {
                        const c = await write(
                          "create",
                          {
                            ...form,
                            transactionDate: form.transactionDate
                              ? new Date(form.transactionDate).toISOString()
                              : null,
                          },
                          {
                            initialAction: createMode,
                            remark,
                            teamId,
                            resolutionReason: reason,
                          },
                        );
                        createRequest.current = null;
                        setForm({ ...empty });
                        await open(c.id);
                        setMessage(
                          "Complaint saved. Resolve it or escalate with a reason.",
                        );
                      });
                    })}
                  </section>
                )}
                {[
                  "My Complaints",
                  "All Complaints",
                  "Search",
                  "Escalations",
                ].includes(tab) && (
                  <section className="bg-white p-5 rounded-xl">
                    <form
                      className="grid md:grid-cols-4 gap-3 mb-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPage(1);
                        run(loadList);
                      }}
                    >
                      {Object.entries(search).map(([key, value]) => (
                        <Field key={key} label={key}>
                          <input
                            aria-label={key}
                            value={value}
                            onChange={(e) =>
                              setSearch({ ...search, [key]: e.target.value })
                            }
                          />
                        </Field>
                      ))}
                      <button disabled={busy}>Search</button>
                    </form>
                    {table(rows)}
                    <div className="flex justify-between mt-4">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        Page {page} · {total} complaints
                      </span>
                      <button
                        disabled={page * 30 >= total}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </section>
                )}
                {tab === "Detail" && detail && (
                  <>
                    <section className="bg-white p-6 rounded-xl">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {detail.complaint.code}
                          </h3>
                          <p>
                            {detail.complaint.status} · {detail.complaint.queue}{" "}
                            · {detail.complaint.returnState}
                          </p>
                        </div>
                        <div className="text-sm">
                          Created {stamp(detail.complaint.createdAt)}
                          <br />
                          Updated {stamp(detail.complaint.updatedAt)}
                        </div>
                      </div>
                      <div className="grid md:grid-cols-3 gap-5 my-6">
                        <p>
                          Calling: {detail.complaint.callingNumber}
                          <br />
                          Registered: {detail.complaint.registeredNumber}
                          <br />
                          {detail.complaint.identifier}
                        </p>
                        <p>
                          {label(detail.complaint.issueType)} /{" "}
                          {label(detail.complaint.complaintType)}
                          <br />
                          {label(detail.complaint.channel)} ·{" "}
                          {label(detail.complaint.callerType)}
                          <br />
                          {[
                            detail.complaint.primaryTag,
                            ...detail.complaint.tags,
                          ]
                            .filter(Boolean)
                            .map(label)
                            .join(", ")}
                        </p>
                        <p>
                          Created by: {person(detail.complaint.creatorId)}
                          <br />
                          Current owner: {person(detail.complaint.ownerId)}
                          <br />
                          Resolved by: {person(detail.complaint.resolverId)}
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap">
                        {detail.complaint.description}
                      </p>
                      <p className="mt-3 text-sm">
                        Transaction: {detail.complaint.transactionId || "—"} ·{" "}
                        {detail.complaint.transactionAmount || "—"} ·{" "}
                        {stamp(detail.complaint.transactionDate)}
                      </p>
                      {detail.complaint.fieldSnapshot.map((o) => (
                        <p key={o.id} className="text-sm">
                          {o.label}:{" "}
                          {detail.complaint.customFields[o.id] ?? "—"}
                        </p>
                      ))}
                      <div className="my-5 grid gap-3 md:grid-cols-3 rounded-lg bg-slate-50 p-4">
                        <p>
                          Overall due
                          <br />
                          {stamp(detail.complaint.dueAt)}
                        </p>
                        <p>
                          L2 elapsed
                          <br />
                          <Clock
                            start={detail.complaint.firstL2At}
                            end={detail.complaint.l2CompletedAt}
                          />
                          <br />
                          Due: {stamp(detail.complaint.l2DueAt)}
                        </p>
                        <p>
                          L3 elapsed
                          <br />
                          <Clock
                            start={detail.complaint.firstL3At}
                            end={detail.complaint.closedAt}
                          />
                          <br />
                          Due: {stamp(detail.complaint.l3DueAt)}
                        </p>
                      </div>
                      {detail.complaint.remarks && (
                        <p className="p-4 bg-teal-50 rounded-lg whitespace-pre-wrap">
                          {detail.complaint.remarks}
                        </p>
                      )}
                      {(manager ||
                        (role === "AGENT" &&
                          detail.complaint.ownerId === setup.actor.id &&
                          detail.complaint.queue === "AGENT" &&
                          !detail.complaint.closedAt)) && (
                        <button
                          disabled={busy}
                          className="my-4"
                          onClick={() => {
                            const c = detail.complaint;
                            setForm(
                              Object.fromEntries(
                                Object.keys(empty).map((k) => [
                                  k,
                                  c[k as keyof Complaint],
                                ]),
                              ) as Form,
                            );
                            setEditing(!editing);
                          }}
                        >
                          Edit complaint details
                        </button>
                      )}
                      {editing &&
                        complaintForm((e) => {
                          e.preventDefault();
                          run(async () => {
                            await act("edit", {
                              ...form,
                              transactionDate: form.transactionDate
                                ? new Date(form.transactionDate).toISOString()
                                : null,
                            });
                            setEditing(false);
                          });
                        })}
                      {!detail.complaint.closedAt && (
                        <div className="border-t mt-5 pt-5 grid gap-4">
                          <Field label="Reason / solution / note">
                            <textarea
                              value={remark}
                              onChange={(e) => setRemark(e.target.value)}
                              rows={3}
                            />
                          </Field>
                          <div className="grid md:grid-cols-3 gap-3">
                            <Field label="Resolution reason">
                              {choice(
                                "resolutionReason",
                                reason,
                                setReason,
                                true,
                              )}
                            </Field>
                            <Field label="Escalation destination">
                              <select
                                value={teamId}
                                onChange={(e) => setTeamId(e.target.value)}
                              >
                                <option value="">Select team</option>
                                {setup.teams
                                  .filter(
                                    (t) =>
                                      t.active &&
                                      t.tier ===
                                        (detail.complaint.queue === "AGENT"
                                          ? "L2"
                                          : "L3"),
                                  )
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name} ({t.tier})
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <Field label="Follow-up due (your local time)">
                              <input
                                type="datetime-local"
                                value={due}
                                onChange={(e) => setDue(e.target.value)}
                              />
                            </Field>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!detail.complaint.ownerId && role !== "AGENT" && (
                              <button
                                disabled={busy}
                                onClick={() => run(() => act("claim"))}
                              >
                                Claim
                              </button>
                            )}
                            {(manager ||
                              detail.complaint.ownerId === setup.actor.id) && (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() => run(() => act("progress"))}
                                >
                                  In progress
                                </button>
                                {!(
                                  detail.complaint.queue === "AGENT" &&
                                  detail.complaint.firstL2At
                                ) && (
                                  <button
                                    className="primary"
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        act("resolve", {
                                          resolutionReason: reason,
                                        }),
                                      )
                                    }
                                  >
                                    Resolve
                                  </button>
                                )}
                                {detail.complaint.queue !== "L3" && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        act(
                                          detail.complaint.queue === "AGENT" &&
                                            detail.complaint.firstL2At
                                            ? "resubmit"
                                            : "escalate",
                                        ),
                                      )
                                    }
                                  >
                                    {detail.complaint.firstL2At &&
                                    detail.complaint.queue === "AGENT"
                                      ? "Resubmit to L2"
                                      : "Escalate"}
                                  </button>
                                )}
                                {detail.complaint.queue !== "AGENT" && (
                                  <button
                                    disabled={busy}
                                    onClick={() => run(() => act("invalid"))}
                                  >
                                    Invalid
                                  </button>
                                )}
                                {detail.complaint.queue === "L2" && (
                                  <>
                                    <button
                                      disabled={busy}
                                      onClick={() => run(() => act("revert"))}
                                    >
                                      Revert to Agent
                                    </button>
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        run(() => act("agent_mistake"))
                                      }
                                    >
                                      Agent mistake
                                    </button>
                                  </>
                                )}
                                <button
                                  disabled={busy}
                                  onClick={() => run(() => act("note"))}
                                >
                                  Add internal note
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => run(() => act("interaction"))}
                                >
                                  Record customer contact
                                </button>
                                <button
                                  disabled={busy || !due}
                                  onClick={() =>
                                    run(() =>
                                      act("followup", {
                                        dueAt: new Date(due).toISOString(),
                                      }),
                                    )
                                  }
                                >
                                  Schedule follow-up
                                </button>
                              </>
                            )}
                          </div>
                          {manager && (
                            <div className="flex gap-3">
                              <select
                                aria-label="Reassign owner"
                                value={assignee}
                                onChange={(e) => setAssignee(e.target.value)}
                              >
                                <option value="">Select new owner</option>
                                {setup.members
                                  .filter(
                                    (m) =>
                                      m.active &&
                                      m.role === detail.complaint.queue &&
                                      (m.role === "AGENT" ||
                                        m.teamId === detail.complaint.teamId),
                                  )
                                  .map((m) => (
                                    <option key={m.id} value={m.userId}>
                                      {person(m.userId)}
                                    </option>
                                  ))}
                              </select>
                              <button
                                disabled={busy}
                                onClick={() => run(() => act("assign"))}
                              >
                                Reassign
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                    <section className="bg-white p-6 mt-5 rounded-xl">
                      <h3 className="font-semibold mb-4">Follow-ups</h3>
                      {detail.followUps.map((f) => (
                        <div className="border-b py-3" key={f.id}>
                          <p>
                            {stamp(f.dueAt)} · {f.note} ·{" "}
                            {f.completedAt
                              ? "Completed"
                              : new Date(f.dueAt) < new Date()
                                ? "Overdue"
                                : "Pending"}
                          </p>
                          {!f.completedAt && !detail.complaint.closedAt && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  act("complete_followup", {
                                    followUpId: f.id,
                                  }),
                                )
                              }
                            >
                              Complete follow-up (remark required)
                            </button>
                          )}
                        </div>
                      ))}
                      <h3 className="font-semibold mt-6 mb-4">Timeline</h3>
                      <ol className="border-l-2 border-teal-200 pl-5 space-y-4">
                        {detail.history.map((h) => (
                          <li key={h.id}>
                            <strong>{h.action.replaceAll("_", " ")}</strong> ·{" "}
                            {h.actorName}
                            <p className="text-xs text-slate-500">
                              {stamp(h.createdAt)}
                            </p>
                            {h.remark && (
                              <p className="whitespace-pre-wrap text-sm">
                                {h.remark}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                      <h3 className="font-semibold mt-6">
                        Customer contacts ({detail.interactions.length})
                      </h3>
                      {detail.interactions.map((i) => (
                        <p key={i.id} className="mt-2 text-sm">
                          {stamp(i.createdAt)} · {i.note}
                        </p>
                      ))}
                      <h3 className="font-semibold mt-6">Internal notes</h3>
                      {detail.notes.map((n) => (
                        <p
                          key={n.id}
                          className="mt-2 text-sm whitespace-pre-wrap"
                        >
                          {stamp(n.createdAt)} · {n.text}
                        </p>
                      ))}
                    </section>
                  </>
                )}
                {tab === "Training Customers" && (
                  <CrmTrainingCustomers
                    key={workspace}
                    workspaceId={workspace}
                    onUse={
                      role === "AGENT" || manager
                        ? (customer) => {
                            setForm({
                              ...empty,
                              callingNumber: customer.number,
                              registeredNumber: customer.registeredNumber,
                              identifier: customer.name,
                            });
                            setTrainingCustomer(customer);
                            navigate("New Complaint");
                          }
                        : undefined
                    }
                  />
                )}
                {tab === "Follow-ups" && (
                  <section className="bg-white p-5 rounded-xl">
                    {followUps.length === 0 && <p>No follow-ups scheduled.</p>}
                    {followUps.map((f) => (
                      <div key={f.id} className="border-b py-4">
                        <button onClick={() => run(() => open(f.complaintId))}>
                          Open complaint
                        </button>
                        <span className="ml-3">
                          {stamp(f.dueAt)} ·{" "}
                          {f.completedAt
                            ? "Completed"
                            : new Date(f.dueAt) < new Date()
                              ? "Overdue"
                              : "Pending"}
                        </span>
                        <p>{f.note}</p>
                      </div>
                    ))}
                  </section>
                )}
                {tab === "Settings" && manager && (
                  <>
                    <section className="bg-white p-5 rounded-xl mb-5">
                      <h3 className="font-semibold">
                        Administration · {setup.workspace.name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Manage this workspace's members, teams, dropdown options
                        and SLA policies. Eligible batch students join
                        automatically as Agents. Use the sidebar for complaints,
                        follow-ups and reports; the selected workspace applies
                        throughout CRM.
                      </p>
                    </section>
                    <Settings
                      key={workspace}
                      setup={setup}
                      busy={busy}
                      save={(action, data, extra) =>
                        run(async () => {
                          await write(action, data, extra);
                          await loadSetup();
                          setMessage(
                            "Configuration saved. Existing complaint SLA snapshots are preserved.",
                          );
                        })
                      }
                    />
                  </>
                )}
                {tab === "Activity" && manager && (
                  <Activity workspaceId={workspace} />
                )}
                {tab === "Profile" && (
                  <section className="bg-white rounded-xl p-6">
                    <h3 className="font-semibold">{setup.actor.name}</h3>
                    <p>
                      {role} · {setup.workspace.name}
                    </p>
                    <p className="mt-3 text-sm text-slate-600">
                      Your portal account is your CRM identity. Your teacher
                      manages any changes to your CRM role and team. Batch
                      students join automatically as Agents.
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
function Settings({
  setup,
  busy,
  save,
}: {
  setup: Setup;
  busy: boolean;
  save: (
    action: string,
    data: unknown,
    extra?: Record<string, unknown>,
  ) => void;
}) {
  const [kind, setKind] = useState("callerType"),
    [fieldType, setFieldType] = useState("text"),
    [selectedRole, setSelectedRole] = useState("AGENT");
  const opts = (kind: string) => (
    <>
      <option value="">None / fallback</option>
      {setup.options
        .filter((o) => o.active && o.kind === kind)
        .map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
    </>
  );
  const handle =
    (fn: (f: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      fn(new FormData(e.currentTarget));
    };
  return (
    <div className="crm-settings-grid">
      {setup.actor.role === "ADMIN" && (
        <>
          <section className="bg-white p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Teams</h3>
            <form
              className="grid md:grid-cols-3 gap-3"
              onSubmit={handle((f) =>
                save("team", { name: f.get("name"), tier: f.get("tier") }),
              )}
            >
              <Field label="Team name">
                <input name="name" required />
              </Field>
              <Field label="Tier">
                <select name="tier">
                  <option>L2</option>
                  <option>L3</option>
                </select>
              </Field>
              <button disabled={busy}>Add team</button>
            </form>
            {setup.teams.map((t) => (
              <p key={t.id} className="mt-3">
                {t.name} · {t.tier} · {t.active ? "Active" : "Inactive"}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    save(
                      "team",
                      { name: t.name, tier: t.tier, active: !t.active },
                      { id: t.id },
                    )
                  }
                >
                  {t.active ? "Deactivate" : "Activate"}
                </button>
              </p>
            ))}
          </section>
          <section className="bg-white p-6 rounded-xl">
            <h3 className="font-semibold mb-4">Batch membership</h3>
            <form
              className="grid md:grid-cols-4 gap-3"
              onSubmit={handle((f) =>
                save(
                  "member",
                  {
                    role: f.get("role"),
                    teamId: f.get("teamId") || null,
                    active: true,
                  },
                  { userId: f.get("userId") },
                ),
              )}
            >
              <Field label="Student">
                <select name="userId" required>
                  {setup.roster
                    .filter((p) => p.role === "student")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="CRM role">
                <select
                  name="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option>AGENT</option>
                  <option>L2</option>
                  <option>L3</option>
                </select>
              </Field>
              <Field label="Team">
                <select name="teamId">
                  <option value="">No team (Agent)</option>
                  {setup.teams
                    .filter((t) => t.active && t.tier === selectedRole)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button disabled={busy}>Assign role</button>
            </form>
            {setup.members.map((m) => (
              <p key={m.id} className="mt-3">
                {setup.roster.find((p) => p.id === m.userId)?.displayName ||
                  "No longer in current roster"}{" "}
                · {m.role}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    save(
                      "member",
                      { role: m.role, teamId: m.teamId, active: !m.active },
                      { userId: m.userId },
                    )
                  }
                >
                  {m.active ? "Deactivate" : "Activate"}
                </button>
              </p>
            ))}
            <h4 className="font-semibold mt-6 mb-3">
              Supervisor workspace access
            </h4>
            <form
              className="flex gap-3"
              onSubmit={handle((f) =>
                save("staff", { active: true }, { userId: f.get("userId") }),
              )}
            >
              <select name="userId">
                {setup.roster
                  .filter((p) => p.role !== "student")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
              </select>
              <button disabled={busy}>Assign</button>
            </form>
            <p className="text-xs mt-2">
              Staff also need the CRM Supervisor portal permission.
            </p>
            {setup.staffAssignments.map((s) => (
              <p key={s.userId}>
                {setup.roster.find((p) => p.id === s.userId)?.displayName ||
                  s.userId}{" "}
                <button
                  disabled={busy}
                  onClick={() =>
                    save("staff", { active: false }, { userId: s.userId })
                  }
                >
                  Remove assignment
                </button>
              </p>
            ))}
          </section>
        </>
      )}
      <section className="bg-white p-6 rounded-xl">
        <h3 className="font-semibold mb-4">Options, tags and fields</h3>
        <form
          className="grid md:grid-cols-3 gap-3"
          onSubmit={handle((f) =>
            save("option", {
              kind,
              label: f.get("label"),
              parentId: f.get("parentId") || null,
              settings:
                kind === "field"
                  ? {
                      type: fieldType,
                      required: f.get("required") === "on",
                      choices: String(f.get("choices") || "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                  : kind === "issueType"
                    ? {
                        transactionRequired:
                          f.get("transactionRequired") === "on",
                      }
                    : {},
            }),
          )}
        >
          <Field label="Category">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {[
                "callerType",
                "channel",
                "complaintType",
                "issueType",
                "tag",
                "resolutionReason",
                "field",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input name="label" required maxLength={200} />
          </Field>
          {kind === "tag" && (
            <Field label="Primary tag parent">
              <select name="parentId">{opts("tag")}</select>
            </Field>
          )}
          {kind === "issueType" && (
            <label>
              <input type="checkbox" name="transactionRequired" /> Require
              transaction details
            </label>
          )}
          {kind === "field" && (
            <>
              <Field label="Field type">
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                >
                  {["text", "longText", "number", "date", "select"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Select choices (comma separated)">
                <input name="choices" />
              </Field>
              <label>
                <input type="checkbox" name="required" /> Required field
              </label>
            </>
          )}
          <button disabled={busy}>Add option</button>
        </form>
        <div className="mt-4 grid md:grid-cols-2 gap-2">
          {setup.options.map((o) => (
            <div
              key={o.id}
              className="flex justify-between border-b py-2 text-sm"
            >
              <span>
                {o.kind}: {o.label} {!o.active && "(archived)"}
              </span>
              <button
                disabled={busy}
                onClick={() =>
                  save(
                    "option",
                    {
                      kind: o.kind,
                      label: o.label,
                      parentId: o.parentId,
                      settings: o.settings,
                      active: !o.active,
                    },
                    { id: o.id },
                  )
                }
              >
                {o.active ? "Archive" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-white p-6 rounded-xl">
        <h3 className="font-semibold mb-2">SLA policies</h3>
        <p className="text-sm text-slate-600 mb-4">
          Enter approved training targets in minutes. Blank complaint/issue/tag
          creates the workspace fallback. A primary-tag policy overrides a type
          policy. Saving an existing match creates a new policy version.
        </p>
        <form
          className="grid md:grid-cols-3 gap-3"
          onSubmit={handle((f) =>
            save("policy", {
              complaintType: f.get("complaintType"),
              issueType: f.get("issueType"),
              primaryTag: f.get("primaryTag"),
              overallMinutes: Number(f.get("overallMinutes")),
              l2Minutes: f.get("l2Minutes") ? Number(f.get("l2Minutes")) : null,
              l3Minutes: f.get("l3Minutes") ? Number(f.get("l3Minutes")) : null,
            }),
          )}
        >
          {["complaintType", "issueType", "tag"].map((k) => (
            <Field key={k} label={k}>
              <select name={k === "tag" ? "primaryTag" : k}>{opts(k)}</select>
            </Field>
          ))}
          {["overallMinutes", "l2Minutes", "l3Minutes"].map((k) => (
            <Field key={k} label={k}>
              <input
                type="number"
                min="1"
                max="525600"
                name={k}
                required={k === "overallMinutes"}
              />
            </Field>
          ))}
          <button disabled={busy}>Save policy version</button>
        </form>
        {setup.policies.map((p) => (
          <div key={p.id} className="border-b py-3 text-sm">
            {p.complaintType
              ? setup.options.find((o) => o.id === p.complaintType)?.label
              : "Workspace fallback"}{" "}
            / {setup.options.find((o) => o.id === p.issueType)?.label} /{" "}
            {setup.options.find((o) => o.id === p.primaryTag)?.label} · v
            {p.version} · Overall {p.overallMinutes}m · L2{" "}
            {p.l2Minutes ?? "N/A"}m · L3 {p.l3Minutes ?? "N/A"}m{" "}
            <button
              disabled={busy}
              onClick={() =>
                save("policy", {
                  complaintType: p.complaintType,
                  issueType: p.issueType,
                  primaryTag: p.primaryTag,
                  overallMinutes: p.overallMinutes,
                  l2Minutes: p.l2Minutes,
                  l3Minutes: p.l3Minutes,
                  active: !p.active,
                })
              }
            >
              {p.active ? "Archive" : "Activate"}
            </button>
          </div>
        ))}
      </section>
      {setup.actor.role === "ADMIN" && (
        <section className="bg-white p-6 rounded-xl">
          <h3 className="font-semibold mb-3">Workspace controls</h3>
          <button disabled={busy} onClick={() => save("dummy", {})}>
            Load 500 customers / 250 pending complaints
          </button>
          <p className="text-xs my-3">
            Loads 500 batch-isolated fictional customers: 250 with ready pending
            complaints and 250 reference profiles for new practice. Repeat
            loading preserves existing data. Missing default SLA: 60 minutes
            overall, L2 20, L3 10; existing settings are preserved.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              save("workspace", {
                state:
                  setup.workspace.state === "ACTIVE" ? "READ_ONLY" : "ACTIVE",
              })
            }
          >
            {setup.workspace.state === "ACTIVE"
              ? "Make read-only"
              : "Activate workspace"}
          </button>
        </section>
      )}
    </div>
  );
}

function Activity({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<{
      audit: {
        id: string;
        actorName: string;
        action: string;
        createdAt: string;
        data: unknown;
      }[];
      reconcile: { userId: string; issue: string }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api<NonNullable<typeof data>["audit"]>({ kind: "audit", workspaceId }),
      api<NonNullable<typeof data>["reconcile"]>({
        kind: "reconcile",
        workspaceId,
      }),
    ])
      .then(([audit, reconcile]) => setData({ audit, reconcile }))
      .catch((e) => setError(e.message));
  }, [workspaceId]);
  return (
    <section className="bg-white rounded-xl p-6">
      <h3 className="font-semibold">Membership reconciliation</h3>
      {error && <p role="alert">{error}</p>}
      {data?.reconcile.length === 0 && (
        <p className="my-3">All CRM members match the current portal roster.</p>
      )}
      {data?.reconcile.map((r) => (
        <p key={r.userId}>
          {r.userId}: {r.issue}
        </p>
      ))}
      <h3 className="font-semibold mt-6">
        Configuration and membership activity
      </h3>
      {data?.audit.map((a) => (
        <details key={a.id} className="border-b py-3">
          <summary>
            {stamp(a.createdAt)} ? {a.actorName} ? {a.action}
          </summary>
          <pre className="text-xs overflow-auto p-3">
            {JSON.stringify(a.data, null, 2)}
          </pre>
        </details>
      ))}
    </section>
  );
}
