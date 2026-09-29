package com.financialapp.app;

/**
 * How a new capture reaches the tray. Only an alert Android delivered live, moments after the payment, rings;
 * captures recovered from the tray when the listener reconnects, or stale re-posts, wait quietly so reopening
 * FinancialApp or a rebind after the OEM killed the listener never produces a burst of alerts.
 */
final class PurchaseAlertPolicy {
    enum Alert { NONE, QUIET, RING }

    private static final long FRESH_WINDOW = 5L * 60 * 1000;

    static Alert decide(boolean replay, boolean foreground, long postedAt, long now) {
        // A reconnect while FinancialApp is open is the app's own catch-up; its Detected transactions card shows the result.
        if (replay && foreground) return Alert.NONE;
        boolean fresh = postedAt > 0 && postedAt <= now && now - postedAt <= FRESH_WINDOW;
        return !replay && !foreground && fresh ? Alert.RING : Alert.QUIET;
    }
}
