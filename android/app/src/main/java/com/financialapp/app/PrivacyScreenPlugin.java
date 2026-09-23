package com.financialapp.app;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrivacyScreen")
public class PrivacyScreenPlugin extends Plugin {
    @PluginMethod
    public void setHidden(PluginCall call) {
        Boolean hidden = call.getBoolean("hidden");
        Activity activity = getActivity();
        if (hidden == null || activity == null) {
            call.reject("A visibility value and active Android window are required.");
            return;
        }

        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (hidden) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve(new JSObject());
        });
    }
}
