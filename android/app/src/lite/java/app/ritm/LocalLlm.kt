package app.ritm

import android.content.Context
import java.io.File

/** Лёгкая сборка без локальной модели: тот же интерфейс, но ничего не делает. */
object LocalLlm {
    const val AVAILABLE = false
    fun file(ctx: Context) = File(ctx.filesDir, "llm/model.litertlm")
    fun size(ctx: Context): Long = 0L
    fun delete(ctx: Context) {}
    fun download(ctx: Context, url: String, progress: (Int, String) -> Unit) { progress(0, "error:в этой версии нет локальной модели") }
    fun ask(ctx: Context, prompt: String): String = throw IllegalStateException("в этой версии нет локальной модели")
}
