package uts.sdk.modules.poemWidget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

public abstract class PoemWidgetProvider extends AppWidgetProvider {
    private static final String NEXT = "com.poementer.app.widget.NEXT";

    abstract String size();

    public static final class Compact extends PoemWidgetProvider {
        @Override String size() { return PoemWidgetStore.COMPACT; }
    }

    public static final class Wide extends PoemWidgetProvider {
        @Override String size() { return PoemWidgetStore.WIDE; }
    }

    static ComponentName component(Context context, String size) {
        return new ComponentName(context, PoemWidgetStore.WIDE.equals(size) ? Wide.class : Compact.class);
    }

    static boolean hasWidgets(Context context, String size) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(component(context, size)).length > 0;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (NEXT.equals(intent.getAction()) && PoemWidgetStore.WIDE.equals(size())) {
            PoemWidgetStore.advance(context);
            refresh(context, size(), false);
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context, size(), false);
    }

    static void refresh(Context context, String size, boolean sourceChanged) {
        if (!hasWidgets(context, size)) return;
        render(context, size);
        String source = PoemWidgetStore.source(PoemWidgetStore.options(context, size));
        JSONObject state = PoemWidgetStore.state(context, size, source);
        if (sourceChanged || PoemWidgetStore.needsRefresh(state, System.currentTimeMillis())) {
            PoemWidgetRefresh.enqueue(context, size, sourceChanged);
        }
    }

    static synchronized void render(Context context, String size) {
        long now = System.currentTimeMillis();
        JSONObject options = PoemWidgetStore.options(context, size);
        String source = PoemWidgetStore.source(options);
        JSONObject state = PoemWidgetStore.state(context, size, source);
        JSONObject poem = PoemWidgetStore.current(state, now);
        JSONObject palette = "custom".equals(options.optString("palette")) ? options : poem;
        int background = PoemWidgetStore.color(palette, "backgroundColor", PoemWidgetStore.DEFAULT_BACKGROUND);
        int foreground = PoemWidgetStore.color(palette, "textColor", PoemWidgetStore.DEFAULT_TEXT);

        boolean wide = PoemWidgetStore.WIDE.equals(size);
        RemoteViews views = new RemoteViews(context.getPackageName(),
            wide ? R.layout.poem_widget_wide : R.layout.poem_widget_compact);
        views.setOnClickPendingIntent(R.id.poem_widget_root, openPoemIntent(context, poem));
        views.setInt(R.id.poem_widget_surface, "setColorFilter", background);
        views.setTextColor(R.id.poem_widget_excerpt, foreground);
        views.setTextViewText(R.id.poem_widget_excerpt, poem == null ? emptyText(source, state, now) : poem.optString("excerpt"));
        if (wide) {
            views.setImageViewResource(R.id.poem_widget_icon, context.getApplicationInfo().icon);
            views.setTextColor(R.id.poem_widget_attribution, foreground);
            views.setTextViewText(R.id.poem_widget_attribution, poem == null ? "" : attribution(poem));
            views.setTextColor(R.id.poem_widget_next, foreground);
            boolean canAdvance = PoemWidgetStore.canAdvance(state, now);
            views.setViewVisibility(R.id.poem_widget_next, canAdvance ? View.VISIBLE : View.INVISIBLE);
            Intent intent = new Intent(context, Wide.class).setAction(NEXT).addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            views.setOnClickPendingIntent(R.id.poem_widget_next, PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        AppWidgetManager.getInstance(context).updateAppWidget(component(context, size), views);
    }

    private static PendingIntent openPoemIntent(Context context, JSONObject poem) {
        String postId = poem == null ? "" : poem.optString("id");
        if (postId.isEmpty()) return null;
        Uri url = new Uri.Builder().scheme("poementer").authority("poem-widget")
            .appendPath("detail").appendQueryParameter("id", postId).build();
        Intent intent = new Intent(Intent.ACTION_VIEW, url).setPackage(context.getPackageName())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
    }

    private static String attribution(JSONObject poem) {
        String title = poem.optString("title");
        String author = poem.optString("author");
        return title.isEmpty() ? author : author + " · " + title;
    }

    private static String emptyText(String source, JSONObject state, long now) {
        if (PoemWidgetStore.day(now).equals(state.optString("day"))) {
            return "today".equals(source) ? "今日还没有新诗" : "暂无可显示的诗句";
        }
        return state.has("attemptedAt") ? "诗句暂未加载" : "诗句正在加载";
    }
}
