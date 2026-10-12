package plus.moneo.app.auto;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;

/**
 * Turns MONEO AUTO on or off on this phone, from moneo.plus/finanzas/auto/celular:
 * intent://link?token=…;scheme=moneo-auto;package=plus.moneo.app → saves the token, asks for
 * notifications (to show "Gasto detectado") and opens Android's "Acceso a notificaciones".
 * intent://off;scheme=moneo-auto;package=plus.moneo.app → forgets the token.
 */
public class AutoLinkActivity extends Activity {
    private static final int ASK_NOTIFICATIONS = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri data = getIntent() != null ? getIntent().getData() : null;
        if (data != null && "off".equals(data.getHost())) {
            AutoStore.disable(this);
            Toast.makeText(this, "MONEO AUTO apagado en este celular", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        String token = data != null ? data.getQueryParameter("token") : null;
        if (token == null || !token.matches("[0-9a-f]{64}")) {
            Toast.makeText(this, "No se pudo activar MONEO AUTO. Inténtalo de nuevo.",
                    Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        AutoStore.enable(this, token);
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"},
                    ASK_NOTIFICATIONS);
        } else {
            openListenerSettings();
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        openListenerSettings();
    }

    private void openListenerSettings() {
        if (hasListenerAccess()) {
            Toast.makeText(this, "MONEO AUTO activado", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        Toast.makeText(this, "Activa MONEO+ en «Acceso a notificaciones»", Toast.LENGTH_LONG)
                .show();
        Intent i;
        if (Build.VERSION.SDK_INT >= 30) {
            i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                    .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                            new ComponentName(this, AutoListener.class).flattenToString());
        } else {
            i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        }
        try {
            startActivity(i);
        } catch (Exception e) {
            startActivity(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"));
        }
        finish();
    }

    private boolean hasListenerAccess() {
        String enabled = Settings.Secure.getString(getContentResolver(),
                "enabled_notification_listeners");
        return enabled != null
                && enabled.contains(new ComponentName(this, AutoListener.class).flattenToString());
    }
}
