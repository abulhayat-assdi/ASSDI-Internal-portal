"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface Competition {
  id: string;
  title: string;
  batchName: string;
  isActive: boolean;
  startDate: string;
  createdAt: string;
}

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Deleting Competition
  const [deleteTargetComp, setDeleteTargetComp] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [pendingCorrections, setPendingCorrections] = useState(0);

  useEffect(() => {
    fetchCompetitions();
    fetch("/api/competitions/corrections?count=pending")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setPendingCorrections(d?.pending || 0))
      .catch(() => {});
  }, []);

  const fetchCompetitions = async () => {
    try {
      const res = await fetch("/api/competitions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCompetitions(data);
    } catch (error) {
      toast.error("Error loading competitions");
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCompetition = async () => {
    if (!deleteTargetComp) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/competitions/${deleteTargetComp.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(`Competition "${deleteTargetComp.title}" deleted successfully`);
        setDeleteTargetComp(null);
        fetchCompetitions();
      } else {
        toast.error("Failed to delete competition");
      }
    } catch (e) {
      toast.error("Error deleting competition");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Competitions (Battle of Cups)</h1>
          <p className="text-sm text-slate-500 mt-1">Manage competitions, view live leaderboards, or edit competition forms. Students submit from the Competitions menu of their own portal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/competitions/corrections"
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md shadow transition text-sm font-semibold flex items-center gap-1.5"
          >
            <span>🛠</span> Correction Requests
            {pendingCorrections > 0 && (
              <span className="bg-white text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingCorrections}</span>
            )}
          </Link>
          <Link
            href="/dashboard/competitions/groups"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow transition text-sm font-semibold flex items-center gap-1.5"
          >
            <span>👥</span> Manage Groups / See Group List
          </Link>
          <Link
            href="/dashboard/competitions/create"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow transition text-sm font-semibold flex items-center gap-1.5"
          >
            <span>+</span> Create New
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : competitions.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          No competitions found. Create one to get started!
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {competitions.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{comp.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{comp.batchName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${comp.isActive ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                      {comp.isActive ? 'Active' : 'Ended'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(comp.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Link 
                      href={`/dashboard/competitions/${comp.id}/report`} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold transition inline-flex items-center gap-1"
                    >
                      <span>📊</span> Report
                    </Link>
                    <Link
                      href={`/dashboard/competitions/${comp.id}/procurement`}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold transition inline-flex items-center gap-1"
                    >
                      <span>🛒</span> Procurement
                    </Link>
                    <Link 
                      href={`/dashboard/competitions/${comp.id}/edit`} 
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold transition inline-flex items-center gap-1"
                    >
                      <span>✏️</span> Edit Form
                    </Link>
                    <Link 
                      href={`/competitions/${comp.id}/report`} 
                      target="_blank"
                      className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold transition inline-flex items-center gap-1"
                    >
                      <span>🌐</span> Public Report
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetComp({ id: comp.id, title: comp.title })}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold transition inline-flex items-center gap-1"
                    >
                      <span>🗑️</span> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTargetComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 p-6 space-y-4 font-sans">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Competition</h3>
                <p className="text-xs text-slate-500">Confirm permanent deletion</p>
              </div>
            </div>

            <p className="text-sm text-slate-700">
              Are you sure you want to delete competition <strong className="text-slate-900">"{deleteTargetComp.title}"</strong>? This will remove the form and all its submission reports.
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTargetComp(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCompetition}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold shadow-md transition"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
