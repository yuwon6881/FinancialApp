# Responsive audit — verified findings

The external visual audit (16 defects, 114 screenshots) was re-checked against the code and a fresh
evidence gallery (`tests/visual/audit-gallery.spec.ts`, run with `AUDIT_GALLERY=1`). The gallery uses
a frozen clock (30 Jul 2026), proves the session is live before each capture, and captures every page
at 390 / 768 / 1440 px both at the top and scrolled to the bottom.

## Why the original audit needed re-checking

- **30 screenshots showed the wrong screen.**
  - App Lock, Account Coverage Gate and all six Settings sub-panels show the sign-in page: the
    session had logged out.
  - Add Account shows the sign-up page.
  - Receipt Split on tablet and desktop shows the crash screen.
- **Some captures used the real date** (27 Oct) instead of the fixed test date. That produced
  "70 days overdue" bills and a sidebar reading "Day 30 of 30".
- **The audit's mock data was incomplete.** It returned the same dashboard for every month, and
  left out wishlist prices, insight counts, loan schedule fields and limit projections. Several
  "data" defects came from that, not from the app.
- **7 of 16 cited source paths do not exist.** There is no `src/views/`.

## Audit items D1–D16

| ID | Verdict | Evidence | Action |
|---|---|---|---|
| D1 Bills FAB overlap | Refuted | Scrolled to bottom, the last row clears the nav and FAB (`.pb-nav-safe`, `src/index.css:573`) | none |
| D2 Insights bottom clipped | Refuted | as D1 | none |
| D3 Bucket chips truncated | Confirmed on tablet/desktop; mobile is fine | `TransactionFormFields.tsx` | fix |
| D4 Calculator hint clipped | Confirmed (mobile) | gallery `overlay-transaction-form` | fix |
| D5 Category labels clipped | Confirmed at every width | gallery | fix |
| D6 Goal funding source clipped | Confirmed (mobile and desktop) | `src/components/wishlist/SavingsGoalForm.tsx` | fix |
| D7 Search placeholder truncated | Confirmed (mobile) | `src/components/search/GlobalSearch.tsx` | fix |
| D8 Cycle summary double action row | Confirmed at every width | `src/components/CycleSummaryModal.tsx` | fix |
| D9 Loans stats stretch | Confirmed: 3 stats in a 4-column strip | gallery `loans-top` (desktop) | fix |
| D10 Dashboard bottom card | Refuted | as D1 | none |
| D11 Ledger last row | Refuted | as D1 | none |
| D12 Bill strip has no scroll cue | Confirmed; desktop strip also stops at the 23rd of a cycle ending the 27th | `src/components/recurring/BillDayStrip.tsx` | fix |
| D13 Security questions submit below fold | Refuted: visible at 390×844 | original screenshot | none |
| D14 Flow filter labels wrap | Refuted: the controls are icon-only (`CategoriesPreferencesTab.tsx:256`) | gallery `budget-categories` | none |
| D15 Receipt sticky header divider | Not reproduced (needs OCR fixture) | — | left as is |
| D16 Coverage Gate | Partly: four panels stack on mobile with no progress count; there is no Continue button | gallery `coverage-gate-top` | add a progress count |

## Defects found during the review

| # | Finding | Verdict | Action |
|---|---|---|---|
| N1 | "NaN%" on the dashboard reward card | Real gap: `useDashboardView.ts` divides by `price` without a guard (the audit mock omitted `price`) | fix |
| N2 | Blank "Transactions" / "No-spend days" Insights tiles | The API sends both (`ReportResponseMapper.cs`); blank only when absent. UI has no fallback | fix (render "—") |
| N3 | Crash screen behind stacked dialogs | Not reproduced with complete data; bill review never auto-opens (existing spec) | none |
| N4 | Cycle wrap-up shows current cycle | Not a bug: `useCycleSummary` targets the previous cycle; the mock ignored the month | none |
| N5 | Pending bill "Due today" | Not a bug: real billing date renders "Due Jul 15 · 15 days ago" | none |
| N6 | Limits / relief / reminder contradictions | Limits and relief: mock inconsistency. Reminder: real — toggle shows on while "Paused—no device" | UX backlog |
| N7 | Food & Dining "finish near RM 0.00" | Not a bug: with `projectedSpend` it reads RM 1,472.50 | none |
| N8 | Insights bucket math | Mock data; not reproduced | none |
| N9 | Loan "bill history incomplete" | Shown when schedule fields are missing (`LoanCard.tsx:41`); mock omitted them | none |
| N10 | Drafts page content offset on desktop | Real: content is a centered narrow column while the tabs sit at the page edge | fix |
| N11 | Bill form "Ledger category" lists buckets | Real (`RecurringPaymentFormSheet.tsx:147`) | rename to "Bucket" |
| N12 | Grammar: "1 bill need review", "1 need review" | Real | fix |

## UX backlog (not in this change)

1. **Transaction entry:**
   - Account picker defaulted from the bucket (removes "choose the account" drafts).
   - Per-merchant category memory and recent categories first.
   - Sticky save button.
   - Attachments not gated on a tax relief category.
2. **Drafts:** choose the account inline in the review banner; resolve several drafts at once.
3. **Bills:**
   - Show "Set up notifications" instead of an "on" reminder toggle that is actually paused.
   - Clearer action names than Discard / Remove / Close.
   - Mark every due date on the strip.
4. **Loans:** create the linked bill from the loan's own terms; show "—" rather than RM 0.00 when the balance is unknown.
5. **Goals:**
   - One resolution card with actions instead of stacked warnings.
   - Label the "+" button "Add money".
   - Explain the Rewards pool vs the Rewards account balance.
6. **Global:**
   - One draft indicator instead of four.
   - Hide pagination on single pages.
   - System theme option.
   - Net-worth card.
   - Search recents.
   - Show/hide password, password rules, passkey on the first sign-in step.
