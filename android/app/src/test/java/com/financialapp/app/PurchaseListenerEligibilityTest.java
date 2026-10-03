package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PurchaseListenerEligibilityTest {
    @Test public void revokedAccessNeverReadsPrivateStorage() {
        assertEquals(PurchaseListenerEligibility.DISABLED,
            PurchaseListenerEligibility.read(() -> false, () -> { throw new AssertionError("Storage must not be read"); }));
    }
    @Test public void signedOutDisabledOrEmptySelectionCancelsRecovery() {
        assertEquals(PurchaseListenerEligibility.DISABLED, PurchaseListenerEligibility.read(() -> true, () -> false));
    }
    @Test public void grantedAccessAndSelectedSourcesAllowRecovery() {
        assertEquals(PurchaseListenerEligibility.ALLOWED, PurchaseListenerEligibility.read(() -> true, () -> true));
    }
    @Test public void unreadableStorageIsDeferredRatherThanTreatedAsDisabled() {
        assertEquals(PurchaseListenerEligibility.STORAGE_UNAVAILABLE,
            PurchaseListenerEligibility.read(() -> true, () -> { throw new IllegalStateException(); }));
        assertEquals(PurchaseListenerEligibility.ACCESS_UNAVAILABLE,
            PurchaseListenerEligibility.read(() -> { throw new IllegalStateException(); }, () -> true));
    }
}
