import { z } from 'zod';

/**
 * Per-course settings for the automated email alerts (leave requests,
 * attendance streaks, digests). Client-safe: no database imports here, so the
 * settings page can share the defaults. Reading/saving lives in ./settings.ts.
 *
 * Anything missing falls back to DEFAULTS, which keeps old rows valid when a
 * new setting is added later.
 */

export const EMAIL_ALERT_SETTINGS_KEY = 'email_alert_settings';

const emailList = z
    .array(z.string().trim().toLowerCase().email('ইমেইল ঠিকানা সঠিক নয়'))
    .max(20, 'সর্বোচ্চ ২০টি ইমেইল')
    .transform((list) => [...new Set(list)]);

export const emailAlertSettingsSchema = z.object({
    /** Staff addresses that receive leave requests, reminders, digests and escalations. */
    staffRecipients: emailList.default([]),

    /** New leave request → staffRecipients. */
    leaveNewToStaff: z.boolean().default(true),
    /** New leave request → a receipt to the student. */
    leaveConfirmToStudent: z.boolean().default(true),
    /** Daily reminder about requests still pending after `pendingReminderHours`. */
    leavePendingReminder: z.boolean().default(true),
    pendingReminderHours: z.number().int().min(1).max(168).default(24),
    /** Daily "on leave today" list → staffRecipients. */
    onLeaveTodayDigest: z.boolean().default(true),
    /** New attendance-correction request → staffRecipients. */
    correctionNewToStaff: z.boolean().default(true),

    /** Consecutive LATE roll calls → student. */
    lateStreakToStudent: z.boolean().default(true),
    lateStreakDays: z.number().int().min(2).max(10).default(2),
    /** Consecutive ABSENT roll calls → student. */
    absentStreakToStudent: z.boolean().default(true),
    absentStreakDays: z.number().int().min(2).max(10).default(2),
    /** A longer absence streak → staffRecipients (and the guardian, if enabled). */
    escalationToStaff: z.boolean().default(true),
    escalationToGuardian: z.boolean().default(false),
    escalationDays: z.number().int().min(2).max(15).default(3),
});

export type EmailAlertSettings = z.infer<typeof emailAlertSettingsSchema>;

export const DEFAULT_EMAIL_ALERT_SETTINGS: EmailAlertSettings = emailAlertSettingsSchema.parse({});

/** Reads stored settings; anything invalid or missing falls back to the default for that field. */
export function parseEmailAlertSettings(raw: unknown): EmailAlertSettings {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {};
    const shape = emailAlertSettingsSchema.shape;
    for (const key of Object.keys(shape) as (keyof typeof shape)[]) {
        const parsed = shape[key].safeParse(source[key]);
        out[key] = parsed.success ? parsed.data : DEFAULT_EMAIL_ALERT_SETTINGS[key];
    }
    return out as EmailAlertSettings;
}
