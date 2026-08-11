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

// Existing composite controls are an explicit migration baseline. Counts may go
// down as composites adopt Button, but may never increase and new files cannot
// introduce raw action buttons.
const RAW_BUTTON_BASELINE = {
  'src/TopNav.tsx': 8,
  'src/App.tsx': 1,
  'src/components/AiAssistantPanel.tsx': 5,
  'src/components/BillTimeline.tsx': 5,
  'src/components/CycleSummaryModal.tsx': 2,
  'src/components/DashboardView.tsx': 5,
  'src/components/DocumentsView.tsx': 6,
  'src/components/dashboard/CarryoverLedgerTable.tsx': 1,
  'src/components/DraftStagingView.tsx': 8,
  'src/components/documents/DocumentUploadSheet.tsx': 4,
  'src/components/dashboard/CategoryLimitPerformance.tsx': 2,
  'src/components/FailedSyncModal.tsx': 3,
  'src/components/dashboard/DashboardHeader.tsx': 1,
  'src/components/dashboard/TrendLineChart.tsx': 1,
  'src/components/dashboard/SubscriptionsTimelineCard.tsx': 1,
  'src/components/documents/view/DocumentList.tsx': 0,
  'src/components/investments/InvestmentPlanPanel.tsx': 2,
  'src/components/LedgerView.tsx': 1,
  'src/components/InvestmentsView.tsx': 7,
  'src/components/ledger/LedgerExportModal.tsx': 3,
  'src/components/ledger/LedgerFilterBar.tsx': 9,
  'src/components/ledger/LedgerPagination.tsx': 5,
  'src/components/ledger/LedgerRows.tsx': 2,
  'src/components/ledger/LedgerDeleteModals.tsx': 3,
  'src/components/ledger/ReceiptSplitSheet.tsx': 7,
  'src/components/ledger/view/LedgerToolbar.tsx': 1,
  'src/components/dashboard/DoughnutChart.tsx': 1,
  'src/components/ledger/transaction-form/ReceiptScanPicker.tsx': 8,
  'src/components/PendingSubscriptionsModal.tsx': 4,
  'src/components/ledger/transaction-form/ReceiptScanStatus.tsx': 2,
  'src/components/ledger/transaction-form/TransactionDocumentsField.tsx': 4,
  'src/components/ledger/transaction-form/TransactionFormFields.tsx': 3,
  'src/components/ledger/transaction-form/TransactionTypeFields.tsx': 3,
  'src/components/recurring/RecurringFilterBar.tsx': 3,
  'src/components/recurring/ReminderControls.tsx': 4,
  'src/components/SettingsView.tsx': 8,
  'src/components/ReportsView.tsx': 2,
  'src/components/settings/ActiveDevicesSection.tsx': 3,
  'src/components/WishlistView.tsx': 6,
  'src/components/settings/InvestmentPlanSection.tsx': 3,
  'src/components/settings/FingerprintSection.tsx': 1,
  'src/components/settings/ManageableNameList.tsx': 3,
}

const THEME_EXCEPTIONS = new Map([
  ['src/App.tsx', ['#0b0e14', '#fcfcfc']],
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
  let rawButtonCount = 0

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
      if (tag === 'button') rawButtonCount += 1
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

  if (!fileName.startsWith('src/components/ui/')) {
    const maximum = RAW_BUTTON_BASELINE[fileName] ?? 0
    if (rawButtonCount > maximum) {
      errors.push(`${fileName}:1 Raw action buttons increased from ${maximum} to ${rawButtonCount}; use Button or an approved composite.`)
    }
  }

  let themeText = sourceText
  for (const exception of THEME_EXCEPTIONS.get(fileName) ?? []) {
    themeText = themeText.replace(exception, '')
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
}

if (errors.length) {
  console.error(`Design-system audit failed with ${errors.length} issue(s):\n${errors.map(error => `- ${error}`).join('\n')}`)
  process.exit(1)
}

console.log('Design-system audit passed.')
