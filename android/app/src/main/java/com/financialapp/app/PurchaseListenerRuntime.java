package com.financialapp.app;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Operation;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Future;

/** One coordinator for listener callbacks, foreground recovery and Android's durable worker. */
final class PurchaseListenerRuntime {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static volatile Thread workerThread;
    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(run -> {
        workerThread = new Thread(run, "purchase-listener-recovery"); return workerThread;
    });
    private static volatile Context application;
    private static volatile PurchaseListenerHealth health;
    private static boolean workScheduled;
    private static Boolean workDesired;
    private static int workGeneration;
    private static final PurchaseListenerRecovery RECOVERY = new PurchaseListenerRecovery((run, delay) -> {
        MAIN.postDelayed(run, delay);
        return () -> MAIN.removeCallbacks(run);
    }, current -> dispatch(() -> request(current)), PurchaseListenerRuntime::publish);

    static boolean access(Context context) {
        if (Build.VERSION.SDK_INT >= 27)
            return context.getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component(context));
        return NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
    }
    private static ComponentName component(Context context) { return new ComponentName(context, PurchaseNotificationListener.class); }
    private static void initialize(Context context) {
        application = context.getApplicationContext();
        if (health == null) health = new PurchaseListenerHealth(application);
    }
    static void ensure(Context context, String trigger, boolean manual) {
        // Keystore and diagnostics IO never run on the listener/Activity main thread.
        WORKER.execute(() -> { initialize(context); reconcile(trigger, manual); });
    }
    private static void dispatch(Runnable run) {
        if (Thread.currentThread() == workerThread) run.run(); else WORKER.execute(run);
    }
    private static PurchaseListenerEligibility eligible() {
        return PurchaseListenerEligibility.read(() -> access(application), () -> new PurchaseCaptureStore(application).hasSelectedSources());
    }
    private static boolean reconcile(String trigger, boolean manual) {
        PurchaseListenerEligibility allowed = eligible();
        if (allowed == PurchaseListenerEligibility.ALLOWED || allowed == PurchaseListenerEligibility.DISABLED) {
            boolean enabled = allowed == PurchaseListenerEligibility.ALLOWED;
            synchronizeWork(enabled);
            RECOVERY.refresh(enabled, PurchaseNotificationListener.isConnected(), manual, trigger);
            return true;
        }
        boolean changed = health.failure(allowed == PurchaseListenerEligibility.ACCESS_UNAVAILABLE ? "access" : "storage");
        if (PurchaseNotificationListener.isConnected()) RECOVERY.refresh(true, true, false, trigger);
        else RECOVERY.unavailable();
        // Preserve any existing Android job and the encrypted preferences while storage is unavailable.
        if (changed) publish(); return false;
    }
    private static void synchronizeWork(boolean enabled) {
        if (workDesired != null && workDesired == enabled) return;
        int operation = ++workGeneration;
        workDesired = enabled;
        if (!enabled) workScheduled = false;
        try {
            ListenableFuture<Operation.State.SUCCESS> result =
                PurchaseListenerWork.synchronize(application, enabled).getResult();
            result.addListener(() -> {
                if (operation != workGeneration) return;
                boolean changed = workScheduled != enabled;
                try { result.get(); workScheduled = enabled; }
                catch (Exception unavailable) {
                    workDesired = null;
                    boolean failureChanged = health.failure("schedule");
                    changed = workScheduled || failureChanged; workScheduled = false;
                }
                if (changed) publish();
            }, WORKER);
        } catch (RuntimeException unavailable) {
            workDesired = null; workScheduled = false;
            if (health.failure("schedule")) publish();
        }
    }
    private static void request(java.util.function.BooleanSupplier current) {
        if (!current.getAsBoolean() || application == null) return;
        // A queued request must recheck the latest consent and selected sources, not its original snapshot.
        if (!reconcile(RECOVERY.trigger(), false) || PurchaseNotificationListener.isConnected() || !current.getAsBoolean()) return;
        health.attempted(RECOVERY.trigger(), System.currentTimeMillis());
        try {
            NotificationListenerService.requestRebind(component(application));
        } catch (RuntimeException unavailable) { health.failure("rebind"); }
        publish();
    }
    static void connected(Context context) {
        long now = System.currentTimeMillis();
        WORKER.execute(() -> {
            initialize(context); health.connected(now); reconcile("connected", false); publish();
        });
    }
    static void disconnected(Context context, String event) {
        long now = System.currentTimeMillis();
        WORKER.execute(() -> {
            initialize(context); health.disconnected(event, now); reconcile(event, false); publish();
        });
    }
    static void failure(String stage) {
        WORKER.execute(() -> { if (health != null && health.failure(stage)) publish(); });
    }
    static void wiped(Context context) {
        WORKER.execute(() -> {
            initialize(context); RECOVERY.refresh(false, false, false); synchronizeWork(false); health.clear(); publish();
        });
    }
    static boolean scheduled(Context context) {
        Future<Boolean> run = WORKER.submit(() -> {
            initialize(context); health.worker(System.currentTimeMillis());
            // An Android job can already be queued when cancellation begins. Reconcile its durable
            // registration again, rather than trusting the process's last scheduling intention.
            workDesired = null;
            // Fresh processes start with no connected flag. Only the listener callback can set it.
            boolean result = reconcile("scheduled", false); publish(); return result;
        });
        try { return run.get(10, TimeUnit.SECONDS); }
        catch (InterruptedException interrupted) { run.cancel(false); Thread.currentThread().interrupt(); return false; }
        catch (Exception unavailable) { run.cancel(false); failure("worker"); return false; }
    }
    private static void publish() {
        WORKER.execute(() -> {
            if (health != null) {
                health.recovery(RECOVERY.attempts(), RECOVERY.trigger(), workScheduled || RECOVERY.retryScheduled());
                health.save();
            }
            PurchaseCapturePlugin.changed();
        });
    }
    static String phase() { return RECOVERY.phase().equals("connecting") ? "connecting" : "stalled"; }
    static JSONObject diagnostics() throws Exception {
        PurchaseListenerHealth current = health;
        return current == null ? new JSONObject().put("reconnectAttempts", 0).put("lastEvent", "checking").put("lastFailure", "")
            : current.snapshot();
    }
}
