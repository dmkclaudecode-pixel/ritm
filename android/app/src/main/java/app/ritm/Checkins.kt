package app.ritm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import org.json.JSONArray
import org.json.JSONObject

/** Сообщения от Ритма днём: пуш с вопросом, ответ прямо из шторки попадает в чат. */
object Checkins {
    private const val PREFS = "ritm"
    private const val CHANNEL = "ritm_chat"
    private const val KEY_REPLY = "reply"
    private val lock = Any()

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun ensureChannel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Сообщения от Ритма", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Вопросы днём: что делаешь, обед, напоминания о планах"
            })
        }
    }

    fun set(ctx: Context, json: String) {
        prefs(ctx).edit().putString("checkins", json).apply()
        schedule(ctx)
    }

    private fun pending(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(ctx, 4, Intent(ctx, CheckinReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        am.cancel(pending(ctx))
        val list = try { JSONArray(prefs(ctx).getString("checkins", "[]")) } catch (e: Exception) { JSONArray() }
        val fired = firedIds(ctx)
        val now = System.currentTimeMillis()
        var next = Long.MAX_VALUE
        for (i in 0 until list.length()) {
            val o = list.getJSONObject(i)
            val at = o.optLong("at")
            if (at > now - 60_000 && o.optString("id") !in fired && at < next) next = at
        }
        if (next != Long.MAX_VALUE) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, maxOf(next, now + 5_000), pending(ctx))
    }

    private fun firedIds(ctx: Context): Set<String> {
        val arr = try { JSONArray(prefs(ctx).getString("firedIds", "[]")) } catch (e: Exception) { JSONArray() }
        return (0 until arr.length()).map { arr.getString(it) }.toSet()
    }

    fun fire(ctx: Context) {
        val list = try { JSONArray(prefs(ctx).getString("checkins", "[]")) } catch (e: Exception) { JSONArray() }
        val now = System.currentTimeMillis()
        val fired = firedIds(ctx).toMutableSet()
        var due: JSONObject? = null
        for (i in 0 until list.length()) {
            val o = list.getJSONObject(i)
            if (o.optString("id") in fired) continue
            val at = o.optLong("at")
            if (at <= now + 120_000) {
                fired.add(o.optString("id"))
                if (now - at < 30 * 60_000) due = o   // старые пропущенные не показываем
            }
        }
        synchronized(lock) {
            prefs(ctx).edit().putString("firedIds", JSONArray(fired.toList().takeLast(200)).toString()).apply()
        }
        if (due != null) {
            show(ctx, due.optString("title"), due.optString("text"))
            synchronized(lock) {
                val arr = try { JSONArray(prefs(ctx).getString("fired", "[]")) } catch (e: Exception) { JSONArray() }
                arr.put(JSONObject(due.toString()).put("firedAt", now))
                prefs(ctx).edit().putString("fired", arr.toString()).apply()
            }
        }
        schedule(ctx)
    }

    @SuppressLint("MissingPermission")
    fun show(ctx: Context, title: String, text: String, nid: Int = 30) {
        ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, 130, Intent(ctx, MainActivity::class.java).putExtra("open", "chat")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val replyFlags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        val replyPi = PendingIntent.getBroadcast(ctx, 140, Intent(ctx, ReplyReceiver::class.java).putExtra("nid", nid), replyFlags)
        val remote = RemoteInput.Builder(KEY_REPLY).setLabel("Ответить Ритму").build()
        val action = NotificationCompat.Action.Builder(R.drawable.ic_notify, "Ответить", replyPi)
            .addRemoteInput(remote).setAllowGeneratedReplies(true).build()
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(0xFF0F7A73.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .addAction(action)
            .setAutoCancel(true)
            .build()
        val nm = NotificationManagerCompat.from(ctx)
        if (nm.areNotificationsEnabled()) try { nm.notify(nid, n) } catch (e: SecurityException) { }
    }

    @SuppressLint("MissingPermission")
    fun onReply(ctx: Context, intent: Intent) {
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_REPLY)?.toString()?.trim().orEmpty()
        val nid = intent.getIntExtra("nid", 30)
        if (text.isNotEmpty()) synchronized(lock) {
            val arr = try { JSONArray(prefs(ctx).getString("inbox", "[]")) } catch (e: Exception) { JSONArray() }
            arr.put(JSONObject().put("text", text).put("at", System.currentTimeMillis()))
            prefs(ctx).edit().putString("inbox", arr.toString()).apply()
        }
        ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, 130, Intent(ctx, MainActivity::class.java).putExtra("open", "chat")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val done = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(0xFF0F7A73.toInt())
            .setContentTitle("Записал")
            .setContentText(if (text.isNotEmpty()) "«$text». Мой ответ — в чате." else "Открой чат, чтобы продолжить.")
            .setContentIntent(open)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setTimeoutAfter(15_000)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(nid, done) } catch (e: SecurityException) { }
    }

    private fun consume(ctx: Context, key: String): String = synchronized(lock) {
        val v = prefs(ctx).getString(key, "[]") ?: "[]"
        prefs(ctx).edit().putString(key, "[]").apply()
        v
    }
    fun consumeFired(ctx: Context) = consume(ctx, "fired")
    fun consumeInbox(ctx: Context) = consume(ctx, "inbox")
}

class CheckinReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = Checkins.fire(ctx)
}

class ReplyReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = Checkins.onReply(ctx, intent)
}
