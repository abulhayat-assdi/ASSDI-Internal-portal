import { hasRequiredPermission, isAdmin, type JWTPayload } from "@/lib/auth";

/**
 * What a signed-in user may do with teacher class logs.
 *  - "all": an admin / super admin who has the teacher-attendance or report
 *    page — sees every teacher's classes and may enter, edit or delete for them.
 *  - "own": a teacher with the teacher-attendance page — only their own classes.
 *  - null: nothing.
 * An admin-role account without either page permission gets nothing, so the
 * data is never wider than the pages that show it.
 */
export function classLogAccess(user: JWTPayload): "all" | "own" | null {
    const hasPage = hasRequiredPermission(user, "teacher_attendance");
    if (isAdmin(user)) {
        return hasPage || hasRequiredPermission(user, "admin_teacher_class_report") ? "all" : null;
    }
    return hasPage ? "own" : null;
}
