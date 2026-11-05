"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import "./chat.css";
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
};
export default function PublicChat({ token }: { token: string }) {
  const [bn, setBn] = useState(false),
    [state, setState] = useState<State>({}),
    [name, setName] = useState(""),
    [category, setCategory] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [feedback, setFeedback] = useState("");
  const endpoint = "/api/live-chat/public/" + encodeURIComponent(token),
    end = useRef<HTMLDivElement>(null),
    pending = useRef<{ text: string; requestId: string } | null>(null),
    typingAt = useRef(0);
  const latestMessage = useRef<string | null>(null);
  const t = (en: string, ba: string) => (bn ? ba : en);
  const request = useCallback(
    async (kind: string, body?: unknown) => {
      const r = await fetch(endpoint + (body ? "" : "?kind=" + kind), {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
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
      } catch (e) {
        if (active) setError((e as Error).message);
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
      void refresh().catch((e) => setError(e.message));
    });
    const heartbeat = setInterval(() => {
      void request("", { action: "heartbeat" }).catch(() => {});
    }, 20000);
    return () => {
      stream.close();
      clearInterval(heartbeat);
    };
  }, [state.conversation?.id, refresh, request, endpoint]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [state.messages?.length]);
  useEffect(() => {
    if (state.messages?.length && document.visibilityState === "visible")
      void request("", { action: "read" }).catch(() => {});
  }, [state.messages?.at(-1)?.id, request]);
  const closed =
    !!state.conversation &&
    ["RESOLVED", "CLOSED", "ABANDONED", "DROPPED"].includes(
      state.conversation.status,
    );
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
  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        action: state.conversation ? "message" : "start",
        data: state.conversation
          ? payload
          : { ...payload, name, categoryId: category },
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
  return (
    <div className="lc">
      <main className="lc-public">
        {state.scenario && (
          <details className="lc-panel">
            <summary>
              Customer role-play scenario / কাস্টমারের ভূমিকায় করণীয়
            </summary>
            <p style={{ whiteSpace: "pre-wrap" }}>{state.scenario}</p>
          </details>
        )}
        <header>
          <div>
            <small>CONTACT CENTER · TRAINING</small>
            <h1>{t("Customer live chat", "কাস্টমার লাইভ চ্যাট")}</h1>
          </div>
          <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
        </header>
        <p className="muted">
          {t(
            "You are chatting in a training environment. Do not share passwords, PINs or real payment details.",
            "এটি প্রশিক্ষণের চ্যাট। পাসওয়ার্ড, পিন বা আসল পেমেন্টের তথ্য দেবেন না।",
          )}
        </p>
        {error && (
          <div role="alert" className="lc-error">
            {error}
          </div>
        )}
        {!ready ? (
          <p role="status">{t("Connecting…", "সংযুক্ত হচ্ছে…")}</p>
        ) : (
          <section className="lc-panel lc-stack">
            {!state.conversation ? (
              <form className="lc-stack" onSubmit={submit}>
                <h2>{t("Start a conversation", "কথোপকথন শুরু করুন")}</h2>
                <label>
                  {t("Your name (required)", "আপনার নাম (আবশ্যক)")}
                  <input
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  {t("Category (required)", "ক্যাটাগরি (আবশ্যক)")}
                  <select
                    aria-label={t("Category (required)", "ক্যাটাগরি (আবশ্যক)")}
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
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || !state.categories?.length}
                >
                  {busy
                    ? t("Starting…", "শুরু হচ্ছে…")
                    : t("Start chat", "চ্যাট শুরু করুন")}
                </button>
              </form>
            ) : (
              <>
                <div className="lc-row">
                  <span className={"lc-badge " + state.conversation.status}>
                    {state.conversation.status}
                  </span>
                  <small>#{state.conversation.id.slice(0, 8)}</small>
                  <span>
                    {state.conversation.status === "QUEUED"
                      ? t(
                          "Waiting · position " + state.queuePosition,
                          "অপেক্ষমাণ · অবস্থান " + state.queuePosition,
                        )
                      : state.conversation.agentJoined
                        ? t("An agent has joined", "একজন এজেন্ট যুক্ত হয়েছেন")
                        : ""}
                  </span>
                </div>
                <div className="lc-messages" aria-live="polite">
                  {(state.messages?.length || 0) >= 100 && (
                    <button
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
                  {state.messages?.map((m) => (
                    <article className={"lc-message " + m.sender} key={m.id}>
                      <strong>
                        {m.sender === "CUSTOMER"
                          ? t("You", "আপনি")
                          : m.sender === "SYSTEM"
                            ? "System"
                            : t("Agent", "এজেন্ট")}
                      </strong>
                      <p>{m.text}</p>
                      <small>
                        {new Date(m.createdAt).toLocaleTimeString(
                          bn ? "bn-BD" : "en-GB",
                        )}{" "}
                        ·{" "}
                        {m.sender === "CUSTOMER"
                          ? state.conversation?.agentReadAt &&
                            m.createdAt <= state.conversation.agentReadAt
                            ? t("Read", "পড়া হয়েছে")
                            : t("Delivered", "পৌঁছেছে")
                          : ""}
                      </small>
                    </article>
                  ))}
                  <div ref={end} />
                </div>
                {!closed ? (
                  <form className="lc-compose" onSubmit={submit}>
                    {state.conversation.agentTypingAt &&
                      Date.now() - +new Date(state.conversation.agentTypingAt) <
                        5000 && (
                        <small>{t("Agent is typing…", "এজেন্ট লিখছেন…")}</small>
                      )}
                    <label>
                      {t("Message", "মেসেজ")}
                      <textarea
                        maxLength={8000}
                        required
                        value={text}
                        onChange={(e) => {
                          setText(e.target.value);
                          if (Date.now() - typingAt.current > 4000) {
                            typingAt.current = Date.now();
                            void request("", { action: "typing" }).catch(
                              () => {},
                            );
                          }
                        }}
                      />
                    </label>
                    <div className="lc-row">
                      <button className="primary" disabled={busy}>
                        {busy
                          ? t("Sending…", "পাঠানো হচ্ছে…")
                          : t("Send", "পাঠান")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              t("End this conversation?", "কথোপকথন শেষ করবেন?"),
                            )
                          )
                            void act("close");
                        }}
                      >
                        {t("End chat", "শেষ করুন")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="lc-stack">
                    <p>
                      {t("This conversation has ended.", "কথোপকথন শেষ হয়েছে।")}
                    </p>
                    {state.feedback && !state.conversation.feedback && (
                      <>
                        <label>
                          {t("Feedback (optional)", "মতামত (ঐচ্ছিক)")}
                          <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            maxLength={2000}
                          />
                        </label>
                        <div className="lc-row">
                          {[1, 2, 3, 4, 5].map((r) => (
                            <button
                              disabled={busy}
                              key={r}
                              aria-label={"Rate " + r + " out of 5"}
                              onClick={() =>
                                void act("feedback", {
                                  rating: r,
                                  comment: feedback,
                                })
                              }
                            >
                              {r} ★
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button disabled={busy} onClick={() => void act("reopen")}>
                      {t("Reopen conversation", "আবার শুরু করুন")}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
