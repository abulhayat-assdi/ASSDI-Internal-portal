package bd.asf.tasmskill.portal.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import bd.asf.tasmskill.portal.MainActivity
import bd.asf.tasmskill.portal.R

object Notifications {
    const val CHANNEL_TRACKING = "tracking"
    const val CHANNEL_ALERTS = "tracking_alerts"
    const val ID_TRACKING = 1001
    private const val ID_ALERT = 1002

    fun createChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_TRACKING,
                ctx.getString(R.string.channel_tracking),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) }
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ALERTS,
                ctx.getString(R.string.channel_alerts),
                NotificationManager.IMPORTANCE_DEFAULT,
            )
        )
    }

    private fun openAppIntent(ctx: Context): PendingIntent {
        val intent = Intent(ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            ctx, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    /** Ongoing, low-importance notification for the foreground service. */
    fun tracking(ctx: Context, title: String?): Notification =
        NotificationCompat.Builder(ctx, CHANNEL_TRACKING)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(ctx, R.color.brand))
            .setContentTitle(title?.takeIf { it.isNotBlank() } ?: ctx.getString(R.string.app_name))
            .setContentText(ctx.getString(R.string.tracking_running))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent(ctx))
            .build()

    fun showAlert(ctx: Context, title: String, text: String) {
        if (!LocationPerms.hasNotificationPermission(ctx)) return
        val n = NotificationCompat.Builder(ctx, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(ctx, R.color.brand))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(ctx))
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(ID_ALERT, n)
        } catch (e: SecurityException) {
            // Notification permission was revoked between the check and the call.
        }
    }

    fun showResumePrompt(ctx: Context) = showAlert(
        ctx,
        ctx.getString(R.string.tracking_resume_title),
        ctx.getString(R.string.tracking_resume_text),
    )
}
