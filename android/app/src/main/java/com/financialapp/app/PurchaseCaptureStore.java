package com.financialapp.app;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** All read/modify/write operations share one lock, including background listener callbacks. */
final class PurchaseCaptureStore {
    private static final String KEY = "financialapp-purchase-capture-v1";
    private static final long RETENTION = 30L * 24 * 60 * 60 * 1000;
    private final Context context;
    PurchaseCaptureStore(Context context) { this.context = context.getApplicationContext(); }
    private AtomicFile file() { return new AtomicFile(new File(context.getNoBackupFilesDir(), "purchase-captures-v1")); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY)) return (SecretKey) store.getKey(KEY, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private JSONObject read() throws Exception {
        if (!file().getBaseFile().exists()) return new JSONObject();
        byte[] bytes = file().readFully();
        if (bytes.length < 29) throw new IllegalStateException("Capture storage is unreadable");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, bytes, 0, 12));
        return new JSONObject(new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8));
    }
    private void write(JSONObject root) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        AtomicFile target = file();
        FileOutputStream output = target.startWrite();
        try {
            output.write(cipher.getIV());
            output.write(cipher.doFinal(root.toString().getBytes(StandardCharsets.UTF_8)));
            target.finishWrite(output);
        } catch (Exception error) { target.failWrite(output); throw error; }
    }
    private JSONObject account(JSONObject root, String owner) throws Exception {
        JSONObject accounts = root.optJSONObject("accounts");
        if (accounts == null) { accounts = new JSONObject(); root.put("accounts", accounts); }
        JSONObject value = accounts.optJSONObject(owner);
        if (value == null) {
            value = new JSONObject().put("enabled", false).put("packages", new JSONArray()).put("candidates", new JSONArray());
            accounts.put(owner, value);
        }
        return value;
    }
    private void authorize(JSONObject root, String owner) {
        if (owner == null || owner.isEmpty() || !owner.equals(root.optString("activeOwner"))) throw new SecurityException("Sign in to the capture owner account");
    }
    void activate(String owner) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); root.put("activeOwner", owner == null ? "" : owner); write(root);
        }
    }
    JSONObject state(String owner) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); authorize(root, owner);
            return new JSONObject(account(root, owner).toString());
        }
    }
    void configure(String owner, boolean enabled, JSONArray packages) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); authorize(root, owner);
            account(root, owner).put("enabled", enabled).put("packages", packages); write(root);
        }
    }
    JSONObject capture(String source, String label, String eventKey, long postedAt, String excerpt, PurchaseNotificationParser.Result parsed) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); String owner = root.optString("activeOwner");
            if (owner.isEmpty()) return null;
            JSONObject account = account(root, owner);
            if (!account.optBoolean("enabled")) return null;
            JSONArray packages = account.getJSONArray("packages"); boolean selected = false;
            for (int i = 0; i < packages.length(); i++) if (source.equals(packages.getString(i))) selected = true;
            if (!selected) return null;
            JSONArray candidates = account.getJSONArray("candidates");
            int pending = 0; boolean possibleDuplicate = false;
            JSONArray retained = new JSONArray();
            for (int i = 0; i < candidates.length(); i++) {
                JSONObject existing = candidates.getJSONObject(i);
                if (eventKey.equals(existing.optString("eventKey"))) return null;
                if (!existing.optString("status", "pending").equals("completed")) pending++;
                if (parsed.amount != null && parsed.description != null && parsed.amount.equals(existing.optString("amount"))
                    && parsed.description.equalsIgnoreCase(existing.optString("description"))
                    && Math.abs(postedAt - existing.optLong("capturedAt")) < 120000) possibleDuplicate = true;
                if (!existing.optString("status").equals("completed") || System.currentTimeMillis() - existing.optLong("completedAt") < RETENTION) retained.put(existing);
            }
            if (pending >= 200 || retained.length() >= 2000) return null;
            JSONObject candidate = new JSONObject().put("id", UUID.randomUUID().toString()).put("transactionId", UUID.randomUUID().toString())
                .put("owner", owner).put("sourcePackage", source).put("sourceLabel", label).put("eventKey", eventKey)
                .put("capturedAt", postedAt).put("excerpt", excerpt).put("status", "pending").put("possibleDuplicate", possibleDuplicate);
            if (parsed.amount != null) candidate.put("amount", parsed.amount);
            if (parsed.currency != null) candidate.put("currency", parsed.currency);
            if (parsed.description != null) candidate.put("description", parsed.description);
            if (parsed.date != null) candidate.put("date", parsed.date);
            retained.put(candidate); account.put("candidates", retained); write(root); return candidate;
        }
    }
    JSONObject update(String owner, String id, String action, JSONObject data) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); authorize(root, owner);
            JSONArray candidates = account(root, owner).getJSONArray("candidates");
            for (int i = 0; i < candidates.length(); i++) {
                JSONObject value = candidates.getJSONObject(i);
                if (!id.equals(value.optString("id"))) continue;
                if (value.optString("status").equals("completed")) return new JSONObject().put("completed", true);
                if (action.equals("edit") && !value.has("prepared")) value.put("edits", data);
                else if (action.equals("prepare")) {
                    if (!value.has("prepared")) value.put("prepared", data);
                } else if (action.equals("complete") || action.equals("discard")) {
                    if (action.equals("discard") && value.has("prepared")) throw new IllegalStateException("This purchase has already been approved");
                    JSONObject tombstone = new JSONObject().put("id", id).put("eventKey", value.getString("eventKey"))
                        .put("status", "completed").put("completedAt", System.currentTimeMillis());
                    candidates.put(i, tombstone);
                }
                write(root); return new JSONObject(value.toString());
            }
            throw new IllegalArgumentException("Capture no longer exists");
        }
    }
    boolean selected(String source) throws Exception {
        synchronized (PurchaseCaptureStore.class) {
            JSONObject root = read(); String owner = root.optString("activeOwner");
            if (owner.isEmpty()) return false;
            JSONObject value = account(root, owner);
            if (!value.optBoolean("enabled")) return false;
            JSONArray packages = value.getJSONArray("packages");
            for (int i = 0; i < packages.length(); i++) if (source.equals(packages.getString(i))) return true;
            return false;
        }
    }
    void wipe() {
        synchronized (PurchaseCaptureStore.class) { file().delete(); }
    }
}
