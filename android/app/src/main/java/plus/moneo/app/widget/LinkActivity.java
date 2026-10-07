package plus.moneo.app.widget;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Receives the device token from moneo.plus/finanzas/widget
 * (intent://link?token=…;scheme=moneo-widget;package=plus.moneo.app) and refreshes the widget.
 */
public class LinkActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri data = getIntent() != null ? getIntent().getData() : null;
        String token = data != null ? data.getQueryParameter("token") : null;
        if (token != null && token.matches("[0-9a-f]{64}")) {
            WidgetStore.link(this, token);
            sendBroadcast(new Intent(this, MoneoWidget.class).setAction(MoneoWidget.ACTION_REFRESH));
            Toast.makeText(this, "Widget de MONEO conectado", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "No se pudo conectar el widget. Inténtalo de nuevo.",
                    Toast.LENGTH_LONG).show();
        }
        finish();
    }
}
