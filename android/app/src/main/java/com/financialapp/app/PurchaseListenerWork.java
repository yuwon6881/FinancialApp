package com.financialapp.app;

import android.content.Context;
import androidx.work.BackoffPolicy;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.Operation;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/** Android owns this fallback across ordinary process death and reboot; Doze may defer execution. */
final class PurchaseListenerWork {
    static final String NAME = "financialapp-purchase-listener-recovery-v1";

    static Operation synchronize(Context context, boolean eligible) {
        WorkManager manager = WorkManager.getInstance(context);
        if (!eligible) return manager.cancelUniqueWork(NAME);
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(PurchaseListenerWorker.class, 15, TimeUnit.MINUTES)
            .setInitialDelay(15, TimeUnit.MINUTES)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
            .build();
        return manager.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }
}
