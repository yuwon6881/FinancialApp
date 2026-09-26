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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PurchaseNotificationListener extends NotificationListenerService {
    static final String CHANNEL = "financialapp-purchase-review-v1";
    static final String EXTRA = "financialapp.purchaseCaptureId";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn.getPackageName().equals(getPackageName()) || (sbn.getNotification().flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        // Keystore and disk access must not block the service's main thread.
        worker.execute(() -> captureNotification(sbn));
    }
    @Override public void onDestroy() { worker.shutdown(); super.onDestroy(); }
    private void captureNotification(StatusBarNotification sbn) {
        try {
            PurchaseCaptureStore store = new PurchaseCaptureStore(this);
            if (!store.selected(sbn.getPackageName())) return;
            Notification notification = sbn.getNotification();
            String title = String.valueOf(notification.extras.getCharSequence(Notification.EXTRA_TITLE, ""));
            String body = String.valueOf(notification.extras.getCharSequence(Notification.EXTRA_BIG_TEXT,
                notification.extras.getCharSequence(Notification.EXTRA_TEXT, "")));
            if (title.length() > 500 || body.length() > 3000) return;
            PurchaseNotificationParser.Result parsed = PurchaseNotificationParser.parse(title, body);
            if (parsed == null) return;
            long eventTime = notification.when > 0 ? notification.when : sbn.getPostTime();
            String identity = sbn.getPackageName() + ":" + sbn.getKey() + ":" + eventTime;
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder(); for (byte b : hash) key.append(String.format(java.util.Locale.ROOT, "%02x", b));
            String label = sbn.getPackageName();
            try { label = getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(sbn.getPackageName(), 0)).toString(); }
            catch (PackageManager.NameNotFoundException ignored) { /* Package name is still a truthful source. */ }
            String excerpt = (title + "\n" + body).trim();
            JSONObject candidate = store.capture(sbn.getPackageName(), label, key.toString(), sbn.getPostTime(), excerpt.substring(0, Math.min(500, excerpt.length())), parsed);
            if (candidate != null) { showReviewNotification(this, candidate.getString("id")); PurchaseCapturePlugin.changed(); }
        } catch (Exception ignored) { /* Fail closed: never log bank notification text or replace unreadable storage. */ }
    }
    static void showReviewNotification(Context context, String id) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Detected purchases", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Purchases waiting for your review in FinancialApp");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        Intent intent = new Intent(context, MainActivity.class).putExtra(EXTRA, id)
            .setAction("financialapp.purchase." + id).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        Notification value = builder.setSmallIcon(R.drawable.ic_stat_purchase)
            .setContentTitle("Possible transaction detected").setContentText("Tap to review in FinancialApp")
            .setContentIntent(pending).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        manager.notify(id, 1, value);
    }
}
