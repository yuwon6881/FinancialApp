package com.financialapp.app;

/** An unreadable preference is not consent withdrawal: preserve it and retry later. */
enum PurchaseListenerEligibility {
    ALLOWED, DISABLED, ACCESS_UNAVAILABLE, STORAGE_UNAVAILABLE;

    interface Check { boolean get() throws Exception; }

    static PurchaseListenerEligibility read(Check access, Check sources) {
        try { if (!access.get()) return DISABLED; }
        catch (Exception unavailable) { return ACCESS_UNAVAILABLE; }
        try { return sources.get() ? ALLOWED : DISABLED; }
        catch (Exception unavailable) { return STORAGE_UNAVAILABLE; }
    }
}
