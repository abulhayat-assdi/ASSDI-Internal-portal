# The WebView looks up @JavascriptInterface methods by name at runtime.
-keepattributes JavascriptInterface
-keepattributes RuntimeVisibleAnnotations
-keep class bd.asf.tasmskill.portal.web.SecureAsmAppBridge
-keep class bd.asf.tasmskill.portal.web.LegacyAsmAppBridge
-keepclassmembers class bd.asf.tasmskill.portal.web.** {
    @android.webkit.JavascriptInterface <methods>;
}

# WorkManager instantiates workers reflectively.
-keep class bd.asf.tasmskill.portal.tracking.UploadWorker { <init>(...); }