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
    }
    @Test public void excludesNonPurchases() {
        for (String text : new String[] {"Payment failed RM 20", "OTP for purchase RM 20", "Payment requested RM 20", "Refund successful RM 20", "Transfer successful RM 20", "Payment received RM 20", "Approve payment RM 20", "Payment pending RM 20", "Your balance is RM 20", "Payment reminder RM 20"}) {
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
        result = PurchaseNotificationParser.parse("Payment successful", "Paid RM 20.00; balance RM 500.00");
        assertNull(result.amount);
    }
    @Test public void doesNotInventDatesOrReadMalformedAmounts() {
        assertNull(PurchaseNotificationParser.parse("Bank", "Payment RM 20 at SHOP"));
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12,34 at SHOP").amount);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12.50 on 2026-02-30").date);
        assertNull(PurchaseNotificationParser.parse("Payment successful", "Paid RM 12.50 at 10:30 AM").description);
    }
}
