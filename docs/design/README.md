# Lumen — the FinancialApp design language

Lumen replaced the Ayu interface in October 2026. It is a ground-up redesign of the visual layer and
the navigation; no API, data, calculation, offline/outbox or persistence behaviour changed.

The template is **Copilot Money** (Apple Design Award finalist, App Store Editor's Choice): a calm,
near-colourless chrome where the money itself is the light source. Where Copilot has no answer, the
references below filled the gap.

| Reference | What Lumen takes from it |
| --- | --- |
| Copilot Money | Dark-first canvas, achromatic chrome, a dashboard that leads with "what can I spend", a review inbox, recurring payments up front |
| Monarch | Dense desktop layouts; Plan as one place for budget, bills and goals; the cycle recap |
| Wise | Show the effect before commit (the transaction form's bucket and balance preview); very few top-level places |
| Revolut / Mercury | Depth from surface lightness rather than shadows; pill actions; colour only where it means something |
| Linear | One accent; hairline borders; ⌘K search; tight tracking at display sizes |
| Stripe | Tabular figures on every amount; light weight on big numbers |
| iOS 26 | A floating glass tab bar with the add action as its own circle |
| Emil Kowalski | UI motion under 300 ms, ease-out, springs for gestures, 0.97 press scale, never animate from `scale(0)` |

## Principles

1. **The data is the light.** Chrome is achromatic. Colour comes only from money, status and the
   four buckets.
2. **Content over containers.** Pages sit on the canvas. Spacing and hairlines group content; a
   surface (`panelClass`) means "this is one object", never "this is a section".
3. **Numbers are the hero.** Amounts use `AmountText`: tabular figures, whole units carrying the
   weight, the currency marker and cents smaller and quieter.
4. **One colour, one meaning.** See [Colour semantics](#colour-semantics).
5. **No decoration.** No gradients, glows or coloured shadows anywhere — including charts,
   skeletons and the brand mark.
6. **Motion explains state.** Fast, interruptible, and fully disabled under reduced motion.

## Foundations

All tokens live in `src/index.css`. Both themes are checked for WCAG AA by
`tests/visual/accessibility.spec.ts`.

### Colour

| Token | Day (light) | Night (dark) |
| --- | --- | --- |
| `--background` (canvas) | `#f5f6f8` | `#090b11` |
| `--card` | `#ffffff` | `#11141c` |
| `--surface-2` / `--surface-3` | `#eef0f3` / `#e5e8ed` | `#171b25` / `#1e2330` |
| `--foreground` | `#0d1017` | `#eceef4` |
| `--muted-foreground` | `#596172` | `#9ba2b3` |
| `--border` | `#e2e5ea` | `#232837` |
| `--primary` / `--brand` (Iris) | `#4f49e6` | `#5e5eef` |
| `--accent-ink` (Iris as text) | `#4b44d9` | `#a7a8ff` |
| `--destructive` | `#c02828` | `#ff6e6e` |

Primary actions are **ink** buttons (foreground on canvas), not Iris. Iris marks the brand, focus,
selection and the one "this is yours" accent (avatar, active nav icon).

#### Colour semantics

| Meaning | Class | Notes |
| --- | --- | --- |
| Outflow / spending | `text-foreground` | Spending is normal. It is never red. |
| Inflow, gains, "funded" | `text-emerald-600 dark:text-emerald-400` | `AmountText tone="positive"` |
| Over a limit, negative balance, destructive | `text-red-600 dark:text-red-400` | Red only means "over" or "this deletes" |
| Needs attention | `text-amber-700 dark:text-amber-300` | Bills to review, drafts, offline |
| Transfer | `text-muted-foreground` + ⇄ icon | Moves money; neither in nor out |
| Buckets | `getCategoryChartColor()` | Essentials sky · Growth violet · Stability emerald · Rewards pink |

Faded text (`text-muted-foreground/70` and lower) fails AA on both canvases. Step hierarchy down in
weight or size instead.

### Typography

**Geist Variable**, self-hosted through `@fontsource-variable/geist` (CSP: no font CDNs). Every role
is a single word — a hyphenated `--text-*` key silently emits no utility — and every role is
registered with `extendTailwindMerge` in `src/lib/utils.ts`, or `cn()` will treat it as a colour and
delete it.

| Role | Size / line | Weight · tracking | Use |
| --- | --- | --- | --- |
| `micro` | 11 / 14 | 500 | Tab bar labels, badges |
| `caption` | 12 / 16 | | Metadata, helper text |
| `label` | 13 / 18 | 500 | Field labels, row labels (sentence case, never uppercase) |
| `body` | 14 / 20 | | Default |
| `callout` | 15 / 22 | | Lead paragraphs |
| `subsection` | 15 / 20 | 600 | Card titles |
| `section` | 17 / 24 | 600 · −0.01em | Section headings |
| `title` | 22 / 28 | 600 · −0.02em | Page titles on phones |
| `display` | 28 / 34 | 600 · −0.025em | Page titles, the amount field |
| `hero` | 40 / 44 | 600 · −0.035em | Hero figures |
| `jumbo` | 56 / 60 | 600 · −0.04em | The Today balance at wide container sizes |

Inputs stay at 16px on phones (iOS zooms below that); `.input-display` is the one exemption, for the
amount field, which is already larger.

### Shape and elevation

- Radii: `rounded-control` 12px (inputs, small surfaces), `rounded-panel` 20px (cards),
  `rounded-overlay` 16px (popovers, menus, toasts), `rounded-sheet` 28px (bottom sheets).
- **Pills** for buttons, chips, segmented controls, badges and the tab bar.
- Surfaces: `panelClass` (`app-panel rounded-panel border border-border/70 bg-card`). Inset
  content inside a panel uses `rounded-control bg-surface-2/70`, never a second bordered card.
- Night has no drop shadows: surfaces step up in lightness with a hairline. Day uses a hairline and a
  very faint shadow. `--app-shadow-overlay` is the only shadow an author reaches for.
- Glass (`glass-nav`, `glass-surface`) is limited to the tab bar, the scrolled phone top bar and
  floating overlays, with a solid fallback under `prefers-reduced-transparency` and without
  `backdrop-filter`.

### Layout

- Gutters 16 / 24 / 32px. Section rhythm 24 / 32px.
- Components that change shape with their space use **container queries** (`@container`,
  `@xl:`, `@3xl:`), not viewport breakpoints, so the same card works in a column and full width.
- Size classes in `src/lib/breakpoints.ts`: compact `<640`, medium `640–1023`, expanded `≥1024`.
- Touch targets are 44px below 1024px; desktop controls may step down at `lg:` only.

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-press` | 120ms | Press and hover |
| `--duration-quick` | 180ms | Toggles, popovers |
| `--duration-enter` | 240ms | Page enter (`view-enter`: fade and 8px rise) |
| `--duration-large` | 320ms | Large surfaces |
| `--ease-fluid` | `cubic-bezier(.22,1,.36,1)` | Default ease-out |
| `SPRING.snappy` | 520 / 38 | Sliding selection pills (`layoutId`) |
| `SPRING.smooth` | 300 / 32 | Content |
| `SPRING.sheet` | 400 / 40, no bounce | Sheets and drawers |

Balances tick to new values (`AmountText animate`), the brand mark lights its four segments in turn
while loading, and skeletons breathe rather than shimmer. Everything runs inside
`MotionConfig reducedMotion="user"` and the global reduced-motion CSS, using `m.*` under
`LazyMotion` only.

## Information architecture

Five destinations replace the eleven rail items. Every published address still resolves:
`src/lib/appLocation.ts` maps the old paths and `section=` values onto the new ones and rewrites the
address to its canonical form.

| Destination | Sections | Canonical paths | Old addresses that land here |
| --- | --- | --- | --- |
| **Today** | — | `/today` | `/`, `/dashboard` |
| **Activity** | Transactions · Review (while drafts wait) | `/activity`, `/activity/review` | `/ledger`, `/drafts` |
| **Plan** | Budget · Bills · Loans · Goals | `/plan/budget`, `/plan/bills`, `/plan/loans`, `/plan/goals` | `/recurring`, `?section=loans`, `/commitments-rewards`, `/wishlist`, `/settings?section=categories\|model\|rules` |
| **Wealth** | Accounts · Investments · Vault | `/wealth/accounts`, `/wealth/investments`, `/wealth/vault` | `/settings?section=accounts`, `/investments`, `/vault` |
| **Insights** | — | `/insights` | `/reports` |
| Settings | Preferences, notifications, security, detection, data | `/settings` | |

Each destination reopens on the section last visited (`navModel.rememberSection`).

### Shell

- **Phones (<640px):** a top bar that is transparent at the top of a page and turns to glass with
  the destination name once scrolled; a floating glass tab bar with the five destinations; a
  separate round **+** that opens the quick-add sheet.
- **Tablets (640–1023px):** a 72px icon rail.
- **Desktop (≥1024px):** a 240px sidebar (foldable to the rail, remembered per device) with search
  (Ctrl/⌘K), **New transaction**, the destinations, Ask AI, bills to review, Settings, the cycle
  card and the account menu. There is no desktop top bar; each page header carries its own title,
  section row and cycle switcher.
- **Ask AI** is a full-screen sheet on phones and a right-hand drawer from 640px up.

The shell is on the eager startup path, so anything not needed to paint it — the sidebar cycle
card, the hub section row — is loaded lazily with a same-size placeholder.

## Components

Shared primitives live in `src/components/ui/`. `UiSpecimen.tsx` renders all of them and is covered
by `tests/visual/design-system.spec.ts`.

- **Actions:** `Button` (`primary` ink, `secondary`, `tertiary`, `destructive`; `sm`/`md`/`lg`/
  `icon`), `IconButton` (owns the accessible name and tooltip), `PillSwitch`, `ToggleButton`,
  `OverflowMenu`.
- **Money:** `AmountText` (marker, units and cents as spans; `tone`, `signDisplay`, `animate`,
  masking through `SensitiveMask`), `AnimatedNumber`, `SensitiveAmount`.
- **Data display:** `ListRow`, `StatTile`, `Sparkline`, `ProgressRing`, `Meter`, `SegmentedMeter`
  (multi-segment bars), `CategoryIcon` (a tinted rounded square), `Badge`, `RowSyncBadge`,
  `DataTable`.
- **Structure:** `PageHeader`, `SectionHeader`, `Panel`/`Card`/`panelClass`, `InteractiveCard`,
  `NoticeCard` (the one anatomy for every "needs attention" card), `DisclosurePanel` (a panel
  whose full-bleed header opens its body; the Security sections), `EmptyState`, `Tabs`,
  `Toolbar`, `SelectionToolbar`, `SwipeableRow` (`card` or `flush`).
- **Overlays:** `BottomSheet` (phone sheet, desktop dialog or side panel), `AnchoredPopover`,
  `dropdown-menu`, `CustomAlertModal`, `CustomConfirmModal`, `ToastViewport`.
- **Forms:** `FormField`, `Input`, `Textarea`, `CustomSelect`, `CurrencySelect`, `DatePicker`,
  `Checkbox`, `RangeInput` (takes `--range-color`), `SmartAmountInput` (keeps the inline
  calculator).
- **Loading:** `Skeleton`, `CycleSkeleton`, the animated `AppLogo`.

## Brand

The mark is a **segmented ring**: four arcs sized 50 / 25 / 15 / 10 — the default split across
Essentials, Growth, Stability and Rewards — in white on an Iris tile. Geometry and every exported
asset come from one source, `scripts/brand-mark.mjs`:

- `node scripts/generate-icons.mjs` writes the PWA icons and `public/favicon.svg`.
- `npm run native:assets` (run after the PWA icons) writes the Android launcher, round, adaptive (foreground,
  Iris background) and monochrome (themed) icons, the Android splash drawables, and the iOS icon and
  splash.
- `ui/AppLogo.tsx` draws the same paths inline; `animated` lights the segments in sequence for
  loading states. `index.html` carries a static copy for the launch splash.

## How the contract is enforced

1. **`npm run check:design-system`** — an AST linter over `src/`: no raw feature buttons or native
   controls, canonical `Button` variants and sizes only, no `text-[Npx]`, no focus suppression on
   primitives, no hand-rolled panel shells (`app-panel` outside `panelStyles`), no literal colours,
   palette steps mapped for both themes.
2. **`src/components/ui/designContract.test.tsx`** — the contract between primitives: matching radii
   and heights for a button and a field of one size, the 44px floor, the focus treatments, role
   names without hyphens, and `cn()` keeping a role beside a colour.
3. **The Playwright matrix** (`npm run test:visual`, 14 projects) — screenshots, axe in both themes,
   keyboard order, the 44px floor at every sub-1024px project, overflow at 200% text, and computed
   heading sizes per tier. A 2% pixel tolerance hides small type changes, so read "no baseline
   moved" as *below threshold*, not *unchanged*.
4. **Budgets** (`scripts/check-bundle-size.js`, run by `npm run build`) — index ≤ 71.5 kB, eager
   critical path ≤ 227 kB, precache ≤ 3 MiB (gzip). Anything new on the startup path needs an
   offsetting saving.

Snapshot diffs are reviewed one image at a time and never bulk-accepted: the only signal for an
empty state whose button slid behind the tab bar was two changed PNGs with every other gate green.

## Lessons kept from the Ayu audit

- **A custom Tailwind scale is not finished until `extendTailwindMerge` knows it.** A stock
  tailwind-merge read `text-eyebrow` as a colour and deleted it under `cn()`.
- **A hyphenated `--text-*` key emits nothing.** `--text-page-title` was declared, passed every
  gate and produced no utility.
- **Count by reading, not by grepping.** Every "N files hand-roll X" figure in the old audit shrank
  once the sites were read; class patterns match unrelated components.
- **A test that can skip its way to green is worse than no test.** Loops over routes assert that
  every route was actually checked.
