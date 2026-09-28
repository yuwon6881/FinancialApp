package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PurchaseNotificationTimingTest {
    @Test public void alertsFreshCapturesButQueuesOldReplaysSilently() {
        long now = 1_000_000;
        assertTrue(PurchaseNotificationTiming.shouldAlert(now, now));
        assertTrue(PurchaseNotificationTiming.shouldAlert(now - 5 * 60 * 1000, now));
        assertFalse(PurchaseNotificationTiming.shouldAlert(now - 5 * 60 * 1000 - 1, now));
        assertFalse(PurchaseNotificationTiming.shouldAlert(now + 1, now));
        assertFalse(PurchaseNotificationTiming.shouldAlert(0, now));
    }
}
