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
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** All read/modify/write operations share one lock, including background listener callbacks. */
final class PurchaseCaptureStore {
    private static final String KEY = "financialapp-purchase-capture-v1";
    private static final long RETENTION = 30L * 24 * 60 * 60 * 1000;
    private static final long SAME_AMOUNT_WINDOW = 2L * 60 * 1000;
    private static final long SAME_TEXT_WINDOW = 10L * 60 * 1000;
    /**
     * Packages the active owner listens to, or null before the first read. Every notification on the
     * phone asks whether its source is selected; answering from memory avoids a Keystore decrypt per
     * unrelated alert. It is refreshed under the store lock on every read and write.
     */
    private static volatile Set<String> selectedCache;
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
        if (!file().getBaseFile().exists()) { cache(new JSONObject()); return new JSONObject(); }
        byte[] bytes = file().readFully();
        if (bytes.length < 29) throw new IllegalStateException("Capture storage is unreadable");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, bytes, 0, 12));
        JSONObject root = new JSONObject(new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8));
        cache(root);
        return root;
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
        cache(root);
    }
    private static void cache(JSONObject root) {
        Set<String> selected = new HashSet<>();
        String owner = root.optString("activeOwner");
        JSONObject accounts = root.optJSONObject("accounts");
        JSONObject account = accounts == null || owner.isEmpty() ? null : accounts.optJSONObject(owner);
        JSONArray packages = account == null || !account.optBoolean("enabled") ? null : account.optJSONArray("packages");
        if (packages != null) for (int i = 0; i < packages.length(); i++) selected.add(packages.optString(i));
        selectedCache = Collections.unmodifiableSet(selected);
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
    /** Identical alert text, independent of case and spacing, so a re-posted alert is recognisable. */
    static String fingerprint(String excerpt) throws Exception {
        String normalized = excerpt.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8));
        StringBuilder value = new StringBuilder();
        for (byte b : hash) value.append(String.format(Locale.ROOT, "%02x", b));
        return value.toString();
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
            String fingerprint = fingerprint(excerpt);
            JSONArray candidates = account.getJSONArray("candidates");
            int pending = 0; boolean possibleDuplicate = false;
            JSONArray retained = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < candidates.length(); i++) {
                JSONObject existing = candidates.getJSONObject(i);
                if (eventKey.equals(existing.optString("eventKey"))) return null;
                boolean completed = existing.optString("status").equals("completed");
                if (!completed) pending++;
                long apart = Math.abs(postedAt - existing.optLong("capturedAt"));
                boolean sameSource = source.equals(existing.optString("sourcePackage"));
                // A re-posted alert (same text) is flagged even after the first copy was saved.
                if (sameSource && apart < SAME_TEXT_WINDOW && fingerprint.equals(existing.optString("fingerprint"))) possibleDuplicate = true;
                if (!completed && parsed.amount != null && parsed.amount.equals(existing.optString("amount")) && apart < SAME_AMOUNT_WINDOW
                    && (sameSource || (parsed.description != null && parsed.description.equalsIgnoreCase(existing.optString("description"))))) possibleDuplicate = true;
                if (!completed || now - existing.optLong("completedAt") < RETENTION) retained.put(existing);
            }
            if (pending >= 200 || retained.length() >= 2000) return null;
            JSONObject candidate = new JSONObject().put("id", UUID.randomUUID().toString()).put("transactionId", UUID.randomUUID().toString())
                .put("owner", owner).put("sourcePackage", source).put("sourceLabel", label).put("eventKey", eventKey)
                .put("fingerprint", fingerprint).put("capturedAt", postedAt).put("excerpt", excerpt).put("status", "pending")
                .put("possibleDuplicate", possibleDuplicate).put("transactionType", parsed.transactionType);
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
                    if (action.equals("discard") && value.has("prepared")) throw new IllegalStateException("This transaction has already been approved");
                    // Only identity survives completion: no amount, merchant or alert text.
                    JSONObject tombstone = new JSONObject().put("id", id).put("eventKey", value.getString("eventKey"))
                        .put("sourcePackage", value.optString("sourcePackage")).put("fingerprint", value.optString("fingerprint"))
                        .put("capturedAt", value.optLong("capturedAt")).put("status", "completed").put("completedAt", System.currentTimeMillis());
                    candidates.put(i, tombstone);
                }
                write(root); return new JSONObject(value.toString());
            }
            // Keeping a review open, or discarding it, has nothing left to protect once the capture is gone.
            if (action.equals("edit") || action.equals("discard")) return new JSONObject().put("missing", true);
            throw new IllegalArgumentException("Capture no longer exists");
        }
    }
    boolean selected(String source) throws Exception {
        Set<String> cached = selectedCache;
        if (cached != null) return cached.contains(source);
        synchronized (PurchaseCaptureStore.class) {
            read();
            return selectedCache.contains(source);
        }
    }
    /** Returns the pending capture ids so their review notifications can be withdrawn. */
    List<String> wipe() {
        synchronized (PurchaseCaptureStore.class) {
            List<String> ids = new ArrayList<>();
            try {
                JSONObject accounts = read().optJSONObject("accounts");
                if (accounts != null) for (java.util.Iterator<String> keys = accounts.keys(); keys.hasNext();) {
                    JSONArray candidates = accounts.getJSONObject(keys.next()).optJSONArray("candidates");
                    if (candidates != null) for (int i = 0; i < candidates.length(); i++) ids.add(candidates.getJSONObject(i).optString("id"));
                }
            } catch (Exception ignored) { /* Unreadable storage is still deleted. */ }
            file().delete();
            selectedCache = Collections.emptySet();
            return ids;
        }
    }
}
