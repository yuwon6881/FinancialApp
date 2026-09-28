package com.financialapp.app;

/** Replayed bank alerts remain reviewable without ringing long after the transaction. */
final class PurchaseNotificationTiming {
    private static final long FRESH_WINDOW = 5L * 60 * 1000;

    static boolean shouldAlert(long postedAt, long now) {
        return postedAt > 0 && postedAt <= now && now - postedAt <= FRESH_WINDOW;
    }
}
