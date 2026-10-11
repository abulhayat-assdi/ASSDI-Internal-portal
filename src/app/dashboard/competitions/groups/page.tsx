"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

interface Student {
  roll: string;
  name: string;
}

const memberRank = (m: { isLeader?: boolean; isDeputy?: boolean }) => (m.isLeader ? 0 : m.isDeputy ? 1 : 2);

interface Group {
  id: string;
  groupName: string;
  batchName: string;
  members: { roll: string; name: string; isLeader?: boolean; isDeputy?: boolean }[];
  createdAt: string;
}

export default function CompetitionGroupsPage() {
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal state for Create / Edit Group
  const [showModal, setShowModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedRolls, setSelectedRolls] = useState<string[]>([]);
  const [leaderRoll, setLeaderRoll] = useState<string>("");
  const [deputyRoll, setDeputyRoll] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Custom Delete Confirmation Modal State
  const [deleteTargetGroup, setDeleteTargetGroup] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetchBatchStudents(selectedBatch);
      fetchGroups(selectedBatch);
    } else {
      setStudents([]);
      setGroups([]);
    }
  }, [selectedBatch]);

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batch-info?all=true");
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.data || []);
        const uniqueNames = Array.from(new Set(rawList.map((b: any) => b.batchName))).filter(Boolean) as string[];
        uniqueNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
        setBatches(uniqueNames);
        if (uniqueNames.length > 0) {
          setSelectedBatch(uniqueNames[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBatchStudents = async (bName: string) => {
    try {
      const res = await fetch(`/api/batch-info?batchName=${encodeURIComponent(bName)}&public=true`);
      if (res.ok) {
        const stds = await res.json();
        setStudents(Array.isArray(stds) ? stds : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGroups = async (bName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitions/groups?batchName=${encodeURIComponent(bName)}`);
      if (res.ok) {
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      toast.error("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingGroupId(null);
    setGroupName("");
    setSelectedRolls([]);
    setLeaderRoll("");
    setDeputyRoll("");
    setShowModal(true);
  };

  const handleOpenEditModal = (group: Group) => {
    setEditingGroupId(group.id);
    setGroupName(group.groupName);
    setSelectedRolls(group.members.map(m => m.roll));
    setLeaderRoll(group.members.find(m => m.isLeader)?.roll || "");
    setDeputyRoll(group.members.find(m => m.isDeputy)?.roll || "");
    setShowModal(true);
  };

  // Roll -> name of the *other* group that already holds it. A student can be
  // in only one group per batch, so these are hidden from the picker.
  const takenRolls = new Map<string, string>();
  groups.forEach(g => {
    if (g.id === editingGroupId) return;
    g.members.forEach(m => takenRolls.set(m.roll, g.groupName));
  });
  // Own members stay visible even if (legacy data) they are also in another
  // group, so the admin can untick them.
  const availableStudents = students.filter(
    s => !takenRolls.has(s.roll) || selectedRolls.includes(s.roll)
  );
  const allSelected = availableStudents.length > 0 && availableStudents.every(s => selectedRolls.includes(s.roll));

  const toggleRollSelect = (roll: string) => {
    if (selectedRolls.includes(roll) && roll === leaderRoll) setLeaderRoll("");
    if (selectedRolls.includes(roll) && roll === deputyRoll) setDeputyRoll("");
    setSelectedRolls(prev =>
      prev.includes(roll) ? prev.filter(r => r !== roll) : [...prev, roll]
    );
  };

  const selectAllRolls = () => {
    if (allSelected) {
      setSelectedRolls([]);
      setLeaderRoll("");
      setDeputyRoll("");
    } else {
      setSelectedRolls(availableStudents.map(s => s.roll));
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      return toast.error("Please enter a Group Name");
    }
    if (!selectedBatch) {
      return toast.error("Please select a Batch");
    }

    setIsSaving(true);
    try {
      const members = selectedRolls.map(roll => {
        const std = students.find(s => s.roll === roll);
        return { roll, name: std?.name || "" };
      });

      const res = await fetch("/api/competitions/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGroupId,
          batchName: selectedBatch,
          groupName: groupName.trim(),
          members,
          leaderRoll,
          deputyRoll,
        }),
      });

      if (res.ok) {
        toast.success(editingGroupId ? "Group updated successfully!" : "Group created successfully!");
        setShowModal(false);
        fetchGroups(selectedBatch);
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to save group");
      }
    } catch (e) {
      toast.error("Error saving group");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteTargetGroup) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/competitions/groups?id=${deleteTargetGroup.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(`Group "${deleteTargetGroup.name}" deleted successfully`);
        setDeleteTargetGroup(null);
        fetchGroups(selectedBatch);
      } else {
        toast.error("Failed to delete group");
      }
    } catch (e) {
      toast.error("Error deleting group");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header with Navigation Link */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard/competitions" className="hover:text-emerald-600 font-medium">
              Competitions
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-medium">Group Management</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Batch Groups & Team List</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize students into groups per batch. Group names will automatically populate as team options in competition forms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/competitions"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
          >
            <span>←</span> Back to Competitions
          </Link>

          <button
            onClick={handleOpenCreateModal}
            disabled={!selectedBatch}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg shadow-sm font-semibold text-sm transition flex items-center gap-2"
          >
            <span>+</span> Create Group
          </button>
        </div>
      </div>

      {/* Batch Selection Card */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Select Batch to View Groups
          </label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full md:w-72 bg-slate-50 border border-slate-300 text-slate-800 px-4 py-2.5 rounded-lg font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {batches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {selectedBatch && (
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-semibold border border-emerald-200">
              Total Students: {students.length}
            </span>
            <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full font-semibold border border-blue-200">
              Total Groups: {groups.length}
            </span>
          </div>
        )}
      </div>

      {/* Group List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span>👥</span> Group List ({selectedBatch || "No Batch Selected"})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600 mb-2"></div>
            <p className="text-sm">Loading groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-base font-medium">No groups created for {selectedBatch || "this batch"}.</p>
            <p className="text-sm text-slate-400 mt-1">Click "Create Group" above to add team groups for students.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">#</th>
                  <th className="px-6 py-3.5">Group Name</th>
                  <th className="px-6 py-3.5">Members Count</th>
                  <th className="px-6 py-3.5">Student Rolls & Names</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {groups.map((group, idx) => (
                  <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-500">{idx + 1}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{group.groupName}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-700">
                      <span className="bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        {group.members.length} Members
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="flex flex-wrap gap-1.5">
                        {[...group.members].sort((a, b) => memberRank(a) - memberRank(b)).map((m) => (
                          <span
                            key={m.roll}
                            className={`px-2 py-0.5 rounded text-xs border font-medium inline-flex items-center gap-1.5 ${
                              m.isLeader
                                ? "bg-amber-50 text-amber-900 border-amber-300"
                                : m.isDeputy
                                  ? "bg-sky-50 text-sky-900 border-sky-300"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            <span><strong className="text-slate-900">{m.roll}</strong>: {m.name}</span>
                            {m.isLeader && (
                              <span className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-px rounded">
                                Leader
                              </span>
                            )}
                            {m.isDeputy && (
                              <span className="bg-sky-600 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-px rounded">
                                Deputy
                              </span>
                            )}
                          </span>
                        ))}
                        {group.members.length > 0 && !group.members.some(m => m.isLeader) && (
                          <span className="px-2 py-0.5 rounded text-xs border font-semibold bg-red-50 text-red-700 border-red-200">
                            ⚠ No leader — this team cannot submit team reports
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleOpenEditModal(group)}
                        className="text-blue-600 hover:text-blue-900 font-semibold text-xs bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTargetGroup({ id: group.id, name: group.groupName })}
                        className="text-red-600 hover:text-red-900 font-semibold text-xs bg-red-50 px-3 py-1.5 rounded-md border border-red-200 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Group */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editingGroupId ? "Edit Group" : "Create New Group"} ({selectedBatch})
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveGroup} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Group / Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Team Alpha, Falcons, Group 1"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Student Member Selector Grid */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Member Students ({selectedRolls.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={selectAllRolls}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableStudents.length === 0 && (
                    <p className="col-span-full text-center text-sm text-slate-500 py-6">
                      All students of this batch are already in a group.
                    </p>
                  )}
                  {availableStudents.map((student) => {
                    const isSelected = selectedRolls.includes(student.roll);
                    const isLeader = leaderRoll === student.roll;
                    const isDeputy = deputyRoll === student.roll;
                    const otherGroup = takenRolls.get(student.roll);
                    return (
                      <label
                        key={student.roll}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-sm cursor-pointer transition ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRollSelect(student.roll)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        <span className="font-mono text-xs text-emerald-700">{student.roll}</span>
                        <span className="truncate flex-1 min-w-0">
                          {student.name}
                          {otherGroup && (
                            <span className="block text-[11px] font-semibold text-red-600">Also in {otherGroup}</span>
                          )}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setLeaderRoll(isLeader ? "" : student.roll);
                                if (isDeputy) setDeputyRoll("");
                              }}
                              title={isLeader ? "Remove as leader" : "Make team leader"}
                              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border transition ${
                                isLeader
                                  ? "bg-amber-500 text-white border-amber-500"
                                  : "bg-white text-slate-500 border-slate-300 hover:border-amber-400 hover:text-amber-600"
                              }`}
                            >
                              {isLeader ? "★ Leader" : "Leader"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setDeputyRoll(isDeputy ? "" : student.roll);
                                if (isLeader) setLeaderRoll("");
                              }}
                              title={isDeputy ? "Remove as deputy leader" : "Make deputy leader"}
                              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border transition ${
                                isDeputy
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : "bg-white text-slate-500 border-slate-300 hover:border-sky-400 hover:text-sky-600"
                              }`}
                            >
                              {isDeputy ? "★ Deputy" : "Deputy"}
                            </button>
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Students already in another group are hidden. Mark one selected member as Leader and one as Deputy — only they can submit the team report.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold shadow-md transition"
                >
                  {isSaving ? "Saving..." : editingGroupId ? "Update Group" : "Save Group"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Group */}
      {deleteTargetGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Group</h3>
                <p className="text-xs text-slate-500">Confirm permanent deletion</p>
              </div>
            </div>

            <p className="text-sm text-slate-700">
              Are you sure you want to delete group <strong className="text-slate-900">"{deleteTargetGroup.name}"</strong>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetGroup(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteGroup}
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
