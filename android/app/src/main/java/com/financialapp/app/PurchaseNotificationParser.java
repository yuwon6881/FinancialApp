package com.financialapp.app;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.text.ParseException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Conservative purchase and completed outgoing-transfer recognition. */
final class PurchaseNotificationParser {
    // "code" alone is not excluded: DuitNow/QR payment confirmations routinely say "QR code".
    private static final Pattern EXCLUDED = Pattern.compile(
        "\\b(otp|tac|one[- ]time|verification|verify|(?:security|secure|auth(?:entication)?|confirmation|activation|login)\\s+code|code\\s+(?:is|:)|declined|failed|failure|unsuccessful|pending|requested|request|approve|authori[sz]ation|refund|refunded|reversed|reversal|received|credited|incoming|inbound|reminder|due|scheduled|initiated|processing|cancelled|canceled)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern PURCHASE = Pattern.compile(
        "\\b(payment|purchase|transaction)\\s+(?:was\\s+|is\\s+|has\\s+been\\s+)?(?:successful|completed|approved|accepted)"
            + "|\\b(?:payment|purchase|transaction)\\b[^\\n]{0,80}?\\b(?:is|was|has\\s+been)\\s+(?:successful|completed|approved)\\b"
            + "|\\b(?:payment|purchase|transaction)\\b[^\\n]{0,120}?\\baccepted\\b"
            + "|\\b(?:paid|spent|purchased|charged|debited)\\b|\\b(?:successful|completed)\\s+(?:payment|purchase)",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern TRANSFER = Pattern.compile(
        "\\btransfer\\b.*\\b(?:successful|successfully|completed|processed|sent|made|transferred)\\b"
            + "|\\b(?:successful|successfully|completed|processed)\\b.*\\btransfer\\b"
            + "|\\b(?:funds?|money)\\s+(?:(?:has|have)\\s+been\\s+|was\\s+|were\\s+)?(?:successfully\\s+)?transferred\\b"
            + "|\\btransferred\\s+(?:RM|MYR|USD|EUR|GBP|SGD)\\b"
            + "|\\b(?:RM|MYR|USD|EUR|GBP|SGD)\\s*[0-9][0-9,.]*\\s+(?:was\\s+)?transferred\\b"
            + "|\\b(?:money|funds?)\\s+(?:was\\s+|were\\s+)?sent\\b"
            + "|\\bsent\\s+(?:RM|MYR|USD|EUR|GBP|SGD)\\b",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern MONEY = Pattern.compile("\\b(RM|MYR|USD|EUR|GBP|SGD)\\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]{1,2})?)(?![0-9.,])", Pattern.CASE_INSENSITIVE);
    /** A figure labelled as a balance or limit is context, not the amount that moved. */
    private static final Pattern BALANCE_CONTEXT = Pattern.compile("\\b(?:bal(?:ance)?|available|avail|limit|remaining)\\b[^0-9]{0,24}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern MERCHANT = Pattern.compile(
        "\\b(?:at|to)\\s+([^\\n;]+?)(?=\\s+(?:at|to|on|using|with|via|for|from|is|was|has|successful|successfully|accepted|ref|reference)\\b|[.!,](?:\\s|$)|[.!]?$)",
        Pattern.CASE_INSENSITIVE);
    /** Phrases that look like merchant captures but are payment instruments or generic nouns. */
    private static final Pattern NOT_MERCHANT = Pattern.compile(
        "^(?:your\\s+)?(?:(?:debit|credit|prepaid|visa|master(?:card)?|amex)\\s+)?(?:card|account|bank(?:\\s+account)?|wallet|e-wallet)\\b",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE = Pattern.compile("\\b(20[0-9]{2}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\\s+[a-z]{3}\\s+20[0-9]{2})\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern MERCHANT_LETTER = Pattern.compile("\\p{L}");
    private static final Pattern TIME = Pattern.compile("^\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?(?:\\s|$)", Pattern.CASE_INSENSITIVE);

    static final class Result {
        String amount;
        String currency;
        String description;
        String date;
        String transactionType;
    }

    static Result parse(String title, String body) {
        String text = (title + " " + body).trim();
        boolean transfer = TRANSFER.matcher(text).find();
        if (EXCLUDED.matcher(text).find() || (!transfer && !PURCHASE.matcher(text).find())) return null;
        Result result = new Result();
        result.transactionType = "outflow";
        readAmount(text, result);
        Matcher merchant = MERCHANT.matcher(text);
        while (merchant.find()) {
            String description = merchant.group(1).trim();
            if (NOT_MERCHANT.matcher(description).find()) continue;
            if (description.length() >= 2 && description.length() <= 120 && MERCHANT_LETTER.matcher(description).find()
                && !TIME.matcher(description).find() && !MONEY.matcher(description).find()) {
                result.description = description;
                break;
            }
        }
        Matcher date = DATE.matcher(text);
        if (date.find()) {
            String value = date.group(1);
            if (!date.find()) {
                SimpleDateFormat format = new SimpleDateFormat(value.indexOf('-') >= 0 ? "yyyy-MM-dd" : "d MMM yyyy", Locale.ENGLISH);
                format.setLenient(false);
                try { result.date = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(format.parse(value)); }
                catch (ParseException ignored) { /* Ambiguous dates remain absent. */ }
            }
        }
        return result;
    }

    /** Exactly one non-balance figure is an amount; two or more stay absent rather than guessed. */
    private static void readAmount(String text, Result result) {
        Matcher money = MONEY.matcher(text);
        String currency = null, amount = null;
        int found = 0;
        while (money.find()) {
            if (BALANCE_CONTEXT.matcher(text.substring(Math.max(0, money.start() - 40), money.start())).find()) continue;
            currency = money.group(1).toUpperCase(Locale.ROOT);
            amount = money.group(2).replace(",", "");
            found++;
        }
        if (found != 1) return;
        BigDecimal value = new BigDecimal(amount);
        if (value.signum() <= 0) return;
        result.amount = value.toPlainString();
        result.currency = currency.equals("RM") ? "MYR" : currency;
    }
}
