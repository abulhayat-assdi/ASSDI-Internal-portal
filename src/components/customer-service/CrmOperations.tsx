"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";

async function request<T>(
  query: Record<string, string>,
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/crm?" + new URLSearchParams(query), {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "CRM request failed");
  return data;
}
type Notice = {
  id: string;
  complaintId: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};
export function CrmNotifications({
  workspaceId,
  onOpen,
}: {
  workspaceId: string;
  onOpen: (id: string) => void;
}) {
  const [data, setData] = useState<{ items: Notice[]; unread: number }>({
    items: [],
    unread: 0,
  });
  const [expanded, setExpanded] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const next = await request<typeof data>({
      kind: "notifications",
      workspaceId,
    });
    setData(next);
    setError("");
  }, [workspaceId]);
  useEffect(() => {
    let active = true,
      pending = false;
    const poll = async () => {
      if (!active || pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const next = await request<typeof data>({
          kind: "notifications",
          workspaceId,
        });
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Notifications unavailable",
          );
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [workspaceId]);
  const mark = async (ids: string[], all = false) => {
    try {
      await request(
        {},
        {
          action: "notification_read",
          workspaceId,
          requestId: crypto.randomUUID(),
          data: all ? { all: true } : { ids },
        },
      );
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not mark notifications read",
      );
    }
  };
  return (
    <div className="crm-notifications">
      <button
        type="button"
        aria-label={`Notifications, ${data.unread} unread`}
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((v) => !v);
          void refresh().catch((e) => setError(e.message));
        }}
      >
        <Bell size={18} />
        <span className="crm-notification-count">{data.unread}</span>
      </button>
      {expanded && (
        <section className="crm-notification-panel" aria-label="Notifications">
          <div className="crm-panel-title">
            <strong>Notifications</strong>
            <button onClick={() => void mark([], true)} disabled={!data.unread}>
              Mark all read
            </button>
            <button
              aria-label="Close notifications"
              onClick={() => setExpanded(false)}
            >
              ×
            </button>
          </div>
          <p className="p-3 text-xs text-slate-500">
            Updates every 15 seconds while this page is visible.
          </p>
          {error && (
            <p role="alert" className="p-3 text-red-700">
              {error}
            </p>
          )}
          {!data.items.length && <p className="p-4">No notifications yet.</p>}
          <div className="crm-notification-list">
            {data.items.map((n) => (
              <button
                key={n.id}
                className={n.readAt ? "" : "unread"}
                onClick={() => {
                  void mark([n.id]);
                  setExpanded(false);
                  onOpen(n.complaintId);
                }}
              >
                <span>{n.message}</span>
                <small>
                  {new Date(n.createdAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Dhaka",
                  })}
                </small>
              </button>
            ))}
          </div>
          <span className="sr-only" role="status">
            {data.unread} unread CRM notifications
          </span>
        </section>
      )}
    </div>
  );
}

type Pool = {
  agents: { id: string; name: string; roll: string | null }[];
  cases: { id: string; code: string; version: number; description: string }[];
  total: number;
};
type Preview = {
  requestId: string;
  allocations: { id: string; version: number; userId: string }[];
  counts: { name: string; count: number }[];
};
export function CrmBulkAssignment({
  workspaceId,
  onChanged,
}: {
  workspaceId: string;
  onChanged: () => void;
}) {
  const [pool, setPool] = useState<Pool | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [limit, setLimit] = useState(25),
    [reason, setReason] = useState("Training practice assignment"),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const next = await request<Pool>({ kind: "assignment_pool", workspaceId });
    setPool(next);
    setSelected((ids) =>
      ids.filter((id) => next.agents.some((a) => a.id === id)),
    );
    setPreview(null);
  }, [workspaceId]);
  useEffect(() => {
    let active = true;
    request<Pool>({ kind: "assignment_pool", workspaceId })
      .then((p) => {
        if (active) setPool(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);
  const build = () => {
    setError("");
    setMessage("");
    if (!pool || !selected.length || !reason.trim()) {
      setError("Choose at least one Agent and enter an assignment reason.");
      return;
    }
    const count = Math.min(pool.cases.length, Math.max(1, Math.floor(limit)));
    if (!count) {
      setError("No Pending complaints are available in the assignment pool.");
      return;
    }
    const agents = pool.agents.filter((a) => selected.includes(a.id));
    const allocations = pool.cases.slice(0, count).map((c, i) => ({
      id: c.id,
      version: c.version,
      userId: agents[i % agents.length].id,
    }));
    setPreview({
      requestId: crypto.randomUUID(),
      allocations,
      counts: agents.map((a) => ({
        name: a.name,
        count: allocations.filter((c) => c.userId === a.id).length,
      })),
    });
  };
  const assign = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ assigned: number }>(
        {},
        {
          action: "bulk_assign",
          workspaceId,
          requestId: preview.requestId,
          data: { allocations: preview.allocations, reason },
        },
      );
      setMessage(
        `${result.assigned} complaints assigned. The recipients will receive notifications.`,
      );
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="crm-panel">
      <div className="crm-panel-title">
        <div>
          <h3>Distribute practice complaints</h3>
          <p>Preview the distribution before applying it.</p>
        </div>
        <button
          disabled={busy}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          <RefreshCw size={15} /> Reload pool
        </button>
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-600 mb-4">
          Only Pending complaints in the Agent queue, currently held by staff or
          without an owner, enter this pool. Cases already assigned to students
          are protected. Available: {pool?.total ?? "…"}; up to 250 per
          operation.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mb-4 text-green-700">
            {message}
          </p>
        )}
        {!pool ? (
          <p>Loading assignment pool...</p>
        ) : (
          <>
            <fieldset disabled={busy}>
              <legend className="font-semibold">Select Agents</legend>
              <button
                type="button"
                onClick={() => {
                  setSelected(pool.agents.map((a) => a.id));
                  setPreview(null);
                }}
              >
                Select all Agents
              </button>
              <div className="crm-agent-picker">
                {pool.agents.map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={(e) => {
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        );
                        setPreview(null);
                      }}
                    />
                    {a.name}
                    {a.roll ? ` · ${a.roll}` : ""}
                  </label>
                ))}
              </div>
              {!pool.agents.length && (
                <p>No eligible student accounts are available in this batch.</p>
              )}
              <div className="crm-assignment-fields">
                <label>
                  Number of complaints
                  <input
                    aria-label="Number of complaints"
                    type="number"
                    min={1}
                    max={Math.min(250, pool.cases.length) || 1}
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPreview(null);
                    }}
                  />
                </label>
                <label>
                  Assignment reason
                  <input
                    aria-label="Assignment reason"
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
              </div>
              <button
                className="primary"
                disabled={
                  !selected.length ||
                  !pool.cases.length ||
                  !Number.isFinite(limit) ||
                  limit < 1
                }
                onClick={build}
              >
                Preview distribution
              </button>
            </fieldset>
            {preview && (
              <div className="mt-5">
                <h3 className="font-semibold">
                  Assignment preview · {preview.allocations.length} complaints
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Complaints to receive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.counts.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td>{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm my-3">
                  Oldest pool cases are distributed evenly across the selected
                  Agents. Existing SLA deadlines continue.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void assign()}
                >
                  {busy
                    ? "Assigning…"
                    : `Assign ${preview.allocations.length} complaints`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

type ProgressRow = {
  id: string;
  name: string;
  roll: string | null;
  role: string;
  active: boolean;
  assignedNow: number;
  pending: number;
  inProgress: number;
  overdue: number;
  assignedInPeriod: number;
  created: number;
  worked: number;
  contacts: number;
  escalated: number;
  resolved: number;
  withinSla: number | null;
  averageTat: number | null;
  lastActivity: string | null;
};
type Progress = {
  rows: ProgressRow[];
  from: string;
  to: string;
  asOf: string;
  basis: string;
};
type Work = {
  rows: {
    id: string;
    code: string;
    status: string;
    queue: string;
    description: string;
  }[];
  total: number;
};
const dhakaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function CrmStudentProgress({
  workspaceId,
  onOpen,
}: {
  workspaceId: string;
  onOpen: (id: string) => void;
}) {
  const [from, setFrom] = useState(() => dhakaToday().slice(0, 8) + "01"),
    [to, setTo] = useState(dhakaToday),
    [period, setPeriod] = useState({ from, to }),
    [data, setData] = useState<Progress | null>(null),
    [error, setError] = useState(""),
    [student, setStudent] = useState(""),
    [owner, setOwner] = useState<ProgressRow | null>(null),
    [page, setPage] = useState(1),
    [work, setWork] = useState<Work | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true,
      pending = false;
    const poll = async () => {
      if (!active || pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const next = await request<Progress>({
          kind: "progress",
          workspaceId,
          ...period,
        });
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Progress unavailable");
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 30000);
    window.addEventListener("focus", poll);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [workspaceId, period, refresh]);
  useEffect(() => {
    let active = true;
    if (!owner) return;
    setWork(null);
    request<Work>({
      kind: "list",
      workspaceId,
      ownerId: owner.id,
      page: String(page),
    })
      .then((next) => {
        if (active) setWork(next);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [owner, page, workspaceId, refresh]);
  const rows = data?.rows.filter((p) => !student || p.id === student) || [];
  return (
    <section className="crm-panel">
      <div className="crm-panel-title">
        <div>
          <h3>Student progress</h3>
          <p>
            Current workload and activity in the selected dates · Asia/Dhaka
          </p>
        </div>
        <button onClick={() => setRefresh((v) => v + 1)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      <div className="p-5">
        <form
          className="crm-progress-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setPeriod({ from, to });
          }}
        >
          <label>
            From
            <input
              aria-label="Progress from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label>
            Through
            <input
              aria-label="Progress through"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
          <label>
            Student
            <select
              aria-label="Progress student"
              value={student}
              onChange={(e) => {
                setStudent(e.target.value);
                setOwner(null);
              }}
            >
              <option value="">All students</option>
              {data?.rows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.roll ? ` · ${p.roll}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">Apply dates</button>
        </form>
        {error && (
          <p role="alert" className="text-red-700 my-3">
            {error}
          </p>
        )}
        {!data ? (
          <p>Loading student progress...</p>
        ) : (
          <>
            <p className="text-sm text-slate-500 my-4">
              {data.basis} Updates every 30 seconds while visible.
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    {[
                      "Student / roll",
                      "Open now",
                      "Pending",
                      "In progress",
                      "Overdue",
                      "Assigned in period",
                      "Created",
                      "Worked cases",
                      "Resolved",
                      "Contacts",
                      "Escalated",
                      "Within SLA",
                      "Average TAT",
                      "Last activity",
                      "Action",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div>
                          {p.roll || "—"} · {p.role}
                          {p.active ? "" : " · Inactive"}
                        </div>
                      </td>
                      <td>{p.assignedNow}</td>
                      <td>{p.pending}</td>
                      <td>{p.inProgress}</td>
                      <td>{p.overdue}</td>
                      <td>{p.assignedInPeriod}</td>
                      <td>{p.created}</td>
                      <td>{p.worked}</td>
                      <td>{p.resolved}</td>
                      <td>{p.contacts}</td>
                      <td>{p.escalated}</td>
                      <td>
                        {p.withinSla === null
                          ? "N/A"
                          : `${p.withinSla.toFixed(1)}%`}
                      </td>
                      <td>
                        {p.averageTat === null
                          ? "N/A"
                          : `${(p.averageTat / 3600000).toFixed(2)} h`}
                      </td>
                      <td>
                        {p.lastActivity
                          ? new Date(p.lastActivity).toLocaleString("en-GB", {
                              timeZone: "Asia/Dhaka",
                            })
                          : "No activity in period"}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setOwner(p);
                            setPage(1);
                          }}
                        >
                          View current work
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <p>No eligible students found.</p>}
            {owner && (
              <section className="mt-5" aria-label="Student work">
                <h3 className="font-semibold">
                  Current ownership · {owner.name}
                </h3>
                <p className="text-sm">
                  All statuses currently owned by this student; this list is
                  independent of the activity date filter.
                </p>
                {!work ? (
                  <p>Loading work...</p>
                ) : (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>Complaint</th>
                          <th>Status</th>
                          <th>Queue</th>
                          <th>Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {work.rows.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <button onClick={() => onOpen(c.id)}>
                                {c.code}
                              </button>
                            </td>
                            <td>{c.status}</td>
                            <td>{c.queue}</td>
                            <td>{c.description.slice(0, 180)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-3 mt-3">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous work page
                      </button>
                      <span>
                        Page {page} · {work.total} complaints
                      </span>
                      <button
                        disabled={page * 20 >= work.total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next work page
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}
