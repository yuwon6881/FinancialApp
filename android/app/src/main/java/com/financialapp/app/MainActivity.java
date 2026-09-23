package com.financialapp.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Protect the first frame too; the JavaScript gate is restored after secure storage loads.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        registerPlugin(PrivacyScreenPlugin.class);
        registerPlugin(NativePushConfigurationPlugin.class);

        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApiKey("AIzaSyBtUAhmSAd8zW0P5PQnqu_Yy-L9DRCV2KQ")
                    .setApplicationId("1:396431756440:android:006f7ad0e1041c2cad54ed")
                    .setProjectId("project-7eb1aec8-8636-4c86-b2a")
                    .setGcmSenderId("396431756440")
                    .build();
                FirebaseApp.initializeApp(this, options);
            }
        } catch (Exception ignored) {
        }

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        // Android captures the task snapshot as this Activity leaves the foreground.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        super.onPause();
    }
}
