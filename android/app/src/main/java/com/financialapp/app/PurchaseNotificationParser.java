package com.financialapp.app;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Conservative purchase recognition. New providers can add source-grounded parsers here. */
final class PurchaseNotificationParser {
    private static final Pattern EXCLUDED = Pattern.compile("\\b(otp|verification|verify|code|declined|failed|failure|unsuccessful|pending|requested|request|approve|authori[sz]ation|refund|reversed|reversal|transfer|received|credited|reminder|due|scheduled|cancelled|canceled)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PURCHASE = Pattern.compile("\\b(payment|purchase|transaction)\\s+(?:was\\s+|is\\s+)?(?:successful|completed|approved)|\\b(?:paid|spent|purchased)\\b|\\b(?:successful|completed)\\s+(?:payment|purchase)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MONEY = Pattern.compile("\\b(RM|MYR|USD|EUR|GBP|SGD)\\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]{1,2})?)(?![0-9.,])", Pattern.CASE_INSENSITIVE);
    private static final Pattern MERCHANT = Pattern.compile("\\b(?:at|to)\\s+([^\\n;]+?)(?=\\s+(?:on|using|with|via)\\b|[.!]?$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE = Pattern.compile("\\b(20[0-9]{2}-[0-9]{2}-[0-9]{2})\\b");
    private static final Pattern MERCHANT_LETTER = Pattern.compile("\\p{L}");
    private static final Pattern TIME = Pattern.compile("^\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?(?:\\s|$)", Pattern.CASE_INSENSITIVE);

    static final class Result {
        String amount;
        String currency;
        String description;
        String date;
    }

    static Result parse(String title, String body) {
        String text = (title + "\n" + body).trim();
        if (EXCLUDED.matcher(text).find() || !PURCHASE.matcher(text).find()) return null;
        Result result = new Result();
        Matcher money = MONEY.matcher(text);
        if (money.find()) {
            String currency = money.group(1).toUpperCase(Locale.ROOT);
            String amount = money.group(2).replace(",", "");
            if (!money.find()) {
                BigDecimal value = new BigDecimal(amount);
                if (value.signum() > 0) {
                    result.amount = value.toPlainString();
                    result.currency = currency.equals("RM") ? "MYR" : currency;
                }
            }
        }
        Matcher merchant = MERCHANT.matcher(body);
        if (merchant.find()) {
            String description = merchant.group(1).trim();
            if (description.length() >= 2 && description.length() <= 120 && MERCHANT_LETTER.matcher(description).find()
                && !TIME.matcher(description).find() && !MONEY.matcher(description).find()) result.description = description;
        }
        Matcher date = DATE.matcher(text);
        if (date.find()) {
            String value = date.group(1);
            if (!date.find()) {
                SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
                format.setLenient(false);
                try { if (value.equals(format.format(format.parse(value)))) result.date = value; }
                catch (ParseException ignored) { /* Ambiguous dates remain absent. */ }
            }
        }
        return result;
    }
}
