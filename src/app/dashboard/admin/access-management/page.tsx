"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    PERMISSION_META,
    PERMISSION_GROUPS,
    PermissionKey,
    DEFAULT_TEACHER_PERMISSIONS,
    DEFAULT_ADMIN_PERMISSIONS,
    TEACHER_FEATURE_PERMISSIONS,
    PORTAL_OWNER_EMAIL,
} from "@/lib/permissions";

type RoleLabel = "teacher" | "admin" | "admin_teacher";

interface ManagedUser {
    id: string;
    email: string;
    displayName: string;
    role: string;
    displayRole: string;
    isPortalOwner: boolean;
    permissions: string[];
}

const DISPLAY_ROLE_BADGE: Record<string, string> = {
    "Super Admin":       "bg-purple-100 text-purple-700 border border-purple-200",
    "Admin + Teacher":   "bg-indigo-100 text-indigo-700 border border-indigo-200",
    "Admin":             "bg-blue-100   text-blue-700   border border-blue-200",
    "Teacher":           "bg-green-100  text-green-700  border border-green-200",
};

const ROLE_OPTIONS: { label: RoleLabel; display: string; icon: string; desc: string }[] = [
    { label: "teacher",       display: "Teacher",         icon: "👤", desc: "Teacher features only" },
    { label: "admin",         display: "Admin",           icon: "⚙️", desc: "Admin access, no teacher features by default" },
    { label: "admin_teacher", display: "Admin + Teacher", icon: "⚙️👤", desc: "Admin + all teacher features" },
];

export default function AccessManagementPage() {
    const { userProfile } = useAuth();
    const [users, setUsers]             = useState<ManagedUser[]>([]);
    const [loading, setLoading]         = useState(true);
    const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
    const [editPerms, setEditPerms]     = useState<Set<string>>(new Set());
    const [editRoleLabel, setEditRoleLabel] = useState<RoleLabel>("teacher");
    const [saving, setSaving]           = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRole, setFilterRole]   = useState<"all" | "teacher" | "admin" | "admin_teacher">("all");

    const isAuthorized = userProfile?.role === "super_admin" || userProfile?.role === "admin";

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/access-management");
            if (res.ok) setUsers(await res.json());
        } finally {
            setLoading(false);
        }
    };

    const openUser = (u: ManagedUser) => {
        setSelectedUser(u);
        // Derive initial role label from displayRole
        const label: RoleLabel =
            u.displayRole === "Admin + Teacher" ? "admin_teacher"
            : u.displayRole === "Admin"          ? "admin"
            : "teacher";
        setEditRoleLabel(label);
        setEditPerms(new Set(u.permissions));
    };

    // When role label button is clicked: set role + apply default permissions
    const handleRoleLabelClick = (label: RoleLabel) => {
        setEditRoleLabel(label);
        if (label === "teacher")       setEditPerms(new Set(DEFAULT_TEACHER_PERMISSIONS));
        else if (label === "admin")    setEditPerms(new Set(DEFAULT_ADMIN_PERMISSIONS));
        else /* admin_teacher */       setEditPerms(new Set([...DEFAULT_ADMIN_PERMISSIONS, ...TEACHER_FEATURE_PERMISSIONS]));
    };

    const togglePermission = (key: PermissionKey) => {
        setEditPerms(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleGroup = (keys: PermissionKey[], on: boolean) => {
        setEditPerms(prev => {
            const next = new Set(prev);
            if (on) keys.forEach(k => next.add(k));
            else    keys.forEach(k => next.delete(k));
            return next;
        });
    };

    const resetToOriginal = () => {
        if (!selectedUser) return;
        const label: RoleLabel =
            selectedUser.displayRole === "Admin + Teacher" ? "admin_teacher"
            : selectedUser.displayRole === "Admin"          ? "admin"
            : "teacher";
        setEditRoleLabel(label);
        setEditPerms(new Set(selectedUser.permissions));
    };

    const saveChanges = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/access-management", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId:      selectedUser.id,
                    roleLabel:   editRoleLabel,
                    permissions: Array.from(editPerms),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save.");

            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id
                    ? { ...u, role: data.role, displayRole: data.displayRole, permissions: data.permissions }
                    : u
            ));
            setSelectedUser(null);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to save.");
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const q = searchQuery.toLowerCase();
        const matchSearch = u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchRole =
            filterRole === "all"
            || (filterRole === "teacher"       && u.displayRole === "Teacher")
            || (filterRole === "admin"         && u.displayRole === "Admin")
            || (filterRole === "admin_teacher" && u.displayRole === "Admin + Teacher");
        return matchSearch && matchRole;
    });

    if (!isAuthorized) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
                    <p className="text-gray-500">Only Department Admins and Super Admins can manage access.</p>
                    <p className="text-sm text-gray-400 mt-1">এই পেজটি শুধুমাত্র আপনার নিজের Department-এর জন্য — অন্য Department-এর ইউজার দেখা বা পরিবর্তন করা যাবে না।</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-1 h-10 bg-purple-600 rounded-full" />
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Access Management</h1>
                    <p className="text-gray-500 mt-1">Role ও পেইজ-এক্সেস নিয়ন্ত্রণ করুন — শুধু আপনার নিজের Department/Course-এর ইউজাররা এখানে দেখাবে</p>
                </div>
            </div>

            {/* Portal Owner Notice */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">👑</span>
                <div>
                    <p className="font-semibold text-purple-800">Portal Owner Protection Active</p>
                    <p className="text-sm text-purple-600 mt-0.5">
                        <strong>Abul Hayat</strong> ({PORTAL_OWNER_EMAIL}) — Permanent Super Admin।
                        এই অ্যাকাউন্ট কেউ modify করতে পারবে না।
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    placeholder="নাম বা ইমেইল দিয়ে খুঁজুন..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                    {(["all", "teacher", "admin", "admin_teacher"] as const).map(r => {
                        const label = r === "all" ? "সবাই" : r === "teacher" ? "Teacher" : r === "admin" ? "Admin" : "Admin+Teacher";
                        const count = r === "all" ? users.length
                            : r === "teacher"       ? users.filter(u => u.displayRole === "Teacher").length
                            : r === "admin"         ? users.filter(u => u.displayRole === "Admin").length
                            : users.filter(u => u.displayRole === "Admin + Teacher").length;
                        return (
                            <button
                                key={r}
                                onClick={() => setFilterRole(r)}
                                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                    filterRole === r
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                                }`}
                            >
                                {label} <span className="opacity-70">({count})</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* User Grid */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
                    <p className="mt-3 text-gray-500">লোড হচ্ছে...</p>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">কোনো ব্যবহারকারী পাওয়া যায়নি</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map(u => (
                        <div
                            key={u.id}
                            onClick={() => !u.isPortalOwner && openUser(u)}
                            className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${
                                u.isPortalOwner
                                    ? "border-purple-200 cursor-default"
                                    : "border-gray-200 cursor-pointer hover:shadow-md hover:border-purple-300 active:scale-[0.99]"
                            }`}
                        >
                            {/* Avatar + name */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                                    {u.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-gray-900 text-sm truncate">{u.displayName}</span>
                                        {u.isPortalOwner && <span>👑</span>}
                                    </div>
                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DISPLAY_ROLE_BADGE[u.displayRole] || "bg-gray-100 text-gray-600"}`}>
                                    {u.displayRole}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {u.isPortalOwner ? "All access" : `${u.permissions.length} পেইজ`}
                                </span>
                            </div>

                            {!u.isPortalOwner && (
                                <div className="mt-3 pt-3 border-t border-gray-100 text-right">
                                    <span className="text-xs font-semibold text-purple-600">Edit Access →</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Edit Modal ─────────────────────────────────────── */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                                    {selectedUser.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{selectedUser.displayName}</h2>
                                    <p className="text-xs text-gray-400">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 mt-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {/* ── Role Selector ── */}
                            <div className="px-5 pt-4 pb-4 border-b border-gray-100 bg-gray-50">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Role নির্বাচন করুন</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {ROLE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.label}
                                            onClick={() => handleRoleLabelClick(opt.label)}
                                            className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                                                editRoleLabel === opt.label
                                                    ? opt.label === "teacher"
                                                        ? "border-green-500 bg-green-50 text-green-700"
                                                        : opt.label === "admin"
                                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                                            : "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                            }`}
                                        >
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="text-xs font-bold leading-tight text-center">{opt.display}</span>
                                            {editRoleLabel === opt.label && (
                                                <span className="text-xs font-normal opacity-60 text-center leading-tight mt-0.5">
                                                    বর্তমান
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-400">
                                    ⚠️ Role পরিবর্তন করলে default permissions সেট হবে — নিচে কাস্টমাইজ করুন
                                </p>
                            </div>

                            {/* ── Permission Presets ── */}
                            <div className="px-5 pt-3 pb-2">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Quick Presets (permission only)</p>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setEditPerms(new Set(DEFAULT_TEACHER_PERMISSIONS))} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-medium">
                                        Teacher Defaults
                                    </button>
                                    <button onClick={() => setEditPerms(new Set(DEFAULT_ADMIN_PERMISSIONS))} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium">
                                        Admin Defaults
                                    </button>
                                    <button onClick={() => setEditPerms(new Set([...DEFAULT_ADMIN_PERMISSIONS, ...TEACHER_FEATURE_PERMISSIONS]))} className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium">
                                        Admin + Teacher
                                    </button>
                                    <button onClick={() => setEditPerms(new Set())} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium">
                                        ✕ সব বাদ
                                    </button>
                                    <button onClick={resetToOriginal} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium">
                                        ↩️ Reset
                                    </button>
                                </div>
                            </div>

                            {/* ── Permission Groups ── */}
                            <div className="px-5 pb-5 space-y-4 mt-1">
                                {PERMISSION_GROUPS.map(group => {
                                    const visibleKeys = (Object.keys(PERMISSION_META) as PermissionKey[])
                                        .filter(k => PERMISSION_META[k].group === group.key)
                                        .filter(k => k !== "access_management" || editRoleLabel !== "teacher");
                                    if (visibleKeys.length === 0) return null;

                                    const allChecked  = visibleKeys.every(k => editPerms.has(k));
                                    const someChecked = visibleKeys.some(k => editPerms.has(k));

                                    return (
                                        <div key={group.key}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{group.label}</p>
                                                    {someChecked && !allChecked && (
                                                        <span className="text-xs text-amber-500">
                                                            ({visibleKeys.filter(k => editPerms.has(k)).length}/{visibleKeys.length})
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={() => toggleGroup(visibleKeys, !allChecked)} className="text-xs text-purple-600 hover:underline font-medium">
                                                    {allChecked ? "সব বাদ" : "সব দিন"}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {visibleKeys.map(key => {
                                                    const meta    = PERMISSION_META[key];
                                                    const checked = editPerms.has(key);
                                                    return (
                                                        <label key={key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                                                            checked ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => togglePermission(key)}
                                                                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 flex-shrink-0"
                                                            />
                                                            <span className="text-base">{meta.icon}</span>
                                                            <span className={`text-sm font-medium leading-tight ${checked ? "text-green-800" : "text-gray-600"}`}>
                                                                {meta.label}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
                            <div className="text-sm text-gray-600">
                                Role:{" "}
                                <span className={`font-bold ${
                                    editRoleLabel === "teacher"       ? "text-green-700"
                                    : editRoleLabel === "admin"       ? "text-blue-700"
                                    : "text-indigo-700"
                                }`}>
                                    {editRoleLabel === "teacher" ? "Teacher" : editRoleLabel === "admin" ? "Admin" : "Admin + Teacher"}
                                </span>
                                <span className="text-gray-400 mx-1">·</span>
                                <span className="text-gray-500">{editPerms.size} পেইজের এক্সেস</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium text-sm">
                                    বাতিল
                                </button>
                                <button onClick={saveChanges} disabled={saving} className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold text-sm disabled:opacity-50">
                                    {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
