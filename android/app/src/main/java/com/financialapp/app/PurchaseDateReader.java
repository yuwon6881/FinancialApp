package com.financialapp.app;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
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
    // Many card alerts state day/month only ("30/09"), the year being implied. The lookbehind and
    // lookahead exclude a full date's day/month prefix ("28/" before it) or year suffix ("/26"
    // after it) so NUMERIC keeps sole ownership of it -- otherwise "28/09/26" also reads its own
    // "09/26" tail as an unrelated, invalid day/month, making the real date ambiguous.
    private static final Pattern YEARLESS = Pattern.compile("(?<![0-9]/)\\b([0-9]{1,2})/([0-9]{1,2})\\b(?!\\s*/\\s*[0-9])");
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
        return read(text, System.currentTimeMillis());
    }

    /** referenceTimeMillis resolves the year for a date the alert states without one (e.g. "30/09"). */
    static String read(String text, long referenceTimeMillis) {
        Set<String> dates = new LinkedHashSet<>();
        for (Matcher m = ISO.matcher(text); m.find();) add(text, m, m.group(3), m.group(2), m.group(1), dates);
        for (Matcher m = NUMERIC.matcher(text); m.find();) {
            if (m.group(1) != null) add(text, m, m.group(1), m.group(2), m.group(3), dates);
            else add(text, m, m.group(4), m.group(5), m.group(6), dates);
        }
        for (Matcher m = DAY_MONTH.matcher(text); m.find();) add(text, m, m.group(1), month(m.group(2)), m.group(3), dates);
        for (Matcher m = MONTH_DAY.matcher(text); m.find();) add(text, m, m.group(2), month(m.group(1)), m.group(3), dates);
        for (Matcher m = YEARLESS.matcher(text); m.find();) addYearless(text, m, m.group(1), m.group(2), referenceTimeMillis, dates);
        String only = dates.size() == 1 ? dates.iterator().next() : null;
        return only == null || only.startsWith("invalid:") ? null : only;
    }

    private static void add(String text, Matcher match, String day, String month, String year, Set<String> dates) {
        if (NOT_PAYMENT_DATE.matcher(text.substring(Math.max(0, match.start() - 30), match.start())).find()) return;
        String value = valid(day, month, year.length() == 2 ? "20" + year : year);
        // An impossible date is still a date the alert stated, so it makes the answer ambiguous rather than disappearing.
        dates.add(value == null ? "invalid:" + match.group() : value);
    }

    /**
     * A bare "30/09" implies the current year, unless that reads as more than a day in the alert's
     * own future -- an alert about something that already happened cannot be describing next year.
     */
    private static void addYearless(String text, Matcher match, String day, String month, long referenceTimeMillis, Set<String> dates) {
        // "24/7" (customer support hours) reads as a valid day/month and is common in bank alert
        // footers; it is never a transaction date, so it is excluded by idiom rather than validity.
        if ("24".equals(day) && "7".equals(month)) return;
        if (NOT_PAYMENT_DATE.matcher(text.substring(Math.max(0, match.start() - 30), match.start())).find()) return;
        Calendar reference = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        reference.setTimeInMillis(referenceTimeMillis);
        int referenceYear = reference.get(Calendar.YEAR);
        String candidate = valid(day, month, String.valueOf(referenceYear));
        if (candidate != null && isMoreThanADayAfter(candidate, referenceTimeMillis)) {
            String previousYear = valid(day, month, String.valueOf(referenceYear - 1));
            if (previousYear != null) candidate = previousYear;
        } else if (candidate == null) {
            candidate = valid(day, month, String.valueOf(referenceYear - 1));
        }
        dates.add(candidate == null ? "invalid:" + match.group() : candidate);
    }

    private static boolean isMoreThanADayAfter(String isoDate, long referenceTimeMillis) {
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            return format.parse(isoDate).getTime() - referenceTimeMillis > 24L * 60 * 60 * 1000;
        } catch (ParseException ignored) { return false; }
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
