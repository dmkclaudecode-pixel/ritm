package app.ritm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

/**
 * Виджет: вода, кофеин и шаги за сегодня + кнопки «вода», «кофе», «чай».
 * Цифры присылает приложение (setWidget), кнопки пишут во «входящие» Checkins как обычное сообщение с временем нажатия
 * и сразу прибавляют к показанным цифрам; точные значения пересчитает приложение при следующем открытии.
 */
class WidgetProvider : AppWidgetProvider() {

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val rv = build(ctx)
        for (id in ids) mgr.updateAppWidget(id, rv)
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        val now = LocalTime.now().let { String.format(Locale.US, "%02d:%02d", it.hour, it.minute) }
        when (intent.action) {
            ACT_WATER -> quick(ctx, "выпил стакан воды в $now", water = 250, mg = 0)
            ACT_COFFEE -> quick(ctx, "выпил кофе в $now", water = 200, mg = 90)
            ACT_TEA -> quick(ctx, "выпил чай в $now", water = 200, mg = 45)
        }
    }

    private fun quick(ctx: Context, text: String, water: Int, mg: Int) {
        Checkins.addMe(ctx, text, "widget")
        val j = read(ctx)
        j.put("water", j.optInt("water") + water).put("mg", j.optInt("mg") + mg)
        ctx.getSharedPreferences("ritm", Context.MODE_PRIVATE).edit().putString("widget", j.toString()).apply()
        refresh(ctx)
    }

    companion object {
        const val ACT_WATER = "app.ritm.widget.WATER"
        const val ACT_COFFEE = "app.ritm.widget.COFFEE"
        const val ACT_TEA = "app.ritm.widget.TEA"

        private fun read(ctx: Context): JSONObject {
            val j = try { JSONObject(ctx.getSharedPreferences("ritm", Context.MODE_PRIVATE).getString("widget", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
            // новые сутки: старые цифры не показываем, пока приложение не пришлёт свежие
            if (j.optString("date") != LocalDate.now().toString()) {
                return JSONObject().put("date", LocalDate.now().toString()).put("water", 0).put("mg", 0).put("steps", -1)
                    .put("waterGoal", j.optInt("waterGoal", 2000)).put("mgMax", j.optInt("mgMax", 400)).put("stepsGoal", j.optInt("stepsGoal", 7000))
            }
            return j
        }

        fun set(ctx: Context, json: String) {
            ctx.getSharedPreferences("ritm", Context.MODE_PRIVATE).edit().putString("widget", json).apply()
            refresh(ctx)
        }

        fun refresh(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, WidgetProvider::class.java))
            if (ids.isNotEmpty()) mgr.updateAppWidget(ids, build(ctx))
        }

        private fun pi(ctx: Context, code: Int, action: String): PendingIntent =
            PendingIntent.getBroadcast(ctx, code, Intent(ctx, WidgetProvider::class.java).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        private fun fmt(n: Int): String = String.format(Locale("ru"), "%,d", n).replace(',', ' ')

        fun build(ctx: Context): RemoteViews {
            val j = read(ctx)
            val rv = RemoteViews(ctx.packageName, R.layout.widget_ritm)
            val water = j.optInt("water")
            val mg = j.optInt("mg"); val mgMax = j.optInt("mgMax", 400)
            val steps = j.optInt("steps", -1)
            rv.setTextViewText(R.id.w_water, if (water >= 1000) String.format(Locale("ru"), "%.1f л", water / 1000.0) else "$water мл")
            rv.setTextViewText(R.id.w_caf, "$mg из $mgMax")
            rv.setTextViewText(R.id.w_steps, if (steps >= 0) fmt(steps) else "—")
            rv.setOnClickPendingIntent(R.id.w_btn_water, pi(ctx, 61, ACT_WATER))
            rv.setOnClickPendingIntent(R.id.w_btn_coffee, pi(ctx, 62, ACT_COFFEE))
            rv.setOnClickPendingIntent(R.id.w_btn_tea, pi(ctx, 63, ACT_TEA))
            val open = PendingIntent.getActivity(ctx, 64, Intent(ctx, MainActivity::class.java).putExtra("open", "today")
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            rv.setOnClickPendingIntent(R.id.w_root, open)
            return rv
        }
    }
}
