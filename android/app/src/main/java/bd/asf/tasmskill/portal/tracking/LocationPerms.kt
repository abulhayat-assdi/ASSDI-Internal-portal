package bd.asf.tasmskill.portal.tracking

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

object LocationPerms {
    private fun granted(ctx: Context, perm: String) =
        ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED

    fun hasForeground(ctx: Context): Boolean =
        granted(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ||
            granted(ctx, Manifest.permission.ACCESS_COARSE_LOCATION)

    fun hasBackground(ctx: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasForeground(ctx) && granted(ctx, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
            hasForeground(ctx)
        }

    /** "granted_background" | "granted_foreground" | "denied" per the contract. */
    fun state(ctx: Context): String = when {
        hasBackground(ctx) -> "granted_background"
        hasForeground(ctx) -> "granted_foreground"
        else -> "denied"
    }

    fun hasNotificationPermission(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            granted(ctx, Manifest.permission.POST_NOTIFICATIONS)

    fun appDetailsIntent(ctx: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
