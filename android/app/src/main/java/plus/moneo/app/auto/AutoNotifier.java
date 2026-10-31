package plus.moneo.app.auto;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.google.androidbrowserhelper.trusted.LauncherActivity;
import java.util.Locale;
import org.json.JSONObject;
import plus.moneo.app.R;

/** "Gasto detectado · S/ 18.00": opens MONEO AUTO with the suggestion ready to register. */
final class AutoNotifier {
    private static final String CHANNEL = "moneo_auto";
    private static final String SITE = "https://moneo.plus";

    private AutoNotifier() {}

    static void show(Context c, JSONObject movement) {
        if (Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != PackageManager.PERMISSION_GRANTED) {
            return; // The suggestion is waiting in MONEO AUTO anyway.
        }
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL, "MONEO AUTO", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Movimientos detectados en los avisos de tu banco");
            nm.createNotificationChannel(ch);
        }
        String type = movement.optString("type");
        String title = ("ingreso".equals(type) ? "Ingreso detectado"
                : "transferencia".equals(type) ? "Transferencia detectada"
                : "Gasto detectado")
                + " · " + money(movement.optString("currency"), movement.optDouble("amount", 0));
        String merchant = movement.optString("merchant", "").trim();
        String text = (merchant.isEmpty() ? "" : merchant + " · ") + "Toca para registrarlo";

        Intent open = new Intent(c, LauncherActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(SITE + "/finanzas/auto?source=android"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(c, 20, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, CHANNEL)
                : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_moneo)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_RECOMMENDATION);
        nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), b.build());
    }

    static String money(String currency, double amount) {
        String symbol = "USD".equals(currency) ? "US$ " : "S/ ";
        return symbol + String.format(Locale.US, "%,.2f", amount);
    }
}
