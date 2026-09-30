package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PurchaseNotificationParserTest {
    @Test public void recognizesCimbFpxAcceptedPayment() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse(
            "CIMB OCTO", "FPX Payment RM515.00 To MOOMOO Securities malaysi accepted on 28 sep 2026");
        assertNotNull(result);
        assertEquals("515.00", result.amount);
        assertEquals("MYR", result.currency);
        assertEquals("MOOMOO Securities malaysi", result.description);
        assertEquals("2026-09-28", result.date);
        assertEquals("outflow", result.transactionType);
        result = PurchaseNotificationParser.parse("FPX Payment RM515.00 To MOOMOO Securities malaysi", "accepted on 28 sep 2026");
        assertNotNull(result);
        assertEquals("MOOMOO Securities malaysi", result.description);
    }
    private static void assertCaptured(String body, String amount, String description) {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("CIMB OCTO", body);
        assertNotNull(body, result);
        assertEquals(body, "outflow", result.transactionType);
        assertEquals(body, "MYR", result.currency);
        assertEquals(body, amount, result.amount);
        assertEquals(body, description, result.description);
    }
    @Test public void recognizesCimbRailsWithoutPaymentWordOrAuxiliaryVerb() {
        assertCaptured("FPX Payment RM515.00 To MOOMOO successful on 28 sep 2026", "515.00", "MOOMOO");
        assertCaptured("Payment RM50.00 to RESTORAN ALI successful", "50.00", "RESTORAN ALI");
        assertCaptured("DuitNow QR RM15.00 to KEDAI KOPI successful", "15.00", "KEDAI KOPI");
        assertCaptured("DuitNow QR: RM15.00 to KEDAI KOPI successful", "15.00", "KEDAI KOPI");
        assertCaptured("DuitNow QR Payment RM15.00 to KEDAI KOPI successful", "15.00", "KEDAI KOPI");
        assertCaptured("DuitNow RM50.00 to AHMAD successful", "50.00", "AHMAD");
        assertCaptured("JomPAY RM120.00 to TNB successful", "120.00", "TNB");
        assertCaptured("JomPAY: RM120.00 to TNB successful", "120.00", "TNB");
        assertCaptured("JomPAY Payment RM120.00 to TNB successful", "120.00", "TNB");
    }
    @Test public void recognizesAcceptedOrApprovedTransfersAndCompactAmounts() {
        assertCaptured("DuitNow Transfer RM50.00 to AHMAD BIN ALI accepted", "50.00", "AHMAD BIN ALI");
        assertCaptured("DuitNow Transfer RM50.00 to AHMAD BIN ALI approved", "50.00", "AHMAD BIN ALI");
        assertCaptured("Transfer RM50.00 to JOHN DOE accepted", "50.00", "JOHN DOE");
        // No space between the code and the digits: "RM50" has no word boundary after "RM".
        assertCaptured("You have transferred RM50.00 to JOHN DOE", "50.00", "JOHN DOE");
        assertCaptured("You sent RM50.00 to JOHN DOE", "50.00", "JOHN DOE");
    }
    @Test public void recognizesCardUsedAlerts() {
        assertCaptured("Your card ending 1234 was used for RM 45.00 at STARBUCKS", "45.00", "STARBUCKS");
        assertNull(PurchaseNotificationParser.parse("Bank", "Your card ending 1234 was used for a transaction that was declined"));
    }
    @Test public void endsPayeeAtAFollowingAmountButKeepsOfInsideNames() {
        assertCaptured("Transfer to AHMAD BIN ALI RM50.00 successful", "50.00", "AHMAD BIN ALI");
        assertCaptured("Payment to RESTORAN ALI of RM50.00 is successful", "50.00", "RESTORAN ALI");
        assertCaptured("Payment RM50.00 to HOUSE OF NOODLES successful", "50.00", "HOUSE OF NOODLES");
    }
    @Test public void rejectsMoneyArrivingFromACounterparty() {
        assertNull(PurchaseNotificationParser.parse("CIMB", "DuitNow Transfer RM50.00 from AHMAD successful"));
        assertNull(PurchaseNotificationParser.parse("CIMB", "Transfer RM50.00 from AHMAD BIN ALI successful"));
        // Paying out of one's own account or wallet is still an outflow.
        assertCaptured("Payment RM20.00 from your account to TNB successful", "20.00", "TNB");
        assertCaptured("DuitNow QR RM8.00 from Savings Account to KEDAI successful", "8.00", "KEDAI");
        assertNotNull(PurchaseNotificationParser.parse("Wallet", "Payment of RM5.00 from eWallet balance successful"));
    }
    @Test public void readsDayFirstAndFullMonthDates() {
        assertEquals("2026-09-28", PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 28/09/2026").date);
        assertEquals("2026-09-08", PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 8-9-2026").date);
        assertEquals("2026-09-28", PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 28 September 2026").date);
        assertEquals("2026-09-28", PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 28-Sept-2026").date);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 31/09/2026").date);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 28/13/2026").date);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM12.00 at SHOP on 28/09/2026, settled 29/09/2026").date);
    }
    @Test public void broadenedRailsStillExcludeUnfinishedOrIncomingAlerts() {
        for (String text : new String[] {"DuitNow QR RM15.00 to KEDAI pending", "JomPAY RM120.00 to TNB failed", "DuitNow Transfer RM50.00 received from AHMAD",
            "FPX Payment RM20.00 to SHOP unsuccessful", "Your DuitNow TAC is 123456", "JomPAY bill RM120.00 due on 30/09/2026", "DuitNow request RM50.00 approved"}) {
            assertNull(text, PurchaseNotificationParser.parse("CIMB", text));
        }
    }
    @Test public void doesNotMistakePendingFpxAuthorizationForPayment() {
        assertNull(PurchaseNotificationParser.parse("CIMB", "FPX Payment RM515.00 to MOOMOO pending approval"));
        assertNull(PurchaseNotificationParser.parse("CIMB", "Approve FPX Payment RM515.00 to MOOMOO"));
        assertNull(PurchaseNotificationParser.parse("CIMB", "FPX Payment RM515.00 to MOOMOO declined"));
    }
    @Test public void extractsSuccessfulPurchase() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Payment successful", "You paid RM 24.50 at COFFEE HOUSE on 2026-09-27");
        assertNotNull(result);
        assertEquals("MYR", result.currency);
        assertEquals("24.50", result.amount);
        assertEquals("COFFEE HOUSE", result.description);
        assertEquals("2026-09-27", result.date);
        assertEquals("outflow", result.transactionType);
    }
    @Test public void recognizesCompletedTransfersAsOutflowPurchaseDrafts() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Transfer successful", "You transferred RM 125.00 to SAVINGS on 2026-09-27");
        assertNotNull(result);
        assertEquals("outflow", result.transactionType);
        assertEquals("MYR", result.currency);
        assertEquals("125.00", result.amount);
        assertEquals("SAVINGS", result.description);
        assertEquals("2026-09-27", result.date);

        result = PurchaseNotificationParser.parse("Money sent", "Sent SGD 80.00 to another account");
        assertNotNull(result);
        assertEquals("outflow", result.transactionType);
        assertEquals("SGD", result.currency);
        assertEquals("80.00", result.amount);

        result = PurchaseNotificationParser.parse("Fund transfer", "RM 50.00 was transferred to SAVINGS");
        assertNotNull(result);
        assertEquals("outflow", result.transactionType);
        assertEquals("50.00", result.amount);

        result = PurchaseNotificationParser.parse("Bank", "Funds have been successfully transferred RM 19.00 to SAVINGS");
        assertNotNull(result);
        assertEquals("outflow", result.transactionType);
        assertEquals("19.00", result.amount);
    }
    @Test public void excludesNonPurchases() {
        for (String text : new String[] {"Payment failed RM 20", "OTP for purchase RM 20", "Payment requested RM 20", "Refund successful RM 20", "Transfer failed RM 20", "Transfer requested RM 20", "Transfer pending RM 20", "Transfer received RM 20", "Incoming transfer successful RM 20", "Payment received RM 20", "Approve payment RM 20", "Payment pending RM 20", "Your balance is RM 20", "Payment reminder RM 20"}) {
            assertNull(text, PurchaseNotificationParser.parse("Bank", text));
        }
    }
    @Test public void preservesUnknownAndAmbiguousFields() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Payment successful", "Thank you");
        assertNotNull(result);
        assertNull(result.amount);
        assertNull(result.currency);
        assertNull(result.description);
        assertNull(result.date);
        result = PurchaseNotificationParser.parse("Purchase successful", "Paid $12.00 at SHOP");
        assertNull(result.currency);
        assertNull(result.amount);
        result = PurchaseNotificationParser.parse("Payment successful", "Paid RM 20.00 to SHOP A and RM 30.00 to SHOP B");
        assertNull(result.amount);
    }
    @Test public void doesNotInventDatesOrReadMalformedAmounts() {
        assertNull(PurchaseNotificationParser.parse("Bank", "Payment RM 20 at SHOP"));
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12,34 at SHOP").amount);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12.50 on 2026-02-30").date);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12.50 at 10:30 AM").description);
    }
    @Test public void acceptsQrPaymentsAndCommonConfirmationWording() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("DuitNow QR", "You have successfully paid RM5.00 to KEDAI MAJU via DuitNow QR code");
        assertNotNull(result);
        assertEquals("5.00", result.amount);
        assertEquals("KEDAI MAJU", result.description);

        result = PurchaseNotificationParser.parse("Bank", "Payment of RM 1,250.00 to ACME SDN BHD is successful.");
        assertNotNull(result);
        assertEquals("1250.00", result.amount);
        assertEquals("ACME SDN BHD", result.description);

        result = PurchaseNotificationParser.parse("Card alert", "Your card was charged RM 18.90 at GRAB FOOD, ref 1234");
        assertNotNull(result);
        assertEquals("GRAB FOOD", result.description);
    }
    @Test public void ignoresBalanceFiguresWhenReadingTheAmount() {
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse("Payment successful", "Paid RM 20.00 at SHOP. Available balance: RM 500.00");
        assertNotNull(result);
        assertEquals("20.00", result.amount);
        assertEquals("SHOP", result.description);
        assertEquals("20.00", PurchaseNotificationParser.parse("Payment successful", "Paid RM 20.00; balance RM 500.00").amount);
    }
    @Test public void stillExcludesVerificationCodes() {
        for (String text : new String[] {"Your TAC for payment RM 20 is 123456", "Security code for purchase RM 20", "Your code is 1234 for payment RM 20", "Payment successful, one-time PIN 1234"}) {
            assertNull(text, PurchaseNotificationParser.parse("Bank", text));
        }
    }
    @Test public void skipInstrumentPhrasesAndFindsActualMerchant() {
        // "to your debit card ... at SPayLater" — must skip "your debit card" and extract "SPayLater"
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse(
            "Maybank", "RM50.00 was charged to your debit card on 2026-09-27 at SPayLater. Please call 1300221234");
        assertNotNull(result);
        assertEquals("SPayLater", result.description);

        // "to your credit card ... at LAZADA"
        result = PurchaseNotificationParser.parse(
            "Card alert", "RM 120.00 charged to your credit card at LAZADA, ref 9876");
        assertNotNull(result);
        assertEquals("LAZADA", result.description);

        // "to your account ... at GRAB"
        result = PurchaseNotificationParser.parse(
            "Transaction successful", "RM 15.00 debited to your account at GRAB on 2026-09-27");
        assertNotNull(result);
        assertEquals("GRAB", result.description);

        // "to your card ... at TNG EWALLET" — bare "card" without debit/credit prefix
        result = PurchaseNotificationParser.parse(
            "Payment successful", "RM 30.00 was charged to your card at TNG EWALLET. Ref 5555");
        assertNotNull(result);
        assertEquals("TNG EWALLET", result.description);

        // Only instrument phrase, no subsequent merchant — description stays absent
        result = PurchaseNotificationParser.parse(
            "Payment successful", "RM 10.00 was charged to your debit card on 2026-09-27");
        assertNotNull(result);
        assertNull(result.description);
    }
    // Card alerts commonly write the merchant as "@NAME" rather than "at NAME" or "to NAME".
    @Test public void recognizesAtSignMerchants() {
        assertCaptured("RM 59.36 was charged on your card num 1181 @Courtsite on 30/09", "59.36", "Courtsite");
        assertCaptured("Your card ending 1234 was used for RM 45.00 @STARBUCKS", "45.00", "STARBUCKS");
    }
    // A bare day/month with no year is common in card alerts; the notification's own post time
    // resolves which year it means, staying in the past when the day/month alone reads as future.
    @Test public void resolvesYearlessDatesFromTheNotificationTime() {
        long postedAt = utc(2026, 9, 30);
        PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse(
            "CIMB", "RM 59.36 was charged on your card num 1181 @Courtsite on 30/09", postedAt);
        assertNotNull(result);
        assertEquals("2026-09-30", result.date);

        // Posted just after New Year, referencing a date from the tail end of the prior year.
        result = PurchaseNotificationParser.parse(
            "Bank", "Paid RM 12.00 at SHOP on 31/12", utc(2027, 1, 2));
        assertNotNull(result);
        assertEquals("2026-12-31", result.date);

        // "24/7" (customer support hours) must never be misread as 24 July.
        result = PurchaseNotificationParser.parse(
            "Bank", "Paid RM 12.00 at SHOP. Need help? Call us 24/7.", utc(2026, 9, 30));
        assertNotNull(result);
        assertNull(result.date);
    }
    private static long utc(int year, int month, int day) {
        java.util.Calendar calendar = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
        calendar.clear();
        calendar.set(year, month - 1, day, 12, 0, 0);
        return calendar.getTimeInMillis();
    }
}
