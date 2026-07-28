# Ayu Light — implementation plan

> **Status: implemented** (phases 1–5). Two things changed during the work and are recorded at the
> bottom under "What shipped differently": a new `--accent-ink` token, and the income ramp being one
> step darker than planned. Kept as the record of *why* the values are what they are.

Goal: replace the current light theme (slate/indigo) with **Ayu Light**, to the same standard the dark
theme now meets — every colour inside the palette, contrast never traded for fidelity.

Palette source: the official `ayu` npm package (`ayu@9.0.0`, `dist/light.js`), not a blog screenshot.

```
syntax   tag #55B4D4   func #F2A300   entity #399EE6   string #86B300   regexp #4CBF99
         markup #F07171  keyword #FF7E33  special #D9B077  constant #A37ACC  operator #ED9366
         comment #787B80 @60%
vcs      added #6CBF43   modified #478ACC   removed #FF7383
editor   fg #5C6166   bg #FCFCFC   line #828E9F @10%   selection #035BD6 @15%
ui       fg #828E9F   bg #F8F9FA   line #6B7D8F @12%   panel #FAFAFA   shadow #6B7D8F @7%
common   accent tint #F29718   accent on #804B00   error #E65050
```

---

## The one finding that shapes everything

I measured every authentic Ayu Light hue as text on `#FCFCFC`:

| hue | ratio | hue | ratio |
|---|---|---|---|
| accent `#F29718` | **2.22** | entity `#399EE6` | **2.84** |
| func `#F2A300` | **2.04** | tag `#55B4D4` | **2.31** |
| keyword `#FF7E33` | **2.47** | regexp `#4CBF99` | **2.22** |
| string `#86B300` | **2.42** | constant `#A37ACC` | **3.29** |
| added `#6CBF43` | **2.23** | markup `#F07171` | **2.80** |
| removed `#FF7383` | **2.55** | error `#E65050` | **3.64** |
| operator `#ED9366` | **2.28** | ui.fg `#828E9F` | **3.24** |
| editor.fg `#5C6166` | 6.10 ✓ | accent.on `#804B00` | 7.00 ✓ |

**Every syntax hue fails AA text (4.5:1). Most fail even the 3:1 non-text graphic floor.** Ayu Light is an
editor theme on a near-white page — it never has to put its accent on white as small bold text, which this
app does constantly (amounts, badges, statuses, chart legends).

So the rule for this port — the exact mirror of what dark mode already does at its 600–700 steps:

> **Authentic hues are for fills, slices and strokes. Text and icons use an in-hue darkened step.**
> A `-500` step that is used bare as text is *not* the authentic hue; the authentic hue lives on the
> `-400` fill step and in the chart tokens.

This is not a new convention — `index.css` already says it for today's light ramps ("the -300 steps … are
intentionally the AA-safe dark tint, not a pale one"). We keep the structure and re-hue it.

Second finding worth knowing: **Ayu's own `accent.on` (#804B00) on `accent.tint` (#F29718) is 3.15:1** — it
fails AA. We do not ship Ayu's literal pairing; `--primary-foreground` becomes a much darker brown.

| on `#F29718` | ratio |
|---|---|
| `#FFFFFF` | 2.28 ✗ |
| `#804B00` (Ayu's own) | 3.15 ✗ |
| `#5C3600` | 4.65 ✓ |
| **`#3A2100`** | **6.59 ✓** ← proposed |
| `#0B0E14` | 8.48 ✓ |

`#3A2100` keeps the warm-brown character Ayu intends while clearing AA with margin.

---

## What the dark-mode work already bought us

The sweep just completed means this is now **mostly a token-file change, not a component sweep**:

- Primary actions, selected/active states, focus rings and brand accents all read `--primary`,
  `--primary-foreground` and `--ring`. Re-point those three and every CTA, switch, pagination pill,
  date-picker selection and focus ring follows.
- Every Tailwind colour utility in `src/` resolves through a `--color-*` → `--ledger-*` mapping. There are
  **875 colour utility usages and only 56 `dark:` overrides** — i.e. the light theme is the *default* path
  for nearly every element, which is exactly why it must be driven from the ramps.
- Charts already read `--chart-line`, `--chart-1..5`, `--chart-custom-1..6` and the ledger ramps. No chart
  component needs touching; only the light values of those tokens change.

**No component files should need editing in phases 1–4.** If one does, that is a signal it hard-codes a
colour and should be tokenised instead — the same test the dark sweep used.

---

## Phase 1 — Base surfaces, ink and accent

`:root` in `src/index.css` only.

| token | now | proposed | note |
|---|---|---|---|
| `--background` | `#f8fafc` | `#FCFCFC` | editor.bg |
| `--card` / `--popover` | `#ffffff` | `#FFFFFF` | keeps card/page separation at 1.03 — same "border is the only structure" situation as dark mode |
| `--foreground` | `#0f172a` | `#5C6166` | editor.fg, 6.10:1 |
| `--secondary` / `--muted` | `#f1f5f9` | `#F1F2F4` | flattened ui.line/panel |
| `--muted-foreground` | `#64748b` | `#646F7A` | 5.00:1. Ayu's own ui.fg `#828E9F` is 3.24:1 — **do not ship it**, same call the dark theme made about `#565B66` |
| `--border` / `--input` | `#e2e8f0` | `#E3E6E9` | ui.line `#6B7D8F@12%` flattened; 1.22:1 vs page, comparable to today |
| `--primary` | `#4338ca` | `#F29718` | accent.tint |
| `--primary-foreground` | `#ffffff` | `#3A2100` | 6.59:1 (see above) |
| `--ring` | `#4f46e5` | `#F29718` | accent |
| `--accent` / `--accent-foreground` | indigo tint | `#FDF0DC` / `#8A5A00` | warm accent chip |
| `--destructive` | `#e11d48` | `#C0392F` | error `#E65050` darkened for white text (5.43:1) |
| `--sidebar*` | slate/indigo | mirror the above | |

**Checkpoint:** page renders, no indigo remains, `--primary` CTA pairs measured ≥4.5:1.

## Phase 2 — The semantic ramps

Re-hue each `--ledger-*` family from its Ayu Light counterpart. Fill steps carry the authentic hue; text
steps are the verified darkened values. All ratios below measured on `#FCFCFC`.

| family | Ayu source | fill (`-400`) | text (`-500/600`) | white-backed (`-700`) |
|---|---|---|---|---|
| pending / gold | accent `#F29718`, func `#F2A300` | `#F29718` | `#966200` (5.06) | `#8A5A00` (white 5.93) |
| expense / red | error `#E65050`, removed `#FF7383` | `#E65050` | `#C0392F` (5.29) | `#A32B2B` (6.97) |
| income / green | string `#86B300`, added `#6CBF43` | `#6CBF43` | `#517A00` (4.95) | `#4A7000` (white 5.82) |
| blue / entity | entity `#399EE6` | `#399EE6` | `#176FAD` (5.23) | `#15628F` (white 6.61) |
| sky / regexp | regexp `#4CBF99`, tag `#55B4D4` | `#4CBF99` | `#24785C` (5.23) | `#1D6349` (white 7.16) |
| transfer / violet | constant `#A37ACC` | `#A37ACC` | `#8A5FC0` (4.57) | `#7B4FB0` (5.71) |
| purple | constant `#A37ACC` | `#A37ACC` | `#8A5FC0` | `#7B4FB0` |
| wishlist / pink | derived from markup `#F07171`, rotated toward magenta (Ayu Light has no pink — same derivation the dark theme documents) | `#E5709B` | `#C03A6B` (5.04) | `#A32B57` (6.73) |
| neutral | ui.fg `#828E9F` | `#828E9F` | `#5F6B75` (5.32) | `#3F4A54` |

Keep the **step-count and ordering identical** to today's block, so no component changes meaning.

**Checkpoint:** the mapped-pair audit still diffs empty; the contrast harness (phase 5) passes for every pair.

## Phase 3 — Charts

Authentic hues fail the **3:1 graphic floor** on white (`#F29718` 2.22, `#6CBF43` 2.23, `#399EE6` 2.84).

- `--chart-1..5` and `--chart-line`: use the `-500`/`-600` text steps from phase 2, not the fills, so a 2px
  trend line and a legend swatch are both readable. `--chart-line` → `#966200`.
- `--chart-custom-1..6`: re-derive from Ayu Light hues darkened to ≥3:1, **preserving the existing hue
  order** (red → olive → magenta → teal → ochre → plum). `categoryColors.ts` maps categories to slots by
  index; changing the order silently re-colours every user's chart.
- Doughnut slices keep their `--card` stroke, which is what separates adjacent slices.

**Checkpoint:** open Reports + Investments in light mode; every series distinguishable, no slice under 3:1.

## Phase 4 — Chrome, ambience and assets

- `--app-grid`, `--app-surface-a/b/c`: warm gold/green/violet washes at the current low alphas (mirror of
  the dark block, which is already gold-led).
- `--app-shadow*`: recolour from `rgba(15,23,42,…)` to Ayu's `ui.panel.shadow` hue `rgba(107,125,143,…)`.
- `--app-inner-highlight`, `--app-highlight` (deep-link cue) → accent.
- `--chart-custom-*` handled in phase 3.
- `index.html`: `theme-color` `#f6f8fc` → `#FCFCFC`; `nativeUi.ts` `LIGHT_BG` likewise; `theme-init.js`
  splash surface.
- **Brand mark decision needed** (see open questions): the mark is currently Ayu-dark gold on `#0F131A`.

## Phase 5 — Verification (reuse what worked)

1. **Mapped-pair audit** — extract `--color-<family>-<step>` from `index.css`, extract used pairs from
   `src/`, `comm -23`. Must be empty; anything listed escapes the palette.
2. **Composited contrast harness** — the in-page probe from the dark sweep, run with `.dark` removed:
   composites translucent fills over the real surface before measuring, so `bg-primary/5` is judged as
   rendered. Assert ≥4.5 text / ≥3.0 graphic for every pair the plan touches.
3. **The reverse white-text trap** — dark mode's failure was white on bright tints. Light mode's is the
   opposite: `text-primary-foreground` is now a dark brown, so audit every `bg-primary` element and any
   `dark:text-background` pairing added in the last sweep still reads in light mode.
4. `npm run lint` (0 problems), `npx tsc -b`, `npx vitest run` (544 tests), `npm run build` incl. bundle
   budgets. `InteractiveDoughnutChart.test.tsx` passes literal hexes as props — check whether it should
   move to tokens rather than asserting brand colours.
5. Side-by-side both themes on: Dashboard, Ledger (table + mobile rows), Reports, Investments, Wishlist,
   Recurring, Settings, Login/Register, Security questions, Lock screen, AI panel, Draft staging.

---

## Risks

| risk | mitigation |
|---|---|
| Ayu Light is inherently low-contrast; a faithful port would regress readability | The fill/text split above; every value pre-measured. Contrast wins ties. |
| Ayu Light's accent is **orange**, and orange currently carries "warning/pending/expense" meaning in this app | Deliberate: gold/pending shares the accent hue exactly as dark mode does (Ayu dark's accent *is* its gold). Warnings stay distinguishable by keeping expense on red `#E65050` and pending on the accent — but audit any screen showing a warning chip next to a primary CTA. |
| Chart hue order changes → users' category colours shuffle | Preserve slot order in `--chart-custom-*`; verify against `categoryColors.ts`. |
| Light-mode-only regressions slip through (only 56 `dark:` overrides, so light is the default path) | Phase 5 step 5 walks every screen in both themes. |
| Two large token blocks drift apart over time | Both blocks keep the same step structure and the audit in phase 5 step 1 is cheap enough to re-run. |

## Sequencing

Phases 1 → 2 → 3 → 4 are strictly ordered (each builds on the previous), with phase 5's harness run at the
end of each. Phase 1 alone is a coherent, shippable checkpoint; phases 2–3 should land together, since
half-re-hued ramps look worse than either end state.

Estimate: phase 1 small, phase 2 the bulk (the values are already derived above), phase 3 medium
(needs visual judgement on six chart slots), phase 4 small, phase 5 ~an hour of screen-walking.

## Open questions

1. **Brand mark.** Options: (a) keep one gold mark on the dark plate for both themes — simplest, already
   in-palette, gold reads on the light page too; (b) make `favicon.svg` theme-aware with
   `prefers-color-scheme` inside the SVG, which the PWA raster icons *cannot* follow, so the installed
   icon and the in-app logo would diverge. Recommendation: (a).
2. **`--foreground` fidelity.** Ayu's `#5C6166` is 6.10:1 — comfortable but noticeably softer than
   today's `#0f172a` (16:1). Faithful, and consistent with the dark theme's warm-grey ink. Confirm the
   softer ink is wanted before phase 1 lands, since it sets the feel of every screen.
3. **Cards on a near-white page.** Ayu gives page `#FCFCFC` and panel `#FAFAFA` — inverted from this app,
   where cards sit *above* the page. Proposal keeps card `#FFFFFF` on page `#FCFCFC` (1.03:1, structure
   from the border, mirroring dark mode). The alternative — page `#F8F9FA` with `#FCFCFC` cards — is more
   literally Ayu; it needs one visual comparison to settle.

---

## What shipped differently

Two things the measurements forced, both worth knowing before touching these values again.

### 1. `--accent-ink` — the accent needed a second weight

`--primary` is a *fill*. Ayu Light's gold is 2.2:1 on white, so `text-primary` — perfectly readable in
dark mode at 9.76:1 — was unreadable in light mode. Seven places used it that way (the scan button, the
AI review card, the login wordmark, the assistant header).

Rather than darken `--primary` and lose the gold fill, there is now a token for the accent *as text*:

```
--accent-ink: #7a4f00;  /* light — 7.09:1 on the page */
--accent-ink: #e6b450;  /* dark  — 9.76:1 on a card; the accent reads as text unchanged here */
```

Use `text-accent-ink` for accent text/icons and `bg-primary` + `text-primary-foreground` for accent
fills. They are not interchangeable.

### 2. The income ramp is one step darker than planned

`#517a00` cleared AA on the page (4.95) but only reached **4.32 on its own 10% chip** —
`bg-emerald-500/10 text-emerald-500` is a real, common pattern. Chips are the tightest surface in the
app, so the ramp is pinned to the *chip*, not the page: `#4d7400` (chip 4.69, page 5.37).

**When adding a ramp step, verify it on the chip.** A value that passes on `--background` can still
fail on the tint of its own family.

### 3. One latent bug this surfaced

Three swipe-action "Edit" buttons were `bg-blue-500 text-primary-foreground`. That read fine in dark
mode by luck — `--primary-foreground` was near-black and the blue was bright. Once light mode's
`--primary-foreground` became dark brown and its blue became dark azure, the pairing was dark-on-dark
(2.8:1). They are now `text-white dark:text-background`, which is correct in both (5.37 / 8.59).

## Verification actually run

- Mapped-pair audit: empty diff — no colour utility escapes the palette in either theme.
- Canvas-normalised contrast harness over every real `bg-*`/`text-*` pair extracted from source, in
  both themes. **Note for whoever reruns this:** normalise computed colours through a canvas.
  `color-mix()` serialises as `oklab(…)`/`color(srgb …)`, which is not parseable as `rgb()` and
  produces phantom failures. Also test the *whole* class string — testing only the light half of
  `text-x-600 dark:text-x-300` reports failures that cannot happen.
- `tsc -b`, `eslint` (0 problems), 544 frontend tests, production build + bundle budgets.
- Every real pair clears AA in both themes; light mode ranges 4.57–7.28, dark 4.51–12.32.
