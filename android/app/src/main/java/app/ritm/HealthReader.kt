package app.ritm

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

object HealthReader {
    private val STEPS = HealthPermission.getReadPermission(StepsRecord::class)
    private val SLEEP = HealthPermission.getReadPermission(SleepSessionRecord::class)
    val PERMISSIONS = setOf(STEPS, SLEEP)
    private val HM = DateTimeFormatter.ofPattern("HH:mm")
    private val DT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")

    /** Шаги и сон за последние 14 дней. Ключ — дата (для сна — дата пробуждения). */
    suspend fun read(ctx: Context): JSONObject {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        val from = today.minusDays(13)
        val steps = JSONObject()
        val sleep = JSONObject()
        val sessions = JSONArray()
        var granted: Set<String> = emptySet()

        if (HealthConnectClient.getSdkStatus(ctx) == HealthConnectClient.SDK_AVAILABLE) {
            val client = HealthConnectClient.getOrCreate(ctx)
            granted = client.permissionController.getGrantedPermissions()

            if (STEPS in granted) {
                val res = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(from.atStartOfDay(), today.plusDays(1).atStartOfDay()),
                        timeRangeSlicer = Period.ofDays(1)
                    )
                )
                for (r in res) {
                    val c = r.result[StepsRecord.COUNT_TOTAL] ?: continue
                    steps.put(r.startTime.toLocalDate().toString(), c)
                }
            }

            if (SLEEP in granted) {
                val res = client.readRecords(
                    ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(
                            from.minusDays(1).atStartOfDay(zone).toInstant(), Instant.now()
                        )
                    )
                )
                for (s in res.records) {
                    val mins = Duration.between(s.startTime, s.endTime).toMinutes()
                    // все сессии от 20 минут: дневной и вечерний сон тоже считается в сутки
                    if (mins >= 20) sessions.put(JSONObject()
                        .put("s", s.startTime.atZone(zone).format(DT))
                        .put("e", s.endTime.atZone(zone).format(DT))
                        .put("m", mins))
                    if (mins < 120) continue
                    putSleep(sleep, s.startTime.atZone(zone), s.endTime.atZone(zone), mins, "hc")
                }
            }
        }

        val usage = usageGranted(ctx)
        if (usage && Build.VERSION.SDK_INT >= 28) {
            val est = estimateSleepFromScreen(ctx, from, zone)
            for (key in est.keys()) if (!sleep.has(key)) sleep.put(key, est.getJSONObject(key))
        }

        val apps = if (usage) try { AppUsageReader.read(ctx) } catch (e: Exception) { JSONObject() } else JSONObject()

        return JSONObject()
            .put("apps", apps)
            .put("steps", steps)
            .put("sleep", sleep)
            .put("sessions", sessions)
            .put("stepsGranted", STEPS in granted)
            .put("sleepGranted", SLEEP in granted)
            .put("usage", usage)
            .put("at", System.currentTimeMillis())
    }

    private fun putSleep(out: JSONObject, start: ZonedDateTime, end: ZonedDateTime, mins: Long, src: String) {
        val key = end.toLocalDate().toString()
        val prev = out.optJSONObject(key)
        if (prev != null && prev.optLong("min") >= mins) return
        out.put(key, JSONObject()
            .put("start", start.format(HM))
            .put("end", end.format(HM))
            .put("min", mins)
            .put("src", src))
    }

    fun usageGranted(ctx: Context): Boolean {
        val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= 29)
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        else
            @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * Примерная оценка сна по телефону: самый длинный ночной промежуток между разблокировками.
     * Засыпание — первое выключение экрана после последней вечерней разблокировки.
     */
    private fun estimateSleepFromScreen(ctx: Context, from: LocalDate, zone: ZoneId): JSONObject {
        val out = JSONObject()
        if (Build.VERSION.SDK_INT < 28) return out
        val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val begin = from.minusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
        val events = usm.queryEvents(begin, System.currentTimeMillis())
        val unlocks = ArrayList<Long>()
        val screenOn = ArrayList<Long>()
        val screenOff = ArrayList<Long>()
        val ev = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(ev)
            when (ev.eventType) {
                UsageEvents.Event.KEYGUARD_HIDDEN -> unlocks.add(ev.timeStamp)
                UsageEvents.Event.SCREEN_INTERACTIVE -> screenOn.add(ev.timeStamp)
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> screenOff.add(ev.timeStamp)
            }
        }
        val active = if (unlocks.size >= 4) unlocks else screenOn
        active.sort(); screenOff.sort()
        for (i in 0 until active.size - 1) {
            val a = active[i]; val b = active[i + 1]
            val off = screenOff.firstOrNull { it in (a + 1) until b } ?: a
            val mins = (b - off) / 60000
            if (mins < 180 || mins > 14 * 60) continue
            val start = Instant.ofEpochMilli(off).atZone(zone)
            val end = Instant.ofEpochMilli(b).atZone(zone)
            val startOk = start.hour >= 19 || start.hour < 6
            val endOk = end.hour in 3..13
            if (startOk && endOk) putSleep(out, start, end, mins, "phone")
        }
        return out
    }
}
