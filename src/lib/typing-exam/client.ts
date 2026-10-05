// Browser-side transport for one typing-exam run: opens the server session,
// autosaves progress, and submits with retries. Shared by the student and
// public pages so both get identical delivery guarantees:
//
//  - progress is autosaved every few seconds and beaconed when the tab is
//    hidden or closed, so the server always holds a recent snapshot;
//  - submit retries transient failures, and if it still cannot get through
//    it beacons the final snapshot (with its finish reason) so the server
//    grades exactly that once the exam window passes;
//  - if /start itself failed, submit falls back to the session-less path.

import type { EngineSnapshot } from "./engine";

/** JSON body the attempt/progress endpoints accept (see parseClientSnapshot). */
export interface ExamWirePayload {
  typedText: string;
  keystrokesTotal: number;
  keystrokesCorrect: number;
  elapsedMs: number;
  finishReason: EngineSnapshot["finishReason"];
}

export function toWirePayload(s: EngineSnapshot): ExamWirePayload {
  return {
    typedText: s.typedText,
    keystrokesTotal: s.keystrokes.total,
    keystrokesCorrect: s.keystrokes.correct,
    elapsedMs: Math.round(s.elapsedMs),
    finishReason: s.finishReason,
  };
}

interface SessionIds {
  sessionId: string;
  sessionToken?: string | null;
}

export interface SubmitOutcome {
  status: number;
  data: Record<string, unknown>;
  /** True when every retry failed to reach the server at all. */
  networkError: boolean;
}

const RETRY_DELAYS_MS = [0, 1000, 2500, 5000];
const SESSION_WAIT_MS = 8000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ExamTransport {
  private sessionPromise: Promise<SessionIds | null> = Promise.resolve(null);
  private session: SessionIds | null = null;

  /**
   * @param urls       endpoints for this exam
   * @param identity   fields every request must carry (public: name/roll/phone/password)
   */
  constructor(
    private readonly urls: { start: string; progress: string; attempt: string },
    private readonly identity: Record<string, unknown> = {}
  ) {}

  /** Opens the server session. Fire-and-forget: runs during the countdown. */
  begin(extra: Record<string, unknown> = {}): void {
    this.session = null;
    this.sessionPromise = fetch(this.urls.start, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...this.identity, ...extra }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const d = await res.json();
        if (typeof d.sessionId !== "string") return null;
        this.session = { sessionId: d.sessionId, sessionToken: d.sessionToken ?? null };
        return this.session;
      })
      .catch(() => null);
  }

  /** Autosave. With beacon=true it survives the page being closed. */
  progress(payload: ExamWirePayload, beacon = false): void {
    const s = this.session;
    if (!s) return;
    const body = JSON.stringify({ ...s, ...payload });
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      // text/plain keeps it a "simple" request; the server parses the text as JSON.
      if (navigator.sendBeacon(this.urls.progress, new Blob([body], { type: "text/plain" }))) return;
    }
    fetch(this.urls.progress, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: beacon,
    }).catch(() => {});
  }

  async submit(payload: ExamWirePayload, extra: Record<string, unknown> = {}): Promise<SubmitOutcome> {
    // Insurance first: if the tab is closed while submit is in flight, the
    // server still holds the final snapshot.
    this.progress(payload, true);
    const session = await Promise.race([this.sessionPromise, sleep(SESSION_WAIT_MS).then(() => this.session)]);
    const body = JSON.stringify({ ...this.identity, ...extra, ...(session ?? {}), ...payload });

    let last: SubmitOutcome = { status: 0, data: {}, networkError: true };
    for (const delay of RETRY_DELAYS_MS) {
      if (delay) await sleep(delay);
      try {
        const res = await fetch(this.urls.attempt, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await res.json().catch(() => ({}));
        last = { status: res.status, data, networkError: false };
        // Only server errors / rate limits are worth retrying; the endpoint is idempotent per session.
        if (res.status < 500 && res.status !== 429) return last;
      } catch {
        last = { status: 0, data: {}, networkError: true };
      }
    }
    // Could not get through: try once more to leave the final snapshot with
    // the server so the attempt is graded from it instead of being lost.
    this.progress(payload, true);
    return last;
  }
}
