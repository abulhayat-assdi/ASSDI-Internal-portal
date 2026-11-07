"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type Item = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/** The signed-in person's incubation reminders for one program. */
export default function NotificationBell({ programId }: { programId?: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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
    <div className="inc-bell" ref={box}>
      <button
        className="inc-btn"
        aria-label={`রিমাইন্ডার${unread ? ` (${unread}টি নতুন)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} />
        {unread > 0 && <span className="inc-bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="inc-bell-panel" role="dialog" aria-label="রিমাইন্ডার">
          <div className="inc-row inc-between">
            <b>রিমাইন্ডার</b>
            {unread > 0 && (
              <button className="inc-link" onClick={markAll}>
                সব পড়া হয়েছে
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="inc-muted">কোনো রিমাইন্ডার নেই।</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? "" : "unread"}>
                  <small>{new Date(n.createdAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</small>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
