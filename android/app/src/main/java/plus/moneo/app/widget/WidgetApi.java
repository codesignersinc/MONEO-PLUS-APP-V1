package plus.moneo.app.widget;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import plus.moneo.app.R;

/** Reads the MONEO Core summary for this device (public.companion_widget). */
final class WidgetApi {
    /** The server answered that the token is unknown or revoked. */
    static final String UNLINKED = "null";

    private WidgetApi() {}

    /** The summary JSON, {@link #UNLINKED}, or null when the network failed. */
    static String fetch(Context c, String token) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(c.getString(R.string.supabase_url) + "/rest/v1/rpc/companion_widget");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            String key = c.getString(R.string.supabase_anon_key);
            conn.setRequestProperty("apikey", key);
            conn.setRequestProperty("Authorization", "Bearer " + key);
            conn.setRequestProperty("Content-Type", "application/json");
            byte[] body = new JSONObject().put("p_token", token).toString()
                    .getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body);
            }
            if (conn.getResponseCode() != 200) return null;
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                String text = buf.toString("UTF-8").trim();
                return text.isEmpty() ? UNLINKED : text;
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
