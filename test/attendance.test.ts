import { describe, expect, it } from 'vitest';
import { getEffectivePermissions } from '@/lib/permissions';
import { tally } from '@/lib/attendance';

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

describe('attendance maths', () => {
    it('late counts as attended, excused is excluded', () => {
        expect(tally(['PRESENT', 'LATE', 'ABSENT']).percentage).toBe(66.7);
        expect(tally(['EXCUSED']).percentage).toBeNull();
        expect(tally(['PRESENT', 'EXCUSED']).percentage).toBe(100);
    });
});
