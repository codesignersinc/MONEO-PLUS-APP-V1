package plus.moneo.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

/** Widget state on the phone: the device token, the last summary and the privacy toggle. */
final class WidgetStore {
    private static final String PREFS = "moneo_widget";
    private static final String TOKEN = "token";
    private static final String SUMMARY = "summary";
    private static final String HIDDEN = "hidden";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String token(Context c) {
        return prefs(c).getString(TOKEN, null);
    }

    static void link(Context c, String token) {
        prefs(c).edit().putString(TOKEN, token).remove(SUMMARY).apply();
    }

    /** The device was unlinked (from Configuración or the account was deleted). */
    static void unlink(Context c) {
        prefs(c).edit().remove(TOKEN).remove(SUMMARY).apply();
    }

    static String summary(Context c) {
        return prefs(c).getString(SUMMARY, null);
    }

    static void saveSummary(Context c, String json) {
        prefs(c).edit().putString(SUMMARY, json).apply();
    }

    /** Amounts start hidden: the widget is on screen for anyone to see. */
    static boolean hidden(Context c) {
        return prefs(c).getBoolean(HIDDEN, true);
    }

    static void toggleHidden(Context c) {
        prefs(c).edit().putBoolean(HIDDEN, !hidden(c)).apply();
    }
}
