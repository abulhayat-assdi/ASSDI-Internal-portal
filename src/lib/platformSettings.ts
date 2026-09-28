import { prisma } from './db';

const SETTINGS_ID = 'global';
const CACHE_TTL_MS = 60 * 1000;

export interface PlatformSettingsData {
  logoUrl: string | null;
  faviconUrl: string | null;
}

const EMPTY: PlatformSettingsData = { logoUrl: null, faviconUrl: null };

let cached: { value: PlatformSettingsData; expiresAt: number } | null = null;

/**
 * The institute's own logo and favicon (single row, not course-scoped).
 * Never throws: branding must not take a page down, so a failed read just
 * means "no global logo".
 */
export async function getPlatformSettings(): Promise<PlatformSettingsData> {
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  try {
    const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
    const value = { logoUrl: row?.logoUrl ?? null, faviconUrl: row?.faviconUrl ?? null };
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (e) {
    console.error('[platformSettings] read failed:', e);
    return EMPTY;
  }
}

export async function updatePlatformSettings(
  patch: Partial<PlatformSettingsData>,
  updatedBy: string | null
): Promise<PlatformSettingsData> {
  const row = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...patch, updatedBy },
    update: { ...patch, updatedBy },
  });
  cached = null;
  return { logoUrl: row.logoUrl, faviconUrl: row.faviconUrl };
}
