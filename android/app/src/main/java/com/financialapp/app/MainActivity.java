package com.financialapp.app;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.WindowManager;
import androidx.lifecycle.Lifecycle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String RENDERER_REBUILT_AT = "financialapp.rendererRebuiltAt";
    private final WebViewRendererRecovery renderer = new WebViewRendererRecovery(new WebViewRendererRecovery.Host() {
        @Override public boolean visible() { return getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED); }
        @Override public void rebuild() { recreate(); }
        @Override public void close() { finish(); }
        @Override public long now() { return SystemClock.elapsedRealtime(); }
    });

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Protect the first frame too; the JavaScript gate is restored after secure storage loads.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        registerPlugin(PrivacyScreenPlugin.class);
        registerPlugin(NativePushConfigurationPlugin.class);
        registerPlugin(PurchaseCapturePlugin.class);
        if (savedInstanceState != null) renderer.restore(savedInstanceState.getLong(RENDERER_REBUILT_AT));
        bridgeBuilder.addWebViewListener(renderer);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        renderer.shown();
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putLong(RENDERER_REBUILT_AT, renderer.rebuiltAt());
    }

    @Override
    public void onPause() {
        // Android captures the task snapshot as this Activity leaves the foreground.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onPause();
    }
}
