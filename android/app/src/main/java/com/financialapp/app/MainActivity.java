package com.financialapp.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Protect the first frame too; the JavaScript gate is restored after secure storage loads.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        registerPlugin(PrivacyScreenPlugin.class);
        registerPlugin(NativePushConfigurationPlugin.class);
        registerPlugin(PurchaseCapturePlugin.class);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        // Android captures the task snapshot as this Activity leaves the foreground.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onPause();
    }
}
