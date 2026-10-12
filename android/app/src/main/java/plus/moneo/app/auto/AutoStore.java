package plus.moneo.app.auto;

import android.content.Context;
import android.content.SharedPreferences;

/** MONEO AUTO on this phone: the device token with the MONEO AUTO permission. */
final class AutoStore {
    private static final String PREFS = "moneo_auto";
    private static final String TOKEN = "token";

    private AutoStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The token, or null when MONEO AUTO is off on this phone. */
    static String token(Context c) {
        return prefs(c).getString(TOKEN, null);
    }

    static void enable(Context c, String token) {
        prefs(c).edit().putString(TOKEN, token).apply();
    }

    /** Turned off on the phone, or the link was revoked from Configuración. */
    static void disable(Context c) {
        prefs(c).edit().remove(TOKEN).apply();
    }
}
