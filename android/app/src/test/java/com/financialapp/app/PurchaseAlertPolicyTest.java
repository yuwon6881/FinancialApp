package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;
import static com.financialapp.app.PurchaseAlertPolicy.Alert.*;

public class PurchaseAlertPolicyTest {
    private static final long NOW = 1_000_000_000;
    private static final long WINDOW = 5 * 60 * 1000;

    @Test public void ringsOnlyForLiveFreshAlertsWhileInBackground() {
        assertEquals(RING, PurchaseAlertPolicy.decide(false, false, false, NOW, NOW));
        assertEquals(RING, PurchaseAlertPolicy.decide(false, false, false, NOW - WINDOW, NOW));
        assertEquals(QUIET, PurchaseAlertPolicy.decide(false, false, false, NOW - WINDOW - 1, NOW));
        assertEquals(QUIET, PurchaseAlertPolicy.decide(false, false, false, NOW + 1, NOW));
        assertEquals(QUIET, PurchaseAlertPolicy.decide(false, false, false, 0, NOW));
    }
    @Test public void catchUpNeverRingsButStaysReviewableFromTheTray() {
        // A replay of an alert posted seconds ago still does not ring: the bank's own alert already did.
        assertEquals(QUIET, PurchaseAlertPolicy.decide(true, false, false, NOW, NOW));
        assertEquals(QUIET, PurchaseAlertPolicy.decide(true, false, false, NOW - 6 * 60 * 1000, NOW));
    }
    @Test public void openAppShowsCatchUpInPlaceAndLiveCapturesQuietly() {
        assertEquals(NONE, PurchaseAlertPolicy.decide(true, true, false, NOW, NOW));
        assertEquals(QUIET, PurchaseAlertPolicy.decide(false, true, false, NOW, NOW));
    }
    @Test public void aLikelyRepeatOfACapturedAlertDoesNotRingAgain() {
        // A bank re-posting its notification, or the same payment arriving by push and SMS.
        assertEquals(QUIET, PurchaseAlertPolicy.decide(false, false, true, NOW, NOW));
        assertEquals(NONE, PurchaseAlertPolicy.decide(true, true, true, NOW, NOW));
    }
}
