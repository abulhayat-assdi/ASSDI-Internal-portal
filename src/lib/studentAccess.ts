import type { CourseStatus, Prisma } from '@prisma/client';

/**
 * Who is still allowed into a course portal, and who may claim a roll number.
 *
 * The rules live here rather than in the routes because three places have to
 * agree on them: the session check on every request, the login route, and
 * self-registration. If they drift, a blocked student keeps a working session
 * or a released roll cannot be reused.
 */

/** Statuses that close the portal. Completed students keep their access. */
const BLOCKING_STATUSES: CourseStatus[] = ['Incomplete', 'Expelled'];

export function isBlockingStatus(status: CourseStatus): boolean {
    return BLOCKING_STATUSES.includes(status);
}

export const BLOCKED_MESSAGE =
    'আপনার কোর্স স্ট্যাটাস অনুযায়ী এই পোর্টালে আপনার অ্যাক্সেস বন্ধ করা হয়েছে। এটি ভুল মনে হলে অ্যাডমিনের সাথে যোগাযোগ করুন।';

export const ROLL_TAKEN_MESSAGE =
    'এই রোল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা হয়েছে। অন্য ইমেইল দিয়ে রেজিস্টার করতে হলে অ্যাডমিনের অনুমতি লাগবে।';

export const ROLL_UNKNOWN_MESSAGE =
    'এই ব্যাচে এই রোল নম্বরটি পাওয়া যায়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।';

/** The roster columns the access rules need. */
export const studentAccessSelect = {
    id: true,
    courseStatus: true,
    registrationUnlocked: true,
    accessBlockedAt: true,
} satisfies Prisma.BatchStudentSelect;

export interface StudentAccessRow {
    id: string;
    courseStatus: CourseStatus;
    registrationUnlocked: boolean;
    accessBlockedAt: Date | null;
}

/**
 * Whether a student's session should still be honoured.
 *
 * A roster row that cannot be found is deliberately *not* a block: students
 * register with a batch and roll that an admin can later rename, and locking
 * people out over a typo would be worse than the thing this guards against.
 */
export function isPortalAccessBlocked(student: StudentAccessRow | null): boolean {
    if (!student) return false;
    return isBlockingStatus(student.courseStatus);
}

export type RegistrationCheck =
    | { ok: true; student: StudentAccessRow; consumesUnlock: boolean }
    | { ok: false; reason: 'unknown-roll' | 'blocked' | 'roll-taken'; message: string };

/**
 * Decides whether this batch/roll may be registered right now.
 *
 * `alreadyRegistered` is whether some user account already carries this batch
 * and roll — the caller looks that up, since it needs an RLS-bypassing read
 * (email is unique platform-wide).
 */
export function checkRegistration(
    student: StudentAccessRow | null,
    alreadyRegistered: boolean
): RegistrationCheck {
    if (!student) {
        return { ok: false, reason: 'unknown-roll', message: ROLL_UNKNOWN_MESSAGE };
    }
    if (isBlockingStatus(student.courseStatus)) {
        return { ok: false, reason: 'blocked', message: BLOCKED_MESSAGE };
    }
    if (alreadyRegistered && !student.registrationUnlocked) {
        return { ok: false, reason: 'roll-taken', message: ROLL_TAKEN_MESSAGE };
    }
    // An unlock is one-shot: it is spent by the registration it permits.
    return { ok: true, student, consumesUnlock: alreadyRegistered && student.registrationUnlocked };
}
