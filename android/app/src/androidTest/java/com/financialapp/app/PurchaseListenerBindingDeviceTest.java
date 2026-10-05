package com.financialapp.app;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.content.ComponentName;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.service.notification.NotificationListenerService;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Run on an Android 14+ emulator. It switches this app's notification access and restores it afterwards;
 * connectedDebugAndroidTest also uninstalls the app when it finishes, which wipes the app's data.
 */
@RunWith(AndroidJUnit4.class)
public class PurchaseListenerBindingDeviceTest {
    private ComponentName listener;
    private boolean previouslyGranted;

    private static void shell(String command) throws Exception {
        ParcelFileDescriptor output = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
        try (InputStream stream = new ParcelFileDescriptor.AutoCloseInputStream(output)) { while (stream.read() != -1) { /* Drain. */ } }
    }
    private static long connectedAt() throws Exception {
        return PurchaseListenerRuntime.diagnostics().optLong("lastConnectedAt");
    }
    private interface Condition { boolean met() throws Exception; }
    private static boolean await(Condition condition, long timeout) throws Exception {
        long deadline = SystemClock.uptimeMillis() + timeout;
        while (SystemClock.uptimeMillis() < deadline) { if (condition.met()) return true; SystemClock.sleep(100); }
        return condition.met();
    }

    @Before public void connectFreshly() throws Exception {
        assumeTrue(Build.VERSION.SDK_INT >= 34);
        listener = new ComponentName(InstrumentationRegistry.getInstrumentation().getTargetContext(), PurchaseNotificationListener.class);
        previouslyGranted = PurchaseListenerRuntime.access(InstrumentationRegistry.getInstrumentation().getTargetContext());
        shell("cmd notification disallow_listener " + listener.flattenToString());
        assertTrue(await(() -> !PurchaseNotificationListener.isConnected(), 10000));
        long granted = System.currentTimeMillis();
        shell("cmd notification allow_listener " + listener.flattenToString());
        assertTrue(await(() -> PurchaseNotificationListener.isConnected() && connectedAt() >= granted, 15000));
    }
    @After public void restoreAccess() throws Exception {
        if (listener != null) shell("cmd notification " + (previouslyGranted ? "allow_listener " : "disallow_listener ") + listener.flattenToString());
    }

    @Test public void requestRebindAloneDoesNotTouchABindingAndroidHasNotSnoozed() throws Exception {
        // This is why recovery that only called requestRebind could never repair a dropped binding.
        long before = connectedAt();
        NotificationListenerService.requestRebind(listener);
        SystemClock.sleep(3000);
        assertEquals(before, connectedAt());
    }
    @Test public void refreshMakesAndroidBindTheListenerAgain() throws Exception {
        long before = connectedAt();
        PurchaseListenerBinding.refresh(listener, Build.VERSION.SDK_INT, PurchaseListenerBinding.SYSTEM);
        assertTrue("Android did not bind the listener again", await(() -> PurchaseNotificationListener.isConnected() && connectedAt() > before, 15000));
    }
}
