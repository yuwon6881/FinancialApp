package com.financialapp.app;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the date a payment happened. Numeric dates are day-first, the Malaysian and Singaporean convention; month
 * names may be English or Malay. Two different dates, or an impossible one, stay absent rather than guessed.
 */
final class PurchaseDateReader {
    private static final String MONTH = "(jan(?:uary|uari)?|feb(?:ruary|ruari)?|march|mar|mac|apr(?:il)?|may|mei|june|jun|julai|july|jul"
        + "|aug(?:ust)?|ogos|ogo|sept(?:ember)?|sep|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?|dis(?:ember)?)";
    private static final Pattern ISO = Pattern.compile("\\b(20[0-9]{2})[-/.]([0-9]{1,2})[-/.]([0-9]{1,2})\\b");
    // A dotted date needs a four-digit year so "1.2.34" never reads as a date.
    private static final Pattern NUMERIC = Pattern.compile(
        "\\b([0-9]{1,2})[/-]([0-9]{1,2})[/-]((?:20)?[0-9]{2})\\b|\\b([0-9]{1,2})\\.([0-9]{1,2})\\.(20[0-9]{2})\\b");
    private static final Pattern DAY_MONTH = Pattern.compile(
        "\\b([0-9]{1,2})(?:st|nd|rd|th)?[\\s.-]*" + MONTH + "[\\s.,-]*((?:20)?[0-9]{2})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern MONTH_DAY = Pattern.compile(
        "\\b" + MONTH + "[\\s.-]*([0-9]{1,2})(?:st|nd|rd|th)?,?\\s+(20[0-9]{2})\\b", Pattern.CASE_INSENSITIVE);
    /** A due, expiry or validity date is about the future, not when the payment happened. */
    private static final Pattern NOT_PAYMENT_DATE = Pattern.compile(
        "\\b(?:due|expir\\w*|valid\\w*|until|till|before|next|tarikh\\s+akhir|sebelum|tamat)\\b[^0-9]{0,14}$", Pattern.CASE_INSENSITIVE);
    private static final String[][] MONTHS = {
        {"jan"}, {"feb"}, {"mar", "mac"}, {"apr"}, {"may", "mei"}, {"jun"}, {"jul"}, {"aug", "ogo"}, {"sep"}, {"oct", "okt"}, {"nov"}, {"dec", "dis"}};

    static String read(String text) {
        Set<String> dates = new LinkedHashSet<>();
        for (Matcher m = ISO.matcher(text); m.find();) add(text, m, m.group(3), m.group(2), m.group(1), dates);
        for (Matcher m = NUMERIC.matcher(text); m.find();) {
            if (m.group(1) != null) add(text, m, m.group(1), m.group(2), m.group(3), dates);
            else add(text, m, m.group(4), m.group(5), m.group(6), dates);
        }
        for (Matcher m = DAY_MONTH.matcher(text); m.find();) add(text, m, m.group(1), month(m.group(2)), m.group(3), dates);
        for (Matcher m = MONTH_DAY.matcher(text); m.find();) add(text, m, m.group(2), month(m.group(1)), m.group(3), dates);
        String only = dates.size() == 1 ? dates.iterator().next() : null;
        return only == null || only.startsWith("invalid:") ? null : only;
    }

    private static void add(String text, Matcher match, String day, String month, String year, Set<String> dates) {
        if (NOT_PAYMENT_DATE.matcher(text.substring(Math.max(0, match.start() - 30), match.start())).find()) return;
        String value = valid(day, month, year.length() == 2 ? "20" + year : year);
        // An impossible date is still a date the alert stated, so it makes the answer ambiguous rather than disappearing.
        dates.add(value == null ? "invalid:" + match.group() : value);
    }

    private static String valid(String day, String month, String year) {
        if (month == null) return null;
        SimpleDateFormat format = new SimpleDateFormat("d/M/yyyy", Locale.ROOT);
        format.setLenient(false);
        try { return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(format.parse(day + "/" + month + "/" + year)); }
        catch (ParseException ignored) { return null; }
    }

    private static String month(String name) {
        String prefix = name.substring(0, 3).toLowerCase(Locale.ROOT);
        for (int i = 0; i < MONTHS.length; i++) for (String candidate : MONTHS[i]) if (candidate.equals(prefix)) return String.valueOf(i + 1);
        return null;
    }
}
