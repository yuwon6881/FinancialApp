package com.financialapp.app;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Reads the one amount a payment alert moved; anything ambiguous stays absent for the reviewer. */
final class PurchaseAmountReader {
    static final String CODES = "RM|MYR|SGD|USD|EUR|GBP|AUD|HKD|CNY|RMB|JPY|THB|IDR|PHP|INR|NZD|CAD|CHF|KRW|TWD|VND|BND";
    /** Symbols with one clear currency. A bare "$" or "¥" could be several, so only a zero amount is read from them. */
    private static final String SYMBOLS = "S\\$|US\\$|A\\$|HK\\$|£|€";
    /** Any money figure ("RM5", "$5", "5.00 EUR"), including ambiguous symbols; used to recognise payment wording, not to read it. */
    static final String FIGURE_START = "(?:\\b(?:" + CODES + ")\\s*-?\\s*[0-9]|(?:" + SYMBOLS + "|\\$|¥)\\s*[0-9]|\\b[0-9][0-9,.]*\\s*(?:" + CODES + ")\\b)";
    // "RM20.00." ends a sentence, while "RM12,34" and "RM1.234" are malformed rather than 12 or 1.23.
    private static final String NUMBER = "((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]{1,2})?)(?![0-9]|[.,][0-9])";
    // Some statements print a debit as "RM-50.00"; the sign is the direction, which the parser already knows.
    private static final Pattern PREFIXED = Pattern.compile("(?:\\b(" + CODES + ")|(" + SYMBOLS + "))\\s*-?\\s*" + NUMBER, Pattern.CASE_INSENSITIVE);
    private static final Pattern SUFFIXED = Pattern.compile("(?<![0-9.,])" + NUMBER + "\\s*(" + CODES + ")\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern AMBIGUOUS = Pattern.compile("(?<![\\p{L}$])(\\$|¥)\\s*" + NUMBER);
    private static final Pattern CODE_AFTER = Pattern.compile("^\\s*(?:" + CODES + ")\\b", Pattern.CASE_INSENSITIVE);
    /** A figure labelled as a balance, limit, fee or reward is context, not the amount that moved. */
    private static final Pattern CONTEXT_BEFORE = Pattern.compile(
        "\\b(?:bal(?:ance)?|available|avail|limit|remaining|outstanding|min(?:imum)?(?:\\s+payment)?|fees?|(?:service\\s+)?charges?"
            + "|cashback|rebate|rewards?|points|discount|baki|had\\s+(?:harian|transaksi)|caj)\\b[^0-9]{0,24}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern CONTEXT_AFTER = Pattern.compile("^\\s*(?:cashback|rebate|discount|off|points|rewards?|fees?)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LABELLED = Pattern.compile("\\b(?:amount|amt|total|jumlah|sebanyak|nilai)\\W{0,4}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern LABELLED_BARE = Pattern.compile("\\b(?:amount|amt|total|jumlah|sebanyak|nilai)[\\s:=\\-]{0,4}" + NUMBER, Pattern.CASE_INSENSITIVE);
    private static final Pattern SMS_HEADER = Pattern.compile("(?m)^\\s*(?:RM|MYR)\\s*0(?:\\.0{1,2})?\\s+"
        + "(?!(?:payment|purchase|transaction|transfer|card|bayaran|pembayaran|transaksi|pemindahan)\\b)[\\p{L}][\\p{L} .&-]{0,40}:", Pattern.CASE_INSENSITIVE);

    private static final class Figure {
        final String currency; final BigDecimal value; final boolean labelled;
        Figure(String currency, BigDecimal value, boolean labelled) { this.currency = currency; this.value = value; this.labelled = labelled; }
        boolean same(Figure other) { return currency.equals(other.currency) && value.compareTo(other.value) == 0; }
    }

    /**
     * One distinct figure is the amount, even when the title and body both repeat it. With several, a single
     * figure labelled "Amount"/"Total" wins; otherwise the amount stays absent rather than guessed.
     */
    static void read(String text, PurchaseNotificationParser.Result result) {
        List<Figure> figures = new ArrayList<>();
        collect(text, PREFIXED.matcher(text), true, false, figures);
        collect(text, SUFFIXED.matcher(text), false, false, figures);
        collect(text, AMBIGUOUS.matcher(text), true, true, figures);
        Matcher bare = LABELLED_BARE.matcher(text);
        while (bare.find()) {
            String before = text.substring(Math.max(0, bare.start() - 40), bare.start());
            if (!CONTEXT_BEFORE.matcher(before).find() && !CONTEXT_AFTER.matcher(text.substring(bare.end())).find()
                && !CODE_AFTER.matcher(text.substring(bare.end())).find())
                figures.add(new Figure("?", new BigDecimal(bare.group(1).replace(",", "")), true));
        }
        Figure chosen = distinct(figures);
        if (chosen == null) {
            List<Figure> labelled = new ArrayList<>();
            for (Figure figure : figures) if (figure.labelled) labelled.add(figure);
            chosen = distinct(labelled);
        }
        if (chosen == null) return;
        boolean ambiguousCurrency = chosen.currency.equals("$") || chosen.currency.equals("¥") || chosen.currency.equals("?");
        if (ambiguousCurrency && chosen.value.signum() != 0) return;
        result.amount = chosen.value.toPlainString();
        result.currency = ambiguousCurrency ? null : chosen.currency;
    }

    private static void collect(String text, Matcher money, boolean prefixed, boolean ambiguous, List<Figure> figures) {
        while (money.find()) {
            String before = text.substring(Math.max(0, money.start() - 40), money.start());
            if (CONTEXT_BEFORE.matcher(before).find() || CONTEXT_AFTER.matcher(text.substring(money.end())).find()) continue;
            if (ambiguous && CODE_AFTER.matcher(text.substring(money.end())).find()) continue;
            String code = ambiguous ? money.group(1) : prefixed ? (money.group(1) != null ? money.group(1) : money.group(2)) : money.group(2);
            BigDecimal value = new BigDecimal((ambiguous ? money.group(2) : prefixed ? money.group(3) : money.group(1)).replace(",", ""));
            // Malaysian bank SMS can open with "RM0 CIMB:" for the message charge, not the transaction.
            Matcher header = SMS_HEADER.matcher(text);
            boolean smsHeader = false;
            while (value.signum() == 0 && header.find()) {
                if (money.start() >= header.start() && money.end() <= header.end()) { smsHeader = true; break; }
            }
            if (smsHeader) continue;
            figures.add(new Figure(currency(code), value, LABELLED.matcher(before).find()));
        }
    }

    private static Figure distinct(List<Figure> figures) {
        if (figures.isEmpty()) return null;
        for (Figure figure : figures) if (!figure.same(figures.get(0))) return null;
        return figures.get(0);
    }

    private static String currency(String code) {
        switch (code.toUpperCase(Locale.ROOT)) {
            case "RM": return "MYR";
            case "RMB": return "CNY";
            case "S$": return "SGD";
            case "US$": return "USD";
            case "A$": return "AUD";
            case "HK$": return "HKD";
            case "£": return "GBP";
            case "€": return "EUR";
            default: return code.toUpperCase(Locale.ROOT);
        }
    }
}
