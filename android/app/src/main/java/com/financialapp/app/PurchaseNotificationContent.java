package com.financialapp.app;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.text.TextUtils;

/** The words a posted notification shows, across the styles banks, wallets and SMS apps use. */
final class PurchaseNotificationContent {
    final String title;
    final String body;

    private PurchaseNotificationContent(CharSequence title, CharSequence body) {
        this.title = title == null ? "" : title.toString();
        this.body = body == null ? "" : body.toString();
    }

    static PurchaseNotificationContent read(Notification notification) {
        Bundle extras = notification.extras;
        if (extras == null) return new PurchaseNotificationContent(null, notification.tickerText);
        CharSequence title = first(extras.getCharSequence(Notification.EXTRA_TITLE_BIG), extras.getCharSequence(Notification.EXTRA_TITLE));
        // Expanded text is complete where the collapsed line is truncated; an SMS app's newest message is the alert itself.
        CharSequence body = first(extras.getCharSequence(Notification.EXTRA_BIG_TEXT), latestMessage(extras), lines(extras),
            extras.getCharSequence(Notification.EXTRA_TEXT), notification.tickerText);
        return new PurchaseNotificationContent(title, body);
    }

    private static CharSequence first(CharSequence... values) {
        for (CharSequence value : values) if (value != null && value.toString().trim().length() > 0) return value;
        return null;
    }

    /** MessagingStyle keeps the newest message last. */
    @SuppressWarnings("deprecation")
    private static CharSequence latestMessage(Bundle extras) {
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages == null) return null;
        for (int i = messages.length - 1; i >= 0; i--) {
            if (!(messages[i] instanceof Bundle)) continue;
            CharSequence text = ((Bundle) messages[i]).getCharSequence("text");
            if (text != null && text.length() > 0) return text;
        }
        return null;
    }

    /** InboxStyle lines; several alerts in one notification leave the amount ambiguous, which the parser keeps absent. */
    private static CharSequence lines(Bundle extras) {
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        return lines == null || lines.length == 0 ? null : TextUtils.join("\n", lines);
    }
}
