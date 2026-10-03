package com.financialapp.app;

import android.content.ComponentName;
import android.content.Context;
import android.provider.Settings;
import androidx.work.Configuration;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.testing.SynchronousExecutor;
import androidx.work.testing.TestWorkerBuilder;
import androidx.work.testing.WorkManagerTestInitHelper;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 26)
public class PurchaseListenerWorkTest {
    private Context context;

    @Before public void initialize() {
        context = RuntimeEnvironment.getApplication();
        Configuration config = new Configuration.Builder().setExecutor(new SynchronousExecutor()).build();
        WorkManagerTestInitHelper.initializeTestWorkManager(context, config);
    }
    @After public void close() { WorkManagerTestInitHelper.closeWorkDatabase(); }
    private List<WorkInfo> work() throws Exception {
        return WorkManager.getInstance(context).getWorkInfosForUniqueWork(PurchaseListenerWork.NAME).get(5, TimeUnit.SECONDS);
    }
    @Test public void repeatedSchedulingKeepsOneExistingJobAndItsDeadline() throws Exception {
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        WorkInfo first = work().get(0);
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        assertEquals(1, work().size()); assertEquals(first.getId(), work().get(0).getId());
        assertEquals(first.getNextScheduleTimeMillis(), work().get(0).getNextScheduleTimeMillis());
    }
    @Test public void disablingCancelsAndReenablingCreatesOnlyOneLiveJob() throws Exception {
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        PurchaseListenerWork.synchronize(context, false).getResult().get(5, TimeUnit.SECONDS);
        assertEquals(WorkInfo.State.CANCELLED, work().get(0).getState());
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        assertEquals(1, work().stream().filter(info -> !info.getState().isFinished()).count());
    }
    @Test public void freshWorkerCancelsRecoveryWhenAccessHasBeenRevoked() throws Exception {
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        PurchaseListenerWorker worker = TestWorkerBuilder.from(context, PurchaseListenerWorker.class, new SynchronousExecutor()).build();
        assertEquals(androidx.work.ListenableWorker.Result.success(), worker.doWork());
        assertEquals(WorkInfo.State.CANCELLED, work().get(0).getState());
        assertEquals("stalled", PurchaseListenerRuntime.phase());
    }
    @Test public void unavailableStoragePreservesTheJobAndPreferencesForALaterRetry() throws Exception {
        ComponentName component = new ComponentName(context, PurchaseNotificationListener.class);
        Settings.Secure.putString(context.getContentResolver(), "enabled_notification_listeners", component.flattenToString());
        // Even a previously cached empty selection must not disguise a failed persisted read as opt-out.
        assertFalse(new PurchaseCaptureStore(context).hasSelectedSources());
        File capture = new File(context.getNoBackupFilesDir(), "purchase-captures-v1");
        byte[] unreadable = new byte[] {1, 2, 3}; Files.write(capture.toPath(), unreadable);
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        PurchaseListenerWorker worker = TestWorkerBuilder.from(context, PurchaseListenerWorker.class, new SynchronousExecutor()).build();
        assertEquals(androidx.work.ListenableWorker.Result.retry(), worker.doWork());
        assertArrayEquals(unreadable, Files.readAllBytes(capture.toPath()));
        assertEquals(WorkInfo.State.ENQUEUED, work().get(0).getState());
        assertEquals("stalled", PurchaseListenerRuntime.phase());
    }
    @Test public void grantedAccessWithoutAnActiveSelectionStillCancelsTheJob() throws Exception {
        ComponentName component = new ComponentName(context, PurchaseNotificationListener.class);
        Settings.Secure.putString(context.getContentResolver(), "enabled_notification_listeners", component.flattenToString());
        PurchaseListenerWork.synchronize(context, true).getResult().get(5, TimeUnit.SECONDS);
        PurchaseListenerWorker worker = TestWorkerBuilder.from(context, PurchaseListenerWorker.class, new SynchronousExecutor()).build();
        assertEquals(androidx.work.ListenableWorker.Result.success(), worker.doWork());
        assertEquals(WorkInfo.State.CANCELLED, work().get(0).getState());
        assertFalse(new File(context.getNoBackupFilesDir(), "purchase-captures-v1").exists());
    }
}
