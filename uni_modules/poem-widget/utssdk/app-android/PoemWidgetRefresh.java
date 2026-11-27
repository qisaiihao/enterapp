package uts.sdk.modules.poemWidget;

import android.content.Context;
import android.util.Log;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

public final class PoemWidgetRefresh extends Worker {
    private static final String FEED = "https://cloud1-5gb0pbyl400845f5-1378788263.ap-shanghai.app.tcloudbase.com/poem-widget/feed";

    public PoemWidgetRefresh(Context context, WorkerParameters parameters) {
        super(context, parameters);
    }

    static void enqueue(Context context, String size, boolean sourceChanged) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(PoemWidgetRefresh.class)
            .setInputData(new Data.Builder().putString("size", size).build())
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork("poem_widget_" + size,
            sourceChanged ? ExistingWorkPolicy.REPLACE : ExistingWorkPolicy.KEEP, request);
    }

    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String size = getInputData().getString("size");
        if (size == null || !PoemWidgetProvider.hasWidgets(context, size)) return Result.success();
        String source = PoemWidgetStore.source(PoemWidgetStore.options(context, size));
        long requestedAt = System.currentTimeMillis();
        if (!PoemWidgetStore.needsRefresh(PoemWidgetStore.state(context, size, source), requestedAt)) {
            return Result.success();
        }
        JSONObject response = null;
        try {
            response = load(source);
        } catch (IOException | JSONException error) {
            Log.w("PoemWidget", "Unable to load the poem feed: " + error.getClass().getSimpleName());
        }
        if (!isStopped()) {
            PoemWidgetStore.finishRefresh(context, size, source, requestedAt, response);
            PoemWidgetProvider.render(context, size);
        }
        return Result.success();
    }

    private static JSONObject load(String source) throws IOException, JSONException {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(FEED + "?source=" + source).openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json");
        try {
            if (connection.getResponseCode() != 200) return null;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                for (int length; (length = input.read(buffer)) != -1;) {
                    if (output.size() + length > 64 * 1024) throw new IOException("Widget feed is too large");
                    output.write(buffer, 0, length);
                }
                JSONObject response = new JSONObject(output.toString("UTF-8"));
                return response.has("poems") && response.optJSONArray("poems") != null ? response : null;
            }
        } finally {
            connection.disconnect();
        }
    }
}
