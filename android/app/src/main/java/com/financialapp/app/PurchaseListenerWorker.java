package com.financialapp.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** A short recovery request, not a permanently running background service. */
public final class PurchaseListenerWorker extends Worker {
    public PurchaseListenerWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }
    @NonNull @Override public Result doWork() {
        return PurchaseListenerRuntime.scheduled(getApplicationContext()) ? Result.success() : Result.retry();
    }
}
