"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";

// recharts (~370KB) only loads once this component actually mounts, and
// never during SSR — this page is public, so every anonymous visitor used to
// pay for a charting library before seeing any content.
const LeaderboardBarCharts = dynamic(() => import("@/components/competitions/LeaderboardBarCharts"), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading charts…</div>,
});

export default function PublicCompetitionReportPage() {
  const params = useParams();
  const id = params.id as string;
  const [competition, setCompetition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"current" | "total">("total");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/competitions/${id}/report?public=true`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCompetition(data);
    } catch (e) {
      toast.error("Error loading competition report");
    } finally {
      setLoading(false);
    }
  };

  const reportData = useMemo(() => {
    if (!competition) return null;
    
    // Schema mapping info
    let salesField = "", profitField = "", cupsField = "", cupRevField = "", packetsField = "", revenueField = "", dayField = "";
    
    competition.schema.forEach((f: any) => {
      if (f.mapping === 'sales') salesField = f.id;
      if (f.mapping === 'profit') profitField = f.id;
      if (f.mapping === 'cups_sold') cupsField = f.id;
      if (f.mapping === 'cup_revenue') cupRevField = f.id;
      if (f.mapping === 'packets_sold') packetsField = f.id;
      if (f.mapping === 'packet_revenue') revenueField = f.id;
      if (f.mapping === 'day_number') dayField = f.id;
    });

    let submissions = competition.submissions || [];
    
    // Calculate "Yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const allDates: string[] = Array.from(new Set<string>(submissions.map((s: any) => new Date(s.submittedAt).toDateString()))).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    if (viewType === "current") {
      submissions = submissions.filter((s: any) => new Date(s.submittedAt).toDateString() === yesterdayStr);
    }

    // Aggregations
    let totalSales = 0, totalProfit = 0;
    const teamMap: Record<string, any> = {};
    const individualMap: Record<string, any> = {};

    const allSubmissions = competition.submissions || [];
    allSubmissions.forEach((sub: any) => {
      const tName = sub.teamName || "Unknown Team";
      if (!teamMap[tName]) {
        teamMap[tName] = { 
          name: tName, 
          sales: 0, 
          profit: 0, 
          cups: 0, 
          cupRevenue: 0, 
          packets: 0, 
          revenue: 0, 
          score: 0, 
          submittedDates: new Set(),
          absentMembers: new Set()
        };
      }
      teamMap[tName].submittedDates.add(new Date(sub.submittedAt).toDateString());

      if (Array.isArray(sub.data?.absentRolls)) {
        sub.data.absentRolls.forEach((roll: string) => teamMap[tName].absentMembers.add(roll));
      }

      if (sub.type === "individual") {
        const indName = sub.studentName || sub.rollNumber;
        if (!individualMap[indName]) {
          individualMap[indName] = { name: indName, roll: sub.rollNumber, team: tName, sales: 0, profit: 0, cups: 0, packets: 0, score: 0, submittedDates: new Set() };
        }
        individualMap[indName].submittedDates.add(new Date(sub.submittedAt).toDateString());
      }
    });

    Object.values(teamMap).forEach(t => {
      t.missingDates = allDates.filter(d => !t.submittedDates.has(d)).map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      t.daysActive = t.submittedDates.size;
      t.absentList = Array.from(t.absentMembers as Set<string>);
    });
    Object.values(individualMap).forEach(i => {
      i.missingDates = allDates.filter(d => !i.submittedDates.has(d)).map(d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    });

    submissions.forEach((sub: any) => {
      const sales = Number(sub.data[salesField] || 0);
      const profit = Number(sub.data[profitField] || 0);
      const cups = Number(sub.data[cupsField] || 0);
      const cupRevenue = Number(sub.data[cupRevField] || 0);
      const packets = Number(sub.data[packetsField] || 0);
      const revenue = Number(sub.data[revenueField] || 0);
      
      totalSales += sales;
      totalProfit += profit;

      const tName = sub.teamName || "Unknown Team";
      if (teamMap[tName]) {
        teamMap[tName].sales += sales;
        teamMap[tName].profit += profit;
        teamMap[tName].cups += cups;
        teamMap[tName].cupRevenue += cupRevenue;
        teamMap[tName].packets += packets;
        teamMap[tName].revenue += revenue;
      }

      if (sub.type === "individual") {
        const indName = sub.studentName || sub.rollNumber;
        if (individualMap[indName]) {
          individualMap[indName].sales += sales;
          individualMap[indName].profit += profit;
          individualMap[indName].cups += cups;
          individualMap[indName].packets += packets;
        }
      }
    });

    Object.values(teamMap).forEach(t => { t.score = t.sales + t.profit; });
    Object.values(individualMap).forEach(i => { i.score = i.cups + i.packets; });

    const teamLeaderboard = Object.values(teamMap).sort((a: any, b: any) => b.score - a.score);
    const individualLeaderboard = Object.values(individualMap).sort((a: any, b: any) => b.score - a.score);

    const topTeam = teamLeaderboard[0]?.name || "N/A";
    const totalTeams = Object.keys(teamMap).length;
    const totalStudents = new Set(allSubmissions.map((s:any) => s.rollNumber)).size;

    const dateMap: Record<string, { date: string, dailySales: number }> = {};
    allSubmissions.forEach((sub: any) => {
      const d = new Date(sub.submittedAt).toLocaleDateString();
      if (!dateMap[d]) dateMap[d] = { date: d, dailySales: 0 };
      dateMap[d].dailySales += Number(sub.data[salesField] || 0);
    });
    
    let cum = 0;
    const dailyChartData = Object.values(dateMap).sort((a:any, b:any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(d => {
      cum += d.dailySales;
      return { ...d, cumulative: cum };
    });

    return {
      totalSales, totalProfit, topTeam, totalTeams, totalStudents,
      teamLeaderboard, individualLeaderboard,
      dailyChartData
    };
  }, [competition, viewType]);

  const handleDownloadExcel = async () => {
    if (!competition || !reportData) return;

    // Loaded on demand — only paid for when someone actually exports.
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Helper to format submission rows
    const formatSubmissionRow = (sub: any) => {
      const row: any = {
        "Submitted At": new Date(sub.submittedAt).toLocaleString(),
        "Type": sub.type || (sub.teamName ? "team" : "individual"),
        "Team Name": sub.teamName || "N/A",
        "Roll Number": sub.rollNumber,
        "Student Name": sub.studentName,
        "Absent Rolls": Array.isArray(sub.data?.absentRolls) ? sub.data.absentRolls.join(", ") : "None"
      };
      
      competition.schema.forEach((field: any) => {
        const val = sub.data?.[field.id];
        if (field.type === 'repeater' && Array.isArray(val)) {
          row[field.label] = val.map((item: any, i: number) => {
            const parts = (field.subFields || []).map((sf: any) => `${sf.label}: ${item[sf.id] || 'N/A'}`);
            return `[${i + 1}] ${parts.join(', ')}`;
          }).join(' \n');
        } else {
          row[field.label] = val !== undefined ? val : "";
        }
      });

      return row;
    };

    const isTeamSubmission = (s: any) => s.type === "team" || Boolean(s.teamName && s.teamName.trim() !== "");

    // 1. Team Submissions Sheet
    const teamSubmissions = competition.submissions.filter((s: any) => isTeamSubmission(s)).map(formatSubmissionRow);
    const wsTeamSubs = XLSX.utils.json_to_sheet(teamSubmissions.length > 0 ? teamSubmissions : [{}]);
    XLSX.utils.book_append_sheet(wb, wsTeamSubs, "Team Submissions");

    // 2. Individual Submissions Sheet
    const indSubmissions = competition.submissions.filter((s: any) => !isTeamSubmission(s)).map(formatSubmissionRow);
    const wsIndSubs = XLSX.utils.json_to_sheet(indSubmissions.length > 0 ? indSubmissions : [{}]);
    XLSX.utils.book_append_sheet(wb, wsIndSubs, "Individual Submissions");

    // 3. Raw Submissions Sheet
    const rawData = competition.submissions.map(formatSubmissionRow);
    const wsRaw = XLSX.utils.json_to_sheet(rawData.length > 0 ? rawData : [{}]);
    XLSX.utils.book_append_sheet(wb, wsRaw, "Raw Submissions");

    // 4. Team Leaderboard
    const teamData = reportData.teamLeaderboard.map((team: any, idx: number) => ({
      "Rank": idx + 1,
      "Team Name": team.name,
      "Cups Sold": team.cups,
      "Cup Revenue (Tk)": team.cupRevenue,
      "Packets Sold": team.packets,
      "Packet Revenue (Tk)": team.revenue,
      "Total Sales (Tk)": team.sales,
      "Total Profit (Tk)": team.profit,
      "Score": team.score.toFixed(2),
      "Days Active": team.daysActive,
      "Absent Members": team.absentList.join(", ") || "None",
      "Missing Reports": team.missingDates.join(", ") || "None",
    }));
    const wsTeams = XLSX.utils.json_to_sheet(teamData);
    XLSX.utils.book_append_sheet(wb, wsTeams, "Team Leaderboard");

    // 5. Individual Leaderboard
    const indData = reportData.individualLeaderboard.map((ind: any, idx: number) => ({
      "Rank": idx + 1,
      "Roll Number": ind.roll,
      "Student Name": ind.name,
      "Team": ind.team,
      "Cups Sold": ind.cups,
      "Packets Sold": ind.packets,
      "Missing Reports": ind.missingDates.join(", ") || "None",
      "Score": ind.score.toFixed(2),
    }));
    const wsInd = XLSX.utils.json_to_sheet(indData);
    XLSX.utils.book_append_sheet(wb, wsInd, "Individual Leaderboard");

    XLSX.writeFile(wb, `${competition.title.replace(/\s+/g, '_')}_Report.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center text-slate-800 p-6">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium tracking-wide text-sm">Loading Live Report...</p>
      </div>
    );
  }

  if (!competition || !reportData) {
    return (
      <div className="min-h-screen bg-slate-50 flex justify-center items-center text-slate-700 p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center max-w-md shadow-md">
          <p className="text-xl font-bold text-slate-800">Report Not Found</p>
          <p className="text-sm text-slate-500 mt-2">The requested competition report could not be found or is inactive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 md:p-8 font-sans">
      
      {/* Top Header Banner */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-wider uppercase mb-2">
            <span>🌐 Public Live Leaderboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            {competition.title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 flex flex-wrap items-center gap-3">
            <span className="bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 text-slate-700 font-semibold">Batch: {competition.batchName}</span>
            <span className="text-slate-400">·</span>
            <span>Live update: <strong className="text-slate-700 font-semibold">{new Date().toLocaleTimeString()}</strong></span>
          </p>
        </div>
        
        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value as any)}
            className="bg-white text-slate-800 border border-slate-300 px-3.5 py-2.5 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm w-full sm:w-auto transition-all"
          >
            <option value="total">Full Report</option>
            <option value="current">Current Report (Yesterday)</option>
          </select>

          <button 
            onClick={handleDownloadExcel} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
          >
            <span>📥</span> Export Excel
          </button>

          <button 
            onClick={fetchData} 
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl shadow-sm font-semibold transition-all flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
          >
            <span className="text-emerald-600">↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5 mb-8">
        {[
          { label: "Total Sales", value: `৳${reportData.totalSales.toLocaleString()}`, icon: "💰" },
          { label: "Total Profit", value: `৳${reportData.totalProfit.toLocaleString()}`, icon: "📈" },
          { label: "Top Team", value: reportData.topTeam, icon: "🏆" },
          { label: "Total Teams", value: reportData.totalTeams, icon: "👥" },
          { label: "Total Students", value: reportData.totalStudents, icon: "🎓" }
        ].map((card, i) => (
          <div 
            key={i} 
            className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Team Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-100 rounded-lg text-amber-700 text-base">🏅</span>
            Team Leaderboard
          </h2>
          <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
            {reportData.teamLeaderboard.length} Teams
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-100 border-b border-slate-200">
                <th className="px-5 py-3.5">Rank</th>
                <th className="px-5 py-3.5">Team</th>
                <th className="px-5 py-3.5 text-right">Cups Sold</th>
                <th className="px-5 py-3.5 text-right">Cup Rev.</th>
                <th className="px-5 py-3.5 text-right">Packets Sold</th>
                <th className="px-5 py-3.5 text-right">Packet Rev.</th>
                <th className="px-5 py-3.5 text-right">Total Sales</th>
                <th className="px-5 py-3.5 text-right">Total Profit</th>
                <th className="px-5 py-3.5 text-right">Score</th>
                <th className="px-5 py-3.5 text-right">Days Active</th>
                <th className="px-5 py-3.5 text-amber-700">Absent Members</th>
                <th className="px-5 py-3.5 text-right text-red-600">Missing Reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {reportData.teamLeaderboard.map((team: any, idx: number) => (
                <tr 
                  key={team.name} 
                  className={`transition-colors hover:bg-slate-50 ${idx === 0 ? "bg-amber-50/60" : idx === 1 ? "bg-slate-50/80" : idx === 2 ? "bg-orange-50/40" : ""}`}
                >
                  <td className="px-5 py-4 font-bold text-slate-700">
                    {idx === 0 ? <span className="text-xl">🥇</span> : idx === 1 ? <span className="text-xl">🥈</span> : idx === 2 ? <span className="text-xl">🥉</span> : <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300">{idx + 1}</span>}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900">{team.name}</td>
                  <td className="px-5 py-4 text-right text-slate-700 font-medium">{team.cups}</td>
                  <td className="px-5 py-4 text-right text-emerald-700 font-semibold">৳{team.cupRevenue.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right text-slate-700 font-medium">{team.packets}</td>
                  <td className="px-5 py-4 text-right text-teal-700 font-semibold">৳{team.revenue.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-black text-emerald-800 text-base">৳{team.sales.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-black text-teal-800 text-base">৳{team.profit.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-black text-amber-600 text-base">{team.score.toFixed(1)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-700">{team.daysActive}</td>
                  <td className="px-5 py-4">
                    {team.absentList.length > 0 ? (
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 max-w-xs">
                        {team.absentList.join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {team.missingDates.length > 0 ? (
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200 max-w-xs">
                        {team.missingDates.join(", ")}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Leaderboard */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
            <span className="p-1.5 bg-blue-100 rounded-lg text-blue-700 text-base">👤</span>
            Individual Leaderboard
          </h2>
          <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200">
            {reportData.individualLeaderboard.length} Students
          </span>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
              <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Rank</th>
                <th className="px-5 py-3.5">Roll</th>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Team</th>
                <th className="px-5 py-3.5 text-right">Cups Sold</th>
                <th className="px-5 py-3.5 text-right">Packets Sold</th>
                <th className="px-5 py-3.5 text-right text-red-600">Missing Reports</th>
                <th className="px-5 py-3.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {reportData.individualLeaderboard.map((ind: any, idx: number) => (
                <tr key={ind.roll} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-500">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-300">{idx + 1}</span>
                  </td>
                  <td className="px-5 py-4 text-emerald-700 font-mono font-bold">{ind.roll}</td>
                  <td className="px-5 py-4 font-bold text-slate-900">{ind.name}</td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{ind.team}</td>
                  <td className="px-5 py-4 text-right text-slate-700 font-medium">{ind.cups}</td>
                  <td className="px-5 py-4 text-right text-slate-700 font-medium">{ind.packets}</td>
                  <td className="px-5 py-4 text-right">
                    {ind.missingDates.length > 0 ? (
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200 max-w-xs">
                        {ind.missingDates.join(", ")}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">None</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-blue-700 text-base">{ind.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaderboardBarCharts
          teamLeaderboard={reportData.teamLeaderboard}
          individualLeaderboard={reportData.individualLeaderboard}
        />
      </div>

    </div>
  );
}
