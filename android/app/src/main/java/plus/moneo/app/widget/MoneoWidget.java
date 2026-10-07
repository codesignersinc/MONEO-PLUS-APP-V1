package plus.moneo.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MONEO home-screen widget: "Puedes gastar hoy", totals, next payment and goal from MONEO Core.
 * Refreshes every 30 minutes (system minimum), when linked, and with its refresh button.
 */
public class MoneoWidget extends AppWidgetProvider {
    static final String ACTION_REFRESH = "plus.moneo.app.widget.REFRESH";
    static final String ACTION_TOGGLE = "plus.moneo.app.widget.TOGGLE";
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context, goAsync());
    }

    @Override
    public void onAppWidgetOptionsChanged(
            Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)) {
            refresh(context, goAsync());
        } else if (ACTION_TOGGLE.equals(action)) {
            WidgetStore.toggleHidden(context);
            renderAll(context);
        }
    }

    private static void refresh(Context context, PendingResult pending) {
        final Context app = context.getApplicationContext();
        renderAll(app);
        IO.execute(() -> {
            try {
                String token = WidgetStore.token(app);
                if (token != null) {
                    String json = WidgetApi.fetch(app, token);
                    if (WidgetApi.UNLINKED.equals(json)) {
                        WidgetStore.unlink(app);
                    } else if (json != null) {
                        WidgetStore.saveSummary(app, json);
                    }
                    // json == null: no connection; keep showing the last summary.
                }
                renderAll(app);
            } finally {
                if (pending != null) pending.finish();
            }
        });
    }

    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MoneoWidget.class));
        for (int id : ids) render(context, manager, id);
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        manager.updateAppWidget(id, WidgetViews.build(context, manager.getAppWidgetOptions(id)));
    }
}
