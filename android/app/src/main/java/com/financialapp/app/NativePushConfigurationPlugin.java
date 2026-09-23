package com.financialapp.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;

@CapacitorPlugin(name = "NativePushConfiguration")
public class NativePushConfigurationPlugin extends Plugin {
    @PluginMethod
    public void isConfigured(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", !FirebaseApp.getApps(getContext()).isEmpty());
        call.resolve(result);
    }
}
