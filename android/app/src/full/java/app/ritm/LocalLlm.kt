package app.ritm

import android.content.Context
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Локальная модель на телефоне (Google LiteRT-LM). Файл модели скачивается один раз в память приложения. */
object LocalLlm {
    const val AVAILABLE = true
    private const val IDLE_MS = 120_000L
    private var engine: Engine? = null
    private var lastUse = 0L
    @Volatile private var downloading = false

    fun file(ctx: Context) = File(File(ctx.filesDir, "llm").apply { mkdirs() }, "model.litertlm")
    fun size(ctx: Context): Long = file(ctx).let { if (it.exists()) it.length() else 0L }
    fun delete(ctx: Context) { synchronized(this) { try { engine?.close() } catch (e: Exception) {}; engine = null }; file(ctx).delete() }

    /** Скачивание с докачкой. progress(процент, состояние): state = "run" | "done" | "error:текст" */
    fun download(ctx: Context, url: String, progress: (Int, String) -> Unit) {
        if (downloading) return
        downloading = true
        Thread {
            val part = File(file(ctx).parentFile, "model.part")
            try {
                var have = if (part.exists()) part.length() else 0L
                var u = url
                var conn: HttpURLConnection
                var hops = 0
                while (true) {
                    conn = URL(u).openConnection() as HttpURLConnection
                    conn.instanceFollowRedirects = false
                    conn.connectTimeout = 15000; conn.readTimeout = 30000
                    if (have > 0) conn.setRequestProperty("Range", "bytes=$have-")
                    val code = conn.responseCode
                    if (code in 301..308 && hops++ < 6) { u = URL(URL(u), conn.getHeaderField("Location")).toString(); conn.disconnect(); continue }
                    if (code == 416) { have = 0; part.delete(); conn.disconnect(); continue }
                    if (code !in listOf(200, 206)) throw RuntimeException("HTTP $code")
                    if (code == 200 && have > 0) { have = 0; part.delete() }
                    break
                }
                val total = have + conn.contentLengthLong
                var done = have; var lastPct = -1
                conn.inputStream.use { input ->
                    java.io.FileOutputStream(part, have > 0).use { out ->
                        val buf = ByteArray(256 * 1024)
                        while (true) {
                            val n = input.read(buf); if (n < 0) break
                            out.write(buf, 0, n); done += n
                            val pct = if (total > 0) (done * 100 / total).toInt() else 0
                            if (pct != lastPct) { lastPct = pct; progress(pct, "run") }
                        }
                    }
                }
                if (total > 0 && part.length() < total) throw RuntimeException("файл скачан не полностью")
                file(ctx).delete(); part.renameTo(file(ctx))
                progress(100, "done")
            } catch (e: Exception) {
                progress(0, "error:" + (e.message ?: "сбой"))
            } finally { downloading = false }
        }.start()
    }

    /** Один запрос к модели. Вызывать из фонового потока. */
    @Synchronized fun ask(ctx: Context, prompt: String): String {
        val f = file(ctx); if (!f.exists()) throw IllegalStateException("модель не скачана")
        val e = engine ?: Engine(EngineConfig(modelPath = f.absolutePath)).also { it.initialize(); engine = it }
        lastUse = System.currentTimeMillis()
        val text = e.createConversation().use { c -> c.sendMessage(prompt).contents.contents.filterIsInstance<Content.Text>().joinToString("") { t -> t.text } }
        Thread { Thread.sleep(IDLE_MS + 500); synchronized(this) { if (System.currentTimeMillis() - lastUse >= IDLE_MS) { try { engine?.close() } catch (x: Exception) {}; engine = null } } }.start()
        return text
    }
}
