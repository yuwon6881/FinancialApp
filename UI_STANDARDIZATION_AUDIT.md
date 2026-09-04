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
- Controls use `rounded-control` and panels use `rounded-panel`. These are semantic tokens in `src/index.css`, so the contract is written in the class name instead of a t-shirt size that has to be mentally multiplied: `--radius` is `0.75rem` and the scale multiplies it, so they compute to **16.8px** and **21.6px**. Earlier drafts claimed 12px and 16px, which no theme value produces; `src/index.css` documents the same trap for `PerimeterBeam`. Overlay surfaces — popovers, menus, sheets, toasts — are a separate family still on the t-shirt scale and want their own token before they are converted.
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
| `EmptyState` | **9 — closed.** 8 sites converted, using the new `compact` density for the one-line notes that sit inside an already-titled panel | none. The earlier "18 files" figure was wrong: it counted every `border-dashed`, most of which are chart legend dashes, archived/disabled row states or drop zones. Only 10 were empty states, and `dashboard/CategoryLimitPerformance` stays hand-rolled as an approved exception — it is a horizontal icon/text/action card, not this centered anatomy |
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

### The type hierarchy is flat — scale in place, migration started

The 573 arbitrary `8px`–`13px` utilities are gone, but they collapsed into one size rather than a scale: **1,092 `text-xs` against 157 `text-sm`**. Nearly all application text renders at 12px, so role and hierarchy are still not expressed.

The scale now exists to migrate onto. `src/index.css` declares seven roles — `eyebrow`, `caption`, `control-label`, `body`, `section`, `title`, `page-title` — each carrying its own size, leading and weight, so "this is a section heading" is one decision rather than three utilities that drift apart. `SectionHeader` and `PageHeader` use them; their values were chosen to match what those primitives already rendered, so adopting a role is inert and only feature call sites change.

Two roles are migrated:

- **Eyebrow — done.** The small uppercase caption over a metric, definition term or filter group had been authored **six ways**: `font-bold`/`font-semibold`/`font-medium` crossed with `tracking-wide`/`wider`/`widest`/`normal`, at `text-xs` or inherited, across 70 sites in 37 files. All now use `text-eyebrow uppercase`, and the audit rejects composing it by hand.
- **Section heading — done, at two levels.** 56 of the 68 feature `h2`/`h3` now use a role, across 47 files.

  The important finding is what *not* to do. The naive reading was one heading role, and 30 of the headings sat at `text-sm` against 14 at `text-base` — so collapsing them onto the single `section` role would have promoted every in-panel heading to panel weight and made every card, sheet and notice heavier. Those two sizes are a real hierarchy: `section` heads a whole panel, `subsection` heads a block inside one. Both roles now exist, and 52 of the 56 conversions are size-neutral because they were already at the right level.

  What was genuinely inconsistent was the **weight at each level** — `font-semibold`, `font-bold` and `font-black` appeared on sibling headings — so four sites changed weight deliberately (`CycleCalendar`, `LedgerServerStatus` twice, `TaxReliefOverview`) and the roles now decide it.

  Twelve are deliberately left, and they are the open question rather than an oversight: six `text-xs font-bold` headings inside dense investment panels (`AllocationChart`, `DepositGuide`, `WithdrawalGuide`, `FundPriceChart`, `InvestmentPlanPanel` twice) are either a legitimate third level or are really labels rather than headings, and three page-level titles sit on special surfaces (`ErrorBoundary`, `LockScreen`, `InvestmentToolbars`) where `PageHeader` already owns the page-title role. Deciding those needs a look at the surfaces, not a codemod. Until they are resolved, a rule rejecting a size-plus-weight on `h2`/`h3` cannot land.

  `SectionHeader` itself still has one importer. Its adoption is now unblocked — the sizes agree — but swapping a heading for the component restructures JSX, so it is separate work from giving the heading its role.

**Corrections.** An earlier entry here claimed `SectionHeader` had "~48 uppercase labels across 31 files" as competing implementations. Those were eyebrow labels on `<p>`, `<span>`, `<dt>` and `<summary>`, not section headings; routing them through `SectionHeader`'s `h2` would have wrecked the document outline. And the acceptance line "nothing renders below 12px" was false: `text-[0.625rem]` twice in the desktop nav rail (10px) and `text-[0.6875rem]` in loan details (11px) rendered under the floor, because the arbitrary-typography rule only matched `px`. It now matches `rem`, `em`, `pt` and `%`, and those three sites use a role.

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

## How the contract is enforced

Three layers, and they catch different things:

1. **`npm run check:design-system`** — a TypeScript-AST linter over `src/`. It rejects raw feature buttons, non-canonical `Button` variants and sizes, native form controls, `text-[Npx]`, focus suppression on shared primitives, hand-rolled panel shells (matched by the `app-panel` marker, not one spelling), literal colours, unmapped palette steps and raw viewport checks. This is what stops a *new* violation entering.
2. **`src/components/ui/designContract.test.tsx`** — asserts the contract *between* primitives: that a button and a field of the same size round identically, that both keep the 44px floor and step down only at `lg:`, that each family's focus treatment is present and uncancelled, and that no primitive surface falls back to the t-shirt radius scale. Single-component tests cannot catch these; the `sm` radius mismatch it was written for had every component internally consistent and every test passing.
3. **The Playwright matrix** — the only layer that sees what a user sees. It caught the empty-state call to action disappearing behind the bottom navigation when nothing else did.

What layer 3 does *not* do is fine-grained typography. `maxDiffPixelRatio` is 0.02, and 2% of a full-page desktop capture is roughly 38,000 pixels, so a few small labels changing size or tracking passes without a baseline update. The eyebrow migration moved the desktop nav rail's group labels from 10px with `tracking-widest` to 12px with the role's tracking — a change plainly visible to a person — and every snapshot still passed. Read "no baseline moved" as *below threshold*, never as *unchanged*, and lean on layers 1 and 2 for anything the eye would have to hunt for.

A rule may only be added once its area is migrated. Adding one first fails CI across every unmigrated file, which is why the four remaining override rules (radius, surface colour, geometry, shadow — roughly 500 sites across 110 files) trail the migrations rather than leading them.

## Why snapshot diffs are reviewed one at a time

The `EmptyState` migration is the standing example. Adopting the shared anatomy replaced hand-tuned compact sizing with desktop-first sizing, which grew the Loans empty state tall enough that its own "Add your first loan" button ended up behind the fixed bottom navigation on a 390px phone. Every gate was green — typecheck, lint, audit, 2,174 unit tests — and the only signal was two changed images. Bulk-accepting them would have shipped an empty state whose call to action could not be reached.

The fix belonged in the primitive, not the call site: the section-level empty state now steps down at compact (`size-11`/`text-sm`/`text-xs`/`max-w-sm`) and grows from `sm:` upward, matching how the rest of the system treats tiers. Eight baselines were then refreshed deliberately — two for Loans, six for the specimen — each inspected before acceptance.

Standardization work is releasable only after focused tests, strict TypeScript, ESLint, design-system audit, dead-code analysis, full Vitest, production build/budgets, and the applicable Playwright matrix pass. Snapshot updates must be reviewed individually; semantic, keyboard, overflow, privacy, and hit-target assertions take precedence over image acceptance.
