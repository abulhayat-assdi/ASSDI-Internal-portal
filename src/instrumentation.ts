/**
 * Server start-up hook.
 *
 * The portal has no scheduler of its own and runs as a single container, so
 * the daily jobs (attendance sweep, deployment folder cleanup) are driven
 * from here rather than requiring a crontab on the host.
 *
 * It calls its own /api/cron/attendance-alerts over localhost instead of
 * importing the job. That keeps this file — which Next also compiles for the
 * edge runtime — free of nodemailer, whose node:child_process import cannot
 * be resolved there, and it exercises exactly the path a real scheduler
 * would use.
 *
 * Needs CRON_SECRET, the same secret the endpoint checks. Set
 * DISABLE_INTERNAL_CRON=1 when driving that endpoint from a real scheduler,
 * or when running more than one instance, so the job has a single owner.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly; the tick decides if it is due
const RUN_AT_HOUR = 7; // local time — a morning digest, not a 3am one

export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (process.env.DISABLE_INTERNAL_CRON === '1') return;
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length < 16) {
        console.info('[cron] internal scheduler off — set CRON_SECRET (16+ chars) to enable');
        return;
    }

    const port = process.env.PORT || '3000';
    const url = `http://127.0.0.1:${port}/api/cron/attendance-alerts`;
    const cleanupUrl = `http://127.0.0.1:${port}/api/cron/deployment-cleanup`;
    const incubationRetentionUrl = `http://127.0.0.1:${port}/api/cron/incubation-retention`;
    const incubationRemindersUrl = `http://127.0.0.1:${port}/api/cron/incubation-reminders`;

    let lastRunDate: string | null = null;

    const tick = async () => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        if (now.getHours() < RUN_AT_HOUR || lastRunDate === dateStr) return;

        // Claim the day before awaiting, so a slow run cannot be started twice.
        lastRunDate = dateStr;
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'x-cron-secret': secret } });
            if (!res.ok) {
                console.error(`[cron] attendance alerts returned ${res.status}`);
            } else {
                const body = (await res.json()) as { ran: number; warned: number; digests: number };
                console.info(
                    `[cron] attendance alerts: ${body.ran} course(s), ${body.warned} warned, ${body.digests} digest(s)`
                );
            }
        } catch (error) {
            console.error('[cron] attendance alerts failed:', error instanceof Error ? error.message : error);
        }

        try {
            const res = await fetch(cleanupUrl, { method: 'POST', headers: { 'x-cron-secret': secret } });
            const body = res.ok ? ((await res.json()) as { removed: number }) : null;
            if (body) console.info(`[cron] deployment cleanup: ${body.removed} orphan folder(s) removed`);
            else console.error(`[cron] deployment cleanup returned ${res.status}`);
        } catch (error) {
            console.error('[cron] deployment cleanup failed:', error instanceof Error ? error.message : error);
        }
        try {
            const res = await fetch(incubationRetentionUrl, { method: 'POST', headers: { 'x-cron-secret': secret } });
            if (!res.ok) console.error(`[cron] incubation retention returned ${res.status}`);
        } catch (error) {
            console.error('[cron] incubation retention failed:', error instanceof Error ? error.message : error);
        }
    };

    // Business Incubation reminders follow Bangladesh time (07:00 Asia/Dhaka)
    // whatever the container's clock is, so leads see them in the morning.
    let lastReminderDate: string | null = null;
    const dhaka = () => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date());
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
        return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
    };
    const reminderTick = async () => {
        const { date, hour } = dhaka();
        if (hour < RUN_AT_HOUR || lastReminderDate === date) return;
        lastReminderDate = date;
        try {
            const res = await fetch(incubationRemindersUrl, { method: 'POST', headers: { 'x-cron-secret': secret } });
            const body = res.ok ? ((await res.json()) as { created: number; emailed: number }) : null;
            if (body) console.info(`[cron] incubation reminders: ${body.created} notification(s), ${body.emailed} email(s)`);
            else console.error(`[cron] incubation reminders returned ${res.status}`);
        } catch (error) {
            console.error('[cron] incubation reminders failed:', error instanceof Error ? error.message : error);
        }
    };

    const timer = setInterval(() => {
        void tick();
        void reminderTick();
    }, CHECK_INTERVAL_MS);
    // Never hold the process open just for this.
    timer.unref?.();
    // First check shortly after start-up instead of an hour later (each job still runs once a day).
    const first = setTimeout(() => {
        void tick();
        void reminderTick();
    }, 60_000);
    first.unref?.();

    console.info('[cron] internal scheduler started (attendance alerts, deployment cleanup, incubation retention, incubation reminders at 07:00 Asia/Dhaka)');
}
