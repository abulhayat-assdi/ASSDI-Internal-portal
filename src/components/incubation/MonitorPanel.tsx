"use client";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { MonitorIssue } from "@/lib/incubation/monitor";

/** "Today's actions" — the same list the daily reminders are built from. */
export default function MonitorPanel({
  issues,
  title = "Today's actions",
  emptyText = "Nothing needs attention right now.",
}: {
  issues?: MonitorIssue[];
  title?: string;
  emptyText?: string;
}) {
  const list = issues ?? [];
  return (
    <section className="inc-card inc-monitor" aria-label={title}>
      <div className="inc-row inc-between">
        <h2>{title}</h2>
        {list.length > 0 && <span className="inc-status pending">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <p className="inc-monitor-ok">
          <CheckCircle2 size={16} /> {emptyText}
        </p>
      ) : (
        <ul className="inc-monitor-list">
          {list.map((i) => (
            <li key={i.key} className={`inc-monitor-item ${i.severity}`}>
              {i.severity === "low" ? <Info size={15} /> : <AlertTriangle size={15} />}
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
