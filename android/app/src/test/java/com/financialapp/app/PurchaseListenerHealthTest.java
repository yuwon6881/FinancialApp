package com.financialapp.app;

import android.content.Context;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 26)
public class PurchaseListenerHealthTest {
    @Test public void reconnectHistorySurvivesRestartWithoutClaimingAConnectionOrScheduledJob() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        PurchaseListenerHealth health = new PurchaseListenerHealth(context);
        health.connected(100); health.disconnected("destroyed", 200); health.attempted("scheduled", 300);
        health.worker(250); health.recovery(5, "scheduled", true); health.save();
        JSONObject restored = new PurchaseListenerHealth(context).snapshot();
        assertEquals(100, restored.getLong("lastConnectedAt")); assertEquals(200, restored.getLong("lastDisconnectedAt"));
        assertEquals(300, restored.getLong("lastAttemptAt")); assertEquals(250, restored.getLong("lastWorkerAt"));
        assertFalse(restored.has("listenerConnected")); assertFalse(restored.getBoolean("recoveryScheduled"));
        assertEquals(0, restored.getInt("reconnectAttempts"));
    }
    @Test public void rewritingHealthDropsUnknownFieldsAndWipingClearsHistory() throws Exception {
        Context context = RuntimeEnvironment.getApplication();
        File file = new File(context.getNoBackupFilesDir(), "purchase-listener-health-v1");
        Files.write(file.toPath(), "{\"lastConnectedAt\":100,\"listenerConnected\":true,\"excerpt\":\"private\"}".getBytes(StandardCharsets.UTF_8));
        PurchaseListenerHealth health = new PurchaseListenerHealth(context); health.save();
        JSONObject persisted = new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
        assertFalse(persisted.has("excerpt")); assertFalse(persisted.has("listenerConnected"));
        health.clear(); assertFalse(file.exists()); assertEquals(0, health.snapshot().getLong("lastConnectedAt"));
    }
}
