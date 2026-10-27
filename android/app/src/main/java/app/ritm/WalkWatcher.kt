package app.ritm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Фоновый поиск прогулок по шагам: раз в 30 минут читает шаги из Health Connect (нужно разрешение
 * «читать в фоне»), и если нашёл не записанную прогулку, присылает уведомление. Запись и вопрос с кнопками
 * приложение показывает само, когда его открывают.
 */
object WalkWatcher {
    private const val PREFS = "ritm"
    private const val NID = 41
    private const val EVERY = 30 * 60_000L

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun cfg(ctx: Context): JSONObject = try { JSONObject(prefs(ctx).getString("walkWatch", "{}")) } catch (e: Exception) { JSONObject() }

    fun configure(ctx: Context, json: String) {
        prefs(ctx).edit().putString("walkWatch", json).apply()
        schedule(ctx, 60_000L)
    }

    private fun pi(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(ctx, 60, Intent(ctx, WalkReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun schedule(ctx: Context, delay: Long = EVERY) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        am.cancel(pi(ctx))
        if (!cfg(ctx).optBoolean("enabled", false)) return
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delay, pi(ctx))
    }

    class Seg(val start: Long, val end: Long, val steps: Long) { val min get() = (end - start) / 60000 }

    /** Подряд идущие 10-минутные отрезки с темпом не меньше 60 шагов в минуту; минимум 20 минут и 1200 шагов. */
    fun segments(b: JSONArray, now: Long): List<Seg> {
        val list = (0 until b.length()).map { b.getJSONObject(it) }.map { it.getLong("t") to it.getLong("n") }.sortedBy { it.first }
        val out = ArrayList<Seg>()
        var s = 0L; var e = 0L; var hotEnd = 0L; var steps = 0L; var lastHot = false; var open = false
        fun close() { if (open) { out.add(Seg(s, hotEnd, steps)); open = false } }
        for ((t, n) in list) {
            val hot = n >= 600; val warm = n >= 200
            if (open && t - e <= 10 * 60_000L && (hot || (warm && lastHot))) { e = t + 10 * 60_000L; steps += n; lastHot = hot; if (hot) hotEnd = e; continue }
            close()
            if (hot) { open = true; s = t; e = t + 10 * 60_000L; hotEnd = e; steps = n; lastHot = true }
        }
        close()
        return out.filter { it.min >= 20 && it.steps >= 1200 && it.end <= now - 10 * 60_000L }
    }

    @SuppressLint("MissingPermission")
    fun check(ctx: Context) {
        schedule(ctx)
        val c = cfg(ctx)
        if (!c.optBoolean("enabled", false)) return
        val zone = ZoneId.systemDefault()
        val now = System.currentTimeMillis()
        val hourNow = Instant.ofEpochMilli(now).atZone(zone).hour
        if (hourNow < 8 || hourNow >= 22) return
        val buckets = runBlocking { HealthReader.stepBuckets(ctx, 4) } ?: return
        val p = prefs(ctx)
        val seen = try { JSONArray(p.getString("walkSeenNative", "[]")) } catch (e: Exception) { JSONArray() }
        val seenSet = HashSet<Long>(); for (i in 0 until seen.length()) seenSet.add(seen.getLong(i))
        val bad = c.optJSONArray("bad")?.let { a -> (0 until a.length()).map { a.getInt(it) }.toSet() } ?: emptySet()
        val today = LocalDate.now().toString()
        var sentToday = if (p.getString("walkDay", "") == today) p.getInt("walkCount", 0) else 0
        for (g in segments(buckets, now)) {
            if (g.start in seenSet) continue
            seenSet.add(g.start)
            val h = Instant.ofEpochMilli(g.start).atZone(zone).hour
            if (h in bad || sentToday >= 3) continue
            sentToday++
            val t0 = Instant.ofEpochMilli(g.start).atZone(zone).toLocalTime().toString().take(5)
            val t1 = Instant.ofEpochMilli(g.end).atZone(zone).toLocalTime().toString().take(5)
            notify(ctx, "Заметил прогулку", "С $t0 до $t1 вы шли около ${g.min} минут, ${g.steps} шагов. Откройте Ритм, чтобы подтвердить.")
        }
        val keep = JSONArray(); seenSet.sortedDescending().take(60).forEach { keep.put(it) }
        p.edit().putString("walkSeenNative", keep.toString()).putString("walkDay", today).putInt("walkCount", sentToday).apply()
    }

    @SuppressLint("MissingPermission")
    private fun notify(ctx: Context, title: String, text: String) {
        Checkins.ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, 132, Intent(ctx, MainActivity::class.java).putExtra("open", "today").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, "ritm_chat").setSmallIcon(R.drawable.ic_notify).setColor(0xFF0F7A73.toInt())
            .setContentTitle(title).setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open).setAutoCancel(true).build()
        val nm = NotificationManagerCompat.from(ctx)
        if (nm.areNotificationsEnabled()) try { nm.notify(NID, n) } catch (e: SecurityException) { }
    }
}

class WalkReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val pending = goAsync()
        Thread { try { WalkWatcher.check(ctx) } catch (e: Throwable) { } finally { pending.finish() } }.start()
    }
}
