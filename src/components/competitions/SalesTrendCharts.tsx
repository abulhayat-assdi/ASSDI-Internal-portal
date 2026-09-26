"use client";

import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const COLORS = ['#10B981', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

/**
 * The team-sales pie chart and daily/cumulative sales trend line, extracted
 * from the dashboard competition report page for the same reason as
 * LeaderboardBarCharts: recharts should only load when this report is
 * actually opened.
 */
export default function SalesTrendCharts({
  teamLeaderboard,
  dailyChartData,
}: {
  teamLeaderboard: any[];
  dailyChartData: any[];
}) {
  return (
    <>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
          <span>🥧</span> Team Sales Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={teamLeaderboard} dataKey="sales" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80}>
                {teamLeaderboard.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(val: any) => `৳${Number(val).toLocaleString()}`} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Legend wrapperStyle={{ color: '#475569', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
          <span>📈</span> Daily & Cumulative Sales Trend
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" />
              <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderRadius: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Legend wrapperStyle={{ color: '#475569', fontSize: '12px' }} />
              <Line type="monotone" dataKey="dailySales" stroke="#0284C7" strokeWidth={2.5} name="Daily Sales" />
              <Line type="monotone" dataKey="cumulative" stroke="#10B981" strokeWidth={2.5} name="Cumulative" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
