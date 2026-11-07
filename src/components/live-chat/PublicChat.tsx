"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  Send,
  Moon,
  Sun,
  X,
  Check,
  CheckCheck,
  WifiOff,
  Star,
  RotateCcw,
} from "lucide-react";
import "./public-chat.css";
import { mergeMessages } from "./messages";
type Message = {
  id: string;
  text: string;
  sender: string;
  senderName: string;
  createdAt: string;
  requestId: string;
};
type State = {
  conversation?: {
    id: string;
    status: string;
    agentJoined: boolean;
    agentTypingAt: string | null;
    agentReadAt: string | null;
    feedback: number | null;
  };
  messages?: Message[];
  categories?: { id: string; name: string }[];
  queuePosition?: number;
  feedback?: boolean;
  scenario?: string;
  accepting?: boolean;
  agentsOnline?: boolean;
  linkOpen?: boolean;
};
const THEME_KEY = "asm-public-chat-theme";
export default function PublicChat({ token }: { token: string }) {
  const [bn, setBn] = useState(false),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [state, setState] = useState<State>({}),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [website, setWebsite] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [offline, setOffline] = useState(false),
    [confirmEnd, setConfirmEnd] = useState(false),
    [rating, setRating] = useState(0),
    [feedback, setFeedback] = useState(""),
    [, tick] = useState(0);
  const endpoint = "/api/live-chat/public/" + encodeURIComponent(token),
    scroller = useRef<HTMLDivElement>(null),
    pending = useRef<{ text: string; requestId: string } | null>(null),
    typingAt = useRef(0),
    latestMessage = useRef<string | null>(null);
  const t = (en: string, ba: string) => (bn ? ba : en);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    setTheme(
      saved === "dark" || saved === "light"
        ? saved
        : matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
    );
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  const request = useCallback(
    async (kind: string, body?: unknown) => {
      const r = await fetch(endpoint + (body ? "" : "?kind=" + kind), {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(v.error || "Something went wrong. Please retry.");
      return v;
    },
    [endpoint],
  );
  const refresh = useCallback(async () => {
    let after = latestMessage.current;
    do {
      const data = await request(
        "conversation" + (after ? "&after=" + encodeURIComponent(after) : ""),
      );
      setState((s) => ({
        ...s,
        ...data,
        messages: mergeMessages(
          s.conversation?.id === data.conversation.id ? s.messages || [] : [],
          data.messages,
        ),
      }));
      const last = data.messages.at(-1);
      if (last) {
        after = last.id;
        latestMessage.current = last.id;
      }
      if (!data.hasMore || !last) break;
    } while (after);
  }, [request]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const welcome = await request("welcome");
        if (active) setState(welcome);
      } catch {
        // Paused, renewed, expired or unknown links: show a closed card, not a form.
        if (active) setState((s) => ({ ...s, linkOpen: false }));
      }
      try {
        await refresh();
      } catch {}
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [request, refresh]);
  useEffect(() => {
    if (!state.conversation?.id) return;
    const stream = new EventSource(endpoint + "/stream");
    stream.addEventListener("change", () => {
      setOffline(false);
      void refresh().catch((e) => setError(e.message));
    });
    stream.onopen = () => {
      setOffline(false);
      void refresh().catch(() => {});
    };
    stream.onerror = () => setOffline(true);
    const heartbeat = setInterval(() => {
      void request("", { action: "heartbeat" }).catch(() => {});
    }, 20000);
    return () => {
      stream.close();
      clearInterval(heartbeat);
    };
  }, [state.conversation?.id, refresh, request, endpoint]);
  useEffect(() => {
    const down = () => setOffline(true),
      up = () => setOffline(false);
    addEventListener("offline", down);
    addEventListener("online", up);
    return () => {
      removeEventListener("offline", down);
      removeEventListener("online", up);
    };
  }, []);
  // Re-render so the typing indicator disappears after its 5-second window.
  useEffect(() => {
    if (!state.conversation?.agentTypingAt) return;
    const id = setTimeout(() => tick((n) => n + 1), 5200);
    return () => clearTimeout(id);
  }, [state.conversation?.agentTypingAt]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages?.length, state.conversation?.agentTypingAt]);
  useEffect(() => {
    if (state.messages?.length && document.visibilityState === "visible")
      void request("", { action: "read" }).catch(() => {});
  }, [state.messages?.at(-1)?.id, request]);

  const conversation = state.conversation;
  const closed =
    !!conversation &&
    ["RESOLVED", "CLOSED", "ABANDONED", "DROPPED"].includes(
      conversation.status,
    );
  const canStart =
    state.linkOpen !== false &&
    state.accepting !== false &&
    !!state.categories?.length;
  const firstAgentMessage = state.messages?.find(
    (m) => m.sender !== "CUSTOMER" && m.sender !== "SYSTEM",
  )?.id;
  const typing =
    !!conversation?.agentTypingAt &&
    Date.now() - +new Date(conversation.agentTypingAt) < 5000;

  const act = async (action: string, data?: unknown) => {
    setBusy(true);
    setError("");
    try {
      await request("", { action, data });
      if (action === "reopen") latestMessage.current = null;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload =
        pending.current?.text === text
          ? pending.current
          : { text, requestId: crypto.randomUUID() };
      pending.current = payload;
      await request("", {
        action: conversation ? "message" : "start",
        data: conversation
          ? payload
          : { ...payload, name, categoryId: category, website },
      });
      pending.current = null;
      setText("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(bn ? "bn-BD" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const status = !ready
    ? { tone: "idle", label: t("Connecting…", "সংযুক্ত হচ্ছে…") }
    : state.linkOpen === false
      ? {
          tone: "off",
          label: t("This chat link is closed", "এই চ্যাট লিংক বন্ধ"),
        }
      : state.accepting === false
        ? { tone: "off", label: t("Outside opening hours", "এখন চ্যাট বন্ধ") }
        : conversation?.status === "QUEUED"
          ? {
              tone: "wait",
              label: t("Waiting for an agent", "এজেন্টের অপেক্ষায়"),
            }
          : conversation?.agentJoined && !closed
            ? { tone: "on", label: t("Agent connected", "এজেন্ট যুক্ত আছেন") }
            : state.agentsOnline
              ? { tone: "on", label: t("Agents online", "এজেন্টরা অনলাইনে") }
              : {
                  tone: "wait",
                  label: t(
                    "Agents busy · you will be queued",
                    "এজেন্টরা ব্যস্ত · আপনি সারিতে থাকবেন",
                  ),
                };

  return (
    <div className="lcp" data-theme={theme}>
      <div className="lcp-window" role="main">
        <header className="lcp-head">
          <span className="lcp-avatar" aria-hidden>
            <MessageCircle size={20} />
          </span>
          <div className="lcp-title">
            <h1>{t("Live chat support", "লাইভ চ্যাট সাপোর্ট")}</h1>
            <p className={"lcp-status " + status.tone}>
              <span className="lcp-dot" aria-hidden />
              {status.label}
            </p>
          </div>
          <div className="lcp-head-actions">
            <button
              type="button"
              className="lcp-icon"
              onClick={() => setBn(!bn)}
              aria-label={bn ? "Switch to English" : "বাংলায় দেখুন"}
            >
              {bn ? "EN" : "বাং"}
            </button>
            <button
              type="button"
              className="lcp-icon"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {conversation && !closed && (
              <button
                type="button"
                className="lcp-icon"
                onClick={() => setConfirmEnd(true)}
                aria-label={t("End chat", "চ্যাট শেষ করুন")}
                title={t("End chat", "চ্যাট শেষ করুন")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </header>

        {confirmEnd && conversation && !closed && (
          <div className="lcp-banner confirm" role="alertdialog">
            <span>{t("End this conversation?", "কথোপকথন শেষ করবেন?")}</span>
            <div>
              <button type="button" onClick={() => setConfirmEnd(false)}>
                {t("Cancel", "বাতিল")}
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => {
                  setConfirmEnd(false);
                  void act("close");
                }}
              >
                {t("End chat", "শেষ করুন")}
              </button>
            </div>
          </div>
        )}
        {offline && conversation && !closed && (
          <div className="lcp-banner warn" role="status">
            <WifiOff size={15} />
            {t(
              "Connection lost. Reconnecting… your messages are saved.",
              "সংযোগ বিচ্ছিন্ন। আবার যুক্ত হচ্ছে… আপনার মেসেজ সংরক্ষিত আছে।",
            )}
          </div>
        )}
        {error && (
          <div className="lcp-banner error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="lcp-link"
              onClick={() => setError("")}
              aria-label={t("Dismiss", "বন্ধ করুন")}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="lcp-body lc-messages" ref={scroller} aria-live="polite">
          {state.scenario && (
            <details className="lcp-scenario">
              <summary>
                Customer role-play scenario / কাস্টমারের ভূমিকায় করণীয়
              </summary>
              <p>{state.scenario}</p>
            </details>
          )}
          {!ready ? (
            <div className="lcp-loading" role="status">
              <span className="lcp-typing">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : !conversation ? (
            <>
              {state.linkOpen !== false && (
                <div className="lcp-msg AGENT">
                  <div className="lcp-bubble">
                    {t(
                      "Hello! 👋 Tell us your name and how we can help. An available agent will reply here.",
                      "আসসালামু আলাইকুম! 👋 আপনার নাম আর কীভাবে সাহায্য করতে পারি লিখুন। একজন এজেন্ট এখানেই উত্তর দেবেন।",
                    )}
                  </div>
                </div>
              )}
              {!canStart && (state.categories || state.linkOpen === false) && (
                <p className="lcp-system">
                  {state.linkOpen === false
                    ? t(
                        "This chat link is paused or no longer valid.",
                        "এই চ্যাট লিংকটি বন্ধ বা আর সক্রিয় নয়।",
                      )
                    : state.accepting === false
                      ? t(
                          "Chat is currently outside opening hours. Please try again later.",
                          "এখন চ্যাটের সময় নয়। পরে আবার চেষ্টা করুন।",
                        )
                      : t(
                          "Chat is not ready yet. Please try again later.",
                          "চ্যাট এখনো প্রস্তুত নয়। পরে চেষ্টা করুন।",
                        )}
                </p>
              )}
              {state.linkOpen !== false && (
                <form className="lcp-start" onSubmit={submit}>
                  <label>
                    {t("Your name (required)", "আপনার নাম (আবশ্যক)")}
                    <input
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder={t("e.g. Rahim Uddin", "যেমন: রহিম উদ্দিন")}
                    />
                  </label>
                  <label>
                    {t("Category (required)", "ক্যাটাগরি (আবশ্যক)")}
                    <select
                      aria-label={t(
                        "Category (required)",
                        "ক্যাটাগরি (আবশ্যক)",
                      )}
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">
                        {t("Select a category", "ক্যাটাগরি নির্বাচন করুন")}
                      </option>
                      {state.categories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("How can we help?", "কীভাবে সাহায্য করতে পারি?")}
                    <textarea
                      required
                      maxLength={8000}
                      rows={3}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t(
                        "Write your question…",
                        "আপনার প্রশ্ন লিখুন…",
                      )}
                    />
                  </label>
                  {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
                  <input
                    className="lcp-hp"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                  <button className="lcp-primary" disabled={busy || !canStart}>
                    {busy
                      ? t("Starting…", "শুরু হচ্ছে…")
                      : t("Start chat", "চ্যাট শুরু করুন")}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <p className="lcp-system">
                {t("Conversation", "কথোপকথন")} #{conversation.id.slice(0, 8)}
              </p>
              {(state.messages?.length || 0) >= 100 && (
                <button
                  type="button"
                  className="lcp-older"
                  onClick={async () => {
                    try {
                      const older = await request(
                        "conversation&before=" +
                          encodeURIComponent(state.messages![0].id),
                      );
                      setState((s) => ({
                        ...s,
                        messages: mergeMessages(
                          older.messages,
                          s.messages || [],
                        ),
                      }));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t("Earlier messages", "আগের মেসেজ")}
                </button>
              )}
              {state.messages?.map((m) => [
                m.id === firstAgentMessage && (
                  <p className="lcp-system joined" key={"joined-" + m.id}>
                    {t(
                      "An agent has joined the chat",
                      "একজন এজেন্ট চ্যাটে যুক্ত হয়েছেন",
                    )}
                  </p>
                ),
                m.sender === "SYSTEM" ? (
                  <p className="lcp-system" key={m.id}>
                    {m.text}
                  </p>
                ) : (
                  <article className={"lcp-msg " + m.sender} key={m.id}>
                    {m.sender !== "CUSTOMER" && (
                      <span className="lcp-who">
                        {t("Support agent", "সাপোর্ট এজেন্ট")}
                      </span>
                    )}
                    <div className="lcp-bubble">{m.text}</div>
                    <small className="lcp-meta">
                      {time(m.createdAt)}
                      {m.sender === "CUSTOMER" &&
                        (conversation.agentReadAt &&
                        m.createdAt <= conversation.agentReadAt ? (
                          <span
                            className="read"
                            title={t("Read", "পড়া হয়েছে")}
                          >
                            <CheckCheck size={14} aria-hidden />
                            <span className="sr">
                              {t("Read", "পড়া হয়েছে")}
                            </span>
                          </span>
                        ) : (
                          <span title={t("Delivered", "পৌঁছেছে")}>
                            <Check size={14} aria-hidden />
                            <span className="sr">
                              {t("Delivered", "পৌঁছেছে")}
                            </span>
                          </span>
                        ))}
                    </small>
                  </article>
                ),
              ])}
              {conversation.status === "QUEUED" && (
                <p className="lcp-system wait">
                  {t(
                    "All agents are busy right now. You are number " +
                      ((state.queuePosition || 0) + 1) +
                      " in the queue. Please stay on this page.",
                    "সব এজেন্ট এখন ব্যস্ত। সারিতে আপনার অবস্থান " +
                      ((state.queuePosition || 0) + 1) +
                      "। অনুগ্রহ করে এই পেজে থাকুন।",
                  )}
                </p>
              )}
              {conversation.agentJoined && !closed && !firstAgentMessage && (
                <p className="lcp-system joined">
                  {t(
                    "An agent has joined the chat",
                    "একজন এজেন্ট চ্যাটে যুক্ত হয়েছেন",
                  )}
                </p>
              )}
              {typing && !closed && (
                <div
                  className="lcp-msg AGENT"
                  aria-label={t("Agent is typing…", "এজেন্ট লিখছেন…")}
                >
                  <div className="lcp-bubble">
                    <span className="lcp-typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                </div>
              )}
              {closed && (
                <div className="lcp-ended">
                  <p>
                    {t("This conversation has ended.", "কথোপকথন শেষ হয়েছে।")}
                  </p>
                  {state.feedback && !conversation.feedback && (
                    <>
                      <span className="lcp-ended-q">
                        {t(
                          "How was your experience?",
                          "আপনার অভিজ্ঞতা কেমন ছিল?",
                        )}
                      </span>
                      <div className="lcp-stars" role="group">
                        {[1, 2, 3, 4, 5].map((r) => (
                          <button
                            type="button"
                            key={r}
                            disabled={busy}
                            className={r <= rating ? "on" : ""}
                            aria-label={"Rate " + r + " out of 5"}
                            onMouseEnter={() => setRating(r)}
                            onFocus={() => setRating(r)}
                            onClick={() =>
                              void act("feedback", {
                                rating: r,
                                comment: feedback,
                              })
                            }
                          >
                            <Star size={24} />
                          </button>
                        ))}
                      </div>
                      <label>
                        {t("Feedback (optional)", "মতামত (ঐচ্ছিক)")}
                        <textarea
                          rows={2}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          maxLength={2000}
                        />
                      </label>
                    </>
                  )}
                  {!!conversation.feedback && (
                    <p className="lcp-thanks">
                      {t(
                        "Thank you for your feedback!",
                        "মতামতের জন্য ধন্যবাদ!",
                      )}
                    </p>
                  )}
                  <button
                    type="button"
                    className="lcp-secondary"
                    disabled={busy}
                    onClick={() => void act("reopen")}
                  >
                    <RotateCcw size={15} />{" "}
                    {t("Reopen conversation", "আবার শুরু করুন")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {conversation && !closed && (
          <form className="lcp-composer" onSubmit={submit}>
            <label className="sr" htmlFor="lcp-message">
              {t("Message", "মেসেজ")}
            </label>
            <textarea
              id="lcp-message"
              aria-label={t("Message", "মেসেজ")}
              rows={1}
              maxLength={8000}
              required
              value={text}
              placeholder={t("Type a message…", "মেসেজ লিখুন…")}
              onKeyDown={onComposerKey}
              onChange={(e) => {
                setText(e.target.value);
                if (Date.now() - typingAt.current > 4000) {
                  typingAt.current = Date.now();
                  void request("", { action: "typing" }).catch(() => {});
                }
              }}
            />
            <button
              className="lcp-send"
              disabled={busy || !text.trim()}
              aria-label={t("Send", "পাঠান")}
              title={t("Send (Enter)", "পাঠান (Enter)")}
            >
              <Send size={18} />
            </button>
          </form>
        )}
        <footer className="lcp-foot">
          {t(
            "Training environment · never share passwords, PINs or real payment details.",
            "প্রশিক্ষণের চ্যাট · পাসওয়ার্ড, পিন বা আসল পেমেন্টের তথ্য দেবেন না।",
          )}
        </footer>
      </div>
    </div>
  );
}
