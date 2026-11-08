package bd.asf.tasmskill.portal

import android.app.Application
import bd.asf.tasmskill.portal.tracking.Notifications

class PortalApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        TrustedHosts.init(this)
    }
}
