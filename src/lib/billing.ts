/**
 * Course plan / billing state lives in Course.settings.billing (JSON) —
 * no DB migration needed to introduce or extend it.
 *
 *   settings: { ..., billing: {
 *     plan: 'trial' | 'monthly' | 'yearly' | 'lifetime' | 'custom',
 *     expiresAt: string | null,   // ISO date; null = never expires
 *     maxStudents: number | null, // null = unlimited
 *     maxTeachers: number | null, // null = unlimited
 *     notes: string,              // payment refs, bkash trx id, etc.
 *     updatedAt: string,
 *     updatedBy: string,          // super-admin email
 *   }}
 *
 * Enforcement points:
 *  - middleware (via isCourseUsable): expired plan ⇒ subdomain behaves as
 *    suspended (no access) until renewed.
 *  - POST /api/auth/register: student seat cap.
 *  - POST /api/admin/create-teacher: teacher seat cap.
 */

export type BillingPlan = 'trial' | 'monthly' | 'yearly' | 'lifetime' | 'custom';

export interface BillingState {
    plan: BillingPlan;
    expiresAt: string | null;
    maxStudents: number | null;
    maxTeachers: number | null;
    notes: string;
    updatedAt?: string;
    updatedBy?: string;
}

export const BILLING_PLANS: { value: BillingPlan; label: string }[] = [
    { value: 'trial', label: 'Trial' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'lifetime', label: 'Lifetime' },
    { value: 'custom', label: 'Custom' },
];

export function getBilling(settings: unknown): BillingState {
    const raw = (settings as { billing?: Partial<BillingState> } | null)?.billing ?? {};
    return {
        plan: (raw.plan as BillingPlan) || 'trial',
        expiresAt: raw.expiresAt ?? null,
        maxStudents: typeof raw.maxStudents === 'number' ? raw.maxStudents : null,
        maxTeachers: typeof raw.maxTeachers === 'number' ? raw.maxTeachers : null,
        notes: typeof raw.notes === 'string' ? raw.notes : '',
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy,
    };
}

/** Lifetime never expires; otherwise expired when expiresAt is in the past. */
export function isBillingExpired(settings: unknown, now = new Date()): boolean {
    const b = getBilling(settings);
    if (b.plan === 'lifetime') return false;
    if (!b.expiresAt) return false;
    return new Date(b.expiresAt).getTime() < now.getTime();
}

/** Days left until expiry (null = no expiry). Negative = overdue. */
export function billingDaysLeft(settings: unknown, now = new Date()): number | null {
    const b = getBilling(settings);
    if (b.plan === 'lifetime' || !b.expiresAt) return null;
    return Math.ceil((new Date(b.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
