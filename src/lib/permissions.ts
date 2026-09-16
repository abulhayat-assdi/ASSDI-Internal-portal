// ============================================================
// As-Sunnah Skill Development Institute — Permission System
// ============================================================

export const PORTAL_OWNER_EMAIL = "mohammadabulhayatt@gmail.com";

export type PermissionKey =
    | "schedule"
    | "routine"
    | "batch_info"
    | "resources"
    | "course_modules"
    | "policies"
    | "feedback"
    | "homework"
    | "leave_tracking"
    | "teachers"
    | "admin_panel"
    | "admin_homework"
    | "admin_results"
    | "admin_leave"
    | "admin_notices"
    | "admin_contact"
    | "admin_resources"
    | "admin_course_modules"
    | "admin_deployments"
    | "access_management"
    | "typing_game_teacher"
    | "admin_typing_game"
    | "typing_exam";

export type PermissionGroup = "teacher" | "management" | "admin" | "system";

export interface PermissionMeta {
    label: string;
    path: string;
    group: PermissionGroup;
    icon: string;
}

export const PERMISSION_META: Record<PermissionKey, PermissionMeta> = {
    schedule: { label: "Class Schedule", path: "/dashboard/schedule", group: "teacher", icon: "📅" },
    routine: { label: "Manage Routine", path: "/dashboard/manage-routine", group: "teacher", icon: "📆" },
    batch_info: { label: "All Batch Info", path: "/dashboard/all-batch-info", group: "teacher", icon: "📊" },
    resources: { label: "Resource Library", path: "/dashboard/resources", group: "teacher", icon: "🗂️" },
    course_modules: { label: "Course Modules", path: "/dashboard/course-modules", group: "teacher", icon: "📚" },
    policies: { label: "Policy & Minutes", path: "/dashboard/policies", group: "teacher", icon: "📋" },
    feedback: { label: "Feedback", path: "/dashboard/feedback", group: "teacher", icon: "💬" },
    homework: { label: "Homework", path: "/dashboard/homework", group: "teacher", icon: "📝" },
    leave_tracking: { label: "Leave Tracking", path: "/dashboard/leave-tracking", group: "teacher", icon: "🌴" },
    teachers: { label: "Teacher Directory", path: "/dashboard/teachers", group: "management", icon: "👥" },
    admin_panel: { label: "Admin Panel", path: "/dashboard/admin", group: "admin", icon: "⚙️" },
    admin_homework: { label: "Manage Homework", path: "/dashboard/admin/manage-homework", group: "admin", icon: "📁" },
    admin_results: { label: "Manage Results", path: "/dashboard/admin/manage-results", group: "admin", icon: "📝" },
    admin_leave: { label: "Manage Leaves", path: "/dashboard/admin/leave-management", group: "admin", icon: "🌴" },
    admin_notices: { label: "Student Notices", path: "/dashboard/admin/student-updates", group: "admin", icon: "🔔" },
    admin_contact: { label: "Contact Messages", path: "/dashboard/admin/contact-messages", group: "admin", icon: "📩" },
    admin_resources: { label: "Admin: Resources", path: "/dashboard/admin/resource-management", group: "admin", icon: "🗂️" },
    admin_course_modules: { label: "Manage Course Modules", path: "/dashboard/admin/course-modules", group: "admin", icon: "📚" },
    admin_deployments: { label: "Student Deployments", path: "/dashboard/admin/deployments", group: "admin", icon: "🚀" },
    access_management: { label: "Access Management", path: "/dashboard/admin/access-management", group: "system", icon: "🔑" },
    typing_game_teacher: { label: "Typing Adventure (Teacher)", path: "/dashboard/typing-game/teacher", group: "teacher", icon: "⌨️" },
    admin_typing_game: { label: "Typing Adventure (Admin)", path: "/dashboard/typing-game/admin", group: "admin", icon: "⌨️" },
    typing_exam: { label: "Typing Test Exam", path: "/dashboard/typing-exam", group: "teacher", icon: "📝" },
};

export const PERMISSION_GROUPS: { key: PermissionGroup; label: string }[] = [
    { key: "teacher", label: "Teacher Features" },
    { key: "management", label: "Management" },
    { key: "admin", label: "Admin Features" },
    { key: "system", label: "System" },
];

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_META) as PermissionKey[];

// Special marker stored in the permissions array to indicate the explicit role label.
// Never used as an actual page permission — always filtered out from access checks.
export const ADMIN_TEACHER_MARKER = "__role:admin_teacher";

// Default permissions assigned to a newly created teacher.
// typing_game_teacher (Typing Adventure Teacher Console, incl. mission
// creation) is deliberately excluded — an admin must opt a teacher in
// explicitly via Access Management, it is not granted by default.
export const DEFAULT_TEACHER_PERMISSIONS: PermissionKey[] = [
    "schedule", "routine", "batch_info", "resources", "course_modules",
    "policies", "feedback", "homework", "leave_tracking",
    "teachers", "admin_results", "typing_exam",
];

// Default admin permissions (management/admin pages only — no teacher features)
// Includes access_management so a Department Admin (admin role scoped to its
// courseId) can manage users/roles within its own department without
// needing Super Admin intervention. Super Admin still retains platform-wide
// control via admin.tasm-skill.asf.bd.
export const DEFAULT_ADMIN_PERMISSIONS: PermissionKey[] = [
    "teachers", "batch_info",
    "admin_panel", "admin_homework", "admin_results", "admin_leave",
    "admin_notices", "admin_contact", "admin_resources", "admin_course_modules",
    "admin_deployments", "admin_typing_game", "typing_exam",
    "access_management",
];

// Teacher-feature permissions added to admin when "Include teacher features" is checked
export const TEACHER_FEATURE_PERMISSIONS: PermissionKey[] = [
    "schedule", "routine", "resources", "course_modules",
    "policies", "feedback", "homework", "leave_tracking",
    "typing_game_teacher", "typing_exam",
];

/** Strip internal metadata markers — only real page keys remain. */
function stripMarkers(perms: string[]): string[] {
    return perms.filter((p) => !p.startsWith("__"));
}

/**
 * Returns effective page permissions for a user.
 * null/empty means role defaults apply (backward compatibility).
 * Internal __markers are always excluded from the result.
 */
export function getEffectivePermissions(
    role: string,
    storedPermissions: string[] | null | undefined
): string[] {
    if (role === "super_admin") return ALL_PERMISSION_KEYS;
    if (!storedPermissions || storedPermissions.length === 0) {
        if (role === "admin") return DEFAULT_ADMIN_PERMISSIONS;
        if (role === "teacher") return DEFAULT_TEACHER_PERMISSIONS;
        return [];
    }
    return stripMarkers(storedPermissions);
}

/**
 * Determine the display role label from DB role + stored permissions.
 * "Admin + Teacher" is stored via ADMIN_TEACHER_MARKER in the permissions array.
 */
export function getDisplayRoleLabel(role: string, storedPermissions: string[] | null | undefined): string {
    if (role === "super_admin") return "Super Admin";
    if (role === "admin" && storedPermissions?.includes(ADMIN_TEACHER_MARKER)) return "Admin + Teacher";
    if (role === "admin") return "Admin";
    return "Teacher";
}

/**
 * Check if a user has a specific permission.
 * Super admins always pass.
 */
export function hasPermission(
    role: string,
    storedPermissions: string[] | null | undefined,
    permission: PermissionKey
): boolean {
    if (role === "super_admin") return true;
    const effective = getEffectivePermissions(role, storedPermissions);
    return effective.includes(permission);
}
