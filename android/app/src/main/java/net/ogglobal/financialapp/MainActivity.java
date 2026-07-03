package net.ogglobal.financialapp;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Paint every layer of the window the app's dark background colour
     * BEFORE the Capacitor bridge and WebView are created.
     *
     * On a warm relaunch Android re-creates the activity; during the brief
     * gap between the splash-theme being replaced and the WebView painting
     * its first frame the window surface is whatever the theme defines.
     * By forcing an opaque, non-translucent, dark window here we guarantee
     * the user never sees the homescreen bleed through.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ── Force the window opaque and dark BEFORE super.onCreate() ──
        // super.onCreate() calls setTheme(AppTheme.NoActionBar) and inflates
        // the layout, so we must set these flags first.
        Window window = getWindow();

        // Clear any translucency flags that the splash theme may have set.
        // On Android the translucent flag is a window attribute set at creation
        // time; clearing it here (before setContentView) makes the window fully
        // opaque for the entire lifetime of this activity instance.
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

        // Set the window background to the app's dark colour.
        // This is the very first thing drawn and acts as the "fallback surface"
        // if neither the splash nor the WebView has painted yet.
        window.getDecorView().setBackgroundColor(Color.parseColor("#0a0d14"));
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.getDecorView().setBackgroundColor(Color.parseColor("#0a0d14"));

        // Ensure the navigation bar matches so there's no lighter strip at the
        // bottom during the transition.
        window.setNavigationBarColor(Color.parseColor("#0a0d14"));
        window.setStatusBarColor(Color.parseColor("#0a0d14"));

        // Now let Capacitor do its thing (theme swap, WebView inflation, etc.)
        super.onCreate(savedInstanceState);

        // After super.onCreate(), the CoordinatorLayout and WebView exist but
        // the WebView may still be transparent.  Paint the root content view
        // dark so nothing bleeds through.
        View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#0a0d14"));
        }
    }
}
