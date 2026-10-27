package app.ritm

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationManagerCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    @Volatile private var pendingOpen: String? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra("open")?.let { pendingOpen = it }
    }

    private val healthLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { _ -> refreshHealth() }

    private val notifLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { ok -> js("window.__ritmNative && window.__ritmNative.onNotifPermission($ok)") }

    private val fileLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { res ->
        val uri = res.data?.data
        fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Reminders.ensureChannel(this)
        Checkins.ensureChannel(this)
        pendingOpen = intent?.getStringExtra("open")

        web = WebView(this)
        setContentView(web)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.databaseEnabled = true
        web.addJavascriptInterface(Bridge(), "RitmNative")

        web.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                openExternal(url)
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    fileLauncher.launch(params.createIntent()); true
                } catch (e: ActivityNotFoundException) {
                    fileCallback = null; false
                }
            }
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized) js("window.__ritmNative && window.__ritmNative.onResume()")
    }

    private fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        catch (e: ActivityNotFoundException) { Toast.makeText(this, "Не нашлось приложения, чтобы открыть ссылку", Toast.LENGTH_SHORT).show() }
    }

    private fun refreshHealth() {
        lifecycleScope.launch {
            val data = try {
                withContext(Dispatchers.IO) { HealthReader.read(this@MainActivity) }
            } catch (e: Exception) {
                JSONObject().put("error", e.message ?: e.javaClass.simpleName)
            }
            js("window.__ritmNative && window.__ritmNative.onHealth(" + JSONObject.quote(data.toString()) + ")")
        }
    }

    inner class Bridge {
        @JavascriptInterface fun version(): String = "1"

        @JavascriptInterface fun status(): String {
            val ctx = this@MainActivity
            val sdk = when (HealthConnectClient.getSdkStatus(ctx)) {
                HealthConnectClient.SDK_AVAILABLE -> "available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update"
                else -> "unavailable"
            }
            return JSONObject()
                .put("health", sdk)
                .put("usage", HealthReader.usageGranted(ctx))
                .put("notifications", NotificationManagerCompat.from(ctx).areNotificationsEnabled())
                .toString()
        }

        @JavascriptInterface fun requestHealth() = runOnUiThread {
            val ctx = this@MainActivity
            when (HealthConnectClient.getSdkStatus(ctx)) {
                HealthConnectClient.SDK_AVAILABLE -> healthLauncher.launch(HealthReader.PERMISSIONS)
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> openExternal(
                    Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding")
                )
                else -> Toast.makeText(ctx, "Health Connect недоступен на этом телефоне", Toast.LENGTH_LONG).show()
            }
        }

        /** Разрешение читать Health Connect в фоне (нужно для уведомлений о прогулках, когда приложение закрыто). */
        @JavascriptInterface fun requestHealthBg() = runOnUiThread {
            try { healthLauncher.launch(setOf(HealthReader.BG)) }
            catch (e: Throwable) { Toast.makeText(this@MainActivity, "Фоновое чтение недоступно на этом телефоне", Toast.LENGTH_LONG).show() }
        }
        @JavascriptInterface fun setWalkWatch(json: String) = WalkWatcher.configure(this@MainActivity, json)

        @JavascriptInterface fun requestUsage() = runOnUiThread {
            try { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
            catch (e: ActivityNotFoundException) { startActivity(Intent(Settings.ACTION_SETTINGS)) }
        }

        @JavascriptInterface fun refreshHealth() = this@MainActivity.refreshHealth()

        @JavascriptInterface fun openAppSettings() = runOnUiThread {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
            } catch (e: ActivityNotFoundException) { startActivity(Intent(Settings.ACTION_SETTINGS)) }
        }

        @JavascriptInterface fun androidVersion(): Int = Build.VERSION.SDK_INT

        @JavascriptInterface fun requestNotifications() = runOnUiThread {
            if (Build.VERSION.SDK_INT >= 33) notifLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            else js("window.__ritmNative && window.__ritmNative.onNotifPermission(" +
                NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled() + ")")
        }

        @JavascriptInterface fun setReminders(morning: String, evening: String, enabled: Boolean) {
            Reminders.save(this@MainActivity, morning, evening, enabled)
            Reminders.schedule(this@MainActivity)
        }

        @JavascriptInterface fun setReview(time: String, enabled: Boolean) {
            Reminders.saveReview(this@MainActivity, time, enabled)
            Reminders.schedule(this@MainActivity)
        }

        /** Что реально сохранено для будильников: время, включённость, ближайший запуск, ограничения батареи. */
        @JavascriptInterface fun diag(): String {
            val p = getSharedPreferences(Reminders.PREFS, MODE_PRIVATE)
            val zone = java.time.ZoneId.systemDefault()
            fun next(hm: String?): String {
                val t = try { java.time.LocalTime.parse(hm ?: "") } catch (e: Exception) { return "—" }
                var at = java.time.ZonedDateTime.of(java.time.LocalDate.now(zone), t, zone)
                if (!at.isAfter(java.time.ZonedDateTime.now(zone))) at = at.plusDays(1)
                return at.format(java.time.format.DateTimeFormatter.ofPattern("dd.MM HH:mm"))
            }
            val pm = getSystemService(android.os.PowerManager::class.java)
            return JSONObject()
                .put("morning", p.getString("morning", null)).put("evening", p.getString("evening", null)).put("enabled", p.getBoolean("enabled", false))
                .put("review", p.getString("review", null)).put("reviewEnabled", p.getBoolean("reviewEnabled", false))
                .put("nextMorning", next(p.getString("morning", "08:45"))).put("nextEvening", next(p.getString("evening", "19:45")))
                .put("nextReview", next(p.getString("review", "23:00")))
                .put("batteryUnrestricted", pm.isIgnoringBatteryOptimizations(packageName))
                .put("notif", NotificationManagerCompat.from(this@MainActivity).areNotificationsEnabled())
                .toString()
        }

        @JavascriptInterface fun setCheckins(json: String) = Checkins.set(this@MainActivity, json)
        @JavascriptInterface fun setWatch(json: String) = Watcher.configure(this@MainActivity, json)
        @JavascriptInterface fun nudges(): String = Watcher.history(this@MainActivity).toString()
        @JavascriptInterface fun testWatch() = Watcher.check(this@MainActivity)
        @JavascriptInterface fun consumeFired(): String = Checkins.consumeFired(this@MainActivity)
        @JavascriptInterface fun consumeInbox(): String = Checkins.consumeInbox(this@MainActivity)
        @JavascriptInterface fun testCheckin() = Checkins.show(this@MainActivity, "Что делаешь?", "Проверка: так будут выглядеть вопросы днём. Можно ответить прямо отсюда.")

        @JavascriptInterface fun consumeOpen(): String {
            val v = pendingOpen ?: ""
            pendingOpen = null
            return v
        }

        @JavascriptInterface fun testReview() {
            Reminders.show(this@MainActivity, "review", test = true)
        }

        @JavascriptInterface fun saveSnapshot(json: String) {
            Reminders.saveSnapshot(this@MainActivity, json)
        }

        @JavascriptInterface fun testNotification() {
            Reminders.show(this@MainActivity, "evening", test = true)
        }

        @JavascriptInterface fun saveFile(name: String, content: String, mime: String): Boolean {
            val ctx = this@MainActivity
            return try {
                if (Build.VERSION.SDK_INT >= 29) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        put(MediaStore.Downloads.MIME_TYPE, mime)
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    }
                    val uri = ctx.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                    ctx.contentResolver.openOutputStream(uri)?.use { it.write(content.toByteArray()) }
                    if (mime == "text/calendar") runOnUiThread {
                        try { startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)) }
                        catch (e: ActivityNotFoundException) { }
                    }
                } else {
                    val dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return false
                    File(dir, name).writeText(content)
                }
                true
            } catch (e: Exception) { false }
        }
    }
}
