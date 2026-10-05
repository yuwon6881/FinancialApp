package com.financialapp.app;

import android.content.ComponentName;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 26)
public class PurchaseListenerBindingTest {
    private static final ComponentName LISTENER = new ComponentName("com.financialapp.app", "com.financialapp.app.PurchaseNotificationListener");
    private static final class Recorder implements PurchaseListenerBinding.Manager {
        final List<String> calls = new ArrayList<>();
        RuntimeException unbindFailure;
        @Override public void unbind(ComponentName component) {
            calls.add("unbind:" + component.getClassName());
            if (unbindFailure != null) throw unbindFailure;
        }
        @Override public void rebind(ComponentName component) { calls.add("rebind:" + component.getClassName()); }
    }

    @Test public void android14DropsTheStaleBindingBeforeAskingForAFreshOne() {
        // requestRebind alone returns early unless the listener was snoozed, so it cannot repair a binding
        // Android stopped retrying; unbinding first is the same reset as switching access off and on.
        for (int sdk : new int[] {34, 35, 36}) {
            Recorder manager = new Recorder();
            PurchaseListenerBinding.refresh(LISTENER, sdk, manager);
            assertEquals(Arrays.asList("unbind:" + LISTENER.getClassName(), "rebind:" + LISTENER.getClassName()), manager.calls);
        }
    }
    @Test public void olderAndroidCanOnlyRequestARebind() {
        Recorder manager = new Recorder();
        PurchaseListenerBinding.refresh(LISTENER, 33, manager);
        assertEquals(Arrays.asList("rebind:" + LISTENER.getClassName()), manager.calls);
    }
    @Test public void aFailedUnbindStillRebindsSoTheListenerIsNeverLeftSnoozed() {
        Recorder manager = new Recorder();
        manager.unbindFailure = new SecurityException("denied");
        try { PurchaseListenerBinding.refresh(LISTENER, 36, manager); fail("The failure must still be reported"); }
        catch (SecurityException expected) { /* Reported to recovery health as a rebind failure. */ }
        assertEquals("rebind:" + LISTENER.getClassName(), manager.calls.get(manager.calls.size() - 1));
    }
}
