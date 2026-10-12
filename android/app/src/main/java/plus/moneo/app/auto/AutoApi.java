package plus.moneo.app.auto;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import plus.moneo.app.R;

/** Sends one bank notification to the auto-notify Edge Function. */
final class AutoApi {
    /** What the server answered. */
    static final class Result {
        /** 401: the link no longer exists (revoked or account deleted). */
        final boolean unlinked;
        /** The detected movement when a suggestion was created, else null. */
        final JSONObject movement;

        Result(boolean unlinked, JSONObject movement) {
            this.unlinked = unlinked;
            this.movement = movement;
        }
    }

    private AutoApi() {}

    /** Null when the network failed (the notification is then dropped, never stored). */
    static Result send(Context c, String token, String pkg, String title, String text,
            long postedAt) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(c.getString(R.string.supabase_url) + "/functions/v1/auto-notify");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            String key = c.getString(R.string.supabase_anon_key);
            conn.setRequestProperty("apikey", key);
            conn.setRequestProperty("Authorization", "Bearer " + key);
            conn.setRequestProperty("Content-Type", "application/json");
            byte[] body = new JSONObject()
                    .put("token", token)
                    .put("app", pkg)
                    .put("title", title)
                    .put("text", text)
                    .put("postedAt", postedAt)
                    .toString()
                    .getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body);
            }
            int code = conn.getResponseCode();
            if (code == 401) return new Result(true, null);
            if (code != 200) return new Result(false, null);
            try (InputStream in = conn.getInputStream()) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int n;
                while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                JSONObject json = new JSONObject(buf.toString("UTF-8"));
                return new Result(false, json.optJSONObject("movement"));
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
