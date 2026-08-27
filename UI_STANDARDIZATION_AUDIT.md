# FinancialApp UI Standardization Audit

Date: 2026-08-27  
Primary surface: installed mobile PWA  
Design direction: evolve the existing Ayu interface

## Executive summary

The application already has a strong shared foundation: Inter is self-hosted, financial figures use tabular numerals, phone inputs are forced to 16px to prevent browser zoom, canonical buttons and icon actions use 44px phone targets, semantic Ayu variables cover both themes, reduced motion is respected, and the mobile shell accounts for safe areas, the bottom navigation, and the floating action menu.

No P0 accessibility or layout failure was confirmed in the audited visual baselines. The main standardization debt sits above the primitives:

- Page headers use several unrelated compositions, producing inconsistent height, alignment, and action hierarchy.
- Older composite controls still use raw buttons and do not automatically inherit the 44px phone target.
- Typography is visually protected by a global 12px floor, but source code still contains 573 authored `8px`–`13px` utilities, making hierarchy difficult to maintain.
- Mobile route coverage is broad, while tablet and desktop coverage is concentrated on representative surfaces rather than every route and nested state.
- Draft Transactions needed a clearer review model. This release delivers the responsive redesign as a standalone implementation package that preserves all persistence and financial contracts while eliminating review friction.

## Evidence and standards

### Existing strengths

- `src/index.css` defines Inter, financial tabular numerals, visible keyboard focus, reduced-motion behavior, a 12px supporting-copy floor, 16px phone form fields, safe-area helpers, and fixed-control clearance.
- `src/components/ui/Button.tsx` provides 44px default phone actions and 44px phone icon controls while returning to compact pointer-first sizes at `sm` and above.
- `scripts/check-design-system.mjs` prevents new native form controls, browser dialogs, unmapped theme colors, and raw-button regressions.
- The visual suite has 71 stored baselines: 42 shared design-system images and 29 mobile-PWA images. Projects cover 390×844, 768×1024, and 1440×900 in Ayu Light and Ayu Dark.

### Quantified standardization debt

| Signal | Current source count | Interpretation |
| --- | ---: | --- |
| `text-[8px]` | 6 | Rendered at the global 12px floor, but misleading in source |
| `text-[9px]` | 87 | Same maintainability issue |
| `text-[10px]` | 330 | Same maintainability issue |
| `text-[11px]` | 150 | Same maintainability issue |
| `text-[13px]` | 4 | One-off typography outside the shared scale |
| `text-xs` | 538 | Dominant compact application text style |
| Raw `<button>` elements | 30 | Concentrated in older dashboard and transaction-form composites |

The small authored sizes are not presently rendered below 12px because of the global CSS floor. They are a consolidation risk: future selectors or component extraction could bypass the floor, and the authored class no longer communicates the actual hierarchy.

## Coverage matrix

| Surface | Mobile evidence | Tablet/desktop evidence | Status | Main observation |
| --- | --- | --- | --- | --- |
| Authentication | Both themes and validation/error states | Both themes | Conforming | Shared fields and application-owned validation are consistent |
| Dashboard | Both themes | Both themes | Finding | Deeply nested panels create long vertical scans on phones |
| Reports | Both themes | Partial | Finding | Mobile page header reserves excess empty space around its secondary action |
| Recurring Bills | Both themes | Partial | Finding | Summary, tabs, timeline, and filters each introduce a separate control band |
| Loans | Both mobile themes | Partial | Conforming with gap | Mobile cards are purpose-built; dense desktop details need broader visual coverage |
| Ledger current cycle | Both themes | Representative shared tests | Finding | Export and Post actions have similar prominence; the transaction-type selector is undersized on phones |
| Ledger all cycles | Both mobile themes | Partial | Conforming with gap | Overflow is guarded; desktop/tablet route snapshots remain incomplete |
| Commitments & Rewards | Both themes | Interaction-focused | Finding | The mobile title wraps early and page/card action hierarchy varies by section |
| Draft Transactions | Both themes | All responsive projects for ordering | Implemented | Responsive batch review queue delivered with targeted state and interaction coverage |
| Settings | Both themes, Accounts across all sizes | Accounts and representative controls | Finding | Five tabs become a two-column text grid that is usable but weak as navigation |
| Investments | Both mobile themes | Desktop table checks | Finding | Empty-state primary and secondary actions use different control language |
| Vault | Both themes plus unavailable state | Partial | Finding | Header and action row do not share the standard page-header composition |
| Global search and menus | Real-browser interaction tests | Representative | Conforming with gap | Focus and routing are covered; visual state coverage is selective |
| Sheets and confirmations | Transaction and destructive states across all sizes | All themes | Conforming | Width, overflow, focus, and keyboard-height behavior are established |
| Offline, privacy, loading | Route-specific tests | Selective | Coverage gap | These states exist but are not matrix-complete for every route |

## Draft Transactions Redesign Delivered

This standalone package modernizes `DraftStagingView` (`/drafts`), replacing confusing repetitive badges with a structured, touch-ergonomic batch review queue.

### Responsive Layout Diagrams

#### 1. Mobile Phone (390 × 844 px)
```text
+------------------------------------------+
| [<-]  [Doc] Draft Transactions (2)  (i)  |
| The top draft records first...           |
+------------------------------------------+
| BATCH SUMMARY                            |
| +--------------------------------------+ |
| | Value: RM 72.50                      | |
| | Status: 1 ready · 1 needs review     | |
| | Attachments: 0 attached              | |
| +--------------------------------------+ |
+------------------------------------------+
| REVIEW QUEUE                             |
| +--------------------------------------+ |
| | [::1] Car fuel              -RM 30.00| |
| |       [Needs review] 2026-08-02      | |
| |       [Essentials] [Transport]  [...] | |
| |  +---------------------------------+ | |
| |  | Choose a category matching flow | | |
| |  +---------------------------------+ | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | [::2] Weekend market        -RM 42.50| |
| |       [Ready] 2026-08-02             | |
| |       [Essentials] [Food]       [...] | |
| +--------------------------------------+ |
|                                          |
| [ + Add Another Transaction (44px)     ] |
|                                          |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| [STICKY ACTION BAR (above MobileBottomNav)]
| | 1 draft needs review                 | |
| | 2 drafts · RM 72.50                  | |
| | [ Review Draft (44px)               ]| |
| ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
| [Home] [Ledger] [Recurring] [Vault] [...]| <- 76px bottom nav
+------------------------------------------+
```

#### 2. Desktop & Tablet (768px – 1440px)
```text
+--------------------------------------------------------------------------+
| [<-]  [Doc] Draft Transactions (2)  (i)                                  |
|       The top draft records first. In Ledger newest-first view, same-day |
|       drafts appear in reverse order.                                    |
+--------------------------------------------------------------------------+
| BATCH SUMMARY                                                [+ Add Draft]
| +---------------------+-----------------------+------------------------+ |
| | Batch value         | Readiness             | Attachments            | |
| | RM 72.50            | 1 ready · 1 to review | 0 attached             | |
| +---------------------+-----------------------+------------------------+ |
+--------------------------------------------------------------------------+
| REVIEW QUEUE                                                     2 drafts|
| Drag numbered handles or use Arrow keys to reorder.                      |
| +----------------------------------------------------------------------+ |
| | [:: 1] Car fuel                                             -RM 30.00| |
| |        [Needs review] 2026-08-02 [Essentials] [Transport] [Edit][Del]| |
| |   +-------------------------------------------------------------+    | |
| |   | Choose a category that matches this money direction. [Review]|    | |
| |   +-------------------------------------------------------------+    | |
| +----------------------------------------------------------------------+ |
| +----------------------------------------------------------------------+ |
| | [:: 2] Weekend market                                       -RM 42.50| |
| |        [Ready] 2026-08-02 [Essentials] [Food]              [Edit][Del]| |
| +----------------------------------------------------------------------+ |
+--------------------------------------------------------------------------+
| [STICKY ACTION BAR]                                                      |
| 1 draft still needs review                                               |
| 2 drafts · RM 72.50                                  [ Review Draft (44px) ]
+--------------------------------------------------------------------------+
```

#### 3. Keyboard-Constrained Viewport (390 × 500 px)
- Sticky batch bar clears viewport bottom with `bottom-[calc(76px+env(safe-area-inset-bottom,0px))]`.
- Review queue is vertically scrollable with zero horizontal overflow (`scrollWidth <= 390px`).
- Numbered reorder handles and 44px overflow menus remain fully interactive without clipping.

### Component Architecture & Hierarchy

1. **`DraftHeader`**:
   - Back button (`size="icon"` with 44px touch target on mobile).
   - Page identity icon, title, and count pill.
   - Accessible `InfoHint` explaining same-day timestamp ordering.

2. **`DraftBatchSummary`**:
   - Total batch outlay / income.
   - Validation tally: count of `Ready` vs `Needs review`.
   - Document readiness indicator showing whether attachments are fully loaded from IndexedDB.
   - Header "+ Add Draft" action on desktop.

3. **`DraftReviewQueue`**:
   - Wrapped in Framer Motion `Reorder.Group` (`axis="y"`).
   - Reorder handles (`GripVertical`) with `aria-label="Reorder {description}. Position {index+1} of {total}"` and keyboard arrow up/down listener (`onKeyDown`).

4. **`DraftQueueCard`**:
   - Primary line: Description (truncated with title tooltip) and tabular formatted amount.
   - Secondary line: Numbered position chip, readiness badge (`Ready` vs `Needs review`), financial date, `LedgerAllocationBadge`, category badge, document clip counter.
   - Problem banner: When invalid, displays issues with high-contrast text and a direct "Review" button.
   - Mobile interaction: `SwipeableRow` with underlying Edit (primary) / Delete (danger) 44px buttons, plus a visible 44px `OverflowMenu` trigger on the card face.
   - Desktop interaction: Inline hover `size="icon"` buttons for Edit and Delete.

5. **`DraftBatchActionBar`**:
   - Sticky elevation with frosted glass backdrop (`bg-card/95 backdrop-blur`).
   - Mobile: Stacked status line and full-width 44px primary action button.
   - Desktop: Side-by-side flex layout with right-aligned button.
   - Primary action logic: If any draft is invalid, triggers `Review Draft` (opens the first invalid draft in `TransactionFormSheet`); if all valid, triggers `Add N to Ledger`.

6. **`DraftEmptyState`**:
   - Lightweight icon panel and headline "Your draft queue is clear".
   - Concise onboarding copy explaining that new transactions can be reviewed before Ledger posting.
   - Dual actions: "Post Transaction" (primary) and "Back to Ledger" (secondary).

### Preserved Contracts & Boundaries

- **Public Interface**: `DraftStagingViewProps` remains unchanged:
  - `draftTransactions: Transaction[]`
  - `onUpdateDraftTransaction: (...) => Promise<void> | void`
  - `onLoadDraftDocumentChanges: (id: string) => Promise<TransactionDocumentChanges>`
  - `onDeleteDraftTransaction: (id: string) => void`
  - `onReorderDraftTransactions: (drafts: Transaction[]) => void`
  - `onSyncDraftBatch: () => Promise<void> | void`
  - `onAddAnother?: () => void`
  - `currency?: string`
  - `hideSensitive: boolean`
- **Zero API or Schema Changes**: Operates strictly on client-side IndexedDB draft state.
- **Strict Financial Semantics**: Reordering uses the existing callback and persistence path; the displayed queue remains the authoritative same-day posting order.
- **Privacy Mode**: Sensitive amounts are masked with `<SensitiveMask />` across all cards, summaries, and action bars.
- **Accessibility**: Reorder, overflow, review, and batch actions retain 44px phone targets; handles support Arrow Up/Down reordering and expose the current position through accessible names.

## Prioritized backlog

### P1 — Mobile transaction-type controls do not meet the application target floor

Effort: S  
Evidence: `src/components/ledger/transaction-form/TransactionTypeFields.tsx` uses compact raw buttons with `py-2` and no `min-h-11`, while the shared phone standard is 44px.  
Recommendation: retain the single-row segmented layout but give every option a measured 44px phone target, returning to compact height at `sm`. Migrate the group to a shared segmented-control primitive or Button-backed implementation.  
Acceptance: Outflow, Transfer, and Account Move are each at least 44px high at 320px and 390px widths; labels do not clip; editing behavior and accessible radio semantics are unchanged.

### P1 — Expand visual coverage from mobile routes to a route-complete responsive matrix

Effort: M  
Evidence: authenticated phone snapshots cover every primary route, while tablet and desktop snapshots are selective.  
Recommendation: add tablet/desktop route snapshots and a small set of canonical nested states rather than duplicating every transient animation.  
Acceptance: every primary route has light/dark evidence at mobile, tablet, and desktop; every nested section has at least one responsive visual; failures identify the route and state.

### P2 — Standardize page headers

Effort: M  
Affected: Reports, Recurring, Ledger, Commitments & Rewards, Settings, Investments, Vault.  
Evidence: mobile baselines show unrelated header shells, icon positions, action placement, padding, and subtitle treatment; Reports leaves a large empty action area while Vault uses a free-form heading and separate action row.  
Recommendation: introduce a composable `PageHeader` with title, icon/back slot, concise description, primary action, secondary action, and compact/mobile variants. Do not force summary metrics into the header.  
Acceptance: all page titles align to the same phone gutter and vertical rhythm; actions have predictable priority; long titles wrap without colliding with icons or actions; skeletons match loaded geometry.

### P2 — Consolidate typography authoring

Effort: L  
Affected: 183 source files, especially transaction forms, receipts, Settings, cycle summaries, and dense cards.  
Evidence: 573 arbitrary `8px`–`13px` utilities are normalized by a global CSS selector rather than expressing the actual rendered size.  
Recommendation: define a small semantic type set for eyebrow, supporting, body, control label, section heading, page heading, and financial value. Migrate feature-by-feature and remove the global compatibility selector only after the count reaches zero.  
Acceptance: no visible text renders below 12px; equivalent roles share size/line-height/weight; long translations and 200% zoom remain usable; arbitrary text sizes are rejected by the design audit.

### P2 — Consolidate older raw interactive controls

Effort: L  
Affected: Dashboard category cards, receipt scanning, document attachments, and transaction-type controls.  
Evidence: 30 raw button tags remain outside tests, protected only by a per-file regression baseline.  
Recommendation: add shared primitives for segmented choices, media tiles, and interactive metric cards, then reduce the baseline in small batches.  
Acceptance: each migration preserves accessible names and interaction geometry; the raw-button baseline decreases and never increases; mobile actions meet the 44px default unless explicitly documented as inline text actions.

### P2 — Clarify primary versus secondary page actions

Effort: M  
Affected: Ledger, Investments, Vault, empty states, and some Settings panels.  
Evidence: some phone pages present multiple full-width or visually unrelated calls to action at the same hierarchy level.  
Recommendation: use one primary filled action per decision point, outline for a real secondary action, ghost for tertiary navigation, and the shared overflow menu for destructive/management actions.  
Acceptance: every audited state has one visually dominant next action; destructive actions never resemble primary progression; icon-only actions retain explicit accessible names.

### P2 — Simplify Settings navigation on phones

Effort: M  
Evidence: five settings tabs wrap into a two-column text grid with an underline that does not strongly communicate grouping or current position. Keyboard roving behavior itself is already covered.  
Recommendation: use a horizontally scrollable tab rail with stable touch widths, or a compact section selector that preserves direct access and roving focus.  
Acceptance: all five sections are reachable without ambiguous reading order; the active section remains visible; targets are at least 44px; focus and browser history behavior remain intact.

### P3 — Reduce avoidable panel nesting and vertical inflation

Effort: L  
Affected: Dashboard, Recurring, Reports, Commitments & Rewards, and Vault.  
Evidence: mobile baselines show multiple bordered shells nested within bordered shells, often with repeated headings and generous padding.  
Recommendation: reserve the full `app-panel` treatment for page-level groups, use separators or muted rows for internal structure, and create compact variants for repeated metrics.  
Acceptance: hierarchy remains clear without relying on every level having its own border and shadow; phone scan length decreases; desktop density does not become sparse.

### P3 — Normalize status and metadata placement

Effort: M  
Affected: documents, investment activity, settings toggles, credentials, notifications, ledger rows, and asynchronous list items.  
Evidence: the current release already begins moving sync badges beside trailing controls rather than allowing them to wrap inside titles. Other feature rows still place status inconsistently.  
Recommendation: standardize row anatomy as leading identity, flexible label/meta, trailing status, then trailing action.  
Acceptance: long labels truncate before badges or controls; status never overlaps card borders; the same state uses the same color and wording across features.

## Verification expectations for future backlog work

- Run ESLint, the design-system audit, strict TypeScript, dead-code analysis, full Vitest, production build and bundle budgets.
- Run the six-project visual suite for shared surfaces or responsive layout changes.
- Add 320px narrow-phone and 390×500 keyboard-height checks for controls or sheets affected by the change.
- Never accept a snapshot update until the semantic, keyboard, overflow, hit-target, and privacy assertions pass.
- Preserve unrelated worktree changes and keep frontend/API releases separate unless an HTTP contract changes.
