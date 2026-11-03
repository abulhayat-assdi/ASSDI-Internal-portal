"use client";

import {
  CheckCheck,
  Clock3,
  Headphones,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { localDate } from "@/lib/customer-service/domain";

type Summary = {
  metrics: Record<string, number | null>;
  breakdowns: Record<string, { name: string; count: number }[]>;
  rows: { resolvedAt: string | null }[];
};
const hours = (value: number | null | undefined) =>
  value == null ? "N/A" : `${(value / 3600000).toFixed(2)} h`;

export default function CrmOverview({
  report,
  from,
  to,
  label,
}: {
  report: Summary;
  from: string;
  to: string;
  label: (id: string) => string;
}) {
  const m = report.metrics;
  const cards = [
    {
      name: "Total Complaints",
      value: m.complaints,
      note: "Created in selected period",
      icon: Headphones,
      tone: "blue",
    },
    {
      name: "Total Pending",
      value: m.pending,
      note: "Open at the end of the period",
      icon: Clock3,
      tone: "amber",
    },
    {
      name: "Resolved",
      value: m.resolved,
      note: "Final resolutions in period",
      icon: CheckCheck,
      tone: "green",
    },
    {
      name: "Solved Within SLA %",
      value: m.withinSla == null ? "N/A" : `${m.withinSla.toFixed(1)}%`,
      note: "Of resolutions in this period",
      icon: ShieldCheck,
      tone: "violet",
    },
  ];
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const start = Math.max(
    new Date(`${from}T00:00:00Z`).getTime(),
    end - 6 * 86400000,
  );
  const days: { date: string; count: number }[] = [];
  if (Number.isFinite(start) && Number.isFinite(end)) {
    for (let day = start; day <= end; day += 86400000)
      days.push({ date: new Date(day).toISOString().slice(0, 10), count: 0 });
  }
  for (const row of report.rows) {
    if (!row.resolvedAt) continue;
    const day = days.find(
      (d) => d.date === localDate(new Date(row.resolvedAt!)),
    );
    if (day) day.count++;
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const points = days
    .map(
      (d, i) =>
        `${32 + (i * 456) / Math.max(1, days.length - 1)},${158 - (d.count / max) * 122}`,
    )
    .join(" ");
  const tethered = m.tethered ?? 0,
    untethered = m.untethered ?? 0;
  const total = tethered + untethered;
  const percentage = total ? (tethered / total) * 100 : 0;
  const issues = [...(report.breakdowns.issueType || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const issueMax = Math.max(1, ...issues.map((i) => i.count));
  return (
    <>
      <div className="crm-kpis">
        {cards.map(({ name, value, note, icon: Icon, tone }) => (
          <section className="crm-kpi" key={name}>
            <div className="crm-kpi-heading">
              <span>{name}</span>
              <span className={`crm-icon-tile ${tone}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong>{value ?? "N/A"}</strong>
            <p>{note}</p>
          </section>
        ))}
      </div>
      <div className="crm-charts">
        <section className="crm-panel crm-trend">
          <div className="crm-panel-title">
            <div>
              <h3>Resolution activity</h3>
              <p>Last {days.length} days of the selected period · Dhaka</p>
            </div>
            <TrendingUp size={19} />
          </div>
          <div className="crm-trend-total">
            <strong>{days.reduce((sum, d) => sum + d.count, 0)}</strong>
            <span>final resolutions</span>
          </div>
          <svg
            viewBox="0 0 520 195"
            role="img"
            aria-label={`Daily resolutions: ${days.map((d) => `${d.date}: ${d.count}`).join(", ")}`}
          >
            {[36, 97, 158].map((y, i) => (
              <g key={y}>
                <line
                  x1="32"
                  y1={y}
                  x2="488"
                  y2={y}
                  stroke="#e8edf4"
                  strokeDasharray="4 4"
                />
                <text x="6" y={y + 4} fill="#94a3b8" fontSize="10">
                  {((max * (2 - i)) / 2).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}
                </text>
              </g>
            ))}
            {days.length > 0 && (
              <>
                <polygon
                  points={`32,158 ${points} ${32 + ((days.length - 1) * 456) / Math.max(1, days.length - 1)},158`}
                  fill="rgba(72,120,255,.09)"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke="#4878ff"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {days.map((d, i) => (
                  <g key={d.date}>
                    <circle
                      cx={32 + (i * 456) / Math.max(1, days.length - 1)}
                      cy={158 - (d.count / max) * 122}
                      r="4"
                      fill="#4878ff"
                    >
                      <title>
                        {d.date}: {d.count} resolutions
                      </title>
                    </circle>
                    <text
                      x={32 + (i * 456) / Math.max(1, days.length - 1)}
                      y="185"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#7b8799"
                    >
                      {d.date.slice(5).replace("-", "/")}
                    </text>
                  </g>
                ))}
              </>
            )}
          </svg>
        </section>
        <section className="crm-panel">
          <div className="crm-panel-title">
            <div>
              <h3>Resolution mix</h3>
              <p>Same-week vs later-week resolutions</p>
            </div>
            <CheckCheck size={19} />
          </div>
          <div className="crm-donut-wrap">
            <div
              className="crm-donut"
              style={{
                background: total
                  ? `conic-gradient(#4878ff 0 ${percentage}%, #36c4ad ${percentage}% 100%)`
                  : "#edf1f7",
              }}
              role="img"
              aria-label={`Tethered ${tethered}, untethered ${untethered}`}
            >
              <div>
                <strong>{total}</strong>
                <span>{total ? "resolved" : "No resolutions"}</span>
              </div>
            </div>
          </div>
          <div className="crm-legend">
            <span>
              <i />
              Tethered <b>{tethered}</b>
            </span>
            <span>
              <i className="mint" />
              Untethered <b>{untethered}</b>
            </span>
          </div>
        </section>
        <section className="crm-panel">
          <div className="crm-panel-title">
            <div>
              <h3>Top issue types</h3>
              <p>Complaints created in selected period</p>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="crm-bars">
            {issues.length ? (
              issues.map((issue) => (
                <div key={issue.name}>
                  <div className="crm-bar-label">
                    <span title={label(issue.name)}>{label(issue.name)}</span>
                    <b>{issue.count}</b>
                  </div>
                  <div className="crm-bar-track">
                    <div
                      style={{ width: `${(issue.count / issueMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="crm-chart-empty">
                <Headphones size={28} />
                <strong>No complaints yet</strong>
                <p>Issue trends will appear as complaints are created.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="crm-secondary-metrics">
        {[
          ["Average SLA", hours(m.average)],
          ["Median TAT", hours(m.median)],
          ["P90 TAT", hours(m.p90)],
          ["Total Interactions", m.interactions ?? 0],
          ["Total Escalation", m.escalations ?? 0],
        ].map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
