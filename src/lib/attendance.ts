import type { AttendanceStatus } from '@prisma/client';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    LATE: 'Late',
    EXCUSED: 'On Leave',
};

/** Course statuses that take a student off the roll call: they have left the batch. */
export const ROLL_CALL_EXCLUDED_STATUSES = ['Incomplete', 'Expelled'] as const;

/** Running and Completed students (and legacy rows with no status) are called; the rest are not. */
export function isInRollCall(courseStatus?: string | null): boolean {
    return !(ROLL_CALL_EXCLUDED_STATUSES as readonly string[]).includes(courseStatus ?? '');
}

/**
 * What a student may ask a day to be changed to: any status other than the
 * one already on the record.
 */
export function correctionOptions(current: AttendanceStatus): AttendanceStatus[] {
    return ATTENDANCE_STATUSES.filter((s) => s !== current);
}

export const CORRECTION_STATUS_LABELS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
} as const;

/** Below this percentage a student shows up on the admin's follow-up list. */
export const LOW_ATTENDANCE_THRESHOLD = 75;

export interface AttendanceTally {
    present: number;
    absent: number;
    late: number;
    excused: number;
    /** Classes that count towards the percentage (everything but EXCUSED / on leave). */
    counted: number;
    /** PRESENT + LATE — a late student was still in the room. */
    attended: number;
    /** 0–100, rounded to one decimal. null when nothing counts yet. */
    percentage: number | null;
}

export function emptyTally(): AttendanceTally {
    return { present: 0, absent: 0, late: 0, excused: 0, counted: 0, attended: 0, percentage: null };
}

/**
 * Turns a list of statuses into a percentage.
 *
 * LATE counts as attended — the student was in the class, and lateness is
 * tracked separately so it can still be acted on. EXCUSED (shown as "On Leave", pre-filled from approved leave requests) is
 * left out of both sides, so approved leave neither rewards nor punishes:
 * it simply isn't one of the classes the student is measured against.
 */
export function tally(statuses: AttendanceStatus[]): AttendanceTally {
    const t = emptyTally();
    for (const s of statuses) {
        if (s === 'PRESENT') t.present++;
        else if (s === 'ABSENT') t.absent++;
        else if (s === 'LATE') t.late++;
        else t.excused++;
    }
    t.attended = t.present + t.late;
    t.counted = t.attended + t.absent;
    t.percentage = t.counted === 0 ? null : Math.round((t.attended / t.counted) * 1000) / 10;
    return t;
}

export function isLowAttendance(t: AttendanceTally, threshold = LOW_ATTENDANCE_THRESHOLD): boolean {
    return t.percentage !== null && t.percentage < threshold;
}

/** "YYYY-MM-DD" for today, the string form every date column here uses. */
export function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function isValidDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
