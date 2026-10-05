package com.financialapp.app;

import static org.junit.Assert.*;

import android.os.SystemClock;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * The transaction listener lives in the same process as the WebView. Android reclaims renderers under
 * memory pressure and on WebView updates; an unhandled loss kills that whole process, listener included.
 * Run on an emulator: before the fix the instrumentation process itself is killed. connectedDebugAndroidTest
 * uninstalls the app when it finishes, which wipes the app's data.
 */
@RunWith(AndroidJUnit4.class)
public class WebViewRendererDeviceTest {
    private static MainActivity current(ActivityScenario<MainActivity> scenario) {
        AtomicReference<MainActivity> activity = new AtomicReference<>();
        scenario.onActivity(activity::set);
        return activity.get();
    }
    private static MainActivity awaitReplacement(ActivityScenario<MainActivity> scenario, MainActivity previous) {
        long deadline = SystemClock.uptimeMillis() + 15000;
        while (SystemClock.uptimeMillis() < deadline) {
            MainActivity activity = current(scenario);
            if (activity != previous) return activity;
            SystemClock.sleep(200);
        }
        return null;
    }
    private static void killRenderer(ActivityScenario<MainActivity> scenario) {
        scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl("chrome://kill"));
    }

    @Test public void visibleRendererLossRebuildsThePageAndKeepsTheProcess() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            MainActivity first = current(scenario);
            killRenderer(scenario);
            MainActivity rebuilt = awaitReplacement(scenario, first);
            assertNotNull("The page was not rebuilt after its renderer was lost", rebuilt);
            assertNotSame(first.getBridge().getWebView(), rebuilt.getBridge().getWebView());
        }
    }

    @Test public void backgroundRendererLossWaitsUntilThePageIsShownAgain() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.moveToState(Lifecycle.State.CREATED);
            MainActivity hidden = current(scenario);
            killRenderer(scenario);
            // No renderer is started for a page nobody can see.
            SystemClock.sleep(3000);
            assertSame(hidden, current(scenario));
            scenario.moveToState(Lifecycle.State.RESUMED);
            assertNotNull("The hidden page was not rebuilt when shown again", awaitReplacement(scenario, hidden));
        }
    }
}
