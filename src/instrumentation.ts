/**
 * Server start-up hook.
 *
 * The portal has no scheduler of its own and runs as a single container, so
 * the daily attendance sweep is driven from here rather than requiring a
 * crontab on the host.
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
                return;
            }
            const body = (await res.json()) as { ran: number; warned: number; digests: number };
            console.info(
                `[cron] attendance alerts: ${body.ran} course(s), ${body.warned} warned, ${body.digests} digest(s)`
            );
        } catch (error) {
            console.error('[cron] attendance alerts failed:', error instanceof Error ? error.message : error);
        }
    };

    const timer = setInterval(tick, CHECK_INTERVAL_MS);
    // Never hold the process open just for this.
    timer.unref?.();

    console.info('[cron] internal scheduler started (attendance alerts)');
}
