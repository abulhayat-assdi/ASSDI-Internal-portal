"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { defaults, rubric, closed, metricLabels } from "@/lib/live-chat/domain";
import "./chat.css";
import { mergeMessages } from "./messages";
type Chat = {
  lastMessagePreview: string;
  unread: number;
  id: string;
  customerName: string;
  categoryId: string;
  status: string;
  agentId: string | null;
  queueAt: string;
  lastActivityAt: string;
  unansweredAt: string | null;
  firstReplyAt: string | null;
  sessionId: string | null;
  customerId: string | null;
  complaintId: string | null;
  transferTo: string | null;
  customerReadAt: string | null;
  customerTypingAt: string | null;
  resolution: string;
  closingNote: string;
};
type Message = {
  id: string;
  senderName: string;
  sender: string;
  kind: string;
  text: string;
  createdAt: string;
};
type Agent = {
  activeChats: number;
  userId: string;
  name: string;
  roll: string;
  status: string;
  heartbeatAt: string;
  lastAssignedAt: string;
};
type Session = {
  id: string;
  name: string;
  mode: string;
  state: string;
  scenario: string;
  participants: string[];
  hints: boolean;
  startsAt: string;
  endsAt: string | null;
  released: boolean;
  demonstrationId: string | null;
  rubric: typeof rubric;
};
type Evaluation = {
  id: string;
  agentId: string;
  total: number;
  passMark: number;
  feedback: string;
  privateNote?: string;
  released: boolean;
};
type Snapshot = {
  counts: Record<string, number>;
  total: number;
  page: number;
  rubric: typeof rubric;
  settings: typeof defaults;
  chats: Chat[];
  agents: Agent[];
  categories: { id: string; name: string; active: boolean }[];
  links: {
    id: string;
    active: boolean;
    expiresAt: string;
    sessionId: string | null;
  }[];
  sessions: Session[];
  references: { id: string; kind: string; title: string; text: string }[];
  identity: { id: string; name: string; staff: boolean; admin: boolean };
};
type Detail = {
  conversation: Chat;
  messages: Message[];
  evaluations: Evaluation[];
  events: { id: string; type: string; actorId: string; createdAt: string }[];
};
type Report = {
  daily: { day: string; total: number; resolved: number; answered: number }[];
  metrics: Record<string, number | null>;
  rows: Chat[];
  agents: {
    agentId: string;
    assigned: number;
    answered: number;
    aht: number | null;
    qa: number | null;
  }[];
  basis: string;
};
type Boot = {
  identity: { id: string; name: string };
  staff: boolean;
  admin: boolean;
  workspaces: { id: string; name: string; role: string }[];
};
const tabs = [
  ["Dashboard", "ড্যাশবোর্ড"],
  ["Live Chat", "লাইভ চ্যাট"],
  ["Queue", "অপেক্ষমাণ"],
  ["History", "ইতিহাস"],
  ["Agents", "এজেন্ট"],
  ["Sessions", "সেশন"],
  ["Reports", "রিপোর্ট"],
  ["Settings", "সেটিংস"],
];
async function api(query: Record<string, string>, body?: unknown) {
  const r = await fetch("/api/live-chat?" + new URLSearchParams(query), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error);
  return value;
}
export default function ChatApp({ staff = false }: { staff?: boolean }) {
  const [boot, setBoot] = useState<Boot | null>(null),
    [w, setW] = useState(""),
    [state, setState] = useState<Snapshot | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("Live Chat"),
    [bn, setBn] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [text, setText] = useState(""),
    [kind, setKind] = useState("MESSAGE"),
    [search, setSearch] = useState(""),
    [target, setTarget] = useState(""),
    [report, setReport] = useState<Report | null>(null),
    [from, setFrom] = useState(new Date().toISOString().slice(0, 10)),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [agentFilter, setAgentFilter] = useState(""),
    [sessionFilter, setSessionFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [page, setPage] = useState(1),
    [agentVisibility, setAgentVisibility] = useState("ALL");
  const queryRef = useRef({ view: "active", search: "", page: "1" }),
    refreshGeneration = useRef(0);
  queryRef.current = {
    view: tab === "History" ? "history" : tab === "Queue" ? "queue" : "active",
    search,
    page: String(page),
  };
  const generation = useRef(0),
    requestId = useRef<{ text: string; id: string } | null>(null),
    end = useRef<HTMLDivElement>(null),
    typingAt = useRef(0);
  const t = (en: string, ba: string) => (bn ? ba : en),
    base = staff ? "/dashboard/crm" : "/student-dashboard/crm";
  const refresh = useCallback(async () => {
    if (!w) return;
    const g = generation.current,
      r = ++refreshGeneration.current;
    const next = await api({ workspaceId: w, ...queryRef.current });
    if (g === generation.current && r === refreshGeneration.current)
      setState(next);
  }, [w]);
  const selectedRef = useRef(selected);
  const latestMessage = useRef<{ id: string; conversationId: string } | null>(
    null,
  );
  selectedRef.current = selected;
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh().catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [tab, search, page, refresh]);
  const loadDetail = useCallback(async () => {
    if (!w || !selected) return;
    const g = generation.current;
    let after =
      latestMessage.current?.conversationId === selected
        ? latestMessage.current.id
        : undefined;
    do {
      const next = await api({
        workspaceId: w,
        kind: "conversation",
        id: selected,
        ...(after ? { after } : {}),
      });
      if (g !== generation.current || selectedRef.current !== selected) return;
      setDetail((previous) => ({
        ...next,
        messages: mergeMessages(
          previous?.conversation.id === selected ? previous.messages : [],
          next.messages,
        ),
      }));
      const last = next.messages.at(-1);
      if (last) {
        after = last.id;
        latestMessage.current = { conversationId: selected, id: last.id };
      }
      if (!next.hasMore || !last) break;
    } while (after);
  }, [w, selected]);
  useEffect(() => {
    void api({ kind: "bootstrap" })
      .then((v: Boot) => {
        setBoot(v);
        const remembered = new URLSearchParams(location.search).get(
          "workspaceId",
        );
        setW(
          v.workspaces.find((x) => x.id === remembered)?.id ||
            v.workspaces[0]?.id ||
            "",
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    generation.current++;
    setState(null);
    setSelected("");
    setDetail(null);
    setReport(null);
    setError("");
    setNotice("");
    setText("");
    latestMessage.current = null;
    void refresh().catch((e) => setError(e.message));
  }, [w, refresh]);
  useEffect(() => {
    setDetail(null);
    latestMessage.current = null;
    setText("");
    requestId.current = null;
    setKind("MESSAGE");
    void loadDetail().catch((e) => setError(e.message));
  }, [loadDetail]);
  useEffect(() => {
    if (!w) return;
    const stream = new EventSource(
      "/api/live-chat/stream?" + new URLSearchParams({ workspaceId: w }),
    );
    let timeout: ReturnType<typeof setTimeout>;
    const change = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        void refresh().catch((e) => setError(e.message));
        void loadDetail().catch((e) => setError(e.message));
      }, 150);
    };
    stream.addEventListener("change", change);
    stream.addEventListener("revoked", () => {
      stream.close();
      setState(null);
      setDetail(null);
      setError(
        "Live Chat access ended. Please reload. / লাইভ চ্যাট অ্যাক্সেস শেষ হয়েছে।",
      );
    });
    stream.onerror = () =>
      setNotice("Reconnecting to live updates… / পুনরায় সংযোগ হচ্ছে…");
    stream.onopen = () => setNotice("");
    return () => {
      clearTimeout(timeout);
      stream.close();
    };
  }, [w, refresh, loadDetail]);
  useEffect(() => {
    if (!w) return;
    const timer = setInterval(() => {
      void api({}, { workspaceId: w, action: "presence", data: {} }).catch(
        (e) => setError(e.message),
      );
    }, 20000);
    return () => clearInterval(timer);
  }, [w]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [detail?.messages.at(-1)?.id]);
  const perform = async (action: string, data?: unknown, id = selected) => {
    const operationGeneration=generation.current;
    setError("");
    setBusy(true);
    try {
      const v = await api({}, { workspaceId: w, action, id, data });
      if(operationGeneration!==generation.current)return null;
      await refresh();
      if (selected) await loadDetail();
      return v;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const me = state?.agents.find((a) => a.userId === state.identity.id),
    c = detail?.conversation,
    owner = c?.agentId === state?.identity.id,
    isStaff = !!state?.identity.staff;
  useEffect(() => setKind(owner ? "MESSAGE" : "COACH"), [owner]);
  useEffect(() => {
    if (owner && selected && document.visibilityState === "visible")
      void api({}, { workspaceId: w, action: "read", id: selected }).catch(
        () => {},
      );
  }, [detail?.messages.at(-1)?.id, owner, selected, w]);
  const reportQuery = () => ({
    workspaceId: w,
    kind: "report",
    from: from + "T00:00:00+06:00",
    to: to + "T23:59:59.999+06:00",
    ...(agentFilter ? { agentId: agentFilter } : {}),
    ...(sessionFilter ? { sessionId: sessionFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });
  const loadReport = async () => {
    try {
      setBusy(true);
      setReport(await api(reportQuery()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const pending =
      requestId.current?.text === text
        ? requestId.current
        : { text, id: crypto.randomUUID() };
    requestId.current = pending;
    const v = await perform("message", { text, kind, requestId: pending.id });
    if (v) {
      setText("");
      requestId.current = null;
    }
  }
  const filtered =
    state?.chats.filter(
      (c) =>
        (tab === "Queue"
          ? c.status === "QUEUED"
          : tab === "History"
            ? closed(c.status)
            : !closed(c.status)) &&
        (c.customerName + " " + c.id)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="lc">
      <header className="lc-top">
        <div>
          <small>ASM CRM / CONTACT CENTER</small>
          <h1>{t("Live Chat Training", "লাইভ চ্যাট প্রশিক্ষণ")}</h1>
          <small>
            {boot?.identity.name} · {isStaff ? "Supervisor" : "Agent"}
          </small>
        </div>
        <div className="lc-row">
          <a className="lc-link" href={base}>
            {t("Back to CRM", "সিআরএমে ফিরুন")}
          </a>
          <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
        </div>
      </header>
      <div className="lc-toolbar">
        <label>
          {t("Batch workspace", "ব্যাচ ওয়ার্কস্পেস")}
          <select
            aria-label="Chat workspace"
            disabled={busy}
            value={w}
            onChange={(e) => setW(e.target.value)}
          >
            {!boot?.workspaces.length && (
              <option value="">
                {t("No accessible workspace", "ওয়ার্কস্পেস নেই")}
              </option>
            )}
            {boot?.workspaces.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Your availability", "আপনার অ্যাভেইলেবিলিটি")}
          <select
            aria-label={t("Your availability", "আপনার অ্যাভেইলেবিলিটি")}
            value={me?.status || "OFFLINE"}
            disabled={!state || busy}
            onChange={(e) =>
              void perform("presence", { status: e.target.value }, "")
            }
          >
            {["OFFLINE", "AVAILABLE", "BUSY", "AWAY"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <small>
          {t("Capacity", "সর্বোচ্চ চ্যাট")}: {state?.settings.capacity || 3} ·{" "}
          {t(
            "Heartbeat is separate from availability",
            "সংযোগ ও অ্যাভেইলেবিলিটি আলাদা",
          )}
        </small>
      </div>
      {error && (
        <div className="lc-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="lc-notice" role="status">
          {notice}
        </div>
      )}
      <nav className="lc-tabs" aria-label="Live Chat navigation">
        {tabs
          .filter(([x]) => isStaff || !["Queue", "Settings"].includes(x))
          .map(([en, ba]) => (
            <button
              key={en}
              className={tab === en ? "active" : ""}
              onClick={() => {
                setTab(en);
                setPage(1);
              }}
            >
              {t(en, ba)}
            </button>
          ))}
      </nav>
      <main className="lc-main">
        {!state ? (
          <div className="lc-empty">
            {boot && !w
              ? t(
                  "Set up a CRM workspace first.",
                  "আগে সিআরএম ওয়ার্কস্পেস তৈরি করুন।",
                )
              : t("Loading chat workspace…", "ওয়ার্কস্পেস লোড হচ্ছে…")}
          </div>
        ) : (
          <>
            {tab === "Dashboard" && (
              <section className="lc-stack">
                <div className="lc-panel">
                  <h2>{t("Current operations", "বর্তমান কার্যক্রম")}</h2>
                  <p className="muted">
                    {t(
                      "Live counts across this workspace. Historical date filters are available in Reports.",
                      "এই ওয়ার্কস্পেসের বর্তমান অবস্থা। তারিখ অনুযায়ী ফলাফল রিপোর্টে দেখুন।",
                    )}
                  </p>
                  <div className="lc-cards">
                    {[
                      "QUEUED",
                      "ASSIGNED",
                      "ACTIVE",
                      "RESOLVED",
                      "CLOSED",
                      "ABANDONED",
                      "DROPPED",
                    ].map((key) => (
                      <div key={key} className="lc-card">
                        <small>{key}</small>
                        <strong>{state.counts[key] || 0}</strong>
                      </div>
                    ))}
                    {["AVAILABLE", "BUSY", "AWAY", "OFFLINE"].map((key) => (
                      <div className="lc-card" key={key}>
                        <small>{key} AGENTS</small>
                        <strong>
                          {state.agents.filter((a) => a.status === key).length}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <button className="primary" onClick={() => setTab("Reports")}>
                    {t(
                      "View performance reports",
                      "পারফরম্যান্স রিপোর্ট দেখুন",
                    )}
                  </button>
                </div>
                <div className="lc-panel">
                  <h2>{t("Response alerts", "উত্তরের সতর্কতা")}</h2>
                  {state.chats
                    .filter(
                      (c) =>
                        c.unansweredAt &&
                        Date.now() - +new Date(c.unansweredAt) >
                          (c.firstReplyAt
                            ? state.settings.nextReplySeconds
                            : state.settings.firstReplySeconds) *
                            1000,
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelected(c.id);
                          setTab("Live Chat");
                        }}
                      >
                        {c.customerName} · {c.status}
                      </button>
                    ))}
                  <small>
                    Showing the latest 50 active conversations; counters include
                    all conversations.
                  </small>
                </div>
              </section>
            )}
            {["Live Chat", "Queue", "History"].includes(tab) && (
              <div className="lc-grid">
                <aside className="lc-panel lc-list">
                  <h2>{t(tab, tabs.find((x) => x[0] === tab)?.[1] || tab)}</h2>
                  <input
                    aria-label="Search conversations"
                    placeholder={t(
                      "Search name or chat ID",
                      "নাম বা চ্যাট আইডি খুঁজুন",
                    )}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <div className="lc-row">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <small>
                      {page} / {Math.max(1, Math.ceil(state.total / 50))}
                    </small>
                    <button
                      disabled={page * 50 >= state.total}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </div>
                  {filtered.length === 0 && (
                    <p className="lc-empty">
                      {t(
                        "No conversations here yet.",
                        "এখনও কোনো কথোপকথন নেই।",
                      )}
                    </p>
                  )}
                  {filtered.map((x) => (
                    <button
                      className={
                        "lc-chat-item " + (selected === x.id ? "selected" : "")
                      }
                      key={x.id}
                      onClick={() => setSelected(x.id)}
                    >
                      <strong>{x.customerName}</strong>
                      <small>{x.lastMessagePreview}</small>
                      {x.unread > 0 && (
                        <span className="lc-badge">
                          {x.unread} unread / নতুন মেসেজ
                        </span>
                      )}
                      <span className={"lc-badge " + x.status}>{x.status}</span>
                      <small>
                        #{x.id.slice(0, 8)} ·{" "}
                        {new Date(x.lastActivityAt).toLocaleTimeString()}
                      </small>
                      {x.transferTo === state.identity.id && (
                        <strong>Transfer invitation</strong>
                      )}
                      {x.unansweredAt &&
                        Date.now() - +new Date(x.unansweredAt) >
                          state.settings.firstReplySeconds * 1000 && (
                          <span style={{ color: "#a54920" }}>
                            Response overdue / উত্তর বাকি
                          </span>
                        )}
                    </button>
                  ))}
                </aside>
                <section className="lc-panel">
                  {!c ? (
                    <div className="lc-empty">
                      {t(
                        "Select a conversation to begin.",
                        "শুরু করতে একটি কথোপকথন নির্বাচন করুন।",
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="lc-row">
                        <h2>{c.customerName}</h2>
                        <span className={"lc-badge " + c.status}>
                          {c.status}
                        </span>
                        <small>#{c.id.slice(0, 8)}</small>
                        <a
                          className="lc-link"
                          href={
                            "/api/live-chat/export?" +
                            new URLSearchParams({
                              workspaceId: w,
                              id: c.id,
                              format: "pdf",
                            })
                          }
                        >
                          Transcript PDF ↓
                        </a>
                      </div>
                      <div className="lc-row">
                        {owner && c.status === "ASSIGNED" && (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void perform("accept")}
                          >
                            {t("Accept chat", "চ্যাট গ্রহণ করুন")}
                          </button>
                        )}
                        {c.transferTo === state.identity.id && (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => void perform("accept_transfer")}
                          >
                            {t("Accept transfer", "ট্রান্সফার গ্রহণ")}
                          </button>
                        )}
                        {isStaff && !owner && !closed(c.status) && (
                          <button
                            disabled={busy}
                            onClick={() => void perform("takeover")}
                          >
                            {t("Take over", "নিজে গ্রহণ করুন")}
                          </button>
                        )}
                        <button
                          disabled={!owner || busy}
                          onClick={() => void perform("read")}
                        >
                          {t("Mark read", "পড়া হয়েছে")}
                        </button>
                      </div>
                      <div className="lc-messages" aria-live="polite">
                        {detail.messages.length >= 100 && (
                          <button
                            onClick={async () => {
                              try {
                                const older = await api({
                                  workspaceId: w,
                                  kind: "conversation",
                                  id: c.id,
                                  before: detail.messages[0].id,
                                });
                                setDetail((d) =>
                                  d
                                    ? {
                                        ...d,
                                        messages: mergeMessages(
                                          older.messages,
                                          d.messages,
                                        ),
                                      }
                                    : d,
                                );
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            {t("Earlier messages", "আগের মেসেজ")}
                          </button>
                        )}
                        {detail.messages.map((m) => (
                          <article
                            key={m.id}
                            className={
                              "lc-message " +
                              (m.kind === "MESSAGE" ? m.sender : m.kind)
                            }
                          >
                            <strong>
                              {m.senderName}
                              {m.kind !== "MESSAGE" ? " · " + m.kind : ""}
                            </strong>
                            <p>{m.text}</p>
                            <small>
                              {new Date(m.createdAt).toLocaleString(
                                bn ? "bn-BD" : "en-GB",
                              )}
                              {m.sender === "AGENT" &&
                              c.customerReadAt &&
                              m.createdAt <= c.customerReadAt
                                ? " · Read"
                                : ""}
                            </small>
                          </article>
                        ))}
                        <div ref={end} />
                      </div>
                      {!closed(c.status) && (owner || isStaff) && (
                        <form className="lc-compose" onSubmit={send}>
                          {c.customerTypingAt &&
                            Date.now() - +new Date(c.customerTypingAt) <
                              5000 && (
                              <small>
                                Customer is typing… / কাস্টমার লিখছেন…
                              </small>
                            )}
                          <div className="lc-row">
                            <select
                              aria-label="Message type"
                              value={kind}
                              onChange={(e) => setKind(e.target.value)}
                            >
                              {owner && (
                                <>
                                  <option value="MESSAGE">
                                    Customer message / কাস্টমার মেসেজ
                                  </option>
                                  <option value="NOTE">
                                    Internal note / অভ্যন্তরীণ নোট
                                  </option>
                                </>
                              )}
                              {isStaff && (
                                <option value="COACH">
                                  Private coaching / গোপন কোচিং
                                </option>
                              )}
                            </select>
                            <small>
                              {kind === "MESSAGE"
                                ? "Visible to customer"
                                : "Hidden from customer"}
                            </small>
                          </div>
                          <textarea
                            aria-label="Message"
                            required
                            maxLength={8000}
                            value={text}
                            onChange={(e) => {
                              setText(e.target.value);
                              if (
                                owner &&
                                Date.now() - typingAt.current > 4000
                              ) {
                                typingAt.current = Date.now();
                                void api(
                                  {},
                                  {
                                    workspaceId: w,
                                    action: "typing",
                                    id: c.id,
                                  },
                                ).catch(() => {});
                              }
                            }}
                          />
                          <button
                            className="primary"
                            disabled={
                              busy ||
                              (!owner && kind !== "COACH") ||
                              (owner && c.status !== "ACTIVE")
                            }
                          >
                            {busy
                              ? t("Sending…", "পাঠানো হচ্ছে…")
                              : t("Send", "পাঠান")}
                          </button>
                        </form>
                      )}
                      {closed(c.status) && (
                        <p className="muted">
                          {c.resolution} · {c.closingNote}
                        </p>
                      )}
                    </>
                  )}
                </section>
                <aside className="lc-panel lc-details lc-stack">
                  <h2>{t("Conversation tools", "কথোপকথনের টুলস")}</h2>
                  {c && (
                    <>
                      <small>
                        {
                          state.categories.find((x) => x.id === c.categoryId)
                            ?.name
                        }{" "}
                        ·{" "}
                        {state.agents.find((x) => x.userId === c.agentId)
                          ?.name || "Unassigned"}
                      </small>
                      {!closed(c.status) && (owner || isStaff) && (
                        <>
                          <label>
                            {t("Transfer / assign to", "ট্রান্সফার / অ্যাসাইন")}
                            <select
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                            >
                              <option value="">
                                {t("Choose available agent", "এজেন্ট নির্বাচন")}
                              </option>
                              {state.agents
                                .filter(
                                  (a) =>
                                    a.status === "AVAILABLE" &&
                                    a.userId !== c.agentId,
                                )
                                .map((a) => (
                                  <option key={a.userId} value={a.userId}>
                                    {a.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="lc-row">
                            {owner && (
                              <button
                                disabled={busy || !target}
                                onClick={() =>
                                  void perform("transfer", { agentId: target })
                                }
                              >
                                Transfer
                              </button>
                            )}
                            {isStaff && (
                              <button
                                disabled={busy || !target}
                                onClick={() =>
                                  void perform("assign", { agentId: target })
                                }
                              >
                                Assign
                              </button>
                            )}
                          </div>
                          <CloseForm
                            busy={busy}
                            onSave={(d) => perform("close", d)}
                          />
                          <CrmLink
                            workspace={w}
                            chat={c}
                            onSave={(d) => perform("crm_link", d)}
                          />
                          <a
                            className="lc-link"
                            href={
                              base +
                              "?view=new-complaint&chatId=" +
                              c.id +
                              "&workspaceId=" +
                              w
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Create CRM complaint ↗
                          </a>
                        </>
                      )}
                      {state.references.map((r) => (
                        <details key={r.id}>
                          <summary>
                            {r.kind === "REPLY" ? "↪ " : "▤ "}
                            {r.title}
                          </summary>
                          <p style={{ whiteSpace: "pre-wrap" }}>{r.text}</p>
                          {r.kind === "REPLY" && owner && (
                            <button onClick={() => setText(r.text)}>
                              Use reply / ব্যবহার করুন
                            </button>
                          )}
                        </details>
                      ))}
                      {isStaff && (
                        <QaForm
                          criteria={
                            state.sessions.find((s) => s.id === c.sessionId)
                              ?.rubric || state.rubric
                          }
                          key={c.id}
                          agents={state.agents}
                          currentAgent={c.agentId}
                          onSave={(d) => perform("evaluate", d)}
                          busy={busy}
                        />
                      )}
                      {detail?.evaluations.map((e) => (
                        <div className="lc-session" key={e.id}>
                          <strong>
                            QA {e.total}/100 ·{" "}
                            {e.total >= e.passMark ? "PASS" : "REVIEW"}
                          </strong>
                          <p>{e.feedback}</p>
                          {e.privateNote && (
                            <small>Private: {e.privateNote}</small>
                          )}
                          <small>{e.released ? "Released" : "Held"}</small>
                        </div>
                      ))}
                      {isStaff && (
                        <>
                          <label>
                            Class demonstration
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value)
                                  void perform("demonstrate", {
                                    sessionId: e.target.value,
                                  });
                              }}
                            >
                              <option value="">
                                Choose demonstration session
                              </option>
                              {state.sessions
                                .filter(
                                  (s) =>
                                    s.mode === "DEMONSTRATION" &&
                                    s.state === "OPEN",
                                )
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <details>
                            <summary>Audit history</summary>
                            {detail?.events.map((e) => (
                              <p key={e.id}>
                                <small>
                                  {new Date(e.createdAt).toLocaleString()} ·{" "}
                                  {e.type}
                                </small>
                              </p>
                            ))}
                          </details>
                        </>
                      )}
                    </>
                  )}
                  {!c && (
                    <p className="muted">
                      {t(
                        "Select a chat to see its tools.",
                        "টুলস দেখতে চ্যাট নির্বাচন করুন।",
                      )}
                    </p>
                  )}
                </aside>
              </div>
            )}
            {tab === "Agents" && (
              <section className="lc-panel lc-scroll">
                <h2>{t("Agent monitor", "এজেন্ট মনিটর")}</h2>
                <select
                  aria-label="Agent connection filter"
                  value={agentVisibility}
                  onChange={(e) => setAgentVisibility(e.target.value)}
                >
                  <option value="ALL">All agents</option>
                  <option value="ACTIVE">Active agents</option>
                  <option value="INACTIVE">Inactive agents</option>
                </select>
                <table>
                  <thead>
                    <tr>
                      {[
                        "Agent / এজেন্ট",
                        "Roll",
                        "Availability",
                        "Connection",
                        "Active chats",
                        "Last assignment",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.agents
                      .filter(
                        (a) =>
                          agentVisibility === "ALL" ||
                          (agentVisibility === "ACTIVE"
                            ? a.status !== "OFFLINE"
                            : a.status === "OFFLINE"),
                      )
                      .map((a) => (
                        <tr key={a.userId}>
                          <td>{a.name}</td>
                          <td>{a.roll}</td>
                          <td>
                            <span className={"lc-badge " + a.status}>
                              {a.status}
                            </span>
                          </td>
                          <td>
                            {Date.now() - +new Date(a.heartbeatAt) < 60000
                              ? "Connected"
                              : "Disconnected"}
                          </td>
                          <td>{a.activeChats}</td>
                          <td>{new Date(a.lastAssignedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            )}
            {tab === "Sessions" && (
              <section className="lc-panel lc-stack">
                <h2>{t("Training & assessment", "প্রশিক্ষণ ও মূল্যায়ন")}</h2>
                {isStaff && (
                  <SessionForm
                    agents={state.agents}
                    busy={busy}
                    onSave={(d) => perform("session", d, "")}
                  />
                )}
                {state.sessions.map((s) => (
                  <article key={s.id} className="lc-session">
                    <div className="lc-row">
                      <strong>{s.name}</strong>
                      <span className="lc-badge">
                        {s.mode} · {s.state}
                      </span>
                    </div>
                    <small>
                      {new Date(s.startsAt).toLocaleString()} →{" "}
                      {s.endsAt
                        ? new Date(s.endsAt).toLocaleString()
                        : "Open-ended"}
                    </small>
                    <p style={{ whiteSpace: "pre-wrap" }}>{s.scenario}</p>
                    {isStaff ? (
                      <div className="lc-row">
                        <button
                          disabled={busy}
                          onClick={async () => {
                            const value = await perform(
                              "link",
                              { sessionId: s.id, hours: 24 },
                              "",
                            );
                            if (value) setNotice(location.origin + value.path);
                          }}
                        >
                          Create customer link
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              "session_state",
                              {
                                state: s.state === "OPEN" ? "CLOSED" : "OPEN",
                                released: s.released,
                              },
                              s.id,
                            )
                          }
                        >
                          {s.state === "OPEN"
                            ? "End session"
                            : "Reopen session"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              "session_state",
                              { state: s.state, released: true },
                              s.id,
                            )
                          }
                        >
                          Release results
                        </button>
                      </div>
                    ) : (
                      s.mode === "DEMONSTRATION" &&
                      s.demonstrationId && (
                        <Demonstration workspace={w} session={s.id} />
                      )
                    )}
                  </article>
                ))}
              </section>
            )}
            {tab === "Reports" && (
              <section className="lc-stack">
                <div className="lc-panel">
                  <h2>{t("Performance reports", "পারফরম্যান্স রিপোর্ট")}</h2>
                  <div className="lc-row">
                    {[
                      ["Today", 0],
                      ["Last 7 days", 6],
                      ["Last 30 days", 29],
                    ].map(([label, days]) => (
                      <button
                        key={String(label)}
                        onClick={() => {
                          const now = new Date(),
                            start = new Date(+now - Number(days) * 86400000);
                          const day = (d: Date) =>
                            new Intl.DateTimeFormat("en-CA", {
                              timeZone: "Asia/Dhaka",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            }).format(d);
                          setFrom(day(start));
                          setTo(day(now));
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="lc-row">
                    <label>
                      From
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      To
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                    {isStaff && (
                      <label>
                        Agent
                        <select
                          value={agentFilter}
                          onChange={(e) => setAgentFilter(e.target.value)}
                        >
                          <option value="">All agents</option>
                          {state.agents.map((a) => (
                            <option key={a.userId} value={a.userId}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Session
                      <select
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                      >
                        <option value="">All sessions</option>
                        {state.sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="">All statuses</option>
                        {[
                          "QUEUED",
                          "ASSIGNED",
                          "ACTIVE",
                          "RESOLVED",
                          "CLOSED",
                          "ABANDONED",
                          "DROPPED",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void loadReport()}
                    >
                      Generate report
                    </button>
                    {["xlsx", "pdf"].map((format) => (
                      <a
                        key={format}
                        className="lc-link"
                        href={
                          "/api/live-chat/export?" +
                          new URLSearchParams({ ...reportQuery(), format })
                        }
                      >
                        {format.toUpperCase()} ↓
                      </a>
                    ))}
                  </div>
                </div>
                {report && (
                  <>
                    <p className="muted">{report.basis}</p>
                    <div className="lc-panel">
                      <h2>
                        {t("Daily volume & resolution", "দৈনিক চ্যাট ও সমাধান")}
                      </h2>
                      {report.daily.map((day) => (
                        <div className="lc-row" key={day.day}>
                          <small style={{ width: 90 }}>{day.day}</small>
                          <meter
                            aria-label={day.day + " chat volume"}
                            min={0}
                            max={Math.max(
                              1,
                              ...report.daily.map((d) => d.total),
                            )}
                            value={day.total}
                            style={{ flex: 1 }}
                          />
                          <span>
                            {day.total} chats · {day.resolved} resolved
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="lc-cards">
                      {Object.entries(report.metrics).map(([key, value]) => (
                        <div className="lc-card" key={key}>
                          <small>{metricLabels[key] || key}</small>
                          <strong>
                            {value === null
                              ? "—"
                              : Number.isInteger(value)
                                ? value
                                : value.toFixed(1)}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="lc-panel lc-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th>Assigned</th>
                            <th>Answered</th>
                            <th>AHT (s)</th>
                            <th>QA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.agents.map((a) => (
                            <tr key={a.agentId}>
                              <td>
                                {state.agents.find(
                                  (x) => x.userId === a.agentId,
                                )?.name || a.agentId}
                              </td>
                              <td>{a.assigned}</td>
                              <td>{a.answered}</td>
                              <td>{a.aht?.toFixed(1) || "—"}</td>
                              <td>{a.qa?.toFixed(1) || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}
            {tab === "Settings" && isStaff && (
              <section className="lc-panel lc-stack">
                <h2>{t("Chat configuration", "চ্যাট কনফিগারেশন")}</h2>
                {state.identity.admin && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => void perform("initialize", {}, "")}
                    >
                      Initialize categories & training references
                    </button>
                    <SettingsForm
                      key={JSON.stringify(state.settings)}
                      value={state.settings}
                      busy={busy}
                      onSave={(d) => perform("settings", d, "")}
                    />
                    <CategoryForm onSave={(d) => perform("category", d, "")} />
                    <div className="lc-row">
                      {state.categories.map((cat) => (
                        <button
                          key={cat.id}
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              "category",
                              { name: cat.name, active: !cat.active },
                              cat.id,
                            )
                          }
                        >
                          {cat.active ? "✓" : "○"} {cat.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <ReferenceForm onSave={(d) => perform("reference", d, "")} />
                <h3>Public links</h3>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const v = await perform("link", { hours: 24 }, "");
                    if (v) setNotice(location.origin + v.path);
                  }}
                >
                  Create 24-hour public practice link
                </button>
                <small>
                  Copy the generated URL when shown. Secrets are not stored in
                  recoverable form.
                </small>
                {state.links.map((link) => (
                  <div key={link.id} className="lc-row">
                    <small>
                      #{link.id.slice(0, 8)} ·{" "}
                      {new Date(link.expiresAt).toLocaleString()}
                    </small>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void perform(
                          "link_state",
                          { active: !link.active },
                          link.id,
                        )
                      }
                    >
                      {link.active ? "Pause" : "Enable"}
                    </button>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
function CloseForm({
  onSave,
  busy,
}: {
  onSave: (d: unknown) => Promise<unknown>;
  busy: boolean;
}) {
  const [resolution, setResolution] = useState("Resolved at first contact"),
    [note, setNote] = useState(""),
    [wrapSeconds, setWrapSeconds] = useState(0),
    [resolved, setResolved] = useState(true);
  return (
    <details>
      <summary>Close & document / সমাপ্তি</summary>
      <form
        className="lc-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ resolved, resolution, note, wrapSeconds });
        }}
      >
        <label>
          Wrap-up time (seconds)
          <input
            type="number"
            min={0}
            max={600}
            value={wrapSeconds}
            onChange={(e) => setWrapSeconds(Number(e.target.value))}
          />
        </label>
        <label>
          Outcome
          <select
            value={resolved ? "yes" : "no"}
            onChange={(e) => setResolved(e.target.value === "yes")}
          >
            <option value="yes">Resolved</option>
            <option value="no">Closed unresolved</option>
          </select>
        </label>
        <label>
          Resolution category
          <input
            required
            maxLength={120}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </label>
        <label>
          Closing notes
          <textarea
            required
            maxLength={4000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button disabled={busy}>Close conversation</button>
      </form>
    </details>
  );
}
function QaForm({
  criteria,
  agents,
  currentAgent,
  onSave,
  busy,
}: {
  criteria: typeof rubric;
  agents: Agent[];
  currentAgent: string | null;
  onSave: (d: unknown) => Promise<unknown>;
  busy: boolean;
}) {
  const [agentId, setAgent] = useState(currentAgent || ""),
    [scores, setScores] = useState<Record<string, number>>({}),
    [feedback, setFeedback] = useState(""),
    [privateNote, setPrivate] = useState(""),
    [released, setReleased] = useState(false);
  return (
    <details>
      <summary>QA evaluation / মূল্যায়ন</summary>
      <form
        className="lc-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ agentId, scores, feedback, privateNote, released });
        }}
      >
        <label>
          Agent
          <select
            required
            value={agentId}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="">Select agent</option>
            {agents.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {criteria.map((r) => (
          <label key={r.key}>
            {r.label} / {r.max}
            <input
              type="number"
              required
              min={0}
              max={r.max}
              value={scores[r.key] ?? ""}
              onChange={(e) =>
                setScores({ ...scores, [r.key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        <label>
          Student feedback
          <textarea
            required
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
        <label>
          Private teacher notes
          <textarea
            value={privateNote}
            onChange={(e) => setPrivate(e.target.value)}
          />
        </label>
        <label>
          <span>
            <input
              type="checkbox"
              checked={released}
              onChange={(e) => setReleased(e.target.checked)}
            />{" "}
            Release to student
          </span>
        </label>
        <button disabled={busy}>Save evaluation</button>
      </form>
    </details>
  );
}
function SessionForm({
  agents,
  onSave,
  busy,
}: {
  agents: Agent[];
  onSave: (d: unknown) => Promise<unknown>;
  busy: boolean;
}) {
  const [name, setName] = useState(""),
    [mode, setMode] = useState("PRACTICE"),
    [scenario, setScenario] = useState(""),
    [participants, setParticipants] = useState<string[]>([]),
    [hints, setHints] = useState(true),
    [minutes, setMinutes] = useState(60);
  const [passMark, setPassMark] = useState(70);
  return (
    <details>
      <summary>Create training session / নতুন সেশন</summary>
      <form
        className="lc-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            name,
            mode,
            scenario,
            participants,
            hints,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + minutes * 60000).toISOString(),
            passMark,
          });
        }}
      >
        <div className="lc-setting-grid">
          <label>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Mode
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setHints(e.target.value !== "ASSESSMENT");
              }}
            >
              {["PRACTICE", "DEMONSTRATION", "ASSESSMENT"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={5}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <label>
            Pass mark / পাস নম্বর
            <input
              type="number"
              min={0}
              max={100}
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          Customer scenario / policy
          <select
            aria-label="Sample training scenario"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) setScenario(e.target.value);
            }}
          >
            <option value="">Choose a sample or write your own</option>
            {[
              "Duplicate payment: The customer says they were charged twice. Ask for a fictional reference, verify the training record, create a payment complaint and explain the next step without promising an unapproved refund.",
              "Delayed delivery: The customer is frustrated about a late parcel. Confirm the fictional order reference, show empathy, check the training policy and escalate when the delivery window has passed.",
              "Account access: The customer cannot sign in. Verify the permitted training identifiers, explain safe recovery and never request a password, PIN or OTP.",
              "Telesales enquiry: The customer asks about a course or service. Discover their needs, provide only approved information, handle objections politely and document the agreed follow-up.",
            ].map((s, i) => (
              <option key={i} value={s}>
                {
                  [
                    "Duplicate payment",
                    "Delayed delivery",
                    "Account access",
                    "Telesales enquiry",
                  ][i]
                }
              </option>
            ))}
          </select>
          <textarea
            required
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Example: A customer was charged twice. Verify the reference, log a payment complaint and explain the escalation without promising an unapproved refund."
          />
        </label>
        <label>
          Participants (none selected means all current agents)
          <select
            multiple
            value={participants}
            onChange={(e) =>
              setParticipants([...e.target.selectedOptions].map((o) => o.value))
            }
          >
            {agents.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <input
              type="checkbox"
              checked={hints}
              onChange={(e) => setHints(e.target.checked)}
            />{" "}
            Allow reference materials & hints
          </span>
        </label>
        <button disabled={busy}>Create session</button>
      </form>
    </details>
  );
}
function SettingsForm({
  value,
  onSave,
  busy,
}: {
  value: typeof defaults;
  onSave: (d: unknown) => Promise<unknown>;
  busy: boolean;
}) {
  const [form, setForm] = useState(value);
  return (
    <form
      className="lc-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <div className="lc-setting-grid">
        {Object.entries(form)
          .filter(([, v]) => typeof v === "number")
          .map(([key, v]) => (
            <label key={key}>
              {key} {key.endsWith("Seconds") ? "(seconds)" : ""}
              <input
                type="number"
                required
                value={Number(v)}
                onChange={(e) =>
                  setForm({ ...form, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        <label>
          Timezone
          <input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </label>
        {(["allowTransfer", "feedback"] as const).map((key) => (
          <label key={key}>
            <span>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />{" "}
              {key}
            </span>
          </label>
        ))}
        <label>
          <span>
            <input
              type="checkbox"
              checked={form.businessHours.enabled}
              onChange={(e) =>
                setForm({
                  ...form,
                  businessHours: {
                    ...form.businessHours,
                    enabled: e.target.checked,
                  },
                })
              }
            />{" "}
            Business hours enabled
          </span>
        </label>
        <label>
          Opening hour
          <input
            type="number"
            min={0}
            max={23}
            value={form.businessHours.start}
            onChange={(e) =>
              setForm({
                ...form,
                businessHours: {
                  ...form.businessHours,
                  start: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Closing hour
          <input
            type="number"
            min={1}
            max={24}
            value={form.businessHours.end}
            onChange={(e) =>
              setForm({
                ...form,
                businessHours: {
                  ...form.businessHours,
                  end: Number(e.target.value),
                },
              })
            }
          />
        </label>
      </div>
      <details>
        <summary>QA rubric weights (total 100)</summary>
        <div className="lc-setting-grid">
          {form.qaRubric.map((r, i) => (
            <label key={r.key}>
              {r.label}
              <input
                type="number"
                min={1}
                max={100}
                value={r.max}
                onChange={(e) =>
                  setForm({
                    ...form,
                    qaRubric: form.qaRubric.map((v, j) =>
                      j === i ? { ...v, max: Number(e.target.value) } : v,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
      <button className="primary" disabled={busy}>
        Save settings
      </button>
    </form>
  );
}
function CategoryForm({
  onSave,
}: {
  onSave: (d: unknown) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  return (
    <form
      className="lc-row"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ name });
      }}
    >
      <input
        aria-label="New category"
        placeholder="New category / নতুন ক্যাটাগরি"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button>Add category</button>
    </form>
  );
}
function ReferenceForm({
  onSave,
}: {
  onSave: (d: unknown) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [kind, setKind] = useState("REPLY");
  return (
    <details>
      <summary>Add canned reply / knowledge</summary>
      <form
        className="lc-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({ kind, title, text });
        }}
      >
        <select
          aria-label="Reference type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="REPLY">Canned reply</option>
          <option value="KNOWLEDGE">Knowledge article</option>
        </select>
        <input
          aria-label="Reference title"
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          aria-label="Reference text"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button>Add reference</button>
      </form>
    </details>
  );
}
function CrmLink({
  workspace,
  chat,
  onSave,
}: {
  workspace: string;
  chat: Chat;
  onSave: (d: unknown) => Promise<unknown>;
}) {
  const [search, setSearch] = useState(""),
    [customers, setCustomers] = useState<
      { id: string; name: string; number: string }[]
    >([]),
    [customerId, setCustomer] = useState(chat.customerId || ""),
    [complaintId, setComplaint] = useState(chat.complaintId || "");
  return (
    <details>
      <summary>CRM customer / complaint</summary>
      <div className="lc-stack">
        <input
          aria-label="Find CRM customer"
          placeholder="Name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={async () => {
            try {
              setCustomers(
                await api({
                  workspaceId: workspace,
                  kind: "customers",
                  search,
                }),
              );
            } catch {}
          }}
        >
          Find customer
        </button>
        <select
          aria-label="Link customer"
          value={customerId}
          onChange={(e) => setCustomer(e.target.value)}
        >
          <option value="">No linked customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.number}
            </option>
          ))}
        </select>
        <input
          aria-label="Complaint ID"
          placeholder="Complaint ID (optional)"
          value={complaintId}
          onChange={(e) => setComplaint(e.target.value)}
        />
        <button
          onClick={() =>
            void onSave({
              customerId: customerId || null,
              complaintId: complaintId || null,
            })
          }
        >
          Save CRM links
        </button>
      </div>
    </details>
  );
}
function Demonstration({
  workspace,
  session,
}: {
  workspace: string;
  session: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () => {
      void api({
        workspaceId: workspace,
        kind: "demonstration",
        sessionId: session,
      })
        .then((v) => {
          if (live) setMessages(v.messages);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [workspace, session]);
  return (
    <div className="lc-panel">
      <small>Class demonstration · customer identity hidden</small>
      {error && <p role="alert">{error}</p>}
      {messages.map((m) => (
        <article key={m.id} className={"lc-message " + m.sender}>
          <strong>
            {m.sender === "CUSTOMER" ? "Training customer" : "Agent"}
          </strong>
          <p>{m.text}</p>
          <small>{new Date(m.createdAt).toLocaleTimeString()}</small>
        </article>
      ))}
    </div>
  );
}
