package app.ritm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

object Reminders {
    private const val CHANNEL = "ritm_daily"
    private const val PREFS = "ritm"

    fun ensureChannel(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Напоминания на день", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Утренний план и вечерняя проверка"
                }
            )
        }
    }

    fun save(ctx: Context, morning: String, evening: String, enabled: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("morning", morning).putString("evening", evening).putBoolean("enabled", enabled).apply()
    }

    fun saveReview(ctx: Context, time: String, enabled: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("review", time).putBoolean("reviewEnabled", enabled).apply()
    }

    private fun code(kind: String) = when (kind) { "morning" -> 1; "evening" -> 2; else -> 3 }

    fun saveSnapshot(ctx: Context, json: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", json).apply()
    }

    private fun pending(ctx: Context, kind: String): PendingIntent {
        val i = Intent(ctx, ReminderReceiver::class.java).putExtra("kind", kind)
        return PendingIntent.getBroadcast(
            ctx, code(kind), i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    fun schedule(ctx: Context) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val am = ctx.getSystemService(AlarmManager::class.java)
        for (kind in listOf("morning", "evening", "review")) {
            am.cancel(pending(ctx, kind))
            val on = if (kind == "review") p.getBoolean("reviewEnabled", false) else p.getBoolean("enabled", false)
            if (!on) continue
            val hm = p.getString(kind, when (kind) { "morning" -> "08:45"; "evening" -> "19:45"; else -> "23:00" }) ?: continue
            val t = try { LocalTime.parse(hm) } catch (e: Exception) { continue }
            val zone = ZoneId.systemDefault()
            var at = ZonedDateTime.of(LocalDate.now(zone), t, zone)
            if (!at.isAfter(ZonedDateTime.now(zone))) at = at.plusDays(1)
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toInstant().toEpochMilli(), pending(ctx, kind))
        }
    }

    @SuppressLint("MissingPermission")
    fun show(ctx: Context, kind: String, test: Boolean = false) {
        ensureChannel(ctx)
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val today = LocalDate.now().toString()
        var title = when (kind) { "morning" -> "План на сегодня"; "review" -> "Пора подвести итоги дня"; else -> "Как прошёл день?" }
        var text = when (kind) {
            "morning" -> "Откройте Ритм недели: дела на сегодня и советы."
            "review" -> "Две минуты: отметьте, что и сколько делали, и получите разбор и план на завтра."
            else -> "Отметьте сделанное, сон, энергию и настроение."
        }
        try {
            val snap = JSONObject(p.getString("snapshot", "{}") ?: "{}")
            val day = snap.optJSONObject("days")?.optJSONObject(today)?.optJSONObject(kind)
            if (day != null) {
                title = day.optString("title", title)
                text = day.optString("text", text)
            }
        } catch (e: Exception) { }
        if (test) title = "Проверка: $title"

        val open = PendingIntent.getActivity(
            ctx, 100 + code(kind), Intent(ctx, MainActivity::class.java).putExtra("open", kind).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(0xFF0F7A73.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        val nm = NotificationManagerCompat.from(ctx)
        if (nm.areNotificationsEnabled()) {
            try { nm.notify(10 + code(kind), n) } catch (e: SecurityException) { }
        }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Reminders.show(ctx, intent.getStringExtra("kind") ?: "morning")
        Reminders.schedule(ctx)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = Reminders.schedule(ctx)
}
