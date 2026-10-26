package app.ritm

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * Присмотр за развлекательными приложениями: раз в 30 минут смотрит, что открыто и сколько,
 * пишет замечание, принимает ответ («по работе», «ладно, выключаю» или свой текст)
 * и через 15 минут проверяет, послушались ли.
 */
object Watcher {
    private const val PREFS = "ritm"
    private const val NID = 40
    private const val CHECK_EVERY = 30 * 60_000L
    private const val FOLLOW_UP = 15 * 60_000L
    private val ENT_CATEGORIES = setOf(0, 2, 4, 5) // игры, видео, соцсети, новости
    private val lock = Any()

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun cfg(ctx: Context): JSONObject = try { JSONObject(prefs(ctx).getString("watch", "{}")) } catch (e: Exception) { JSONObject() }

    fun configure(ctx: Context, json: String) {
        prefs(ctx).edit().putString("watch", json).apply()
        schedule(ctx, CHECK_EVERY)
    }

    private fun pi(ctx: Context, code: Int, action: String, extra: (Intent) -> Unit = {}): PendingIntent {
        val i = Intent(ctx, WatchReceiver::class.java).setAction(action).also(extra)
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun schedule(ctx: Context, delay: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val p = pi(ctx, 50, "check")
        am.cancel(p)
        if (!cfg(ctx).optBoolean("enabled", false) || !HealthReader.usageGranted(ctx)) return
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delay, p)
    }

    private fun isEnt(ctx: Context, pkg: String, c: JSONObject): Boolean {
        val ent = c.optJSONArray("ent"); val non = c.optJSONArray("nonEnt")
        if (non != null) for (i in 0 until non.length()) if (non.getString(i) == pkg) return false
        if (ent != null) for (i in 0 until ent.length()) if (ent.getString(i) == pkg) return true
        return try {
            val ai = ctx.packageManager.getApplicationInfo(pkg, 0)
            Build.VERSION.SDK_INT >= 26 && ai.category in ENT_CATEGORIES
        } catch (e: PackageManager.NameNotFoundException) { false }
    }

    private fun label(ctx: Context, pkg: String): String = try {
        ctx.packageManager.getApplicationLabel(ctx.packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) { pkg }

    /** Минуты по приложениям в окне [from, to] и приложение, открытое сейчас. */
    private fun usage(ctx: Context, from: Long, to: Long): Pair<Map<String, Long>, String?> {
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(from - 6 * 3600_000L, to)
        val ev = UsageEvents.Event()
        val open = HashMap<String, Long>()
        val total = HashMap<String, Long>()
        fun add(p: String, a: Long, b: Long) { val s = maxOf(a, from); val e = minOf(b, to); if (e > s) total[p] = (total[p] ?: 0L) + (e - s) }
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val p = ev.packageName ?: continue
            when (ev.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> if (!open.containsKey(p)) open[p] = ev.timeStamp
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> open.remove(p)?.let { add(p, it, ev.timeStamp) }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> { for ((k, a) in open) add(k, a, ev.timeStamp); open.clear() }
            }
        }
        var current: String? = null; var latest = 0L
        for ((k, a) in open) { add(k, a, to); if (a > latest) { latest = a; current = k } }
        return Pair(total.mapValues { it.value / 60000 }, current)
    }

    private fun inWindow(c: JSONObject): Boolean {
        val now = LocalTime.now()
        val wake = try { LocalTime.parse(c.optString("wake", "08:00")) } catch (e: Exception) { LocalTime.of(8, 0) }
        return now.isAfter(wake) || now.isBefore(LocalTime.of(2, 0))
    }

    private fun exempt(ctx: Context, pkg: String): Boolean {
        val ex = try { JSONObject(prefs(ctx).getString("watchExempt", "{}")) } catch (e: Exception) { JSONObject() }
        return ex.optString(pkg) == LocalDate.now().toString()
    }

    fun check(ctx: Context) {
        val c = cfg(ctx)
        schedule(ctx, CHECK_EVERY)
        if (!c.optBoolean("enabled", false) || !HealthReader.usageGranted(ctx) || !inWindow(c)) return
        val p = prefs(ctx)
        if (System.currentTimeMillis() - p.getLong("lastNudge", 0) < 50 * 60_000L) return
        val now = System.currentTimeMillis()
        val sessionLimit = c.optLong("sessionMin", 40)
        val limits = c.optJSONObject("limits") ?: JSONObject()
        val notes = c.optJSONObject("notes") ?: JSONObject()
        fun limitOf(p: String): Long = if (limits.has(p)) limits.optLong(p) else if (isEnt(ctx, p, c)) sessionLimit else 0L
        val (lastHour, current) = usage(ctx, now - 60 * 60_000L, now)
        val dayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val (today, _) = usage(ctx, dayStart, now)
        val entToday = today.filter { limitOf(it.key) > 0 && !exempt(ctx, it.key) }.values.sum()
        val dayLimit = c.optLong("dayLimit", 120)
        val off = try { LocalTime.parse(c.optString("off", "22:30")) } catch (e: Exception) { LocalTime.of(22, 30) }
        val workFrom = c.optString("workFrom", ""); val workTo = c.optString("workTo", "")
        val workDay = c.optJSONArray("workDays")?.let { arr -> (0 until arr.length()).any { arr.getInt(it) == LocalDate.now().dayOfWeek.value - 1 } } ?: false

        val cand = lastHour.filter { limitOf(it.key) > 0 && !exempt(ctx, it.key) }
            .maxByOrNull { it.value.toDouble() / limitOf(it.key) } ?: return
        val pkg = cand.key; val min = cand.value; val lim = limitOf(pkg)
        val note = notes.optString(pkg, "")
        val nowT = LocalTime.now()
        val late = nowT.isAfter(off) || nowT.isBefore(LocalTime.of(4, 0))
        val atWork = workDay && workFrom.isNotEmpty() && workTo.isNotEmpty() &&
            nowT.isAfter(LocalTime.parse(workFrom)) && nowT.isBefore(LocalTime.parse(workTo))
        val name = label(ctx, pkg)
        val reason: String; val text: String
        when {
            min >= lim -> { reason = "session"; text = "Друг, ты в $name уже около $min минут за последний час. " + (if (note.isNotEmpty()) "$note " else "") + "Давай сделаем перерыв: встань, попей воды, пройдись пару минут." }
            late && min >= 15 -> { reason = "late"; text = "Уже ${nowT.toString().take(5)}, а ты в $name ($min мин за последний час). Экран перед сном мешает заснуть. Завязываем?" }
            atWork && min >= 20 -> { reason = "work"; text = "Ты же сейчас на работе, а в $name уже $min минут. Это точно по делу?" }
            entToday >= dayLimit && min >= 15 && pkg == current -> { reason = "day"; text = "На развлечения сегодня уже ${entToday / 60} ч ${entToday % 60} мин при лимите ${dayLimit / 60} ч. $name опять открыт. Может, на сегодня хватит?" }
            else -> return
        }
        val id = "n" + now
        val rec = JSONObject().put("id", id).put("at", now).put("pkg", pkg).put("label", name).put("reason", reason).put("min", min).put("response", "").put("outcome", "")
        synchronized(lock) {
            val arr = history(ctx); arr.put(rec)
            val trimmed = JSONArray(); val from = maxOf(0, arr.length() - 150); for (i in from until arr.length()) trimmed.put(arr.get(i))
            p.edit().putString("nudges", trimmed.toString()).putLong("lastNudge", now).putString("activeNudge", id).apply()
        }
        Checkins.addBot(ctx, text, "nudge")
        show(ctx, id, "Перерыв?", text)
        ctx.getSystemService(AlarmManager::class.java)
            .setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now + FOLLOW_UP, pi(ctx, 51, "follow") { it.putExtra("id", id) })
    }

    @SuppressLint("MissingPermission")
    private fun show(ctx: Context, id: String, title: String, text: String) {
        Checkins.ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, 131, Intent(ctx, MainActivity::class.java).putExtra("open", "chat")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val replyFlags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        val replyPi = PendingIntent.getBroadcast(ctx, 52, Intent(ctx, WatchReceiver::class.java).setAction("reply").putExtra("id", id), replyFlags)
        val remote = RemoteInput.Builder("reply").setLabel("Ответить Ритму").build()
        val n = NotificationCompat.Builder(ctx, "ritm_chat")
            .setSmallIcon(R.drawable.ic_notify)
            .setColor(0xFF0F7A73.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_notify, "Ладно, выключаю", pi(ctx, 53, "comply") { it.putExtra("id", id) }).build())
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_notify, "Это по работе", pi(ctx, 54, "work") { it.putExtra("id", id) }).build())
            .addAction(NotificationCompat.Action.Builder(R.drawable.ic_notify, "Ответить", replyPi).addRemoteInput(remote).build())
            .setAutoCancel(true)
            .build()
        val nm = NotificationManagerCompat.from(ctx)
        if (nm.areNotificationsEnabled()) try { nm.notify(NID, n) } catch (e: SecurityException) { }
    }

    @SuppressLint("MissingPermission")
    private fun info(ctx: Context, title: String, text: String) {
        val n = NotificationCompat.Builder(ctx, "ritm_chat").setSmallIcon(R.drawable.ic_notify).setColor(0xFF0F7A73.toInt())
            .setContentTitle(title).setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOnlyAlertOnce(true).setAutoCancel(true).setTimeoutAfter(20_000).build()
        try { NotificationManagerCompat.from(ctx).notify(NID, n) } catch (e: SecurityException) { }
    }

    fun history(ctx: Context): JSONArray = try { JSONArray(prefs(ctx).getString("nudges", "[]")) } catch (e: Exception) { JSONArray() }

    private fun update(ctx: Context, id: String, f: (JSONObject) -> Unit): JSONObject? = synchronized(lock) {
        val arr = history(ctx); var found: JSONObject? = null
        for (i in 0 until arr.length()) { val o = arr.getJSONObject(i); if (o.optString("id") == id) { f(o); found = o } }
        prefs(ctx).edit().putString("nudges", arr.toString()).apply()
        found
    }

    fun classify(text: String): String {
        val t = text.lowercase()
        return when {
            Regex("работ|учеб|учёб|по делу|для дела|нужно для|надо для|созвон|митинг|проект|клиент|заказ").containsMatchIn(t) -> "work"
            Regex("ладно|ок|окей|хорошо|понял|поняла|выключ|закрыва|закрою|убираю|сейчас|договорились|да,|^да$|прав").containsMatchIn(t) -> "comply"
            Regex("отстань|не хочу|нет|потом|еще чуть|ещё чуть|5 минут|пять минут|не мешай").containsMatchIn(t) -> "refuse"
            else -> "text"
        }
    }

    fun respond(ctx: Context, id: String, kind: String, text: String?) {
        val rec = update(ctx, id) { it.put("response", kind); if (text != null) it.put("reply", text) } ?: return
        val name = rec.optString("label")
        Checkins.addMe(ctx, text ?: if (kind == "work") "Это по работе" else "Ладно, выключаю", "nudge")
        when (kind) {
            "work" -> {
                val ex = try { JSONObject(prefs(ctx).getString("watchExempt", "{}")) } catch (e: Exception) { JSONObject() }
                ex.put(rec.optString("pkg"), LocalDate.now().toString())
                prefs(ctx).edit().putString("watchExempt", ex.toString()).apply()
                update(ctx, id) { it.put("outcome", "exempt") }
                val msg = "Понял, это по работе. Сегодня больше не трогаю тебя из-за $name."
                Checkins.addBot(ctx, msg, "nudge-result"); info(ctx, "Понял", msg)
            }
            "comply" -> { val msg = "Договорились! Загляну через 15 минут."; Checkins.addBot(ctx, msg, "nudge-result"); info(ctx, "Договорились", msg) }
            "refuse" -> { val msg = "Ладно, ещё немного, но я проверю через 15 минут."; Checkins.addBot(ctx, msg, "nudge-result"); info(ctx, "Хорошо", msg) }
            else -> { val msg = "Записал. Проверю через 15 минут, как дела с $name."; Checkins.addBot(ctx, msg, "nudge-result"); info(ctx, "Записал", msg) }
        }
    }

    fun followUp(ctx: Context, id: String) {
        val rec = history(ctx).let { arr -> (0 until arr.length()).map { arr.getJSONObject(it) }.firstOrNull { it.optString("id") == id } } ?: return
        if (rec.optString("outcome").isNotEmpty()) return
        val pkg = rec.optString("pkg"); val name = rec.optString("label")
        val (used, _) = usage(ctx, rec.optLong("at") + 60_000L, System.currentTimeMillis())
        val m = used[pkg] ?: 0L
        val promised = rec.optString("response") == "comply"
        if (m >= 7) {
            update(ctx, id) { it.put("outcome", "ignored").put("after", m) }
            val msg = if (promised) "Эй, ты обещал выключить, а $name всё ещё открыт: $m минут после нашего разговора. Давай всё-таки перерыв?"
                      else "Вижу, $name всё ещё открыт: ещё $m минут. Давай всё-таки сделаем перерыв?"
            Checkins.addBot(ctx, msg, "nudge-result")
            show(ctx, id + "f", "Всё ещё в $name", msg)
        } else {
            update(ctx, id) { it.put("outcome", "obeyed").put("after", m) }
            Checkins.addBot(ctx, if (promised) "Ты сдержал слово и отложил $name. Так держать!" else "Вижу, ты отложил $name. Молодец!", "nudge-result")
        }
    }
}

class WatchReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = (intent.getStringExtra("id") ?: "").removeSuffix("f")
        when (intent.action) {
            "check" -> Watcher.check(ctx)
            "follow" -> Watcher.followUp(ctx, id)
            "comply" -> Watcher.respond(ctx, id, "comply", null)
            "work" -> Watcher.respond(ctx, id, "work", null)
            "reply" -> {
                val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence("reply")?.toString()?.trim().orEmpty()
                if (text.isNotEmpty()) Watcher.respond(ctx, id, Watcher.classify(text), text)
            }
        }
    }
}
