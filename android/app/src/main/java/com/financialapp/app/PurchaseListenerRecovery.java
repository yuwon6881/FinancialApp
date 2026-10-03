package com.financialapp.app;

import java.util.ArrayList;
import java.util.List;

/** Bounded attempts followed by spaced recovery; reads and lifecycle noise never extend a deadline. */
final class PurchaseListenerRecovery {
    interface Scheduler { Runnable later(Runnable run, long delay); }
    interface Request { void run(java.util.function.BooleanSupplier current); }
    private final Scheduler scheduler;
    private final Request request;
    private final Runnable changed;
    private final List<Runnable> cancellations = new ArrayList<>();
    private String phase = "idle";
    private int generation;
    private int attempts;
    private int failedEpisodes;
    private String trigger = "checking";

    PurchaseListenerRecovery(Scheduler scheduler, Request request, Runnable changed) {
        this.scheduler = scheduler; this.request = request; this.changed = changed;
    }
    synchronized String phase() { return phase; }
    synchronized int attempts() { return attempts; }
    synchronized String trigger() { return trigger; }
    synchronized boolean retryScheduled() { return phase.equals("stalled"); }
    synchronized void refresh(boolean eligible, boolean connected, boolean restart) {
        refresh(eligible, connected, restart, restart ? "manual" : "status");
    }
    synchronized void refresh(boolean eligible, boolean connected, boolean restart, String reason) {
        if (!eligible || connected) {
            cancel(); failedEpisodes = 0; setPhase("idle"); return;
        }
        if (phase.equals("connecting")) return;
        if (!restart && !phase.equals("idle")) return;
        start(reason);
    }
    private void start(String reason) {
        cancel();
        int episode = generation;
        phase = "connecting"; trigger = reason;
        // Schedule before requesting: Android may connect synchronously in a test or platform adapter.
        for (long delay : new long[] {2000, 5000, 10000, 20000})
            cancellations.add(scheduler.later(() -> attempt(episode), delay));
        cancellations.add(scheduler.later(() -> timeout(episode), 30000));
        changed.run(); attempt(episode);
    }
    private synchronized void attempt(int episode) {
        if (episode != generation || !phase.equals("connecting")) return;
        attempts++; request.run(() -> current(episode));
    }
    private synchronized boolean current(int episode) { return episode == generation && phase.equals("connecting"); }
    private synchronized void timeout(int episode) {
        if (episode != generation) return;
        waitForRetry();
    }
    synchronized void unavailable() {
        if (!phase.equals("stalled")) waitForRetry();
    }
    private void waitForRetry() {
        cancel();
        long delay = failedEpisodes == 0 ? 60000 : failedEpisodes == 1 ? 300000 : 900000;
        failedEpisodes = Math.min(2, failedEpisodes + 1);
        int waiting = generation;
        // Register before publishing so observers always see a real pending retry.
        cancellations.add(scheduler.later(() -> retry(waiting), delay));
        setPhase("stalled");
    }
    private synchronized void retry(int waiting) {
        if (waiting == generation && phase.equals("stalled")) start("cooldown");
    }
    private void cancel() {
        generation++;
        for (Runnable cancellation : cancellations) cancellation.run();
        cancellations.clear();
    }
    private void setPhase(String value) {
        if (phase.equals(value)) return;
        phase = value; changed.run();
    }
}
