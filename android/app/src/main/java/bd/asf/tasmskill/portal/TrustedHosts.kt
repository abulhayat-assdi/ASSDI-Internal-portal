package bd.asf.tasmskill.portal

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.TimeUnit

/**
 * Course host list from GET https://<root>/api/app/hosts, cached in private prefs.
 * The cached list is used when a fetch fails. Fetch functions block, so never call them on
 * the main thread.
 */
object TrustedHosts {
    private const val TAG = "AsmHosts"
    private const val PREFS = "asm_hosts"
    private const val KEY_SLUGS = "slugs"
    private const val KEY_FETCHED_AT = "fetched_at"
    private const val MAX_AGE_MS = 300_000L          // matches Cache-Control max-age=300
    private const val MIN_GAP_MS = 10_000L            // between any two fetches
    private const val PER_HOST_REFETCH_GAP_MS = 60_000L

    @Volatile
    private var slugs: Set<String> = emptySet()

    @Volatile
    private var loaded = false

    @Volatile
    private var lastFetchAt = 0L

    private val lastHostRefetch = ConcurrentHashMap<String, Long>()
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val main = Handler(Looper.getMainLooper())
    private val fetchLock = Any()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(3, TimeUnit.SECONDS)
            .readTimeout(3, TimeUnit.SECONDS)
            .callTimeout(4, TimeUnit.SECONDS)
            .followRedirects(false)
            .build()
    }

    fun current(): Set<String> = slugs

    /** Load the cached list (cheap; safe on the main thread). */
    fun init(ctx: Context) {
        if (loaded) return
        synchronized(this) {
            if (loaded) return
            val prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            slugs = prefs.getStringSet(KEY_SLUGS, emptySet())
                .orEmpty()
                .filter { OriginPolicy.isValidSlug(it) }
                .toSet()
            lastFetchAt = 0L
            loaded = true
        }
    }

    fun isStale(ctx: Context): Boolean {
        val prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return System.currentTimeMillis() - prefs.getLong(KEY_FETCHED_AT, 0L) > MAX_AGE_MS
    }

    fun addListener(l: () -> Unit) {
        listeners.add(l)
    }

    fun removeListener(l: () -> Unit) {
        listeners.remove(l)
    }

    /** Blocking fetch. Returns true when the server answered with a valid list. */
    fun refresh(ctx: Context): Boolean = synchronized(fetchLock) {
        init(ctx)
        lastFetchAt = System.currentTimeMillis()
        val request = Request.Builder()
            .url(BuildConfig.HOSTS_URL)
            .header("Accept", "application/json")
            .header("User-Agent", "AsmPortalApp/${BuildConfig.VERSION_NAME} (Android)")
            .get()
            .build()
        val fetched = try {
            client.newCall(request).execute().use { resp ->
                if (resp.code != 200) null else Origins.policy.parseHostsResponse(resp.body?.string().orEmpty())
            }
        } catch (e: Exception) {
            Log.i(TAG, "host list fetch failed: ${e.message}")
            null
        } ?: return false

        val changed = fetched != slugs
        slugs = fetched
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putStringSet(KEY_SLUGS, fetched)
            .putLong(KEY_FETCHED_AT, System.currentTimeMillis())
            .apply()
        if (changed) main.post { listeners.forEach { it() } }
        true
    }

    /**
     * A navigation reached <label>.<root> that is not listed: refetch once (rate-limited per
     * label) in case the course is new. Returns true when a fetch happened and succeeded.
     */
    fun refetchForLabel(ctx: Context, label: String): Boolean {
        val now = System.currentTimeMillis()
        val last = lastHostRefetch[label] ?: 0L
        if (now - last < PER_HOST_REFETCH_GAP_MS) return false
        lastHostRefetch[label] = now
        // A fetch finished moments ago (for example the startup fetch): reuse its result.
        if (now - lastFetchAt < MIN_GAP_MS) return label in slugs
        return refresh(ctx)
    }
}
