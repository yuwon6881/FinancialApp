package com.financialapp.app;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.net.Uri;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.content.ComponentName;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;
import java.util.HashSet;
import java.util.Set;
import java.util.Arrays;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "PurchaseCapture", permissions = @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS}))
public class PurchaseCapturePlugin extends Plugin {
    private static WeakReference<PurchaseCapturePlugin> instance = new WeakReference<>(null);
    private String pendingTap;
    @Override public void load() { instance = new WeakReference<>(this); readTap(getActivity().getIntent()); }
    @Override protected void handleOnNewIntent(Intent intent) { readTap(intent); }
    private void readTap(Intent intent) {
        if (intent != null && intent.hasExtra(PurchaseNotificationListener.EXTRA)) {
            getActivity().setIntent(intent);
            pendingTap = intent.getStringExtra(PurchaseNotificationListener.EXTRA);
            notifyListeners("changed", new JSObject());
        }
    }
    static void changed() {
        PurchaseCapturePlugin plugin = instance.get();
        if (plugin != null) plugin.notifyListeners("changed", new JSObject());
    }
    private PurchaseCaptureStore store() { return new PurchaseCaptureStore(getContext()); }
    private interface Operation { JSObject run() throws Exception; }
    private void run(PluginCall call, Operation operation) {
        try { call.resolve(operation.run()); }
        catch (Exception error) { call.reject("Transaction detection could not complete this operation. Try again after signing in."); }
    }
    private boolean access() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }
    private boolean reviewNotifications() {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            android.app.NotificationChannel channel = manager.getNotificationChannel(PurchaseNotificationListener.CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }
    @PluginMethod public void activate(PluginCall call) { run(call, () -> { store().activate(call.getString("owner")); return new JSObject(); }); }
    @PluginMethod public void state(PluginCall call) {
        run(call, () -> {
            JSONObject data = store().state(call.getString("owner"));
            JSONArray pending = new JSONArray(); JSONArray candidates = data.getJSONArray("candidates");
            for (int i = 0; i < candidates.length(); i++) {
                JSONObject candidate = candidates.getJSONObject(i);
                if (!candidate.optString("status").equals("completed")) pending.put(candidate);
            }
            return new JSObject().put("enabled", data.optBoolean("enabled")).put("packages", data.getJSONArray("packages"))
                .put("candidates", pending).put("access", access()).put("tapId", pendingTap)
                .put("notifications", reviewNotifications());
        });
    }
    @PluginMethod public void applications(PluginCall call) {
        run(call, () -> {
            Intent intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            JSONArray applications = new JSONArray(); Set<String> seen = new HashSet<>();
            for (ResolveInfo app : getContext().getPackageManager().queryIntentActivities(intent, 0)) {
                String name = app.activityInfo.packageName;
                if (!name.equals(getContext().getPackageName()) && seen.add(name)) applications.put(new JSONObject()
                    .put("packageName", name).put("label", app.loadLabel(getContext().getPackageManager()).toString()));
            }
            return new JSObject().put("applications", applications);
        });
    }
    @PluginMethod public void configure(PluginCall call) {
        run(call, () -> {
            JSArray packages = call.getArray("packages", new JSArray());
            JSONArray valid = new JSONArray();
            for (int i = 0; i < packages.length(); i++) {
                String name = packages.getString(i);
                if (!name.equals(getContext().getPackageName()) && getContext().getPackageManager().getLaunchIntentForPackage(name) != null) valid.put(name);
            }
            store().configure(call.getString("owner"), Boolean.TRUE.equals(call.getBoolean("enabled")), valid);
            if (access()) NotificationListenerService.requestRebind(new ComponentName(getContext(), PurchaseNotificationListener.class));
            return new JSObject();
        });
    }
    @PluginMethod public void openAccessSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); call.resolve();
    }
    @PluginMethod public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) requestPermissionForAlias("notifications", call, "notificationsResult");
        else call.resolve();
    }
    @PermissionCallback private void notificationsResult(PluginCall call) { call.resolve(); }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        Intent intent = Build.VERSION.SDK_INT >= 26
            ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
            : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent); call.resolve();
    }
    @PluginMethod public void update(PluginCall call) {
        run(call, () -> {
            String action = call.getString("action", "edit");
            if (!Arrays.asList("edit", "prepare", "complete", "discard").contains(action)) throw new IllegalArgumentException();
            String id = call.getString("id");
            JSONObject candidate = store().update(call.getString("owner"), id, action, call.getObject("data", new JSObject()));
            if (action.equals("complete") || action.equals("discard")) getContext().getSystemService(NotificationManager.class).cancel(id, 1);
            if (action.equals("complete") || action.equals("discard")) changed();
            return new JSObject(candidate.toString());
        });
    }
    @PluginMethod public void consumeTap(PluginCall call) {
        run(call, () -> { store().state(call.getString("owner")); pendingTap = null;
            getActivity().getIntent().removeExtra(PurchaseNotificationListener.EXTRA); return new JSObject(); });
    }
    @PluginMethod public void wipe(PluginCall call) {
        store().wipe(); pendingTap = null; getContext().getSystemService(NotificationManager.class).cancelAll(); changed(); call.resolve();
    }
}
