package plus.moneo.app.auto;

import android.app.Notification;
import android.content.Context;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MONEO AUTO on Android. With the person's consent (moneo.plus/finanzas/auto/celular) and
 * Android's "Acceso a notificaciones", reads ONLY the notifications of Yape, BCP, Interbank
 * and BBVA and sends their title and text to MONEO to detect the movement. Every other app is
 * ignored without reading it. Nothing is stored on the phone; the server keeps only the
 * detected movement, never the text.
 */
public class AutoListener extends NotificationListenerService {
    /** Bank apps, by package. Keep in sync with supabase/functions/auto-notify. */
    static final String[] PACKAGES = {
        "com.bcp.innovacxion.yapeapp", // Yape
        "com.bcp.bank.bcp", // BCP
        "pe.com.interbank.mobilebanking", // Interbank
        "com.bbva.nxt_peru", // BBVA Perú
    };

    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    // The same notification is often re-posted (updates, grouping): send each text once.
    private static final Map<String, Long> SEEN = new LinkedHashMap<String, Long>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Long> eldest) {
            return size() > 100;
        }
    };

    static boolean isBankApp(String pkg) {
        for (String p : PACKAGES) if (p.equals(pkg)) return true;
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || !isBankApp(sbn.getPackageName())) return;
        final Context app = getApplicationContext();
        final String token = AutoStore.token(app);
        if (token == null) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0
                || (n.flags & Notification.FLAG_ONGOING_EVENT) != 0) {
            return;
        }
        Bundle extras = n.extras;
        if (extras == null) return;
        final String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        CharSequence big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        final String text = str(big != null ? big : extras.getCharSequence(Notification.EXTRA_TEXT));
        if (title.isEmpty() && text.isEmpty()) return;
        final String pkg = sbn.getPackageName();
        final long postedAt = sbn.getPostTime();
        String key = pkg + "|" + (title + "\n" + text).hashCode();
        synchronized (SEEN) {
            Long last = SEEN.get(key);
            if (last != null && postedAt - last < 10 * 60 * 1000) return;
            SEEN.put(key, postedAt);
        }
        IO.execute(() -> {
            AutoApi.Result r = AutoApi.send(app, token, pkg, title, text, postedAt);
            if (r == null) return;
            if (r.unlinked) {
                AutoStore.disable(app);
            } else if (r.movement != null) {
                AutoNotifier.show(app, r.movement);
            }
        });
    }

    private static String str(CharSequence s) {
        return s == null ? "" : s.toString().trim();
    }
}
