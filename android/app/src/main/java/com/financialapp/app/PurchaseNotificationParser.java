package com.financialapp.app;

import java.util.regex.Pattern;

/**
 * Recognises completed outgoing payments and transfers in any selected app's alert, in English or Malay. The rules
 * describe payment wording, not particular apps, and err toward a reviewable capture only when the alert reads as
 * money that has already left: anything unfinished, incoming, a code, a reminder, a summary or a promotion is skipped.
 */
final class PurchaseNotificationParser {
    private static final String FIGURE = PurchaseAmountReader.FIGURE_START;
    private static final String NOUN = "(?:payments?|purchases?|transactions?|transfers?|txn|trx|pmt|pymt|trf|trsf|xfer|duit\\s?now(?:\\s+qr)?|jompay|fpx|ibg|giro|paynow"
        + "|mydebit|auto-?debit|direct\\s+debit|standing\\s+instruction|pembayaran|bayaran|pemindahan|transaksi|pembelian)";
    private static final String STATUS = "(?:successful(?:ly)?|success|succeeded|completed?|approved|accepted|processed|confirmed|authori[sz]ed"
        + "|done|made|sent|berjaya|selesai|diluluskan|diterima)";

    // "code" alone is not excluded: DuitNow/QR payment confirmations routinely say "QR code".
    private static final Pattern EXCLUDED = Pattern.compile(String.join("|",
        // Codes and approval prompts.
        "\\b(?:otp|tac|one[- ]time|verification|verify|approve|authori[sz]ation)\\b",
        "\\b(?:security|secure|auth(?:entication)?|confirmation|activation|login)\\s+code\\b|\\bcode\\s*(?:is\\b|:)",
        "\\bkod\\s+(?:pengesahan|keselamatan|sekali|tac|otp)\\b",
        // Did not happen.
        "\\b(?:declined|failed|failure|unsuccessful|rejected|insufficient|cancell?ed|voided|gagal|ditolak|dibatalkan)\\b",
        "\\bnot\\s+(?:been\\s+)?(?:successful|completed|processed|approved|charged|debited|deducted|paid|sent|transferred)\\b",
        "\\b(?:could\\s+not|couldn't|unable\\s+to)\\b|\\btidak\\s+berjaya\\b",
        // Has not happened yet.
        "\\b(?:pending|scheduled|initiated|upcoming|queued|awaiting|submitted|tertunda|belum)\\b|\\bprocessing\\b(?!\\s+fee)",
        "\\bbeing\\s+processed\\b|\\bin\\s+progress\\b|\\bon\\s+hold\\b|\\bsedang\\s+diproses\\b|\\bakan\\s+di\\w+",
        "\\b(?:will|to)\\s+be\\s+(?:debited|charged|deducted|paid|processed|transferred|sent)\\b",
        "\\brequest(?:ed|s)?\\b(?!\\s*(?:id|no\\b|number|ref))",
        "\\bplease\\s+(?:make|pay|complete|transfer|approve|confirm)\\b|\\bmake\\s+(?:a\\s+|your\\s+)?payment\\b|\\bpay\\s+(?:now|before|by)\\b",
        // Money coming in.
        "\\b(?:refund(?:ed)?|reversed|reversal|chargeback|credited|dikreditkan|incoming|inbound|deposited|menerima)\\b",
        "\\bcash\\s+deposit\\b|\\bbayaran\\s+balik\\b|\\bwang\\s+masuk\\b|\\bditerima\\s+daripada\\b",
        // "We received your payment" and "received by the recipient" confirm money that left.
        "\\breceived\\b(?!\\s+(?:your\\s+(?:payment|transfer)|by)\\b)",
        "\\b(?:paid|sent|transferred|reloaded|topped\\s+up)\\s+(?:(?:in)?to\\s+(?:your|you)\\b|you\\b)",
        // Reminders, spending summaries and promotions.
        "\\b(?:reminder|peringatan)\\b|\\bdue\\b(?!\\s+date)",
        "\\bspen(?:t|ding)\\b[^\\n]{0,80}?\\b(?:(?:this|last|past)\\s+(?:week|month|year)|so\\s+far|in\\s+total)\\b",
        "\\bspending\\s+(?:summary|insights?|report)\\b",
        "\\bstand\\s+a\\s+chance\\b|\\bto\\s+win\\b|\\blucky\\s+draw\\b|\\bcontest\\b|\\bt&c\\b|\\bterms\\s+(?:and\\s+conditions\\s+)?apply\\b",
        "\\bapply\\s+now\\b|\\blimited[- ]time\\b|\\bmust\\s+be\\b|\\bmin(?:imum)?\\s+spend\\b|\\bwhen\\s+you\\s+(?:pay|spend|transfer|shop)\\b",
        // A limit change quotes the new limit as a figure, so it is excluded whatever the amount reading.
        "\\blimits?\\b[\\s\\S]{0,40}?\\b(?:updated|changed|increased|decreased|reduced|set)\\b"),
        Pattern.CASE_INSENSITIVE);
    /** A payment named with its outcome, in either order ("Payment ... successful", "Successful payment"). */
    private static final Pattern COMPLETED = Pattern.compile(
        "\\b" + NOUN + "\\b[\\s\\S]{0,120}?\\b" + STATUS + "\\b|\\b" + STATUS + "\\b[^\\n]{0,60}?\\b" + NOUN + "\\b"
            // A biller's receipt, or the bank confirming the payee has it.
            + "|\\breceived\\s+your\\s+(?:payment|transfer)\\b|\\b" + NOUN + "\\b[^\\n]{0,120}?\\breceived\\s+by\\b",
        Pattern.CASE_INSENSITIVE);
    /** Past-tense money verbs; these only count beside a money figure, so "Your bill has been paid" alone is not enough. */
    private static final Pattern MONEY_VERB = Pattern.compile(
        "\\b(?:paid|spent|purchased|charged|debited|deducted|sent|transferred|dibayar|dibelanjakan|dicaj|didebitkan|dipindahkan)\\b"
            + "|\\btelah\\s+(?:membayar|memindahkan|menghantar|membelanjakan)\\b|\\bcard\\b[^\\n]{0,40}?\\bused\\b",
        Pattern.CASE_INSENSITIVE);
    /** Terse card alerts ("Card txn RM10.00 at SHOP") and tap-to-pay receipts ("RM12.50 with Visa ••1234") state no outcome. */
    private static final Pattern CARD_CONTEXT = Pattern.compile("\\b(?:card|kad|visa|master(?:card)?|amex|mydebit|unionpay)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern NOUN_WITH_FIGURE = Pattern.compile(
        "\\b" + NOUN + "\\b[^\\n]{0,60}?" + FIGURE + "|" + FIGURE + "[^\\n]{0,60}?\\b" + NOUN + "\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern TAP_TO_PAY = Pattern.compile(
        FIGURE + "[0-9,.]*\\s+(?:with|using|via|on)\\s+(?:your\\s+)?(?:visa|master(?:card)?|amex|mydebit|unionpay|debit|credit|card)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMOTIONAL = Pattern.compile(
        "\\b(?:promo(?:tion)?|offer|voucher|cashback|rebate|reward|enjoy|discount|get|earn|up\\s+to|due\\s+date|next|minimum)\\b|%",
        Pattern.CASE_INSENSITIVE);
    /**
     * A bank's "Top-up of RM50 to TNG eWallet" is money leaving; the wallet's own "Reload RM50 successful" is money
     * arriving, so a top-up counts only when it names somewhere else the money went.
     */
    private static final Pattern TOP_UP_OUT = Pattern.compile(
        "\\b(?:top[- ]?up|reload)\\b[^\\n]{0,60}?\\b(?:to|kepada)\\s+(?!(?:your|my|anda)\\b)\\S", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANY_FIGURE = Pattern.compile(FIGURE, Pattern.CASE_INSENSITIVE);
    /** Someone the money went to; "to your account" is where money arrives and "at 10:30" is a time, not a payee. */
    private static final Pattern PAYEE = Pattern.compile("\\b(?:to|at|kepada|di)\\s+(?!(?:your|my|anda)\\b|[0-9]{1,2}(?:[:.][0-9]{2}|\\s*[ap]m\\b))\\S", Pattern.CASE_INSENSITIVE);
    /** Money "from" a person or business with no payee is incoming; paying from one's own account, card or wallet is not. */
    private static final Pattern FROM_COUNTERPARTY = Pattern.compile(
        "\\b(?:from|daripada|dari)\\s+(?!(?:your|my|anda)\\b|(?:[\\w-]+\\s+){0,2}(?:account|acct|a/c|card|wallet|e-?wallet|balance|savings?|current|akaun|kad)\\b)",
        Pattern.CASE_INSENSITIVE);
    /** Settings changes ("transfer limit updated", "payee added") mention payment words but move no money. */
    private static final Pattern SETTINGS_CHANGE = Pattern.compile(
        "\\b(?:limit|password|pin|profile|device|favou?rites?|payee|beneficiar(?:y|ies)|biller|settings?|e-?mail|phone|address|card)\\b[\\s\\S]{0,40}?"
            + "\\b(?:updated|changed|registered|added|removed|activated|deactivated|linked|unlinked|saved|set|enabled|disabled|blocked|unblocked|frozen)\\b",
        Pattern.CASE_INSENSITIVE);

    static final class Result {
        String amount;
        String currency;
        String description;
        String date;
        String transactionType;
    }

    static Result parse(String title, String body) {
        String text = normalize(title + "\n" + body);
        if (EXCLUDED.matcher(text).find()) return null;
        boolean figure = ANY_FIGURE.matcher(text).find();
        boolean payee = PAYEE.matcher(text).find();
        boolean terseCard = figure && !PROMOTIONAL.matcher(text).find()
            && (TAP_TO_PAY.matcher(text).find() || (payee && CARD_CONTEXT.matcher(text).find() && NOUN_WITH_FIGURE.matcher(text).find()));
        boolean moneyVerb = figure && (MONEY_VERB.matcher(text).find() || TOP_UP_OUT.matcher(text).find());
        if (!COMPLETED.matcher(text).find() && !moneyVerb && !terseCard) return null;
        if (!payee && FROM_COUNTERPARTY.matcher(text).find()) return null;
        Result result = new Result();
        result.transactionType = "outflow";
        PurchaseAmountReader.read(text, result);
        if (result.amount == null && SETTINGS_CHANGE.matcher(text).find()) return null;
        result.description = PurchaseMerchantReader.read(text);
        result.date = PurchaseDateReader.read(text);
        return result;
    }

    /** Apps pad text with no-break and zero-width characters that would otherwise defeat whitespace and word matching. */
    static String normalize(String value) {
        return value.replaceAll("[\\u200B-\\u200F\\u2060-\\u2064\\u2066-\\u2069\\uFEFF\\u00AD]", "")
            .replaceAll("[\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000\\t]", " ")
            .replaceAll("[\\u2018\\u2019]", "'").replaceAll("[\\u201C\\u201D]", "\"").replaceAll("[\\u2010-\\u2015\\u2212]", "-")
            .replaceAll("\\r\\n?", "\n").replaceAll(" *\\n *", "\n").replaceAll(" {2,}", " ").trim();
    }
}
