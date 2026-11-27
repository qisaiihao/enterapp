package uts.sdk.modules.poemWidget;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.TimeZone;

final class PoemWidgetStore {
    static final String COMPACT = "compact";
    static final String WIDE = "wide";
    static final String DEFAULT_BACKGROUND = "#F5EFE5";
    static final String DEFAULT_TEXT = "#302820";
    static final long RETRY_INTERVAL = 60 * 60 * 1000L;
    private static final long CACHE_LIFETIME = 48 * RETRY_INTERVAL;
    private static final Random RANDOM = new Random();

    static String day(long time) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));
        return format.format(new Date(time));
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("poem_widget", Context.MODE_PRIVATE);
    }

    static JSONObject json(String value) {
        try {
            return new JSONObject(value);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static JSONObject options(Context context, String size) {
        JSONObject options = json(preferences(context).getString("settings", "{}")).optJSONObject(size);
        return options != null ? options : new JSONObject();
    }

    static String source(JSONObject options) {
        String source = options.optString("source");
        switch (source) {
            case "today":
            case "repost":
            case "popular":
                return source;
            default:
                return "original";
        }
    }

    static int color(JSONObject data, String key, String fallback) {
        String hex = data == null ? "" : data.optString(key);
        return Color.parseColor(hex.matches("#[0-9a-fA-F]{6}") ? hex : fallback);
    }

    static JSONObject state(Context context, String size, String source) {
        JSONObject state = json(preferences(context).getString("feed_" + size, "{}"));
        return source.equals(state.optString("source")) ? state : new JSONObject();
    }

    static boolean needsRefresh(JSONObject state, long now) {
        long lastAttempt = state.optLong("attemptedAt");
        if (!day(now).equals(day(lastAttempt)) || lastAttempt > now) return true;
        return (!day(now).equals(state.optString("day")) || poems(state).length() < 2)
            && now - lastAttempt >= RETRY_INTERVAL;
    }

    private static boolean isReadable(JSONObject state, long now) {
        if ("today".equals(state.optString("source"))) return day(now).equals(state.optString("day"));
        return now - state.optLong("fetchedAt") < CACHE_LIFETIME;
    }

    private static JSONArray poems(JSONObject state) {
        JSONArray poems = state.optJSONArray("poems");
        return poems != null ? poems : new JSONArray();
    }

    static JSONObject current(JSONObject state, long now) {
        return isReadable(state, now) ? find(poems(state), state.optString("selectedId")) : null;
    }

    static boolean canAdvance(JSONObject state, long now) {
        return isReadable(state, now) && poems(state).length() > 1;
    }

    private static JSONObject find(JSONArray poems, String id) {
        for (int index = 0; index < poems.length(); index++) {
            JSONObject poem = poems.optJSONObject(index);
            if (poem != null && id.equals(poem.optString("id"))) return poem;
        }
        return null;
    }

    private static String select(JSONArray poems, String previous) {
        List<String> candidates = new ArrayList<>();
        for (int index = 0; index < poems.length(); index++) {
            JSONObject poem = poems.optJSONObject(index);
            if (poem == null) continue;
            String id = poem.optString("id");
            if (!id.isEmpty() && !previous.equals(id)) candidates.add(id);
        }
        if (!candidates.isEmpty()) return candidates.get(RANDOM.nextInt(candidates.size()));
        return find(poems, previous) == null ? "" : previous;
    }

    private static void save(Context context, String size, JSONObject state) {
        preferences(context).edit().putString("feed_" + size, state.toString()).apply();
    }

    static synchronized void finishRefresh(Context context, String size, String source, long requestedAt, JSONObject result) {
        long now = System.currentTimeMillis();
        if (!source.equals(source(options(context, size))) || !day(requestedAt).equals(day(now))) return;
        JSONObject state = state(context, size, source);
        if (state.optLong("attemptedAt") > requestedAt) return;

        String today = day(now);
        try {
            state.put("source", source);
            state.put("attemptedAt", now);
            if (result != null && source.equals(result.optString("source")) && today.equals(result.optString("day"))) {
                JSONArray poems = result.getJSONArray("poems");
                String previous = state.optString("selectedId");
                boolean canKeep = today.equals(state.optString("day")) && find(poems, previous) != null;
                state.put("selectedId", canKeep ? previous : select(poems, previous));
                state.put("day", today);
                state.put("fetchedAt", now);
                state.put("poems", poems);
            }
            save(context, size, state);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    static synchronized void advance(Context context) {
        JSONObject state = state(context, WIDE, source(options(context, WIDE)));
        if (!canAdvance(state, System.currentTimeMillis())) return;
        try {
            state.put("selectedId", select(poems(state), state.optString("selectedId")));
            save(context, WIDE, state);
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }
}
