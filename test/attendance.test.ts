import { describe, expect, it } from 'vitest';
import { getEffectivePermissions } from '@/lib/permissions';
import { correctionOptions, isInRollCall, tally } from '@/lib/attendance';

describe('new permissions reach the right roles', () => {
    it('a fresh admin gets the report screens', () => {
        const p = getEffectivePermissions('admin', []);
        expect(p).toContain('admin_attendance');
        expect(p).toContain('reports');
    });
    it('a fresh teacher can take the roll call', () => {
        expect(getEffectivePermissions('teacher', [])).toContain('attendance');
    });
    it('an existing user with saved permissions does NOT get them automatically', () => {
        const p = getEffectivePermissions('admin', ['admin_panel']);
        expect(p).not.toContain('reports');
    });
});

describe('who is on the roll call', () => {
    it('calls Running and Completed students, and rows with no status', () => {
        expect(isInRollCall('Running')).toBe(true);
        expect(isInRollCall('Completed')).toBe(true);
        expect(isInRollCall(null)).toBe(true);
        expect(isInRollCall(undefined)).toBe(true);
    });
    it('leaves out Incomplete and Expelled students', () => {
        expect(isInRollCall('Incomplete')).toBe(false);
        expect(isInRollCall('Expelled')).toBe(false);
    });
});

describe('what a correction request may ask for', () => {
    it('offers every status except the one already on the record', () => {
        expect(correctionOptions('ABSENT')).toEqual(['PRESENT', 'LATE', 'EXCUSED']);
        expect(correctionOptions('PRESENT')).toEqual(['ABSENT', 'LATE', 'EXCUSED']);
    });
});

describe('attendance maths', () => {
    it('late counts as attended, excused is excluded', () => {
        expect(tally(['PRESENT', 'LATE', 'ABSENT']).percentage).toBe(66.7);
        expect(tally(['EXCUSED']).percentage).toBeNull();
        expect(tally(['PRESENT', 'EXCUSED']).percentage).toBe(100);
    });
});
