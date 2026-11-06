"use client";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  MessageSquare,
  Users,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
type Conversation = {
  id: string;
  customerName: string;
  status: string;
  lastMessagePreview: string;
  agentId: string | null;
  unansweredAt: string | null;
  firstReplyAt: string | null;
};
type Agent = {
  userId: string;
  name: string;
  status: string;
  heartbeatAt: string;
  activeChats: number;
};
const statusColors: Record<string, string> = {
  QUEUED: "#e6b34a",
  ASSIGNED: "#9890fa",
  ACTIVE: "#4aa8f7",
  RESOLVED: "#51c38d",
  CLOSED: "#9197ad",
  ABANDONED: "#f17e86",
  DROPPED: "#d990e4",
};
export default function LiveChatOverview({
  counts,
  chats,
  agents,
  staff,
  bn,
  onOpen,
  onTab,
  firstReplySeconds,
  nextReplySeconds,
  disconnectSeconds = 60,
}: {
  counts: Record<string, number>;
  chats: Conversation[];
  agents: Agent[];
  staff: boolean;
  bn: boolean;
  onOpen: (id: string) => void;
  onTab: (tab: string) => void;
  firstReplySeconds: number;
  nextReplySeconds: number;
  disconnectSeconds?: number;
}) {
  const t = (en: string, ba: string) => (bn ? ba : en);
  const liveAgents = agents.map((a) => ({
    ...a,
    status:
      Date.now() - +new Date(a.heartbeatAt) > disconnectSeconds * 1000
        ? "OFFLINE"
        : a.status,
  }));
  liveAgents.sort(
    (a, b) => Number(b.status !== "OFFLINE") - Number(a.status !== "OFFLINE"),
  );
  const online = liveAgents.filter((a) => a.status !== "OFFLINE");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(statusColors).map(([key, color]) => ({
    key,
    color,
    value: counts[key] || 0,
  }));
  let cursor = 0;
  const stops = entries
    .filter((x) => x.value)
    .map((x) => {
      const start = cursor;
      cursor += total ? (x.value / total) * 100 : 0;
      return x.color + " " + start + "% " + cursor + "%";
    });
  const active = chats.filter((c) =>
    ["QUEUED", "ASSIGNED", "ACTIVE"].includes(c.status),
  );
  const overdue = active.filter(
    (c) =>
      c.unansweredAt &&
      Date.now() - +new Date(c.unansweredAt) >
        (c.firstReplyAt ? nextReplySeconds : firstReplySeconds) * 1000,
  );
  const labels: Record<string, string> = {
    QUEUED: t("Pending", "অপেক্ষমাণ"),
    ASSIGNED: t("Assigned", "অ্যাসাইন হয়েছে"),
    ACTIVE: t("Active", "চলমান"),
    RESOLVED: t("Resolved", "সমাধান হয়েছে"),
    CLOSED: t("Closed", "বন্ধ"),
    ABANDONED: t("Abandoned", "পরিত্যক্ত"),
    DROPPED: t("Dropped", "বিচ্ছিন্ন"),
  };
  return (
    <section className="lc-overview">
      <div className="lc-overview-heading">
        <div>
          <span className="lc-eyebrow">
            {t("YOUR TRAINING WORKSPACE", "আপনার প্রশিক্ষণ ওয়ার্কস্পেস")}
          </span>
          <h2>{t("Current operations", "বর্তমান কার্যক্রম")}</h2>
          <p>
            {t(
              "A clear view of conversations, your queue and the people behind every reply.",
              "কথোপকথন, অপেক্ষমাণ চ্যাট ও এজেন্টদের বর্তমান অবস্থা এক জায়গায়।",
            )}
          </p>
        </div>
        <button className="primary" onClick={() => onTab("Live Chat")}>
          <MessageSquare size={16} />
          {t("Open live chat", "লাইভ চ্যাট খুলুন")}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="lc-operations-strip">
        <div className="lc-live-label">
          <span className="lc-live-dot" />
          <div>
            <strong>{t("Training desk", "ট্রেনিং ডেস্ক")}</strong>
            <small>{t("Current snapshot", "বর্তমান অবস্থা")}</small>
          </div>
        </div>
        <div>
          <span>{t("Conversations", "কথোপকথন")}</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>{t("Active chats", "চলমান চ্যাট")}</span>
          <strong>{(counts.ACTIVE || 0) + (counts.ASSIGNED || 0)}</strong>
        </div>
        <div>
          <span>{t("Agents online", "অনলাইন এজেন্ট")}</span>
          <strong>{online.length}</strong>
        </div>
        <div className="lc-strip-note">
          <Clock3 size={17} />
          <span>
            {t("Asia/Dhaka", "এশিয়া/ঢাকা")}
            <small>
              {t("Live workspace data", "ওয়ার্কস্পেসের বর্তমান তথ্য")}
            </small>
          </span>
        </div>
      </div>
      <div className="lc-summary-grid">
        {[
          {
            icon: Clock3,
            label: t("Pending chats", "অপেক্ষমাণ চ্যাট"),
            value: counts.QUEUED || 0,
            tone: "amber",
            tab: "Queue",
          },
          {
            icon: Activity,
            label: t("In progress", "চলমান"),
            value: counts.ACTIVE || 0,
            tone: "blue",
            tab: "Live Chat",
          },
          {
            icon: CheckCheck,
            label: t("Resolved", "সমাধান হয়েছে"),
            value: counts.RESOLVED || 0,
            tone: "green",
            tab: "History",
          },
          {
            icon: Users,
            label: t("Available agents", "প্রস্তুত এজেন্ট"),
            value: online.filter((a) => a.status === "AVAILABLE").length,
            tone: "violet",
            tab: "Agents",
          },
        ].map((x) => (
          <button
            key={x.label}
            className={"lc-summary-card " + x.tone}
            onClick={() =>
              onTab(!staff && x.tab === "Queue" ? "Live Chat" : x.tab)
            }
          >
            <span className="lc-stat-icon">
              <x.icon size={18} />
            </span>
            <span>
              <small>{x.label}</small>
              <strong>{x.value}</strong>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      <div className="lc-overview-grid">
        <section className="lc-panel lc-distribution">
          <div className="lc-section-heading">
            <h3>{t("Conversation distribution", "কথোপকথনের অবস্থা")}</h3>
            <span className="lc-subtle-pill">
              {t("Current status", "বর্তমান অবস্থা")}
            </span>
          </div>
          <div className="lc-distribution-body">
            <div
              className="lc-donut"
              role="img"
              aria-label={t(
                "Conversation status distribution",
                "কথোপকথনের অবস্থার চার্ট",
              )}
              style={{
                background: stops.length
                  ? "conic-gradient(" + stops.join(",") + ")"
                  : "var(--line)",
              }}
            >
              <div>
                <strong>{total}</strong>
                <small>{t("Total", "মোট")}</small>
              </div>
            </div>
            <div className="lc-distribution-legend">
              {entries.map((x) => (
                <div key={x.key}>
                  <i style={{ background: x.color }} />
                  <span>{labels[x.key]}</span>
                  <strong>{x.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <p className="lc-scope-note">
            {t(
              staff
                ? "All conversations in this batch workspace."
                : "Status counts cover your assigned conversations. Pending practice cases appear in Live Chat.",
              staff
                ? "এই ব্যাচ ওয়ার্কস্পেসের সব কথোপকথন।"
                : "আপনার অ্যাসাইন করা কথোপকথনের সংখ্যা। অপেক্ষমাণ অনুশীলন লাইভ চ্যাটে পাওয়া যাবে।",
            )}
          </p>
        </section>
        <section className="lc-panel lc-team-card">
          <div className="lc-section-heading">
            <h3>
              <Users size={17} />
              {t("Team availability", "টিমের অ্যাভেইলেবিলিটি")}
            </h3>
            <button className="lc-text-button" onClick={() => onTab("Agents")}>
              {t("View all", "সব দেখুন")}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="lc-team-grid">
            {liveAgents.slice(0, 6).map((a) => (
              <div className="lc-team-person" key={a.userId}>
                <span className="lc-avatar">
                  {a.name
                    .trim()
                    .split(/\s+/)
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    <i className={"lc-presence-dot " + a.status} />
                    {a.status} · {a.activeChats} {t("chats", "চ্যাট")}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {!liveAgents.length && (
            <p className="lc-empty">
              {t(
                "Agents appear here when they set their availability.",
                "এজেন্ট অ্যাভেইলেবিলিটি নির্বাচন করলে এখানে দেখা যাবে।",
              )}
            </p>
          )}
          <div className="lc-training-note">
            <Users size={18} />
            <p>
              {t(
                "Practice with purpose. Teachers can observe, coach privately and review completed conversations.",
                "শিক্ষক পর্যবেক্ষণ, ব্যক্তিগত কোচিং ও সম্পন্ন কথোপকথন মূল্যায়ন করতে পারবেন।",
              )}
            </p>
          </div>
        </section>
        <section className="lc-panel lc-queue-card">
          <div className="lc-section-heading">
            <h3>
              <MessageSquare size={17} />
              {t("Conversation queue", "অপেক্ষমাণ ও চলমান চ্যাট")}
              <span className="lc-subtle-pill">{active.length}</span>
            </h3>
            <button
              className="lc-text-button"
              onClick={() => onTab("Live Chat")}
            >
              {t("Open inbox", "ইনবক্স খুলুন")}
              <ArrowUpRight size={14} />
            </button>
          </div>
          {active.slice(0, 4).map((c) => (
            <button
              className="lc-inbox-row"
              key={c.id}
              onClick={() => onOpen(c.id)}
            >
              <span className="lc-avatar">
                {c.customerName.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{c.customerName}</strong>
                <small>
                  {c.lastMessagePreview ||
                    t("Open conversation", "কথোপকথন খুলুন")}
                </small>
              </span>
              <span className={"lc-badge " + c.status}>{labels[c.status]}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {!active.length && (
            <p className="lc-empty">
              {t(
                "Your queue is clear. Open Live Chat to choose a practice case.",
                "কোনো চলমান চ্যাট নেই। অনুশীলন বেছে নিতে লাইভ চ্যাট খুলুন।",
              )}
            </p>
          )}
          <small className="lc-scope-note">
            {t(
              "Preview of the current conversation page; totals above include the full scope.",
              "বর্তমান চ্যাট পৃষ্ঠার সংক্ষিপ্ত তালিকা; উপরের সংখ্যায় সংশ্লিষ্ট সব চ্যাট অন্তর্ভুক্ত।",
            )}
          </small>
        </section>
        <section className="lc-panel lc-alert-card">
          <div className="lc-section-heading">
            <h3>
              <AlertCircle size={17} />
              {t("Response alerts", "উত্তরের সতর্কতা")}
            </h3>
            <span className="lc-subtle-pill">{overdue.length}</span>
          </div>
          {overdue.slice(0, 4).map((c) => (
            <button
              className="lc-alert-row"
              key={c.id}
              onClick={() => onOpen(c.id)}
            >
              <i className="lc-presence-dot AWAY" />
              <span>
                {c.customerName}
                <small>
                  {t(
                    "A customer is waiting for a reply",
                    "কাস্টমার উত্তরের অপেক্ষায় আছেন",
                  )}
                </small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {!overdue.length && (
            <div className="lc-calm-state">
              <CheckCheck size={26} />
              <strong>{t("No response alerts", "উত্তরের সতর্কতা নেই")}</strong>
              <small>
                {t(
                  "No overdue replies in the current page.",
                  "বর্তমান পৃষ্ঠায় কোনো উত্তর বিলম্বিত নয়।",
                )}
              </small>
            </div>
          )}
          <button className="lc-text-button" onClick={() => onTab("Reports")}>
            {t("View performance reports", "পারফরম্যান্স রিপোর্ট দেখুন")}
            <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
    </section>
  );
}
