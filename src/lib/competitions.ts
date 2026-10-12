// Shared competition helpers. Pure functions only — imported by both API
// routes and client components.

export type GroupMember = { roll: string; name: string; isLeader?: boolean; isDeputy?: boolean };
export type TeamRole = "leader" | "deputy" | "member";

export interface GroupLike {
    id: string;
    groupName: string;
    members: unknown;
}

export interface SubmissionLike {
    type: string;
    teamName?: string | null;
    groupId?: string | null;
    rollNumber: string;
    reportDate?: string | null;
    submittedAt: string | Date;
    data: any;
}

const REPORT_TIMEZONE = "Asia/Dhaka";

/** YYYY-MM-DD of an instant in the portal's reporting timezone. */
export function toReportDate(d: Date | string = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIMEZONE }).format(new Date(d));
}

export const isValidReportDate = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/** dd Mon yyyy for a YYYY-MM-DD string, without timezone drift. */
export function formatReportDate(v: string): string {
    const [y, m, d] = v.split("-").map(Number);
    if (!y || !m || !d) return v;
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** The form's own date question, if it has one — it doubles as the report date. */
export function getDateFieldId(schema: any): string | null {
    const field = (Array.isArray(schema) ? schema : []).find((f: any) => f?.type === "date");
    return field ? String(field.id) : null;
}

/**
 * The day a submission counts for: the explicit report date, else the form's
 * date answer, else the day it was submitted (legacy public-form rows).
 */
export function effectiveReportDate(sub: Pick<SubmissionLike, "reportDate" | "submittedAt" | "data">, schema: any): string {
    if (isValidReportDate(sub.reportDate)) return sub.reportDate;
    const dateField = getDateFieldId(schema);
    const answered = dateField ? sub.data?.[dateField] : null;
    if (isValidReportDate(answered)) return answered;
    return toReportDate(sub.submittedAt);
}

export function groupMembers(group: Pick<GroupLike, "members"> | null | undefined): GroupMember[] {
    return Array.isArray(group?.members) ? (group!.members as GroupMember[]) : [];
}

export function findGroupForRoll<G extends GroupLike>(groups: G[], roll: string): G | null {
    return groups.find((g) => groupMembers(g).some((m) => String(m.roll) === String(roll))) ?? null;
}

export function teamRoleOf(group: Pick<GroupLike, "members"> | null | undefined, roll: string): TeamRole | null {
    const me = groupMembers(group).find((m) => String(m.roll) === String(roll));
    if (!me) return null;
    return me.isLeader ? "leader" : me.isDeputy ? "deputy" : "member";
}

/** Only the leader and deputy leader may file the team's report. */
export const canSubmitForTeam = (role: TeamRole | null) => role === "leader" || role === "deputy";

/** Team rows carry groupId when filed from the portal; legacy rows only have the name. */
export function isTeamSubmissionOf(sub: SubmissionLike, group: GroupLike): boolean {
    if (sub.type !== "team") return false;
    if (sub.groupId) return sub.groupId === group.id;
    return (sub.teamName || "").trim() === group.groupName.trim();
}

/** Returns an error message, or null when the answer is acceptable. */
export function validateField(field: any, value: any): string | null {
    if (field.type === "repeater") {
        if (field.required && (!value || value.length === 0)) return `${field.label} is required. Please add at least one item.`;
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                for (const sub of field.subFields || []) {
                    const v = value[i]?.[sub.id];
                    if (sub.required && !v) return `${field.label} (Item ${i + 1}): ${sub.label} is required.`;
                    if (v && sub.validation === "bd_mobile" && !/^01[3-9]\d{8}$/.test(v)) {
                        return `${field.label} (Item ${i + 1}): ${sub.label} must be a valid 11-digit BD mobile number.`;
                    }
                }
            }
        }
        return null;
    }

    if (field.required && !value && value !== 0) return `${field.label} is required.`;
    if (value && field.validation === "number" && isNaN(Number(value))) return `${field.label} must be a number.`;
    if (value && field.validation === "bd_mobile" && !/^01[3-9]\d{8}$/.test(value)) {
        return `${field.label} must be a valid 11-digit Bangladeshi mobile number starting with 0.`;
    }
    return null;
}

export function validateFormData(schema: any, data: Record<string, any>): string | null {
    for (const field of Array.isArray(schema) ? schema : []) {
        const error = validateField(field, data?.[field.id]);
        if (error) return error;
    }
    return null;
}

/** Keeps only answers to questions the form actually asks. */
export function pickSchemaData(schema: any, data: any): Record<string, any> {
    const out: Record<string, any> = {};
    for (const field of Array.isArray(schema) ? schema : []) {
        if (data && data[field.id] !== undefined) out[field.id] = data[field.id];
    }
    return out;
}

/** Human-readable answer for tables and exports. */
export function formatAnswer(field: any, value: any): string {
    if (value === undefined || value === null || value === "") return "";
    if (field.type === "repeater" && Array.isArray(value)) {
        return value
            .map((item: any, i: number) => {
                const parts = (field.subFields || []).map((sf: any) => `${sf.label}: ${item?.[sf.id] || "N/A"}`);
                return `[${i + 1}] ${parts.join(", ")}`;
            })
            .join("\n");
    }
    return String(value);
}

export const isNumericField = (field: any) =>
    field.type === "short_text" && field.validation === "number";

// ── Procurement ──────────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "due" | "partial";

export interface ProcurementLike {
    groupId: string;
    groupName: string;
    quantity: number;
    totalAmount: number;
    paidAmount: number;
}

export const roundMoney = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** What is still owed on a procurement; never negative. */
export const procurementDue = (totalAmount: number, paidAmount: number) =>
    roundMoney(Math.max(0, roundMoney(totalAmount) - roundMoney(paidAmount)));

export function paymentStatusOf(totalAmount: number, paidAmount: number): PaymentStatus {
    if (procurementDue(totalAmount, paidAmount) === 0) return "paid";
    return roundMoney(paidAmount) <= 0 ? "due" : "partial";
}

export interface ProcurementTotals {
    quantity: number;
    total: number;
    paid: number;
    due: number;
}

export function procurementTotals(entries: ProcurementLike[]): ProcurementTotals {
    const t = entries.reduce(
        (acc, e) => ({
            quantity: acc.quantity + e.quantity,
            total: acc.total + e.totalAmount,
            paid: acc.paid + e.paidAmount,
            due: acc.due + procurementDue(e.totalAmount, e.paidAmount),
        }),
        { quantity: 0, total: 0, paid: 0, due: 0 }
    );
    return { quantity: t.quantity, total: roundMoney(t.total), paid: roundMoney(t.paid), due: roundMoney(t.due) };
}

/** Per-team totals, in team-name order. */
export function procurementByTeam(entries: ProcurementLike[]): (ProcurementTotals & { groupId: string; groupName: string })[] {
    const byTeam = new Map<string, ProcurementLike[]>();
    entries.forEach((e) => byTeam.set(e.groupId, [...(byTeam.get(e.groupId) || []), e]));
    return Array.from(byTeam.entries())
        .map(([groupId, rows]) => ({ groupId, groupName: rows[0].groupName, ...procurementTotals(rows) }))
        .sort((a, b) => a.groupName.localeCompare(b.groupName, undefined, { numeric: true }));
}

export const formatTaka = (n: number) => `৳${roundMoney(n).toLocaleString("en-US")}`;
