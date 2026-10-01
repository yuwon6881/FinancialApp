package com.financialapp.app;

import java.util.ArrayList;
import java.util.List;

/** A bounded recovery episode. Status reads never extend its deadline or restart a stalled episode. */
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

    PurchaseListenerRecovery(Scheduler scheduler, Request request, Runnable changed) {
        this.scheduler = scheduler; this.request = request; this.changed = changed;
    }
    synchronized String phase() { return phase; }
    synchronized int attempts() { return attempts; }
    synchronized void refresh(boolean eligible, boolean connected, boolean restart) {
        if (!eligible || connected) {
            cancel(); setPhase("idle"); return;
        }
        if (!restart && !phase.equals("idle")) return;
        cancel();
        int episode = generation;
        phase = "connecting";
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
        cancel(); setPhase("stalled");
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
