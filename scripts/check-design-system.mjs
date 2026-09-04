import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const THEME_CSS = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8')
const PALETTE_NAMES = 'blue|indigo|sky|cyan|green|emerald|teal|lime|orange|red|rose|amber|yellow|violet|purple|fuchsia|pink|slate|gray|zinc|neutral'
const CONTROL_IMPLEMENTATIONS = new Set([
  'src/components/ui/Input.tsx',
  'src/components/ui/Textarea.tsx',
  'src/components/ui/Checkbox.tsx',
  'src/components/ui/RangeInput.tsx',
])

const BUTTON_VARIANTS = new Set(['primary', 'secondary', 'tertiary', 'destructive'])
const BUTTON_SIZES = new Set(['sm', 'md', 'lg', 'icon'])

// The three primitives where a raw <button> *is* the implementation boundary. Named explicitly
// rather than exempting all of src/components/ui/, so a new shared component cannot quietly
// hand-roll its own button element instead of composing Button.
const RAW_BUTTON_IMPLEMENTATIONS = new Set([
  'src/components/ui/Button.tsx',
  'src/components/ui/InteractiveCard.tsx',
  'src/components/ui/PillSwitch.tsx',
])

// Shared primitives own their own focus treatment: an outline for actions, a border+ring for text
// entry, both keyed to --ring. A call site that cancels it leaves keyboard users relying on the
// `!important` net in index.css, and the several ad-hoc replacement rings this rule replaced had
// drifted to four different colours. Feature code cannot render a focusable control any other way,
// because raw <button>/<input>/<textarea> are already rejected above.
const FOCUS_OWNING_PRIMITIVES = new Set([
  'Button', 'IconButton', 'InteractiveCard', 'Tabs', 'Input', 'Textarea', 'Checkbox',
  'RangeInput', 'CustomSelect', 'DatePicker', 'CurrencySelect', 'SmartAmountInput', 'ToggleButton',
])
const FOCUS_SUPPRESSION = /\b(?:[a-z-]+:)*(?:outline-none|outline-hidden|ring-0)\b/
// Every entry needs a stated reason, and the two kinds are not equivalent.
//
// Composition (permanent): a borderless field composed inside a shell that carries the border and
// focus treatment for the pair. Giving the inner field its own ring would paint two nested
// indicators. `AiAssistantPanel` is the extreme case -- its textarea is deliberately transparent
// and sits over a highlighted mirror, so the field itself has no visible surface at all. This
// pattern is now hand-rolled four times and should become a shared field-in-shell primitive.
//
// Tracked debt (temporary): re-implements the control contract instead of composing it. Listed so
// the rule can hold the line today, and scheduled for the control-contract migration, which will
// move its baselines.
const FOCUS_OVERRIDE_EXCEPTIONS = new Map([
  ['src/components/search/GlobalSearch.tsx', 'composition: field delegates focus styling to its shell'],
  ['src/components/ledger/LedgerFilterBar.tsx', 'composition: field delegates focus styling to its shell'],
  ['src/components/AiAssistantPanel.tsx', 'composition: transparent textarea over a highlighted mirror'],
  ['src/components/settings/ManageableNameList.tsx', 'tracked debt: hand-rolled control styling, pending control-contract migration'],
])

// A <label> forwards its activation to the first *labelable* descendant, and `button` is
// labelable. So a button standing ahead of the real control inside a label silently steals every
// click on the label's whole box -- that is how clicking a slider's name or its percentage badge
// came to toggle the lock button beside it. Allowed only where a labelable control (an input)
// precedes the button, which is the trailing clear-search affordance pattern.
const LABEL_WRAPPED_BUTTON_EXCEPTIONS = new Set([
  'src/components/settings/ManageableNameList.tsx',
])

// Each entry is a literal that this file is allowed to contain despite the theme-colour rule.
// Every occurrence is stripped before the rule runs, so an exception covers a repeated literal
// rather than only its first use.
const THEME_EXCEPTIONS = new Map([
  // The installed-PWA system bars need real hex: they are baked into the WebAPK and cannot read a
  // CSS variable. See INVARIANTS.md DS-07.
  ['src/lib/nativeUi.ts', ['#0b0e14', '#fcfcfc']],
  ['src/components/TwoFactorSection.tsx', ['bg-white']],
  ['src/components/ui/BottomSheet.tsx', ['bg-black/70']],
])

const errors = []
const relative = file => path.relative(ROOT, file).replaceAll('\\', '/')
const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
const report = (file, sourceFile, node, message) => {
  errors.push(`${relative(file)}:${lineOf(sourceFile, node)} ${message}`)
}

function allSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return allSourceFiles(full)
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) return []
    return [full]
  })
}

function jsxTagName(node) {
  const tag = node.tagName
  return ts.isIdentifier(tag) ? tag.text : tag.getText()
}

function attribute(node, name) {
  return node.attributes.properties.find(property =>
    ts.isJsxAttribute(property) && property.name.getText() === name)
}

function stringAttributeValue(node, name) {
  const property = attribute(node, name)
  if (!property || !ts.isJsxAttribute(property) || !property.initializer) return undefined
  return ts.isStringLiteral(property.initializer) ? property.initializer.text : undefined
}

// Overrides are rarely a plain string: most are template literals with a conditional inside. Gather
// every literal chunk of the expression so a class hidden in a ternary branch is still seen.
function classNameLiterals(node) {
  const property = attribute(node, 'className')
  if (!property || !ts.isJsxAttribute(property) || !property.initializer) return ''
  const chunks = []
  const collect = current => {
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)
      || ts.isTemplateHead(current) || ts.isTemplateMiddle(current) || ts.isTemplateTail(current)) {
      chunks.push(current.text)
    }
    ts.forEachChild(current, collect)
  }
  collect(property.initializer)
  return chunks.join(' ')
}

for (const file of allSourceFiles(SRC)) {
  const fileName = relative(file)
  const sourceText = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  // Any unit, not just px: two nav labels sat at text-[0.625rem] (10px) and one at
  // text-[0.6875rem] (11px), under the 12px minimum, because the rule only looked for px.
  if (/text-\[[\d.]+(?:px|rem|em|pt|%)\]/.test(sourceText)) {
    errors.push(`${fileName}:1 Arbitrary typography sizes are not allowed; use a role from the shared type scale.`)
  }

  // The eyebrow label -- the small uppercase caption over a metric, a definition term or a filter
  // group -- had been spelled five ways: bold or semibold, crossed with tracking-wide, wider or
  // normal. `text-eyebrow` carries size, weight and tracking, so the role is one decision.
  const eyebrowByHand = /\bfont-(?:bold|semibold|medium)\s+uppercase\s+tracking-|\buppercase\s+font-(?:bold|semibold|medium)\s+tracking-/
  if (eyebrowByHand.test(sourceText)) {
    errors.push(`${fileName}:1 Compose the eyebrow label with "text-eyebrow uppercase" instead of a size, weight and tracking by hand.`)
  }

  if (fileName !== 'src/lib/breakpoints.ts') {
    if (/\buseIsMobile\b/.test(sourceText)) {
      errors.push(`${fileName}:1 useIsMobile is obsolete; choose useSizeClass, useIsCompact, or useIsExpanded explicitly.`)
    }
    if (/\b(?:window\.)?innerWidth\s*(?:<|>|<=|>=)/.test(sourceText)) {
      errors.push(`${fileName}:1 Raw numeric viewport checks are not allowed; use the shared tier hooks.`)
    }
    if (/matchMedia\([^\n]*(?:min|max)-width/.test(sourceText)) {
      errors.push(`${fileName}:1 Raw width media queries are not allowed in TypeScript; use the shared tier contract.`)
    }
  }

  // The old form of this rule matched one exact spelling of the shell, so reordering the classes or
  // dropping the /92 from bg-card slipped past it -- which is how 39 hand-rolled copies accumulated.
  // Matching the `app-panel` marker itself catches every spelling, and is only possible now that
  // those copies are gone.
  if (fileName !== 'src/components/ui/panelStyles.ts' && /\bapp-panel\b/.test(sourceText)) {
    errors.push(`${fileName}:1 Use Panel, or compose panelClass/panelFromMediumClass from ui/panelStyles, instead of writing the panel shell by hand.`)
  }

  if (/calc\((?:96|160|164|216)px|bottom:\s*['"](?:96|160|164|216)px/.test(sourceText)) {
    errors.push(`${fileName}:1 Use --app-nav-height or --app-fab-offset instead of a hard-coded navigation offset.`)
  }

  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = jsxTagName(node)

      if (tag === 'select') report(file, sourceFile, node, 'Use CustomSelect instead of native <select>.')
      if ((tag === 'input' || tag === 'textarea') && !CONTROL_IMPLEMENTATIONS.has(fileName)) {
        report(file, sourceFile, node, `Use the shared ${tag === 'textarea' ? 'Textarea' : 'Input'} primitive.`)
      }
      if ((tag === 'input' || tag === 'Input') && stringAttributeValue(node, 'type') === 'date') {
        report(file, sourceFile, node, 'Use DatePicker instead of a native date field.')
      }
      if (tag === 'form' && !attribute(node, 'noValidate')) {
        report(file, sourceFile, node, 'Submit forms must use noValidate and application validation.')
      }
      if (tag === 'button' && !RAW_BUTTON_IMPLEMENTATIONS.has(fileName)) {
        report(file, sourceFile, node, 'Use Button, IconButton, or InteractiveCard instead of a raw feature button.')
      }
      if (FOCUS_OWNING_PRIMITIVES.has(tag)
        && !fileName.startsWith('src/components/ui/')
        && !FOCUS_OVERRIDE_EXCEPTIONS.has(fileName)
        && FOCUS_SUPPRESSION.test(classNameLiterals(node))) {
        report(file, sourceFile, node,
          `<${tag}> may not cancel its own focus treatment; remove the outline-none/ring-0 utility and let the primitive supply it.`)
      }

      if (tag === 'Button') {
        const variant = stringAttributeValue(node, 'variant')
        const size = stringAttributeValue(node, 'size')
        if (variant && !BUTTON_VARIANTS.has(variant)) {
          report(file, sourceFile, node, `Unsupported Button variant "${variant}"; use the canonical action hierarchy.`)
        }
        if (size && !BUTTON_SIZES.has(size)) {
          report(file, sourceFile, node, `Unsupported Button size "${size}"; use the shared control scale.`)
        }
      }

      if ((tag === 'button' || tag === 'Button') && !LABEL_WRAPPED_BUTTON_EXCEPTIONS.has(fileName)) {
        for (let parent = node.parent; parent; parent = parent.parent) {
          const isLabelElement = (ts.isJsxElement(parent) && jsxTagName(parent.openingElement) === 'label')
          if (!isLabelElement) continue
          report(file, sourceFile, node,
            'A <button> inside <label> becomes the label\'s activation target, so clicks anywhere in the label toggle it. Use a <div> and give the real control an aria-label.')
          break
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(sourceFile)
      const method = node.expression.name.text
      if ((owner === 'window' || owner === 'globalThis') && ['alert', 'confirm', 'prompt'].includes(method)) {
        report(file, sourceFile, node, `Use the themed dialog system instead of ${owner}.${method}().`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  let themeText = sourceText
  for (const exception of THEME_EXCEPTIONS.get(fileName) ?? []) {
    themeText = themeText.replaceAll(exception, '')
  }
  const literalThemePattern = /\b(?:bg|text|border|shadow|ring|outline|fill|stroke)-(?:black|white)(?:\/\d+)?\b|#[\da-fA-F]{6}(?:[\da-fA-F]{2})?\b|rgba?\s*\(/g
  for (const match of themeText.matchAll(literalThemePattern)) {
    const prefix = themeText.slice(0, match.index)
    const line = prefix.split(/\r?\n/).length
    errors.push(`${fileName}:${line} Unapproved literal theme color "${match[0]}"; use a semantic token.`)
  }

  const unreadablePrimaryTextPattern = /\btext-primary(?!-)\b/g
  for (const match of sourceText.matchAll(unreadablePrimaryTextPattern)) {
    const prefix = sourceText.slice(0, match.index)
    const line = prefix.split(/\r?\n/).length
    errors.push(`${fileName}:${line} Unreadable accent utility "${match[0]}"; use text-accent-ink for text and icons.`)
  }

  const malformedOpacityPattern = /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow)-[^\s'"`]+\/\d+\/\d+\b/g
  for (const match of sourceText.matchAll(malformedOpacityPattern)) {
    const prefix = sourceText.slice(0, match.index)
    const line = prefix.split(/\r?\n/).length
    errors.push(`${fileName}:${line} Malformed theme utility "${match[0]}"; use a single opacity modifier.`)
  }

  const paletteUtilityPattern = new RegExp(`\\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow)-((?:${PALETTE_NAMES})-\\d{2,3})(?:/\\d+)?\\b`, 'g')
  for (const match of sourceText.matchAll(paletteUtilityPattern)) {
    if (THEME_CSS.includes(`--color-${match[1]}:`)) continue
    const prefix = sourceText.slice(0, match.index)
    const line = prefix.split(/\r?\n/).length
    errors.push(`${fileName}:${line} Unmapped palette utility "${match[0]}"; map it to an Ayu theme token in src/index.css.`)
  }

  const ledgerUtilityPattern = /\b(?:bg|text|border|ring|outline|fill|stroke)-ledger-[^\s'"`]+\b/g
  for (const match of sourceText.matchAll(ledgerUtilityPattern)) {
    const prefix = sourceText.slice(0, match.index)
    const line = prefix.split(/\r?\n/).length
    errors.push(`${fileName}:${line} Invalid utility "${match[0]}"; use mapped theme color tokens (e.g. purple-500) instead of raw CSS variable names.`)
  }
}

if (errors.length) {
  console.error(`Design-system audit failed with ${errors.length} issue(s):\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log('Design-system audit passed.')
