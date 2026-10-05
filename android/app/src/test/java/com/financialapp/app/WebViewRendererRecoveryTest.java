package com.financialapp.app;

import android.content.Context;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.widget.FrameLayout;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.util.ArrayList;
import java.util.List;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 26)
public class WebViewRendererRecoveryTest {
    private static final class Host implements WebViewRendererRecovery.Host {
        boolean visible = true; long now = 100000; final List<String> actions = new ArrayList<>();
        @Override public boolean visible() { return visible; }
        @Override public void rebuild() { actions.add("rebuild"); }
        @Override public void close() { actions.add("close"); }
        @Override public long now() { return now; }
    }
    private static RenderProcessGoneDetail detail(boolean crashed) {
        return new RenderProcessGoneDetail() {
            @Override public boolean didCrash() { return crashed; }
            @Override public int rendererPriorityAtExit() { return WebView.RENDERER_PRIORITY_WAIVED; }
        };
    }
    private static WebView attachedWebView() {
        Context context = RuntimeEnvironment.getApplication();
        FrameLayout container = new FrameLayout(context); WebView view = new WebView(context);
        container.addView(view); return view;
    }

    @Test public void handlesEveryLossSoWebViewNeverKillsTheListenerProcess() {
        for (boolean crashed : new boolean[] {false, true}) {
            Host host = new Host(); WebView view = attachedWebView();
            assertTrue(new WebViewRendererRecovery(host).onRenderProcessGone(view, detail(crashed)));
            assertNull(view.getParent());
            assertTrue(shadowOf(view).wasDestroyCalled());
            assertEquals(java.util.Collections.singletonList("rebuild"), host.actions);
        }
    }
    @Test public void aHiddenPageRebuildsOnlyWhenShownAgain() {
        Host host = new Host(); host.visible = false;
        WebViewRendererRecovery recovery = new WebViewRendererRecovery(host);
        recovery.onRenderProcessGone(attachedWebView(), detail(false));
        recovery.shown();
        assertEquals(java.util.Collections.singletonList("rebuild"), host.actions);
        recovery.shown();
        assertEquals(1, host.actions.size());
    }
    @Test public void aLossRepeatingRightAfterARebuildClosesInsteadOfLooping() {
        Host host = new Host();
        WebViewRendererRecovery first = new WebViewRendererRecovery(host);
        first.onRenderProcessGone(attachedWebView(), detail(true));
        // The recreated page inherits the rebuild time through its saved state.
        WebViewRendererRecovery recreated = new WebViewRendererRecovery(host);
        recreated.restore(first.rebuiltAt());
        host.now += WebViewRendererRecovery.REPEAT_WINDOW - 1;
        recreated.onRenderProcessGone(attachedWebView(), detail(true));
        assertEquals(java.util.Arrays.asList("rebuild", "close"), host.actions);
        WebViewRendererRecovery later = new WebViewRendererRecovery(host);
        later.restore(recreated.rebuiltAt());
        host.now += WebViewRendererRecovery.REPEAT_WINDOW;
        later.onRenderProcessGone(attachedWebView(), detail(false));
        assertEquals("rebuild", host.actions.get(2));
    }
}
