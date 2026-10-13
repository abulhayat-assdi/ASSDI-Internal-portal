import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
    ALL_PERMISSION_KEYS,
    DEFAULT_ADMIN_PERMISSIONS,
    PERMISSION_META,
    UNREGISTERED_PAGE,
    getRequiredPermission,
} from "./permissions";

const DASHBOARD_DIR = join(process.cwd(), "src", "app", "dashboard");

function pagePaths(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) pagePaths(full, out);
        else if (name === "page.tsx") {
            const rel = relative(DASHBOARD_DIR, dir).split(sep).join("/");
            out.push("/dashboard" + (rel ? "/" + rel : ""));
        }
    }
    return out;
}

describe("dashboard page permissions", () => {
    it("every dashboard page is registered in PERMISSION_META or explicitly open", () => {
        const unregistered = pagePaths(DASHBOARD_DIR).filter(
            (p) => getRequiredPermission(p.replace(/\[[^\]]+\]/g, "x")) === UNREGISTERED_PAGE,
        );
        // A page listed here has no permission of its own. Register it in
        // PERMISSION_META (src/lib/permissions.ts) so it gets its own checkbox
        // in Access Management.
        expect(unregistered).toEqual([]);
    });

    it("Admin Panel no longer covers other admin pages", () => {
        expect(getRequiredPermission("/dashboard/admin")).toBe("admin_panel");
        expect(getRequiredPermission("/dashboard/admin/cv-manager")).toBe("admin_cv");
        expect(getRequiredPermission("/dashboard/admin/batch-forms")).toBe("admin_batch_forms");
        expect(getRequiredPermission("/dashboard/admin/user-management")).toBe("admin_user_management");
        expect(getRequiredPermission("/dashboard/settings/branding")).toBe("admin_branding");
        expect(getRequiredPermission("/dashboard/competitions/abc/report")).toBe("admin_competitions");
        expect(getRequiredPermission("/dashboard/admin/some-new-page")).toBe(UNREGISTERED_PAGE);
    });

    it("every key has a path and new admin keys are in the admin defaults", () => {
        for (const k of ALL_PERMISSION_KEYS) expect(PERMISSION_META[k].path).toMatch(/^\/dashboard/);
        for (const k of ["admin_competitions", "admin_cv", "admin_batch_forms", "admin_branding", "admin_user_management"] as const) {
            expect(DEFAULT_ADMIN_PERMISSIONS).toContain(k);
        }
    });
});
