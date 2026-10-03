package com.financialapp.app;

import org.junit.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

public class PurchaseListenerRecoveryTest {
    private static final class Clock implements PurchaseListenerRecovery.Scheduler {
        long now;
        final List<Task> tasks = new ArrayList<>();
        static final class Task { long at; Runnable run; boolean cancelled; }
        public Runnable later(Runnable run, long delay) {
            Task task = new Task(); task.at = now + delay; task.run = run; tasks.add(task);
            return () -> task.cancelled = true;
        }
        void advance(long time) {
            while (true) {
                Task next = null;
                for (Task task : tasks) if (!task.cancelled && task.at <= time && (next == null || task.at < next.at)) next = task;
                if (next == null) break;
                now = next.at; next.cancelled = true; next.run.run();
            }
            now = time;
        }
    }
    @Test public void retriesAtBoundedTimesAndStatusReadsDoNotRestart() {
        Clock clock = new Clock(); List<Long> attempts = new ArrayList<>();
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts.add(clock.now), () -> {});
        recovery.refresh(true, false, false);
        assertEquals("connecting", recovery.phase());
        clock.advance(1000); recovery.refresh(true, false, false);
        clock.advance(30000);
        assertEquals(java.util.Arrays.asList(0L, 2000L, 5000L, 10000L, 20000L), attempts);
        assertEquals("stalled", recovery.phase());
        recovery.refresh(true, false, false); clock.advance(60000);
        assertEquals(5, attempts.size());
    }
    @Test public void connectionOrEligibilityLossCancelsPendingAttempts() {
        for (boolean connected : new boolean[] {false, true}) {
            Clock clock = new Clock(); int[] attempts = {0};
            PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
            recovery.refresh(true, false, false);
            recovery.refresh(connected, connected, false);
            clock.advance(60000);
            assertEquals(1, attempts[0]); assertEquals("idle", recovery.phase());
        }
    }
    @Test public void restoredEligibilityStartsANewEpisode() {
        Clock clock = new Clock(); int[] attempts = {0};
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        recovery.refresh(true, false, false); recovery.refresh(false, false, false);
        clock.advance(60000); recovery.refresh(true, false, false);
        assertEquals(2, attempts[0]); assertEquals("connecting", recovery.phase());
    }
    @Test public void explicitRetryRestartsStalledRecovery() {
        Clock clock = new Clock(); int[] attempts = {0};
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        recovery.refresh(true, false, false); clock.advance(30000);
        recovery.refresh(true, false, true);
        assertEquals("connecting", recovery.phase()); assertEquals(6, attempts[0]);
        clock.advance(60000); assertEquals("stalled", recovery.phase());
    }
    @Test public void reentrantConnectionDoesNotLeaveRetriesScheduled() {
        Clock clock = new Clock(); PurchaseListenerRecovery[] holder = new PurchaseListenerRecovery[1]; int[] attempts = {0};
        holder[0] = new PurchaseListenerRecovery(clock, current -> { attempts[0]++; holder[0].refresh(true, true, false); }, () -> {});
        holder[0].refresh(true, false, false); clock.advance(60000);
        assertEquals(1, attempts[0]); assertEquals("idle", holder[0].phase());
    }
    @Test public void queuedRequestsBecomeInvalidAfterCancellationOrRestart() {
        Clock clock = new Clock(); List<java.util.function.BooleanSupplier> requests = new ArrayList<>();
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, requests::add, () -> {});
        recovery.refresh(true, false, false);
        assertTrue(requests.get(0).getAsBoolean());
        recovery.refresh(false, false, false);
        assertFalse(requests.get(0).getAsBoolean());
        recovery.refresh(true, false, true);
        assertTrue(requests.get(1).getAsBoolean());
        recovery.refresh(true, false, true);
        assertTrue(requests.get(1).getAsBoolean());
        clock.advance(30000);
        assertFalse(requests.get(1).getAsBoolean());
    }
    @Test public void timeoutAndConnectionPublishHealthWithoutStatusPolling() {
        Clock clock = new Clock(); List<String> phases = new ArrayList<>(); PurchaseListenerRecovery[] holder = new PurchaseListenerRecovery[1];
        holder[0] = new PurchaseListenerRecovery(clock, current -> {}, () -> phases.add(holder[0].phase()));
        holder[0].refresh(true, false, false); clock.advance(30000);
        holder[0].refresh(true, true, false); holder[0].refresh(true, true, false);
        assertEquals(java.util.Arrays.asList("connecting", "stalled", "idle"), phases);
        holder[0].refresh(true, false, false);
        assertEquals("connecting", holder[0].phase());
    }
    @Test public void failedEpisodesWaitOneFiveThenFifteenMinutes() {
        Clock clock = new Clock(); List<Long> attempts = new ArrayList<>();
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts.add(clock.now), () -> {});
        recovery.refresh(true, false, false);
        clock.advance(89999); assertEquals(5, attempts.size());
        clock.advance(90000); assertEquals(Long.valueOf(90000), attempts.get(5));
        clock.advance(419999); assertEquals(10, attempts.size());
        clock.advance(420000); assertEquals(Long.valueOf(420000), attempts.get(10));
        clock.advance(1350000); assertEquals(Long.valueOf(1350000), attempts.get(15));
        clock.advance(2280000); assertEquals(Long.valueOf(2280000), attempts.get(20));
    }
    @Test public void repeatedTriggersNeverExtendAnActiveDeadline() {
        Clock clock = new Clock(); int[] attempts = {0};
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        recovery.refresh(true, false, false);
        clock.advance(19000);
        recovery.refresh(true, false, false); recovery.refresh(true, false, true);
        clock.advance(30000);
        assertEquals("stalled", recovery.phase()); assertEquals(5, attempts[0]);
        recovery.refresh(true, false, false);
        clock.advance(90000); assertEquals(6, attempts[0]);
    }
    @Test public void reconnectAndDisableCancelCooldownAndResetBackoff() {
        for (boolean connected : new boolean[] {false, true}) {
            Clock clock = new Clock(); int[] attempts = {0};
            PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
            recovery.refresh(true, false, false); clock.advance(30000);
            recovery.refresh(connected, connected, false); clock.advance(90000);
            assertEquals(5, attempts[0]);
            recovery.refresh(true, false, false); clock.advance(180000);
            assertEquals(11, attempts[0]);
        }
    }
    @Test public void storageUnavailableDefersWithoutDiscardingRecovery() {
        Clock clock = new Clock(); int[] attempts = {0};
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        recovery.unavailable();
        assertEquals("stalled", recovery.phase());
        clock.advance(59999); assertEquals(0, attempts[0]);
        clock.advance(60000); assertEquals(1, attempts[0]);
        recovery.unavailable(); recovery.unavailable();
        clock.advance(359999); assertEquals(1, attempts[0]);
        clock.advance(360000); assertEquals(2, attempts[0]);
    }
    @Test public void freshProcessStartsRecoveryRatherThanTrustingOldHealth() {
        Clock clock = new Clock(); int[] attempts = {0};
        PurchaseListenerRecovery previous = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        previous.refresh(true, true, false);
        PurchaseListenerRecovery fresh = new PurchaseListenerRecovery(clock, current -> attempts[0]++, () -> {});
        fresh.refresh(true, false, false);
        assertEquals("connecting", fresh.phase()); assertEquals(1, attempts[0]);
    }
    @Test public void simultaneousTriggersShareOneEpisode() throws Exception {
        Clock clock = new Clock(); AtomicInteger attempts = new AtomicInteger();
        PurchaseListenerRecovery recovery = new PurchaseListenerRecovery(clock, current -> attempts.incrementAndGet(), () -> {});
        CountDownLatch start = new CountDownLatch(1); List<Thread> triggers = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            Thread trigger = new Thread(() -> {
                try { start.await(); recovery.refresh(true, false, true); }
                catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            });
            triggers.add(trigger); trigger.start();
        }
        start.countDown();
        for (Thread trigger : triggers) { trigger.join(5000); assertFalse(trigger.isAlive()); }
        assertEquals(1, attempts.get());
        clock.advance(30000); assertEquals(5, attempts.get()); assertEquals("stalled", recovery.phase());
    }
}
