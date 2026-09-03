# FinancialApp UI Standardization Audit

Date: 2026-09-03
Direction: evolve the existing Ayu interface
Scope: application shell, all nine primary routes, shared overlays, responsive interaction, and component enforcement

## Outcome

The application-wide standardization pass is complete. FinancialApp keeps its Ayu identity while using one action hierarchy, one page-header anatomy, shared tab and badge semantics, shared surface primitives, and a zero-baseline rule for feature-level raw buttons.

No backend, HTTP, database, financial-calculation, persistence, offline, or route contract changed.

## Before and after

| Signal | Before | After | Contract |
| --- | ---: | ---: | --- |
| Raw production `<button>` elements | 207 across 77 files | 3, all inside shared primitive implementations | Feature code must use a shared action primitive |
| Feature raw buttons | 207-baseline model | 0 | New raw feature buttons fail `check:design-system` |
| `Button` uses of `variant="unstyled"` | 170 | 0 | Only primary, secondary, tertiary, and destructive actions exist |
| Primary routes using `PageHeader` | 5 of 9 | 9 of 9 | Specialized summaries use header slots rather than separate shells |
| Independent tab implementations | Settings, Recurring, Commitments/Rewards, Ledger scope | One shared `Tabs` contract | Arrow keys, Home/End, focus, counts, and panel links are shared |
| Arbitrary pixel typography | 0 | 0 | The semantic type-scale check remains enforced |
| Stored visual baselines | 125 | 131, including the six reviewed Ayu specimen snapshots | Route and shared-surface evidence covers both themes and all primary sizes |

## Canonical component contract

- Buttons use `primary`, `secondary`, `tertiary`, or `destructive`; sizes are `sm`, `md`, `lg`, or `icon`.
- Compact and medium actions retain a 44px minimum target. Expanded actions use explicit 36–40px sizes where appropriate.
- Buttons, form controls, icon actions, and segmented controls use a 12px radius. Panels use a 16px radius. Full pills are reserved for badges, counts, avatars, and switches.
- `IconButton` owns icon-only accessible names and tooltips.
- `Tabs` owns tab roles, selection, keyboard movement, counts, panel relationships, and optional horizontal overflow.
- `Badge` and `StatusBadge` own neutral, accent, info, success, warning, and danger state treatments.
- `PageHeader`, `Panel`, `SectionHeader`, `Toolbar`, `EmptyState`, and `InteractiveCard` own repeated layout anatomy.
- Forms continue to use `FormField` and the canonical input, textarea, select, date, checkbox, range, and amount controls.

## Approved raw-button implementations

Raw buttons are limited to shared primitive internals where the element itself is the implementation boundary:

- `Button.tsx`
- `InteractiveCard.tsx`
- `PillSwitch.tsx`

The design-system audit rejects raw buttons everywhere else. There is no per-feature migration baseline.

## Route and state coverage

The responsive suite covers Dashboard, Reports, Recurring, Ledger current/all cycles, Commitments & Rewards, Drafts, Settings, Investments, and Vault across Ayu Light and Dark at mobile, medium, and desktop sizes. Shared contracts additionally cover 320px narrow phones, 390×500 keyboard-height layouts, 960px medium layouts, and 1024–1366px expanded layouts.

Nested coverage includes authentication errors, transaction and destructive sheets, Settings account surfaces and keyboard tabs, Draft review and persistence, Vault unavailable/selection/editing states, Recurring Bills/Loans, responsive search, fixed-navigation clearance, touch targets, and horizontal containment.

## Completion gates

The standardization is releasable only after focused tests, strict TypeScript, ESLint, design-system audit, dead-code analysis, full Vitest, production build/budgets, and the applicable Playwright matrix pass. Snapshot updates must be reviewed individually; semantic, keyboard, overflow, privacy, and hit-target assertions take precedence over image acceptance.
