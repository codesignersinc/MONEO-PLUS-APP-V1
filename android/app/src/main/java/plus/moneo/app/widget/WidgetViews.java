package plus.moneo.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import com.google.androidbrowserhelper.trusted.LauncherActivity;
import java.util.Locale;
import org.json.JSONObject;
import plus.moneo.app.R;

/** Builds the widget for its current size: small, medium or large (or "Conectar"). */
final class WidgetViews {
    private static final String SITE = "https://moneo.plus";
    private static final String MASK = "••••••";
    private static final String[] MONTHS = {
        "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"
    };

    private WidgetViews() {}

    static RemoteViews build(Context c, Bundle options) {
        if (WidgetStore.token(c) == null) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_unlinked);
            v.setOnClickPendingIntent(R.id.w_root, open(c, "/finanzas/widget?source=android", 1));
            return v;
        }
        int minW = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) : 0;
        int minH = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) : 0;
        int layout;
        if (minW > 0 && (minW < 200 || minH < 100)) layout = R.layout.widget_small;
        else if (minH > 0 && minH < 200) layout = R.layout.widget_medium;
        else layout = R.layout.widget_large;

        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        boolean hidden = WidgetStore.hidden(c);
        JSONObject s = parse(WidgetStore.summary(c));

        v.setOnClickPendingIntent(R.id.w_root, open(c, "/finanzas?source=android", 2));
        v.setOnClickPendingIntent(R.id.w_eye, broadcast(c, MoneoWidget.ACTION_TOGGLE, 3));
        v.setImageViewResource(R.id.w_eye, hidden ? R.drawable.ic_w_eye_off : R.drawable.ic_w_eye);

        if (s == null) {
            v.setTextViewText(R.id.w_safe, "…");
            v.setTextViewText(R.id.w_hint, "Actualizando");
        } else {
            String cur = s.optString("currency", "PEN");
            JSONObject safe = s.optJSONObject("safeToSpend");
            v.setTextViewText(R.id.w_safe,
                    money(safe != null ? safe.optDouble("today", 0) : 0, cur, hidden));
            v.setTextViewText(R.id.w_hint, hint(safe));
        }

        if (layout != R.layout.widget_small) {
            v.setOnClickPendingIntent(R.id.w_refresh, broadcast(c, MoneoWidget.ACTION_REFRESH, 4));
            v.setOnClickPendingIntent(R.id.w_add_expense,
                    open(c, "/mini?nuevo=gasto&source=android", 5));
            v.setOnClickPendingIntent(R.id.w_add_income,
                    open(c, "/mini?nuevo=ingreso&source=android", 6));
            if (s != null) {
                String cur = s.optString("currency", "PEN");
                v.setTextViewText(R.id.w_available, money(s.optDouble("available", 0), cur, hidden));
                v.setTextViewText(R.id.w_committed, money(s.optDouble("committed", 0), cur, hidden));
            }
        }

        if (layout == R.layout.widget_large && s != null) {
            String cur = s.optString("currency", "PEN");
            v.setTextViewText(R.id.w_networth, money(s.optDouble("netWorth", 0), cur, hidden));
            JSONObject next = s.optJSONObject("nextPayment");
            if (next != null) {
                v.setTextViewText(R.id.w_next_name, next.optString("name", ""));
                v.setTextViewText(R.id.w_next_amount,
                        money(next.optDouble("amount", 0), cur, hidden) + " · "
                                + due(next.optString("date", ""), s.optString("asOf", ""),
                                        next.optBoolean("overdue", false)));
            } else {
                v.setTextViewText(R.id.w_next_name, "Nada pendiente");
                v.setTextViewText(R.id.w_next_amount, "");
            }
            JSONObject goal = s.optJSONObject("mainGoal");
            if (goal != null) {
                int pct = (int) Math.round(goal.optDouble("pct", 0));
                v.setTextViewText(R.id.w_goal_name, goal.optString("name", ""));
                v.setTextViewText(R.id.w_goal_pct, pct + "%");
                v.setProgressBar(R.id.w_goal_bar, 100, Math.max(3, pct), false);
                v.setViewVisibility(R.id.w_goal_bar, View.VISIBLE);
            } else {
                v.setTextViewText(R.id.w_goal_name, "Crea tu primera meta");
                v.setTextViewText(R.id.w_goal_pct, "");
                v.setViewVisibility(R.id.w_goal_bar, View.GONE);
            }
        }
        return v;
    }

    private static JSONObject parse(String json) {
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    static String money(double n, String currency, boolean hidden) {
        if (hidden) return MASK;
        String symbol;
        switch (currency) {
            case "USD": symbol = "US$ "; break;
            case "EUR": symbol = "€ "; break;
            case "PEN": symbol = "S/ "; break;
            default: symbol = currency + " ";
        }
        return (n < 0 ? "- " : "") + symbol + String.format(Locale.US, "%,.2f", Math.abs(n));
    }

    private static String hint(JSONObject safe) {
        if (safe == null) return "aprox.";
        String until = safe.optString("until", "");
        int days = safe.optInt("days", 1);
        String span = days == 1 ? "solo hoy" : days + " días";
        return "proximo_ingreso".equals(safe.optString("untilKind"))
                ? "aprox. · hasta tu ingreso del " + shortDate(until) + " (" + span + ")"
                : "aprox. · hasta fin de mes (" + span + ")";
    }

    static String shortDate(String ymd) {
        try {
            int m = Integer.parseInt(ymd.substring(5, 7));
            int d = Integer.parseInt(ymd.substring(8, 10));
            return d + " " + MONTHS[m - 1];
        } catch (Exception e) {
            return ymd;
        }
    }

    /** Days since 1970-01-01 for a YYYY-MM-DD date (no java.time below API 26). */
    private static long epochDay(String ymd) {
        int y = Integer.parseInt(ymd.substring(0, 4));
        int m = Integer.parseInt(ymd.substring(5, 7));
        int d = Integer.parseInt(ymd.substring(8, 10));
        y -= m <= 2 ? 1 : 0;
        long era = (y >= 0 ? y : y - 399) / 400;
        long yoe = y - era * 400;
        long doy = (153L * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    static String due(String date, String today, boolean overdue) {
        try {
            long n = epochDay(date) - epochDay(today);
            if (overdue || n < 0) return "Vencido";
            if (n == 0) return "Hoy";
            if (n == 1) return "Mañana";
            if (n <= 7) return "En " + n + " días";
            return shortDate(date);
        } catch (Exception e) {
            return "";
        }
    }

    private static PendingIntent open(Context c, String path, int code) {
        Intent i = new Intent(c, LauncherActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(SITE + path))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent broadcast(Context c, String action, int code) {
        Intent i = new Intent(c, MoneoWidget.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
