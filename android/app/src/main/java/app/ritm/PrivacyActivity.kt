package app.ritm

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

/** Экран, который Health Connect показывает по ссылке «Зачем приложению эти данные». */
class PrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (20 * resources.displayMetrics.density).toInt()
        val text = TextView(this).apply {
            setPadding(pad, pad, pad, pad)
            textSize = 16f
            text = "Rhythm читает из Health Connect только количество шагов и время сна.\n\n" +
                "Эти данные нужны, чтобы показывать вашу активность за день, считать длительность и регулярность сна " +
                "и подбирать советы. Они остаются на телефоне: приложение никуда их не отправляет и ничего не записывает " +
                "в Health Connect.\n\nДоступ можно отозвать в любой момент в настройках Health Connect."
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
