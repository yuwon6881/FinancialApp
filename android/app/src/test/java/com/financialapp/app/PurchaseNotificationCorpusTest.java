package com.financialapp.app;

import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Alert shapes across banks, card networks, e-wallets and SMS, in English and Malay. The texts are representative of
 * the formats these senders use rather than verbatim copies; the rules they exercise are wording, never an app name.
 */
public class PurchaseNotificationCorpusTest {
    /** title, body, amount, currency, merchant, date; null means the field must stay absent. */
    private static final String[][] CAPTURED = {
        {"Maybank2u", "You've made a payment of RM25.00 to TNB via JomPAY on 28 Sep 2026.", "25.00", "MYR", "TNB", "2026-09-28"},
        {"Messages", "RM0 Maybank: Your card ending 1234 was charged RM45.90 at SHOPEE MALAYSIA on 28/09/26 10:15.", "45.90", "MYR", "SHOPEE MALAYSIA", "2026-09-28"},
        {"62003", "RM0.00 CIMB: Card txn RM12.50 at 7-ELEVEN MALAYSIA on 28-Sep-26", "12.50", "MYR", "7-ELEVEN MALAYSIA", "2026-09-28"},
        {"CIMB OCTO", "DuitNow QR: RM15.00 to KEDAI KOPI successful", "15.00", "MYR", "KEDAI KOPI", null},
        {"PBB", "Your Debit Card xxxx1234 transaction of RM88.00 at AEON BIG on 28/09/2026 was approved.", "88.00", "MYR", "AEON BIG", "2026-09-28"},
        {"RHB", "Fund Transfer of RM200.00 to ALI BIN ABU is successful. Ref: 123456", "200.00", "MYR", "ALI BIN ABU", null},
        {"HLB", "IBG transfer RM1,000.00 to JOHN TAN completed on 28/09/2026", "1000.00", "MYR", "JOHN TAN", "2026-09-28"},
        {"Bank Islam", "Pembayaran sebanyak RM50.00 kepada SYARIKAT ABC SDN. BHD. telah berjaya pada 28 Sep 2026.", "50.00", "MYR", "SYARIKAT ABC SDN. BHD", "2026-09-28"},
        {"MAE", "Anda telah membayar RM12.00 kepada KEDAI RUNCIT AMINAH melalui DuitNow QR.", "12.00", "MYR", "KEDAI RUNCIT AMINAH", null},
        {"Bank Rakyat", "Pemindahan DuitNow RM100.00 kepada SITI berjaya pada 1 Ogos 2026", "100.00", "MYR", "SITI", "2026-08-01"},
        {"Payment successful", "You paid RM8.50 to Grab Food.", "8.50", "MYR", "Grab Food", null},
        {"eWallet", "Payment of RM3.20 to MyRapid KL was successful.", "3.20", "MYR", "MyRapid KL", null},
        {"Wallet", "Payment of RM19.90 to Mr DIY successful", "19.90", "MYR", "Mr DIY", null},
        {"Boost", "You've paid RM6.00 at Tealive Sunway", "6.00", "MYR", "Tealive Sunway", null},
        {"STARBUCKS", "RM 14.90 with Visa •••• 1234", "14.90", "MYR", null, null},
        {"Wallet", "Payment completed. RM 23.00 paid at KFC", "23.00", "MYR", "KFC", null},
        {"DBS", "You have sent SGD 50.00 to JOHN LIM via PayNow on 28 Sep 2026", "50.00", "SGD", "JOHN LIM", "2026-09-28"},
        {"OCBC", "A transaction of SGD 12.30 was made with your card ending 1234 at FAIRPRICE on 28/09/26.", "12.30", "SGD", "FAIRPRICE", "2026-09-28"},
        {"Wise", "You spent 12.00 EUR at CAFE PARIS", "12.00", "EUR", "CAFE PARIS", null},
        {"Card", "S$4.50 spent at KOPITIAM", "4.50", "SGD", "KOPITIAM", null},
        {"Card", "You made a purchase of $25.00 at Amazon", null, null, "Amazon", null},
        {"RM10.00 spent at ZUS COFFEE", "You spent RM10.00 at ZUS COFFEE on 28/09/2026. Available balance RM500.00", "10.00", "MYR", "ZUS COFFEE", "2026-09-28"},
        {"Bank", "Transfer of RM50.00 to AHMAD successful. Fee: RM0.50", "50.00", "MYR", "AHMAD", null},
        {"Transaction successful", "Merchant: KEDAI ABC\nAmount: RM12.00\nDate: 28/09/2026", "12.00", "MYR", "KEDAI ABC", "2026-09-28"},
        {"Bank", "Payment successful! You paid RM20.00 to KFC and earned RM0.20 cashback", "20.00", "MYR", "KFC", null},
        {"Bank", "You paid RM 10.00 at SHOP​", "10.00", "MYR", "SHOP", null},
        {"Bank", "You paid RM20.00.", "20.00", "MYR", null, null},
        {"Bank", "Auto-debit of RM59.00 to MAXIS successful", "59.00", "MYR", "MAXIS", null},
        {"Bank", "Payment of USD 10.00 to NETFLIX completed on Sep 28, 2026", "10.00", "USD", "NETFLIX", "2026-09-28"},
        {"TNB", "We have received your payment of RM120.00. Thank you.", "120.00", "MYR", null, null},
        {"Bank", "Payment of RM120.00 to TNB successful. Next due date 28/10/2026.", "120.00", "MYR", "TNB", null},
        {"Bank", "Total: RM30.00 paid to KEDAI A. Previous bill RM12.00", "30.00", "MYR", "KEDAI A", null},
        {"Bank", "RM10.00 debited from your account for GRAB at 10:30", "10.00", "MYR", "GRAB", null},
        {"Bank", "Your payment of RM50.00 to Ahmad has been received by the recipient.", "50.00", "MYR", "Ahmad", null},
        {"Grab", "Your ride has been paid. RM12.00 charged to Visa 1234.", "12.00", "MYR", null, null},
        {"Bank", "Card purchase RM-50.00 at SHOP", "50.00", "MYR", "SHOP", null},
        {"Bank", "Top-up of RM50.00 to TNG eWallet successful", "50.00", "MYR", "TNG eWallet", null},
        {"Bank", "Pmt RM50.00 to TNB successful", "50.00", "MYR", "TNB", null},
        {"Bank", "Duit Now RM20.00 to ALI successful", "20.00", "MYR", "ALI", null},
        {"Bank", "Bayaran RM20.00 kepada TNB telah diterima", "20.00", "MYR", "TNB", null},
        {"Messages", "RM0 CIMB: DuitNow Transfer of RM50.00 to ALI BIN ABU (Ref: Makan) successful", "50.00", "MYR", "ALI BIN ABU", null},
        {"Bank", "Payment to Ahmad for dinner RM25.00 successful", "25.00", "MYR", "Ahmad", null},
        {"Bank", "Transaksi kad anda sebanyak RM45.00 di MYDIN telah diluluskan", "45.00", "MYR", "MYDIN", null},
        {"PayPal", "You sent a payment of $10.00 USD to John", "10.00", "USD", "John", null},
        {"Bank", "✅ PAYMENT SUCCESSFUL\nRM 9.90 paid to NETFLIX.COM", "9.90", "MYR", "NETFLIX.COM", null},
        {"Bank", "Transaction of RM5.00 at SHELL has been authorised", "5.00", "MYR", "SHELL", null},
        {"Bank", "Card transaction: RM45.00 at IKEA. Not you? Call 1300 88 1234", "45.00", "MYR", "IKEA", null},
        {"Bank", "Payment of RM2.50 at PLUS toll was successful", "2.50", "MYR", "PLUS toll", null},
    };

    private static final String[][] SKIPPED = {
        {"Bank", "Your OTP is 123456. Do not share."},
        {"Messages", "RM0 Maybank: TAC for DuitNow transfer RM50.00 to ALI is 123456"},
        {"Bank", "You have received RM50.00 from AHMAD via DuitNow"},
        {"DuitNow", "RM50.00 from AHMAD BIN ALI has been credited to your account"},
        {"Bank", "Transfer RM50.00 from JOHN successful"},
        {"Bank", "Salary of RM3,000.00 deposited into your account"},
        {"Bank", "Your transaction of RM50.00 at SHOP was declined due to insufficient funds"},
        {"Bank", "Payment of RM59.00 to MAXIS will be debited on 30/09/2026"},
        {"Bank", "Reminder: Your credit card payment of RM500.00 is due on 30/09/2026"},
        {"Bank", "You spent RM1,234.00 this month. See your spending insights."},
        {"Bank", "Get RM5 cashback when you pay with DuitNow QR! T&C apply."},
        {"Bank", "Enjoy 10% off at Starbucks with your Visa card"},
        {"Bank", "Your DuitNow transfer limit has been updated to RM5,000.00 successfully"},
        {"Bank", "New payee ALI BIN ABU added successfully"},
        {"Shop", "Your refund of RM20.00 from SHOPEE has been processed"},
        {"Bank", "FPX payment RM20.00 to SHOP is being processed"},
        {"Bank", "You received a payment request of RM20 from ALI"},
        {"Bank", "Cash withdrawal RM100.00 at ATM"},
        {"Wallet", "Reload RM50.00 successful"},
        {"Wallet", "Your eWallet has been reloaded with RM50.00"},
        {"Bank", "Login successful from a new device"},
        {"Bank", "Pembayaran RM50.00 kepada TNB gagal"},
        {"Bank", "Anda telah menerima RM50.00 daripada ALI"},
        {"Bank", "RM50 was paid to your account by ALI"},
        {"Bank", "Stand a chance to win RM1,000 when you spend RM50 at Watsons"},
        {"Bank", "Your card ending 1234 has been activated successfully"},
        {"Bank", "Transaction alert: RM50.00 from AHMAD at 10:30"},
        {"Bank", "Your payment of RM20.00 to SHOP could not be completed"},
        {"Bank", "Transfer to ALI of RM50.00 was not successful"},
        {"Bank", "Please make payment of RM80.00 to TNB before 30/09/2026"},
        {"Bank", "Scheduled transfer of RM100.00 to MOM on 1 Oct 2026"},
        {"Bank", "Payment of RM30.00 to SHOP is on hold"},
        {"Bank", "Pay with CIMB card and get RM10 cashback. Transaction must be completed by 30/09/2026"},
        {"Bank", "Your transfer to ALI failed. RM50.00 has been returned to your account"},
        {"Bank", "You received RM2.00 cashback for your payment at KFC"},
        {"Wallet", "Reload to your wallet successful. RM50.00"},
        {"Bank", "Bayaran RM50.00 diterima daripada ALI"},
        {"Bank", "You have spent RM300.00 so far this month"},
    };

    @Test public void capturesOutgoingPaymentsAcrossSenders() {
        // Every row is checked so one run reports the whole corpus rather than the first miss.
        StringBuilder failures = new StringBuilder();
        for (String[] row : CAPTURED) {
            PurchaseNotificationParser.Result result = PurchaseNotificationParser.parse(row[0], row[1]);
            String actual = result == null ? "skipped"
                : String.join(" | ", "" + result.amount, "" + result.currency, "" + result.description, "" + result.date);
            String expected = String.join(" | ", "" + row[2], "" + row[3], "" + row[4], "" + row[5]);
            if (result != null) assertEquals("outflow", result.transactionType);
            if (!expected.equals(actual)) failures.append("\n").append(row[1]).append("\n  expected ").append(expected).append("\n  actual   ").append(actual);
        }
        assertEquals("", failures.toString());
    }

    @Test public void skipsAlertsThatAreNotMoneyLeaving() {
        StringBuilder failures = new StringBuilder();
        for (String[] row : SKIPPED) if (PurchaseNotificationParser.parse(row[0], row[1]) != null) failures.append("\n").append(row[1]);
        assertEquals("", failures.toString());
    }
}
