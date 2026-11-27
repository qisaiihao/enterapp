package uts.sdk.modules.poemWidget;

import android.content.Context;
import android.content.pm.PackageManager;
import org.json.JSONObject;

public final class PoemWidgetBridge {
    public static boolean isAvailable(Context context) {
        try {
            context.getPackageManager().getReceiverInfo(PoemWidgetProvider.component(context, PoemWidgetStore.COMPACT), 0);
            context.getPackageManager().getReceiverInfo(PoemWidgetProvider.component(context, PoemWidgetStore.WIDE), 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    public static String readSettings(Context context) {
        return PoemWidgetStore.preferences(context).getString("settings", "{}");
    }

    public static boolean writeSettings(Context context, String value) {
        JSONObject settings = PoemWidgetStore.json(value);
        JSONObject compact = settings.optJSONObject(PoemWidgetStore.COMPACT);
        JSONObject wide = settings.optJSONObject(PoemWidgetStore.WIDE);
        if (compact == null || wide == null || !isAvailable(context)) return false;
        String compactSource = PoemWidgetStore.source(PoemWidgetStore.options(context, PoemWidgetStore.COMPACT));
        String wideSource = PoemWidgetStore.source(PoemWidgetStore.options(context, PoemWidgetStore.WIDE));
        if (!PoemWidgetStore.preferences(context).edit().putString("settings", value).commit()) return false;
        PoemWidgetProvider.refresh(context, PoemWidgetStore.COMPACT, !compactSource.equals(PoemWidgetStore.source(compact)));
        PoemWidgetProvider.refresh(context, PoemWidgetStore.WIDE, !wideSource.equals(PoemWidgetStore.source(wide)));
        return true;
    }

    public static String readPreview(Context context, String size) {
        String source = PoemWidgetStore.source(PoemWidgetStore.options(context, size));
        JSONObject poem = PoemWidgetStore.current(PoemWidgetStore.state(context, size, source), System.currentTimeMillis());
        return poem == null ? "{}" : poem.toString();
    }
}
