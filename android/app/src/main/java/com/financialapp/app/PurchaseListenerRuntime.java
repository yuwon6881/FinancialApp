package com.financialapp.app;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Process-local health only: never retains notification content or an Activity/Service instance. */
final class PurchaseListenerRuntime {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor();
    private static volatile Context application;
    private static volatile String lastEvent = "checking";
    private static volatile String lastFailure = "";
    private static final PurchaseListenerRecovery RECOVERY = new PurchaseListenerRecovery((run, delay) -> {
        MAIN.postDelayed(run, delay);
        return () -> MAIN.removeCallbacks(run);
    }, current -> WORKER.execute(() -> request(current)), PurchaseCapturePlugin::changed);

    static boolean access(Context context) {
        if (Build.VERSION.SDK_INT >= 27)
            return context.getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component(context));
        return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
    }
    private static ComponentName component(Context context) { return new ComponentName(context, PurchaseNotificationListener.class); }
    static void ensure(Context context, boolean restart) {
        application = context.getApplicationContext();
        // Initial selection may need a Keystore read after process death; keep it off Android's main thread.
        WORKER.execute(() -> RECOVERY.refresh(eligible(), PurchaseNotificationListener.isConnected(), restart));
    }
    private static boolean eligible() {
        if (application == null) return false;
        try { if (!access(application)) return false; }
        catch (RuntimeException unavailable) { failure("access"); return false; }
        try { return new PurchaseCaptureStore(application).hasSelectedSources(); }
        catch (Exception unavailable) { failure("storage"); return false; }
    }
    private static void request(java.util.function.BooleanSupplier current) {
        boolean allowed = eligible();
        RECOVERY.refresh(allowed, PurchaseNotificationListener.isConnected(), false);
        if (!allowed || PurchaseNotificationListener.isConnected() || !current.getAsBoolean()) return;
        try {
            NotificationListenerService.requestRebind(component(application));
            lastEvent = "rebind_requested";
        } catch (RuntimeException unavailable) { failure("rebind"); }
    }
    static void connected() {
        lastEvent = "connected"; lastFailure = "";
        RECOVERY.refresh(true, true, false);
    }
    static void disconnected(Context context, String event) {
        lastEvent = event; ensure(context, false);
    }
    static void failure(String stage) { lastFailure = stage; }
    static String phase() { return RECOVERY.phase().equals("stalled") ? "stalled" : "connecting"; }
    static JSONObject diagnostics() throws Exception {
        return new JSONObject().put("reconnectAttempts", RECOVERY.attempts()).put("lastEvent", lastEvent).put("lastFailure", lastFailure);
    }
}
