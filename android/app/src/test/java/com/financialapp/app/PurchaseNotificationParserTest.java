package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PurchaseNotificationParserTest {
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
}
