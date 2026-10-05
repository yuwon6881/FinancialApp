package com.financialapp.app;

import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;

/**
 * A lost WebView renderer costs a page rebuild, never the process. Android reclaims renderers under
 * memory pressure and replaces them on WebView updates; an unhandled loss makes WebView kill the whole
 * app process, and the transaction notification listener runs in that process.
 */
final class WebViewRendererRecovery extends WebViewListener {
    interface Host { boolean visible(); void rebuild(); void close(); long now(); }
    /** A renderer lost again this soon after a rebuild is failing on its own; stop instead of looping. */
    static final long REPEAT_WINDOW = 10000;
    private final Host host;
    private boolean pending;
    private long rebuiltAt;

    WebViewRendererRecovery(Host host) { this.host = host; }
    /** The previous page's rebuild time, so a recreated page still recognises a repeating loss. */
    void restore(long rebuiltAt) { this.rebuiltAt = rebuiltAt; }
    long rebuiltAt() { return rebuiltAt; }

    @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        // The instance cannot be reused once its renderer is gone; WebView requires it destroyed.
        ViewParent parent = view.getParent();
        if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(view);
        view.destroy();
        // A hidden page waits: starting a renderer nobody can see invites the same reclaim again.
        if (host.visible()) rebuild(); else pending = true;
        return true;
    }
    void shown() {
        if (!pending) return;
        pending = false; rebuild();
    }
    private void rebuild() {
        long now = host.now();
        boolean repeating = rebuiltAt > 0 && now >= rebuiltAt && now - rebuiltAt < REPEAT_WINDOW;
        rebuiltAt = now;
        if (repeating) host.close(); else host.rebuild();
    }
}
