package com.financialapp.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collection;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PurchaseNotificationListener extends NotificationListenerService {
    static final String CHANNEL = "financialapp-purchase-review-v1";
    static final String EXTRA = "financialapp.purchaseCaptureId";
    private static final String GROUP = "financialapp-purchase-reviews";
    private static final String SUMMARY_TAG = "financialapp-purchase-summary";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static volatile boolean connected;
    static boolean isConnected() { return connected; }
    @Override public void onListenerConnected() {
        connected = true;
        PurchaseListenerRuntime.connected();
        PurchaseCapturePlugin.changed();
        // Alerts that arrived while Android had the listener unbound are recovered here, as a replay rather than live news.
        StatusBarNotification[] active;
        try { active = getActiveNotifications(); }
        catch (RuntimeException unavailable) { PurchaseListenerRuntime.failure("replay"); return; /* Live alerts still arrive. */ }
        if (active != null) for (StatusBarNotification notification : active) enqueue(notification, true);
    }
    @Override public void onListenerDisconnected() {
        connected = false;
        PurchaseCapturePlugin.changed();
        PurchaseListenerRuntime.disconnected(this, "disconnected");
    }
    @Override public void onNotificationPosted(StatusBarNotification sbn) { enqueue(sbn, false); }
    private void enqueue(StatusBarNotification sbn, boolean replay) {
        if (sbn.getPackageName().equals(getPackageName()) || (sbn.getNotification().flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        // Keystore and disk access must not block the service's main thread.
        try { worker.execute(() -> captureNotification(sbn, replay)); }
        catch (java.util.concurrent.RejectedExecutionException destroyed) { /* The service is shutting down; the next binding replays the tray. */ }
    }
    @Override public void onDestroy() { connected = false; PurchaseListenerRuntime.disconnected(this, "destroyed"); PurchaseCapturePlugin.changed(); worker.shutdown(); super.onDestroy(); }
    private void captureNotification(StatusBarNotification sbn, boolean replay) {
        String stage = "storage";
        try {
            PurchaseCaptureStore store = new PurchaseCaptureStore(this);
            if (!store.selected(sbn.getPackageName())) return;
            stage = "content";
            Notification notification = sbn.getNotification();
            PurchaseNotificationContent content = PurchaseNotificationContent.read(notification);
            String title = content.title, body = content.body;
            if (title.length() > 500 || body.length() > 3000) return;
            long eventTime = notification.when > 0 ? notification.when : sbn.getPostTime();
            // Many card alerts state the day and month only ("30/09"), assuming the current year;
            // the notification's own time is the only honest reference for resolving it.
            stage = "parse";
            PurchaseNotificationParser.Result parsed = PurchaseNotificationParser.parse(title, body, eventTime);
            if (parsed == null) return;
            stage = "persist";
            String identity = sbn.getPackageName() + ":" + sbn.getKey() + ":" + eventTime;
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder(); for (byte b : hash) key.append(String.format(java.util.Locale.ROOT, "%02x", b));
            String label = sbn.getPackageName();
            try { label = getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(sbn.getPackageName(), 0)).toString(); }
            catch (PackageManager.NameNotFoundException ignored) { /* Package name is still a truthful source. */ }
            String excerpt = (title + "\n" + body).trim();
            JSONObject candidate = store.capture(sbn.getPackageName(), label, key.toString(), sbn.getPostTime(), excerpt.substring(0, Math.min(500, excerpt.length())), parsed);
            if (candidate != null) {
                stage = "review_alert";
                PurchaseAlertPolicy.Alert alert = PurchaseAlertPolicy.decide(replay, PurchaseCapturePlugin.isForeground(),
                    candidate.optBoolean("possibleDuplicate"), sbn.getPostTime(), System.currentTimeMillis());
                if (alert != PurchaseAlertPolicy.Alert.NONE) showReviewNotification(this, candidate.getString("id"), alert == PurchaseAlertPolicy.Alert.RING);
                PurchaseCapturePlugin.changed();
            }
        } catch (Exception ignored) { PurchaseListenerRuntime.failure(stage); /* Never log bank text or replace unreadable storage. */ }
    }
    static void showReviewNotification(Context context, String id, boolean ring) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Detected transactions", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Transactions waiting for your review in FinancialApp");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, MainActivity.class).putExtra(EXTRA, id)
            .setAction("financialapp.purchase." + id).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder review = builder(context).setContentTitle("Possible transaction detected").setContentText("Tap to review in FinancialApp")
            .setContentIntent(pending);
        // A quiet review defers alerting to the silent summary, so it lands in the tray without sound or heads-up.
        if (Build.VERSION.SDK_INT >= 26) review.setGroupAlertBehavior(ring ? Notification.GROUP_ALERT_CHILDREN : Notification.GROUP_ALERT_SUMMARY);
        manager.notify(id, 1, review.build());
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Notification.Builder summary = builder(context).setContentTitle("Transactions waiting for review").setContentText("Open FinancialApp to review them")
            .setContentIntent(PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
            .setGroupSummary(true);
        if (Build.VERSION.SDK_INT >= 26) summary.setGroupAlertBehavior(Notification.GROUP_ALERT_CHILDREN);
        manager.notify(SUMMARY_TAG, 1, summary.build());
    }
    private static Notification.Builder builder(Context context) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        return builder.setSmallIcon(R.drawable.ic_stat_purchase).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).setGroup(GROUP);
    }
    /** Withdraws review alerts, and the group summary once no review alert is left under it. */
    static void withdrawReviews(Context context, Collection<String> ids) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        for (String id : ids) manager.cancel(id, 1);
        // Cancellation is asynchronous, so the alerts just withdrawn may still be listed.
        for (StatusBarNotification active : manager.getActiveNotifications()) {
            String tag = active.getTag();
            if (GROUP.equals(active.getNotification().getGroup()) && tag != null && !tag.equals(SUMMARY_TAG) && !ids.contains(tag)) return;
        }
        manager.cancel(SUMMARY_TAG, 1);
    }
}
