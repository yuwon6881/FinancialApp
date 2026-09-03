# FinancialApp UI Standardization Audit

Date: 2026-09-03
Direction: evolve the existing Ayu interface
Scope: application shell, all nine primary routes, shared overlays, responsive interaction, and component enforcement

This is the canonical copy. The copy at the workspace root is a superseded pre-refactor record; do not reconcile the two in its favour.

## Outcome

The **action layer** is standardized: one hierarchy, one page-header anatomy, shared tab and badge semantics, and a zero-baseline rule for feature-level raw buttons, all enforced by `npm run check:design-system`.

The **surface layer** is not yet standardized. The shared surface primitives exist and are correct, but adoption is thin and features still hand-roll the shells around the now-canonical buttons. That is recorded as open debt below rather than described as finished.

No backend, HTTP, database, financial-calculation, persistence, offline, or route contract changed.

## Before and after

Figures are re-derived from the tree, not carried over from earlier drafts. Two previously published "before" numbers were not reproducible at any commit and are corrected here.

| Signal | Before | After | Contract |
| --- | ---: | ---: | --- |
| Raw production `<button>` outside shared primitives | 24 across 7 files | 0 | Feature code must use a shared action primitive |
| Old per-file raw-button allowlist (`RAW_BUTTON_BASELINE`) | 151 permitted across 42 entries (peak 158/43) | removed entirely | No per-feature migration baseline exists |
| `Button` uses of `variant="unstyled"` | 168 across 82 files | 0 | Only primary, secondary, tertiary, and destructive actions exist |
| Primary routes using `PageHeader` | 5 of 9 | 9 of 9 | Specialized summaries use header slots rather than separate shells |
| Independent tab implementations | Settings, Recurring, Commitments/Rewards, Ledger scope | one shared `Tabs` | Arrow keys, Home/End, focus, counts, and panel links are shared |
| Arbitrary pixel typography | 0 | 0 | The semantic type-scale check remains enforced |
| Ad-hoc focus treatments on shared primitives | 6 sites, 4 different ring colours | 0 | One outline for actions, one border+ring for text entry |
| Stored visual baselines | 125 | 131, including six reviewed Ayu specimen snapshots | Route and shared-surface evidence covers both themes and all primary sizes |

**Corrections to earlier drafts.** A figure of "207 raw buttons across 77 files" was published; it does not reproduce at any point in the last 60 commits, where feature raw buttons were a flat 24 across 7 files. The closest real artifact is the retired allowlist above. Likewise "170 `unstyled` uses" was 168 at the commit before the pass, peaking at 169.

## Canonical component contract

- Buttons use `primary`, `secondary`, `tertiary`, or `destructive`; sizes are `sm`, `md`, `lg`, or `icon`. Status colour never encodes action rank.
- Compact and medium actions retain a 44px minimum target. Expanded actions use explicit 36–40px sizes where appropriate.
- Controls use the `rounded-xl` token and panels use `rounded-2xl`. State the contract in tokens, not pixels: `--radius` is `0.75rem` and the scale multiplies it, so `rounded-xl` computes to **16.8px** and `rounded-2xl` to **21.6px**. Earlier drafts claimed 12px and 16px, which no theme value produces; `src/index.css` documents the same trap for `PerimeterBeam`.
- Full pills are reserved for badges, counts, avatars, and switches.
- `IconButton` owns icon-only accessible names and tooltips. `Tabs` owns tab roles, selection, keyboard movement, counts, panel relationships, and optional horizontal overflow. `Badge` and `StatusBadge` own the six state tones. `PageHeader`, `Panel`, `SectionHeader`, `Toolbar`, `EmptyState`, and `InteractiveCard` own repeated layout anatomy.
- Forms continue to use `FormField` and the canonical input, textarea, select, date, checkbox, range, and amount controls.
- Shared primitives own their focus treatment. A call site may position a primitive but may not cancel its focus, and the audit rejects `outline-none`, `outline-hidden`, and `ring-0` on them.

## Approved raw-button implementations

Raw buttons are limited to the three shared primitives where the element is the implementation boundary: `Button.tsx`, `InteractiveCard.tsx`, `PillSwitch.tsx`. These are now an explicit file allowlist in the audit script; the exemption used to cover all of `src/components/ui/`, which would have let a new shared component hand-roll its own button.

## Open debt

### Surface-primitive adoption is thin

| Primitive | Feature importers | Competing hand-rolled implementations |
| --- | ---: | --- |
| `IconButton` | **19 — closed.** All 28 icon-only call sites adopted it; the primitive layer (`HorizontalRail`, `OverflowMenu`, `ToastViewport`, `ToggleButton`) still composes `Button` directly as the implementation boundary | none |
| `EmptyState` | 1 | 18 files hand-roll dashed empty shells |
| `SectionHeader` | 1 | ~48 `font-bold uppercase tracking-wide` labels across 31 files |
| `Toolbar` | 2 | 5 further filter/action bars; it is the only `role="toolbar"` in the tree |
| `Badge`/`StatusBadge` | 3 | `RowSyncBadge` (15 consumers, undeclared second badge system) plus pills in 14 files |
| `Panel`/`Card` | 10 / 4 | **none — closed.** All 39 hand-rolled shells now compose `panelClass`, `PANEL_TONES` or `panelFromMediumClass` from `ui/panelStyles`, and the audit rejects the `app-panel` marker outside that module |
| `Meter` | 4 | 15 files hand-roll progress tracks; 3 independent `role="progressbar"` |
| `Skeleton` | 8 | 4 further skeleton systems; 10 files still on raw `animate-pulse` |
| `Tabs` | 5 | none — the one genuinely consolidated pattern |

### Local re-styling of shared primitives

Call sites still override the primitives they use: **219 radius overrides across 99 files, 180 surface-colour overrides across 90, 120 geometry overrides across 68, 70 shadow overrides across 54.** This is the honest measure of remaining visual variation, and a better one than the raw-button count. These four categories are deliberately *not* yet rejected by the audit: a rule that large would need an allowlist of ~110 files, which is a migration baseline under another name. Each category is scheduled to become an audit rule as its feature area is migrated.

### The 44px floor is delivered by load-bearing safety nets

`src/index.css` carries two `!important` rules — a `@media (width < 64rem)` `min-height`/`min-width` of `2.75rem`, and a `:focus-visible` outline that outranks any `focus:outline-none`. They work: `responsive-contract.spec.ts` asserts the 44px floor across every route at every viewport under 1024px and passes. But **76 call sites author a sub-44px step-down at `sm:` (the start of the medium tier) where only 6 correctly step down at `lg:`**, so the authored classes contradict the contract and the nets cannot be removed until those sites are normalized. This is the same maintainability trap the pre-refactor audit recorded for `text-[10px]` utilities.

### The type hierarchy is flat

The 573 arbitrary `8px`–`13px` utilities are gone, but they collapsed into one size rather than a scale: **1,092 `text-xs` against 157 `text-sm`**, while the semantic tokens `--text-caption`, `--text-body`, `--text-title`, and `--text-page-title` are used 7 times in total. Nearly all application text now renders at 12px, so role and hierarchy are no longer expressed.

### Smaller items

- No `RadioGroup` primitive: `TransactionTypeFields.tsx`, `StabilityReloadIntentCard.tsx`, and `ReminderControls.tsx` hand-roll `role="radio"` across 10 sites with literal tone classes and no arrow-key roving.
- `Checkbox` and `RangeInput` bypass `controlStyles.ts`; `dropdown-menu.tsx` uses its own radii and a literal `z-50` instead of `Z_LAYERS`.
- The "borderless field composed inside a focus-bearing shell" pattern is hand-rolled four times (`GlobalSearch`, `LedgerFilterBar` twice, `AiAssistantPanel`) and should become a shared primitive.
- `ManageableNameList.tsx` re-implements the control contract by hand and holds the only tracked-debt entry in the focus-override allowlist.
- Five effective breakpoints exist rather than three: `useIsDenseContent()` at 1280px, CSS `2xl:` at Tailwind's un-aliased 1536px, and bespoke `min-[1280px]`, `min-[1360px]`, `min-[1400px]`, `min-[360px]`. `md:` and `xl:` are aliased to 640/1024 in `index.css`, so they are harmless, but 90 sites write the same two boundaries two different ways.
- 25 grey-family palette occurrences across 6 files, and ~34 fixed `h-[…]`/`min-h-[…]` magic numbers, were untouched by this pass.

## Route and state coverage

The responsive suite covers Dashboard, Reports, Recurring, Ledger current/all cycles, Commitments & Rewards, Drafts, Settings, Investments, and Vault across Ayu Light and Dark at mobile, medium, and desktop sizes. Shared contracts additionally cover 320px narrow phones, 390×500 keyboard-height layouts, 960px medium layouts, and 1024–1366px expanded layouts.

Nested coverage includes authentication errors, transaction and destructive sheets, Settings account surfaces and keyboard tabs, Draft review and persistence, Vault unavailable/selection/editing states, Recurring Bills/Loans, responsive search, fixed-navigation clearance, touch targets, and horizontal containment.

The specimen page is snapshotted at mobile, medium, and desktop in both themes, but not at 320px or 390×500, and it covers roughly thirteen primitives — the form controls, alerts, overlays, tables, meters, sync badges, skeletons, and masked states are not yet in it.

## Gate status

Measured on 2026-09-03 against the standardization commit plus the enforcement changes made in this pass (not yet committed):

- ESLint, `check:design-system`, `typecheck:strict`, and `deadcode`: pass. Note what `typecheck:strict` is: its `include` is only `src/lib/api.ts`, `src/lib/apiTypes.ts`, and `src/lib/outbox.ts`, so it is a targeted `strictNullChecks` gate for the API and outbox layer, **not** a project typecheck. Whole-project type checking is `tsc -b`, which runs inside `npm run build` — so a green `typecheck:strict` on its own is not evidence that the application compiles, and any report should cite the build for that.
- Production build: pass. Budget headroom is very small and is now the binding constraint on the remaining surface work. The panel consolidation moved the eager critical path from 219.29 kB to 219.44 kB, leaving 0.06 kB, so the limit was raised to 221.0 kB under the documented convention. **The precache ceiling cannot be raised the same way — it is fixed by invariant PERF-02 at 3 MiB and stands at 3070.18 kB, about 1.8 kB spare.** Adopting `EmptyState`, `SectionHeader`, `Badge`, `IconButton`, `Meter` and the skeleton consolidation touches roughly 110 more call sites; each should remove more duplicated markup than it adds, but the precache figure must be read after every area and an offsetting reduction found if it stops falling.
- Full Vitest: 292 files, 2,174 tests, all passing.
- Playwright: 324 passed, 156 intentional project skips, across the whole 14-project matrix. The 44px floor assertion passes at all eight sub-1024px projects, including 320px and 390×500.

Standardization work is releasable only after focused tests, strict TypeScript, ESLint, design-system audit, dead-code analysis, full Vitest, production build/budgets, and the applicable Playwright matrix pass. Snapshot updates must be reviewed individually; semantic, keyboard, overflow, privacy, and hit-target assertions take precedence over image acceptance.
