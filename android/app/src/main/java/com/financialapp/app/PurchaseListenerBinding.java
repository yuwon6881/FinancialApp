package com.financialapp.app;

import android.content.ComponentName;
import android.service.notification.NotificationListenerService;
import androidx.annotation.RequiresApi;

/**
 * Asks Android for a fresh listener binding. requestRebind alone only lifts a requestUnbind snooze; it
 * returns early for a listener whose binding Android stopped retrying after the process died. Android 14
 * lets the app drop that stale state itself, the same reset as switching notification access off and on.
 * Never toggle the listener component's enabled state instead: Android removes the access grant of a
 * component that is disabled when it processes the package change.
 */
final class PurchaseListenerBinding {
    interface Manager { void unbind(ComponentName component); void rebind(ComponentName component); }
    static final Manager SYSTEM = new Manager() {
        @RequiresApi(34) @Override public void unbind(ComponentName component) { NotificationListenerService.requestUnbind(component); }
        @Override public void rebind(ComponentName component) { NotificationListenerService.requestRebind(component); }
    };

    private PurchaseListenerBinding() {}
    static void refresh(ComponentName component, int sdk, Manager manager) {
        if (sdk < 34) { manager.rebind(component); return; }
        try { manager.unbind(component); }
        // Unbinding snoozes the listener; only the rebind lifts that, so it must follow even a failure.
        finally { manager.rebind(component); }
    }
}
