package bd.asf.tasmskill.portal.tracking

import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArraySet

/** In-process "tracking status changed" signal. Listeners always run on the main thread. */
object StatusBus {
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    fun add(listener: () -> Unit) {
        listeners.add(listener)
    }

    fun remove(listener: () -> Unit) {
        listeners.remove(listener)
    }

    fun notifyChanged() {
        main.post { listeners.forEach { it() } }
    }
}
