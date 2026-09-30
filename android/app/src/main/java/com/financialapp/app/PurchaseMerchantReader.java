package com.financialapp.app;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads the payee or merchant an alert names; instruments, times and masked numbers are never mistaken for one. */
final class PurchaseMerchantReader {
    /** Where a name ends: a following clause word, an amount ("to ALI RM50", "to ALI of RM50"), punctuation or a new line. */
    private static final String END = "(?=\\s+(?:at|to|on|using|with|via|for|from|is|was|has|have|successful(?:ly)?|accepted|approved|completed|done"
        + "|ref|reference|no|id|dated|date|time|amount|amt|trx|txn|pada|melalui|untuk|daripada|dari|sebanyak|telah|adalah|berjaya|dengan)\\b"
        + "|\\s+(?:of\\s+|sebanyak\\s+)?" + PurchaseAmountReader.FIGURE_START
        // "to KFC and earned ..." ends the name; "MARKS AND SPENCER" does not.
        + "|\\s+and\\s+(?:earned|received|got|you|your|enjoyed|saved)\\b"
        + "|\\s*[(|•]|\\s+-\\s|\\s+[A-Za-z][A-Za-z ]{0,20}:\\s|[!,:;](?:\\s|$)|[.!]?\\s*$|\\n"
        // "ACME SDN. BHD." keeps its abbreviation periods.
        + "|(?<!\\b(?:sdn|bhd|co|ltd|inc|plt|corp|st|mr|mrs|ms|dr))\\.(?:\\s|$))";
    // A labelled field ("Merchant: X", "To: X") is more reliable than a preposition, so it is read first.
    private static final Pattern LABELLED = Pattern.compile(
        "\\b(?:merchant(?:\\s+name)?|payee(?:\\s+name)?|recipient(?:\\s+name)?|beneficiary(?:\\s+name)?|biller(?:\\s+name)?|paid\\s+to|to"
            + "|penerima|nama\\s+penerima|peniaga)\\s*:\\s*([^\\n;|]+?)" + END, Pattern.CASE_INSENSITIVE);
    private static final Pattern INLINE = Pattern.compile("\\b(?:at|to|kepada|di)\\s+([^\\n;|]+?)" + END, Pattern.CASE_INSENSITIVE);
    /**
     * Card alerts commonly name the merchant with "@" instead of a word ("RM59.36 ... @COURTSITE").
     * The lookbehind keeps this from reading an embedded email address's domain ("user@bank.com")
     * as a merchant: an email's "@" is always preceded by a word character, a standalone one never is.
     */
    private static final Pattern AT_SIGN = Pattern.compile("(?<!\\w)@\\s*([^\\n;|]+?)" + END, Pattern.CASE_INSENSITIVE);
    /** "RM59.00 deducted for MAXIS": a weaker cue, used only when nothing names a payee. */
    private static final Pattern PURPOSE = Pattern.compile("\\b(?:for|untuk)\\s+([^\\n;|]+?)" + END, Pattern.CASE_INSENSITIVE);
    /** "your debit card", "Savings account 1234", "own account": the payment instrument, not who was paid. */
    private static final Pattern INSTRUMENT = Pattern.compile(
        "^(?:(?:your|my|anda|own|another|other|the|a|debit|credit|prepaid|visa|master(?:card)?|amex|savings?|current|e-)\\s*)*"
            + "(?:card|account|acct|a/c|bank(?:\\s+account)?|wallet|e-?wallet|akaun|kad)(?:\\s+(?:ending|no\\.?|number))?(?:\\s*[0-9x*•#.-]+)?$"
            // A bare network name with its masked number: "Visa 1234", "Mastercard ending 5678".
            + "|^(?:visa|master(?:card)?|amex|mydebit|unionpay)(?:\\s+(?:debit|credit|card))*(?:\\s+(?:ending|no\\.?|number))?(?:\\s*[0-9x*•#.-]+)?$",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern OWNED = Pattern.compile("^(?:your|my|anda)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LETTER = Pattern.compile("\\p{L}");
    private static final Pattern MASKED = Pattern.compile("^[0-9xX*•#\\s-]+$");
    private static final Pattern TIME = Pattern.compile("^\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?(?:\\s|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FIGURE = Pattern.compile(PurchaseAmountReader.FIGURE_START, Pattern.CASE_INSENSITIVE);
    private static final Pattern TRIM = Pattern.compile("^[\"'\\s]+|[\"'\\s.,:;-]+$");

    static String read(String text) {
        String labelled = first(LABELLED.matcher(text));
        if (labelled != null) return labelled;
        String inline = first(INLINE.matcher(text));
        if (inline != null) return inline;
        String atSign = first(AT_SIGN.matcher(text));
        return atSign != null ? atSign : first(PURPOSE.matcher(text));
    }

    private static String first(Matcher match) {
        while (match.find()) {
            String name = TRIM.matcher(match.group(1)).replaceAll("");
            if (name.length() < 2 || name.length() > 120 || !LETTER.matcher(name).find() || MASKED.matcher(name).matches()) continue;
            if (OWNED.matcher(name).find() || INSTRUMENT.matcher(name).matches() || TIME.matcher(name).find() || FIGURE.matcher(name).find()) continue;
            if (PurchaseDateReader.read(name) != null) continue;
            return name;
        }
        return null;
    }
}
