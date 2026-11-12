import { describe, expect, it, vi } from 'vitest';

// daily.ts pulls in the database and mailer; the streak walk itself is pure.
vi.mock('../db', () => ({ withCourseContext: vi.fn() }));
vi.mock('../mailer', () => ({
    escapeHtml: (s: string) => s,
    isMailConfigured: () => false,
    paragraphs: (s: string) => s,
    renderEmail: () => '',
    sendMail: vi.fn(),
}));

import { currentStreak } from './daily';
import { parseEmailAlertSettings, DEFAULT_EMAIL_ALERT_SETTINGS } from './settingsSchema';

// Newest first, like the job builds it.
const d = (date: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null, onLeave = false) => ({
    date,
    status,
    onLeave,
});

describe('currentStreak', () => {
    it('counts consecutive absences back from the latest roll call', () => {
        const s = currentStreak([d('2026-11-12', 'ABSENT'), d('2026-11-11', 'ABSENT'), d('2026-11-10', 'PRESENT')]);
        expect(s).toMatchObject({ type: 'ABSENT', count: 2, startDate: '2026-11-11', endDate: '2026-11-12' });
    });

    it('counts consecutive lates separately from absences', () => {
        const s = currentStreak([d('2026-11-12', 'LATE'), d('2026-11-11', 'LATE'), d('2026-11-10', 'ABSENT')]);
        expect(s).toMatchObject({ type: 'LATE', count: 2 });
    });

    it('a late day breaks an absence streak', () => {
        const s = currentStreak([d('2026-11-12', 'ABSENT'), d('2026-11-11', 'LATE'), d('2026-11-10', 'ABSENT')]);
        expect(s).toMatchObject({ type: 'ABSENT', count: 1 });
    });

    it('skips excused days, approved leave and days with no record without breaking the streak', () => {
        const s = currentStreak([
            d('2026-11-12', 'ABSENT'),
            d('2026-11-11', 'EXCUSED'),
            d('2026-11-10', 'ABSENT', true),
            d('2026-11-09', null),
            d('2026-11-08', 'ABSENT'),
            d('2026-11-07', 'PRESENT'),
        ]);
        expect(s).toMatchObject({ type: 'ABSENT', count: 2, startDate: '2026-11-08', dates: ['2026-11-08', '2026-11-12'] });
    });

    it('returns null when the latest counted day is present', () => {
        expect(currentStreak([d('2026-11-12', 'PRESENT'), d('2026-11-11', 'ABSENT')])).toBeNull();
        expect(currentStreak([])).toBeNull();
    });
});

describe('parseEmailAlertSettings', () => {
    it('falls back to defaults for missing or invalid fields', () => {
        const s = parseEmailAlertSettings({ lateStreakDays: 99, absentStreakDays: 3, staffRecipients: ['A@x.com', 'a@x.com'] });
        expect(s.lateStreakDays).toBe(DEFAULT_EMAIL_ALERT_SETTINGS.lateStreakDays);
        expect(s.absentStreakDays).toBe(3);
        expect(s.staffRecipients).toEqual(['a@x.com']);
        expect(parseEmailAlertSettings(null)).toEqual(DEFAULT_EMAIL_ALERT_SETTINGS);
    });
});
