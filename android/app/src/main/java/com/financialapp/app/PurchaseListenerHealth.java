package com.financialapp.app;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** One bounded, content-free snapshot in no-backup storage; it never establishes connectivity. */
final class PurchaseListenerHealth {
    private final AtomicFile file;
    private String lastEvent = "checking", lastFailure = "", recoveryTrigger = "checking";
    private long lastConnectedAt, lastDisconnectedAt, lastAttemptAt, lastWorkerAt;
    private int attempts;
    private boolean scheduled;

    PurchaseListenerHealth(Context context) {
        file = new AtomicFile(new File(context.getNoBackupFilesDir(), "purchase-listener-health-v1"));
        if (!file.getBaseFile().exists()) return;
        try {
            JSONObject data = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
            lastEvent = data.optString("lastEvent", "checking");
            lastFailure = data.optString("lastFailure");
            recoveryTrigger = data.optString("recoveryTrigger", "checking");
            lastConnectedAt = data.optLong("lastConnectedAt");
            lastDisconnectedAt = data.optLong("lastDisconnectedAt");
            lastAttemptAt = data.optLong("lastAttemptAt");
            lastWorkerAt = data.optLong("lastWorkerAt");
            // Attempts and scheduling are current-process observations, unlike historical times.
        } catch (Exception unavailable) { lastFailure = "health_storage"; }
    }
    synchronized void connected(long now) { lastConnectedAt = now; lastEvent = "connected"; lastFailure = ""; }
    synchronized void disconnected(String event, long now) { lastDisconnectedAt = now; lastEvent = event; }
    synchronized void attempted(String trigger, long now) {
        lastAttemptAt = now; recoveryTrigger = trigger; lastEvent = "rebind_requested";
    }
    synchronized void worker(long now) { lastWorkerAt = now; }
    synchronized boolean failure(String stage) {
        if (lastFailure.equals(stage)) return false;
        lastFailure = stage; return true;
    }
    synchronized void recovery(int count, String trigger, boolean pending) {
        attempts = count; recoveryTrigger = trigger; scheduled = pending;
    }
    synchronized JSONObject snapshot() throws Exception {
        return new JSONObject().put("reconnectAttempts", attempts).put("lastEvent", lastEvent).put("lastFailure", lastFailure)
            .put("lastConnectedAt", lastConnectedAt).put("lastDisconnectedAt", lastDisconnectedAt)
            .put("lastAttemptAt", lastAttemptAt).put("lastWorkerAt", lastWorkerAt)
            .put("recoveryTrigger", recoveryTrigger).put("recoveryScheduled", scheduled);
    }
    synchronized void save() {
        FileOutputStream output = null;
        try {
            byte[] bytes = snapshot().toString().getBytes(StandardCharsets.UTF_8);
            output = file.startWrite(); output.write(bytes); file.finishWrite(output);
        } catch (Exception unavailable) {
            if (output != null) file.failWrite(output);
            if (lastFailure.isEmpty()) lastFailure = "health_storage";
        }
    }
    synchronized void clear() {
        file.delete();
        lastEvent = "checking"; lastFailure = ""; recoveryTrigger = "checking";
        lastConnectedAt = 0; lastDisconnectedAt = 0; lastAttemptAt = 0; lastWorkerAt = 0;
        attempts = 0; scheduled = false;
    }
}
