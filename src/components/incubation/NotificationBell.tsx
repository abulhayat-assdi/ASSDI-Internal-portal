"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

type Item = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

const PANEL_WIDTH = 380;

/**
 * The signed-in person's incubation reminders for one program.
 * The panel is rendered on document.body (a portal) so the header's
 * overflow clipping can never cut it off; it is positioned under the bell
 * and kept inside the viewport.
 */
export default function NotificationBell({ programId }: { programId?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/incubation/notifications${programId ? `?programId=${programId}` : ""}`);
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items || []);
      setUnread(d.unread || 0);
    } catch {
      /* a reminder list must never break the workspace */
    }
  }, [programId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const place = useCallback(() => {
    const b = button.current?.getBoundingClientRect();
    if (!b) return;
    const gutter = 12;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - gutter * 2);
    const left = Math.min(Math.max(gutter, b.right - width), window.innerWidth - width - gutter);
    const top = b.bottom + 8;
    setPos({ top, left, width, maxHeight: Math.max(200, window.innerHeight - top - gutter) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const markAll = async () => {
    await fetch("/api/incubation/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(programId ? { programId } : {}),
    }).catch(() => {});
    load();
  };

  return (
    <div className="inc-bell">
      <button
        ref={button}
        className="inc-btn"
        aria-label={`Reminders${unread ? ` (${unread} new)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} />
        {unread > 0 && <span className="inc-bell-count">{unread}</span>}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            className="inc-bell-panel"
            role="dialog"
            aria-label="Reminders"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          >
            <div className="inc-bell-head">
              <b>Reminders</b>
              <div className="inc-bell-head-actions">
                {unread > 0 && (
                  <button className="inc-link" onClick={markAll}>
                    Mark all as read
                  </button>
                )}
                <button className="inc-bell-close" aria-label="Close reminders" onClick={() => setOpen(false)}>
                  <X size={15} />
                </button>
              </div>
            </div>
            {items.length === 0 ? (
              <p className="inc-bell-empty">
                No reminders yet. Daily reminders appear here when a report is missing, a check-out is pending, or
                something waits for your approval.
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id} className={n.readAt ? "" : "unread"}>
                    <small>{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</small>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
