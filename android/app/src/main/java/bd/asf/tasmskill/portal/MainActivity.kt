package bd.asf.tasmskill.portal

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import bd.asf.tasmskill.portal.OriginPolicy.Trust
import bd.asf.tasmskill.portal.tracking.LocationPerms
import bd.asf.tasmskill.portal.tracking.TrackingService
import bd.asf.tasmskill.portal.tracking.TrackingStatus
import bd.asf.tasmskill.portal.tracking.TrackingStore
import bd.asf.tasmskill.portal.tracking.StatusBus
import bd.asf.tasmskill.portal.tracking.Uploader
import bd.asf.tasmskill.portal.web.AsmAppCore
import bd.asf.tasmskill.portal.web.LegacyAsmAppBridge
import bd.asf.tasmskill.portal.web.SecureAsmAppBridge
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var errorView: View

    private val mainHandler = Handler(Looper.getMainLooper())
    private var firstPageDone = false
    private var mainFrameError = false
    private var failingUrl: String? = null
    private var webViewDestroyed = false

    @Volatile
    private var hostsReady = false
    private val io = Executors.newSingleThreadExecutor()

    // JS bridge: nonce-protected native object + document-start wrapper (see AsmAppBridge.kt)
    private val bridgeNonce = AsmAppCore.newNonce()
    private var bridgeScript: ScriptHandler? = null
    private var secureBridge = false
    private val hostsListener: () -> Unit = { updateBridgeScript() }

    @Volatile
    private var lastKnownUrl: String? = null

    /** Registered at construction time, as required for activity-result launchers. */
    val permissionFlow = PermissionFlow(this)

    // File chooser state
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingChooserParams: WebChromeClient.FileChooserParams? = null
    private var cameraFile: File? = null
    private var cameraUri: Uri? = null

    // Web geolocation prompt waiting for the runtime permission
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null

    private val statusListener: () -> Unit = { dispatchTrackingStatus() }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            handleFileResult(result.resultCode, result.data)
        }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            val params = pendingChooserParams
            pendingChooserParams = null
            if (params != null) launchFileChooser(params) else cancelFileChooser()
        }

    private val geoPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val granted = LocationPerms.hasForeground(this)
            pendingGeo?.let { (origin, callback) -> callback.invoke(origin, granted, false) }
            pendingGeo = null
            StatusBus.notifyChanged()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val startedAt = SystemClock.elapsedRealtime()
        splash.setKeepOnScreenCondition {
            (!firstPageDone || !hostsReady) && SystemClock.elapsedRealtime() - startedAt < SPLASH_MAX_MS
        }

        // Course host list: cached copy now, fresh copy during the splash (short timeout).
        TrustedHosts.init(this)
        TrustedHosts.addListener(hostsListener)
        io.execute {
            TrustedHosts.refresh(applicationContext)
            hostsReady = true
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)
        val root = findViewById<View>(R.id.root)
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        webView = findViewById(R.id.webview)
        swipe = findViewById(R.id.swipe)
        errorView = findViewById(R.id.error_view)
        findViewById<Button>(R.id.retry).setOnClickListener { retry() }

        setupWebView()

        swipe.setColorSchemeResources(R.color.brand)
        // Pull-to-refresh only when the page is scrolled to the top.
        swipe.setOnChildScrollUpCallback { _, _ -> webView.scrollY > 0 || webView.canScrollVertically(-1) }
        swipe.setOnRefreshListener { webView.reload() }

        val restored = savedInstanceState?.let { webView.restoreState(it) }
        if (restored == null) webView.loadUrl(BuildConfig.START_URL)

        onBackPressedDispatcher.addCallback(this) {
            if (errorView.visibility == View.VISIBLE && webView.canGoBack()) {
                hideError()
                webView.goBack()
            } else if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            setGeolocationEnabled(true)
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            userAgentString = WebSettings.getDefaultUserAgent(this@MainActivity) +
                " AsmPortalApp/${BuildConfig.VERSION_NAME} (Android)"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }
        installBridge()
        webView.webViewClient = PortalWebViewClient()
        webView.webChromeClient = PortalChromeClient()
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            startDownload(url, userAgent, contentDisposition, mimeType)
        }
    }

    // ---------------------------------------------------------------- navigation

    private inner class PortalWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) {
                // Student mini-sites live on unlisted <name>.<root> hosts: never inside a frame.
                return Origins.classify(request.url.toString()) == Trust.UNLISTED_SUBDOMAIN
            }
            return handleNavigation(request.url) // also called for main-frame redirects
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            // Runs on a background thread. Blocks frame documents (HTML) from unlisted
            // <name>.<root> hosts, covering initial iframe loads that shouldOverrideUrlLoading
            // does not see. Images/scripts from such hosts are left alone.
            if (request.isForMainFrame) return null
            val url = request.url.toString()
            if (Origins.classify(url) != Trust.UNLISTED_SUBDOMAIN) return null
            val accept = request.requestHeaders.entries
                .firstOrNull { it.key.equals("Accept", ignoreCase = true) }?.value.orEmpty()
            if (accept.isNotEmpty() && !accept.contains("text/html")) return null
            if (Origins.classifyWithRefetch(applicationContext, url) == Trust.TRUSTED) return null
            return WebResourceResponse(
                "text/plain", "utf-8", 403, "Forbidden",
                mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)),
            )
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            mainFrameError = false
            lastKnownUrl = url
            // Safety net for navigations that skip shouldOverrideUrlLoading (e.g. form POSTs).
            if (url != null && url != "about:blank" && !Origins.isTrusted(url)) {
                view.stopLoading()
                if (view.canGoBack()) view.goBack() else view.loadUrl(BuildConfig.START_URL)
                val uri = Uri.parse(url)
                if (Origins.classify(url) == Trust.UNLISTED_SUBDOMAIN) resolveUnlisted(uri) else openExternal(uri)
            }
        }

        override fun onPageFinished(view: WebView, url: String?) {
            firstPageDone = true
            swipe.isRefreshing = false
            lastKnownUrl = view.url
            if (mainFrameError) showError() else hideError()
            dispatchTrackingStatus()
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            lastKnownUrl = url
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                mainFrameError = true
                failingUrl = request.url.toString()
                showError()
            }
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // The renderer crashed or was killed: drop this WebView and rebuild the activity.
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            webViewDestroyed = true
            recreate()
            return true
        }
    }

    /** Returns true when the navigation was handled outside the WebView. */
    private fun handleNavigation(uri: Uri): Boolean {
        val url = uri.toString()
        val scheme = uri.scheme?.lowercase()
        if (scheme == "http" || scheme == "https") {
            when (Origins.classify(url)) {
                Trust.TRUSTED -> return false
                Trust.UNLISTED_SUBDOMAIN -> {
                    resolveUnlisted(uri)
                    return true
                }
                Trust.UNTRUSTED -> Unit
            }
        }
        if (url == "about:blank") return false
        openExternal(uri)
        return true
    }

    /**
     * <name>.<root> that is not in the course list: refetch the list once (a course may be
     * new), then load it in the WebView if it is now listed, otherwise open it in the browser.
     */
    private fun resolveUnlisted(uri: Uri) {
        val url = uri.toString()
        io.execute {
            val trust = Origins.classifyWithRefetch(applicationContext, url)
            mainHandler.post {
                if (isDestroyed || webViewDestroyed) return@post
                if (trust == Trust.TRUSTED) webView.loadUrl(url) else openExternal(uri)
            }
        }
    }

    @SuppressLint("JavascriptInterface")
    private fun installBridge() {
        val core = AsmAppCore(this)
        secureBridge = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (secureBridge) {
            webView.addJavascriptInterface(SecureAsmAppBridge(core, bridgeNonce), NATIVE_BRIDGE_NAME)
            updateBridgeScript()
        } else {
            webView.addJavascriptInterface(LegacyAsmAppBridge(core), "AsmApp")
        }
    }

    /** (Re)register the window.AsmApp wrapper for the current trusted origins. */
    private fun updateBridgeScript() {
        if (!secureBridge || webViewDestroyed || !::webView.isInitialized) return
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        try {
            bridgeScript?.remove()
            bridgeScript = WebViewCompat.addDocumentStartJavaScript(
                webView, AsmAppCore.wrapperScript(bridgeNonce), Origins.originRules()
            )
        } catch (e: Exception) {
            android.util.Log.e("AsmBridge", "cannot register bridge script", e)
        }
    }

    private fun openExternal(uri: Uri) {
        when (uri.scheme?.lowercase()) {
            "intent" -> openIntentUri(uri.toString())
            "javascript", "file", "content", "data", "blob", "about" -> Unit // never leave the app with these
            "http", "https" -> startExternal(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
            else -> startExternal(Intent(Intent.ACTION_VIEW, uri)) // tel:, mailto:, whatsapp:, geo:, ...
        }
    }

    private fun openIntentUri(url: String) {
        val intent = try {
            Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
        } catch (e: Exception) {
            return
        }
        intent.addCategory(Intent.CATEGORY_BROWSABLE)
        intent.component = null
        intent.selector = null
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            val fallback = intent.getStringExtra("browser_fallback_url")
            when {
                fallback != null && (fallback.startsWith("https://") || fallback.startsWith("http://")) ->
                    startExternal(Intent(Intent.ACTION_VIEW, Uri.parse(fallback)).addCategory(Intent.CATEGORY_BROWSABLE))
                intent.`package` != null ->
                    startExternal(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${intent.`package`}")))
                else -> toast(R.string.no_app_to_open)
            }
        }
    }

    private fun startExternal(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            toast(R.string.no_app_to_open)
        } catch (e: SecurityException) {
            toast(R.string.no_app_to_open)
        }
    }

    private fun showError() {
        swipe.isRefreshing = false
        errorView.visibility = View.VISIBLE
        webView.visibility = View.INVISIBLE
    }

    private fun hideError() {
        errorView.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun retry() {
        hideError()
        val url = failingUrl
        if (url != null) webView.loadUrl(url) else webView.reload()
    }

    // ---------------------------------------------------------------- chrome client

    private inner class PortalChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams,
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = filePathCallback
            val wantsCamera = acceptsImage(fileChooserParams) || acceptsVideo(fileChooserParams)
            if (wantsCamera && hasDeviceCamera() && !hasCameraPermission()) {
                pendingChooserParams = fileChooserParams
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            } else {
                launchFileChooser(fileChooserParams)
            }
            return true
        }

        override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
            if (!Origins.isTrusted(origin)) {
                callback.invoke(origin, false, false)
                return
            }
            if (LocationPerms.hasForeground(this@MainActivity)) {
                callback.invoke(origin, true, false)
            } else {
                pendingGeo?.let { (o, cb) -> cb.invoke(o, false, false) }
                pendingGeo = origin to callback
                geoPermissionLauncher.launch(
                    arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                )
            }
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            val trusted = Origins.isTrusted(request.origin?.toString())
            val wantsVideo = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
            if (trusted && wantsVideo && hasCameraPermission()) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            } else {
                request.deny()
            }
        }
    }

    private fun acceptTypes(params: WebChromeClient.FileChooserParams): List<String> =
        params.acceptTypes.orEmpty()
            .flatMap { it.split(",") }
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }

    private fun acceptsImage(params: WebChromeClient.FileChooserParams): Boolean {
        val types = acceptTypes(params)
        return types.isEmpty() || types.any {
            it == "*/*" || it.startsWith("image/") || it in IMAGE_EXTENSIONS
        }
    }

    private fun acceptsVideo(params: WebChromeClient.FileChooserParams): Boolean =
        acceptTypes(params).any { it.startsWith("video/") }

    private fun hasDeviceCamera() = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)

    private fun hasCameraPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun launchFileChooser(params: WebChromeClient.FileChooserParams) {
        val types = acceptTypes(params)
        val mimeTypes = (types.filter { it.contains('/') } +
            types.filter { it.startsWith(".") }.mapNotNull {
                MimeTypeMap.getSingleton().getMimeTypeFromExtension(it.drop(1))
            }).distinct()

        val content = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
            if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
            if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }

        val captureIntents = mutableListOf<Intent>()
        cameraFile = null
        cameraUri = null
        if (hasDeviceCamera() && hasCameraPermission()) {
            if (acceptsImage(params)) createImageCaptureIntent()?.let(captureIntents::add)
            if (acceptsVideo(params)) captureIntents += Intent(MediaStore.ACTION_VIDEO_CAPTURE)
        }

        val intent = if (params.isCaptureEnabled && captureIntents.isNotEmpty()) {
            captureIntents.first()
        } else {
            Intent.createChooser(content, getString(R.string.choose_file)).apply {
                if (captureIntents.isNotEmpty()) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, captureIntents.toTypedArray())
                }
            }
        }
        try {
            fileChooserLauncher.launch(intent)
        } catch (e: ActivityNotFoundException) {
            cancelFileChooser()
        }
    }

    private fun createImageCaptureIntent(): Intent? = try {
        val dir = File(cacheDir, "camera").apply { mkdirs() }
        dir.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 86_400_000L }?.forEach { it.delete() }
        val file = File(dir, "IMG_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        cameraFile = file
        cameraUri = uri
        Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            clipData = ClipData.newRawUri("", uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    } catch (e: Exception) {
        null
    }

    private fun handleFileResult(resultCode: Int, data: Intent?) {
        val callback = fileCallback ?: return
        fileCallback = null
        if (resultCode != RESULT_OK) {
            callback.onReceiveValue(null)
            return
        }
        val uris = mutableListOf<Uri>()
        data?.clipData?.let { clip ->
            for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let(uris::add)
        }
        if (uris.isEmpty()) data?.data?.let(uris::add)
        val photo = cameraFile
        val photoUri = cameraUri
        if (photo != null && photoUri != null && photo.length() > 0) {
            // The camera wrote to our FileProvider file; use it instead of the echoed clip data.
            uris.remove(photoUri)
            if (uris.isEmpty()) uris += photoUri
        } else if (photoUri != null) {
            uris.remove(photoUri)
        }
        callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
    }

    private fun cancelFileChooser() {
        fileCallback?.onReceiveValue(null)
        fileCallback = null
    }

    // ---------------------------------------------------------------- downloads

    private fun startDownload(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase()
        if (scheme != "https" && !(scheme == "http" && Origins.isTrusted(url))) {
            toast(R.string.download_unsupported) // blob:/data: URLs are not supported by DownloadManager
            return
        }
        try {
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(uri).apply {
                if (!mimeType.isNullOrBlank()) setMimeType(mimeType)
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                addRequestHeader("User-Agent", userAgent ?: webView.settings.userAgentString)
                setTitle(fileName)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                } else {
                    // No storage permission on Android 8/9: app-specific folder, opened from the notification.
                    setDestinationInExternalFilesDir(this@MainActivity, Environment.DIRECTORY_DOWNLOADS, fileName)
                }
            }
            getSystemService(DownloadManager::class.java)?.enqueue(request)
            toast(R.string.download_started)
        } catch (e: Exception) {
            toast(R.string.download_unsupported)
        }
    }

    // ---------------------------------------------------------------- bridge support

    /** Current top-level URL, read on the main thread (the bridge calls this from a binder thread). */
    fun currentUrlForBridge(): String? {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return if (::webView.isInitialized) webView.url else null
        }
        val ref = AtomicReference<String?>(null)
        val latch = CountDownLatch(1)
        mainHandler.post {
            try {
                ref.set(if (::webView.isInitialized) webView.url else null)
            } finally {
                latch.countDown()
            }
        }
        return if (latch.await(2, TimeUnit.SECONDS)) ref.get() else lastKnownUrl
    }

    /** window.dispatchEvent(new CustomEvent("asmapp:tracking",{detail:<status>})) on trusted pages only. */
    private fun dispatchTrackingStatus() {
        if (!::webView.isInitialized || isDestroyed || webViewDestroyed) return
        if (!Origins.isTrusted(webView.url)) return
        val status = TrackingStatus.build(this).toString()
        webView.evaluateJavascript(
            "(function(){try{window.dispatchEvent(new CustomEvent('asmapp:tracking',{detail:$status}));}catch(e){}})();",
            null,
        )
    }

    /** Restart the service if a session exists but the service died (vendor kill, reboot prompt). */
    private fun resumeTrackingIfNeeded() {
        val config = TrackingStore.getConfig(this) ?: return
        if (config.isExpired()) {
            TrackingStore.clearConfig(this)
            TrackingStore.setLastError(this, "expired")
            Uploader.finalFlush(this, config)
            return
        }
        if (!TrackingService.running && LocationPerms.hasForeground(this)) {
            TrackingService.start(this)
        }
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onStart() {
        super.onStart()
        StatusBus.add(statusListener)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        if (hostsReady && TrustedHosts.isStale(this)) io.execute { TrustedHosts.refresh(applicationContext) }
        resumeTrackingIfNeeded()
        dispatchTrackingStatus()
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        webView.onPause()
        super.onPause()
    }

    override fun onStop() {
        StatusBus.remove(statusListener)
        super.onStop()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    override fun onDestroy() {
        TrustedHosts.removeListener(hostsListener)
        io.shutdown()
        cancelFileChooser()
        pendingGeo?.let { (o, cb) -> cb.invoke(o, false, false) }
        pendingGeo = null
        if (::webView.isInitialized && !webViewDestroyed) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.removeJavascriptInterface("AsmApp")
            webView.removeJavascriptInterface(NATIVE_BRIDGE_NAME)
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun toast(res: Int) = Toast.makeText(this, res, Toast.LENGTH_SHORT).show()

    companion object {
        private const val SPLASH_MAX_MS = 3000L
        private const val NATIVE_BRIDGE_NAME = "__asmAppNative"
        private val IMAGE_EXTENSIONS = setOf(".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp")
    }
}
