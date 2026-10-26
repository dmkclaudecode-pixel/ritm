package app.ritm

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Время в приложениях по дням: минуты по каждому приложению, минуты по часам суток и число разблокировок.
 * Нужен «Доступ к истории использования».
 */
object AppUsageReader {

    private class Day {
        val perApp = HashMap<String, Long>()     // мс
        val hours = LongArray(24)                // мс
        var pickups = 0
    }

    fun read(ctx: Context, days: Int = 8): JSONObject {
        val out = JSONObject()
        if (!HealthReader.usageGranted(ctx)) return out
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val from = today.minusDays((days - 1).toLong())
        val begin = from.atStartOfDay(zone).toInstant().toEpochMilli()
        val now = System.currentTimeMillis()
        val pm = ctx.packageManager
        val skip = HashSet<String>().apply {
            add(ctx.packageName)
            add("com.android.systemui")
            homePackages(pm).forEach { add(it) }
        }

        val byDay = HashMap<LocalDate, Day>()
        fun day(d: LocalDate) = byDay.getOrPut(d) { Day() }

        fun addInterval(pkg: String, a: Long, b: Long) {
            if (b <= a || pkg in skip) return
            var t = a
            while (t < b) {
                val zt = Instant.ofEpochMilli(t).atZone(zone)
                val hourEnd = zt.withMinute(0).withSecond(0).withNano(0).plusHours(1).toInstant().toEpochMilli()
                val end = minOf(b, hourEnd)
                val d = day(zt.toLocalDate())
                d.perApp[pkg] = (d.perApp[pkg] ?: 0L) + (end - t)
                d.hours[zt.hour] += end - t
                t = end
            }
        }

        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = usm.queryEvents(begin, now)
        val ev = UsageEvents.Event()
        val open = HashMap<String, Long>()
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            val pkg = ev.packageName ?: continue
            val t = ev.timeStamp
            when (ev.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> if (!open.containsKey(pkg)) open[pkg] = t
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> open.remove(pkg)?.let { addInterval(pkg, it, t) }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> { for ((p, a) in open) addInterval(p, a, t); open.clear() }
                UsageEvents.Event.KEYGUARD_HIDDEN -> day(Instant.ofEpochMilli(t).atZone(zone).toLocalDate()).pickups++
            }
        }
        for ((p, a) in open) addInterval(p, a, now)

        val labels = HashMap<String, Pair<String, Int>>()
        fun info(pkg: String): Pair<String, Int> = labels.getOrPut(pkg) {
            try {
                val ai = pm.getApplicationInfo(pkg, 0)
                val cat = if (Build.VERSION.SDK_INT >= 26) ai.category else -1
                val game = if (cat == -1 && (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0) 0 else cat
                Pair(pm.getApplicationLabel(ai).toString(), game)
            } catch (e: PackageManager.NameNotFoundException) { Pair(pkg, -1) }
        }

        for ((d, data) in byDay) {
            val list = JSONArray()
            data.perApp.entries.sortedByDescending { it.value }.take(25).forEach { (pkg, ms) ->
                val min = ms / 60000
                if (min < 1) return@forEach
                val (label, cat) = info(pkg)
                list.put(JSONObject().put("p", pkg).put("l", label).put("m", min).put("c", cat))
            }
            val hours = JSONArray(); data.hours.forEach { hours.put(it / 60000) }
            out.put(d.toString(), JSONObject()
                .put("total", data.perApp.values.sum() / 60000)
                .put("pickups", data.pickups)
                .put("hours", hours)
                .put("apps", list))
        }
        return out
    }

    private fun homePackages(pm: PackageManager): List<String> = try {
        val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        pm.queryIntentActivities(i, 0).map { it.activityInfo.packageName }
    } catch (e: Exception) { emptyList() }
}
