import type { Prisma } from '@prisma/client';
import { withCourseContext } from '../db';
import { EMAIL_ALERT_SETTINGS_KEY, parseEmailAlertSettings, type EmailAlertSettings } from './settingsSchema';

export * from './settingsSchema';

/** Stored in a `cms_content` row like the attendance-alert state, so a new toggle needs no migration. */

export async function getEmailAlertSettings(courseId: string): Promise<EmailAlertSettings> {
    const row = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cmsContent.findUnique({ where: { courseId_key: { courseId, key: EMAIL_ALERT_SETTINGS_KEY } } })
    );
    return parseEmailAlertSettings(row?.value);
}

export async function saveEmailAlertSettings(
    courseId: string,
    settings: EmailAlertSettings,
    updatedBy: string
): Promise<void> {
    const value = settings as unknown as Prisma.InputJsonValue;
    await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.cmsContent.upsert({
            where: { courseId_key: { courseId, key: EMAIL_ALERT_SETTINGS_KEY } },
            update: { value, updatedBy },
            create: { courseId, key: EMAIL_ALERT_SETTINGS_KEY, value, updatedBy },
        })
    );
}
