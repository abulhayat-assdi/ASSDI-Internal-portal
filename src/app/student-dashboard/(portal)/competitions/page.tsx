"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CompetitionItem {
  id: string;
  title: string;
  description: string | null;
  batchName: string;
  isActive: boolean;
}

const ROLE_LABEL: Record<string, string> = { leader: "Team Leader", deputy: "Deputy Leader", member: "Member" };

export default function StudentCompetitionsPage() {
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [team, setTeam] = useState<{ groupName: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/competitions")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
        setTeam(data.team || null);
      })
      .catch(() => setError("Could not load competitions. Please refresh the page."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏆 Competitions</h1>
          <p className="text-sm text-slate-500 mt-1">Submit your daily report and see your own and your team&apos;s data.</p>
        </div>
        {team ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Your Team</p>
            <p className="font-bold text-slate-900">
              {team.groupName} <span className="font-semibold text-emerald-700">· {ROLE_LABEL[team.role] || "Member"}</span>
            </p>
          </div>
        ) : (
          !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-900 font-medium">
              You are not in a team yet.
            </div>
          )
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600 mb-2"></div>
          <p className="text-sm">Loading competitions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-5 text-sm font-medium">{error}</div>
      ) : competitions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-12 text-center text-slate-500">
          <p className="text-base font-medium">No competition is running for your batch right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              href={`/student-dashboard/competitions/${comp.id}`}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">{comp.title}</h2>
                <span
                  className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                    comp.isActive ? "bg-green-100 text-green-800 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {comp.isActive ? "Running" : "Ended"}
                </span>
              </div>
              {comp.description && <p className="text-sm text-slate-500 line-clamp-2">{comp.description}</p>}
              <span className="mt-auto text-sm font-bold text-emerald-700">
                {comp.isActive ? "Open form & my data →" : "View my data →"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
