const fs = require('fs');
const path = require('path');

function replaceInFile(filepath, replacements) {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  for (const {from, to} of replacements) {
    if (typeof from === 'string') {
      content = content.split(from).join(to);
    } else {
      content = content.replace(from, to);
    }
  }
  if (content !== original) {
    fs.writeFileSync(filepath, content);
    console.log(`Updated ${filepath}`);
  }
}

// 1. Fix Button imports
const filesWithImports = [
  'src/components/ledger/LedgerFilterBar.tsx',
  'src/components/recurring/RecurringFilterBar.tsx',
  'src/components/recurring/ReminderControls.tsx',
  'src/components/settings/ActiveDevicesSection.tsx',
  'src/components/settings/ManageableNameList.tsx'
];
for (const file of filesWithImports) {
  replaceInFile(file, [
    { from: "from '../../ui/Button'", to: "from '../ui/Button'" }
  ]);
}

// 2. Fix duplicate classNames from previous conversions
replaceInFile('src/components/ui/BottomSheet.tsx', [
  { from: 'className="touch-pan-y"\n            className={`sheet-panel', to: 'className={`touch-pan-y sheet-panel' },
  { from: 'className="touch-none"\n              className="pb-3', to: 'className="touch-none pb-3' }
]);

replaceInFile('src/components/ui/SwipeableRow.tsx', [
  { from: 'style={{ touchAction: \'manipulation\', x }}', to: 'style={{ x }}\n        className={cn(\'touch-manipulation relative bg-card\', contentClassName)}' },
  { from: 'className={cn(\'relative bg-card\', contentClassName)}', to: '' },
  { from: 'style={{ x }} className="touch-manipulation"\n        onClick', to: 'style={{ x }}\n        onClick' },
  { from: 'className={cn(\'relative bg-card\', contentClassName)}', to: 'className={cn(\'touch-manipulation relative bg-card\', contentClassName)}' }
]);

// Let's do this carefully: Just re-read SwipeableRow.tsx and replace the native stuff.
let sr = fs.readFileSync('src/components/ui/SwipeableRow.tsx', 'utf8');
sr = sr.replace(/style=\{\{ touchAction: 'manipulation', x \}\}/g, 'style={{ x }}');
sr = sr.replace(/className=\{cn\('relative bg-card', contentClassName\)\}/g, 'className={cn(\'touch-manipulation relative bg-card\', contentClassName)}');
fs.writeFileSync('src/components/ui/SwipeableRow.tsx', sr);

// 3. Button replacements
// Here we replace native <button> with <Button> across the rest of the application
const replacements = [
  {
    file: 'src/components/DraftStagingView.tsx',
    changes: [
      { from: '<button\n            onClick={onCancel}', to: '<Button variant="ghost" size="icon"\n            onClick={onCancel}' },
      { from: '            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground cursor-pointer transition select-none"\n            title="Go back"', to: '            className="text-muted-foreground hover:text-foreground"\n            title="Go back"' },
      { from: '<button\n                    type="button"\n                    onMouseDown', to: '<Button variant="outline" size="xs"\n                    type="button"\n                    onMouseDown' },
      { from: 'className="absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"\n                    >', to: 'className="absolute right-0 top-0 z-10 h-6 px-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"\n                    >' },
      { from: '<button\n                            key={s.note}', to: '<Button variant="ghost"\n                            key={s.note}' },
      { from: 'className="w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer transition duration-100 hover:bg-blue-500/10 first:rounded-t-xl last:rounded-b-xl"\n                          >', to: 'className="w-full justify-start h-auto px-3 py-2 flex-col items-start gap-0.5 hover:bg-blue-500/10 rounded-none first:rounded-t-xl last:rounded-b-xl"\n                          >' },
      { from: '<button\n                    onClick={() => handleStartEdit(draft)}', to: '<Button variant="unstyled"\n                    onClick={() => handleStartEdit(draft)}' },
      { from: '<button\n                    onClick={() => { if (!hideSensitive) onDeleteDraftTransaction(draft.id) }}', to: '<Button variant="unstyled"\n                    onClick={() => { if (!hideSensitive) onDeleteDraftTransaction(draft.id) }}' },
      { from: '</button>', to: '</Button>' } // Naive, but might work if we just replace all </button>
    ]
  },
  {
    file: 'src/components/FailedSyncModal.tsx',
    changes: [
      { from: '<button\n            onClick={onClose}', to: '<Button variant="ghost" size="icon"\n            onClick={onClose}' },
      { from: '            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition"\n          >', to: '            className="text-muted-foreground"\n          >' },
      { from: '<button\n            onClick={handleRetry}', to: '<Button\n            onClick={handleRetry}' },
      { from: '            className="w-full sm:w-auto rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"\n          >', to: '            className="w-full sm:w-auto px-6 py-2.5"\n          >' },
      { from: '<button\n              onClick={() => setDetailsOpen(o => !o)}', to: '<Button variant="ghost"\n              onClick={() => setDetailsOpen(o => !o)}' },
      { from: '              className="mt-4 flex w-full items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm font-semibold transition hover:bg-muted/60"\n            >', to: '              className="mt-4 w-full justify-between bg-muted/40 px-4 py-3 hover:bg-muted/60"\n            >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/LedgerView.tsx',
    changes: [
      { from: '<button\n            onClick={handleBatchDelete}', to: '<Button variant="danger" size="sm"\n            onClick={handleBatchDelete}' },
      { from: '            className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/20"\n          >', to: '            className="gap-2"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/ReportsView.tsx',
    changes: [
      { from: '<button\n              onClick={() => onNavigate(\'dashboard\')}', to: '<Button variant="ghost"\n              onClick={() => onNavigate(\'dashboard\')}' },
      { from: '              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90"\n            >', to: '              className="mt-6"\n            >' },
      { from: '<button\n      onClick={onClick}', to: '<Button variant="ghost"\n      onClick={onClick}' },
      { from: '      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"\n    >', to: '      className="mt-4 border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n    >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/SettingsView.tsx',
    changes: [
      { from: '<button\n          onClick={() => onNavigate(\'dashboard\')}', to: '<Button variant="ghost" size="icon"\n          onClick={() => onNavigate(\'dashboard\')}' },
      { from: '          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"\n          aria-label="Back to Today"\n        >', to: '          aria-label="Back to Today"\n        >' },
      { from: '<button type="button" onClick={() => view.toggleLock(key)} className="p-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer" title={view.lockedAllocations.includes(key) ? \'Unlock\' : \'Lock\'}>', to: '<Button variant="ghost" size="icon" type="button" onClick={() => view.toggleLock(key)} className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted" title={view.lockedAllocations.includes(key) ? \'Unlock\' : \'Lock\'}>' },
      { from: '<button\n                onClick={() => handleExport(\'json\')}', to: '<Button variant="outline"\n                onClick={() => handleExport(\'json\')}' },
      { from: '                className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold hover:bg-muted/50"\n              >', to: '                className="gap-2"\n              >' },
      { from: '<button\n                onClick={() => handleExport(\'csv\')}', to: '<Button variant="outline"\n                onClick={() => handleExport(\'csv\')}' },
      { from: '<button\n                      onClick={() => void document.getElementById(\'import-file-upload\')?.click()}', to: '<Button variant="outline"\n                      onClick={() => void document.getElementById(\'import-file-upload\')?.click()}' },
      { from: '                      className="flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold hover:bg-muted/50"\n                    >', to: '                      className="gap-2"\n                    >' },
      { from: '<button\n                                    onClick={() => handleResetAll()}', to: '<Button variant="danger"\n                                    onClick={() => handleResetAll()}' },
      { from: '                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/20 active:scale-[0.98]"\n                                  >', to: '                                    className="w-full gap-2"\n                                  >' },
      { from: '<button\n                                  onClick={() => handleSignOut()}', to: '<Button variant="outline"\n                                  onClick={() => handleSignOut()}' },
      { from: '                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-bold text-foreground hover:bg-muted/60 active:scale-[0.98]"\n                                >', to: '                                  className="w-full gap-2 bg-muted/30 hover:bg-muted/60"\n                                >' },
      { from: '<button\n                                onClick={() => setHasAcknowledgedResetWarning(true)}', to: '<Button variant="danger"\n                                onClick={() => setHasAcknowledgedResetWarning(true)}' },
      { from: '                                className="w-full rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90"\n                              >', to: '                                className="w-full"\n                              >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/TwoFactorSection.tsx',
    changes: [
      { from: '<button\n            onClick={() => setVerifyOpen(false)}', to: '<Button variant="ghost" size="icon"\n            onClick={() => setVerifyOpen(false)}' },
      { from: '            className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition"\n          >', to: '            className="text-muted-foreground"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/App.tsx',
    changes: [
      { from: '<button\n            onClick={() => window.location.reload()}', to: '<Button\n            onClick={() => window.location.reload()}' },
      { from: '            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"\n          >', to: '            className="px-6 py-2.5"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/TopNav.tsx',
    changes: [
      { from: '<button\n            onClick={onShowSettings}', to: '<Button variant="ghost" size="icon"\n            onClick={onShowSettings}' },
      { from: '            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground active:scale-95"\n            aria-label="Settings"\n          >', to: '            className="relative text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n            aria-label="Settings"\n          >' },
      { from: '<button\n            onClick={onSwitchAccount}', to: '<Button variant="ghost" size="icon"\n            onClick={onSwitchAccount}' },
      { from: '            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground active:scale-95"\n            aria-label="Switch profile"\n          >', to: '            className="relative text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n            aria-label="Switch profile"\n          >' },
      { from: '<button\n                onClick={onSwitchAccount}', to: '<Button variant="ghost"\n                onClick={onSwitchAccount}' },
      { from: '                className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"\n              >', to: '                className="gap-2 border-border/40 bg-muted/30 text-[10px] hover:bg-muted"\n              >' },
      { from: '<button\n          onClick={() => setDesktopNavOpen(!desktopNavOpen)}', to: '<Button variant="ghost" size="icon"\n          onClick={() => setDesktopNavOpen(!desktopNavOpen)}' },
      { from: '          className="hidden xl:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground active:scale-95"\n          aria-label={desktopNavOpen ? "Collapse menu" : "Expand menu"}\n        >', to: '          className="hidden xl:flex shrink-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n          aria-label={desktopNavOpen ? "Collapse menu" : "Expand menu"}\n        >' },
      { from: '<button\n          onClick={() => window.location.reload()}', to: '<Button variant="ghost" size="icon"\n          onClick={() => window.location.reload()}' },
      { from: '          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground active:scale-95"\n          aria-label="Refresh app"\n          title="Refresh app"\n        >', to: '          className="shrink-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n          aria-label="Refresh app"\n          title="Refresh app"\n        >' },
      { from: '<button\n            onClick={() => onNavigate(\'add\')}', to: '<Button\n            onClick={() => onNavigate(\'add\')}' },
      { from: '            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"\n          >', to: '            className="gap-2 shadow-sm"\n          >' },
      { from: '<button\n                  onClick={() => {\n                    if (item.disabled) return;\n                    onNavigate(item.id);\n                  }}', to: '<Button variant="ghost"\n                  onClick={() => {\n                    if (item.disabled) return;\n                    onNavigate(item.id);\n                  }}' },
      { from: '                  disabled={item.disabled}\n                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 outline-none\n                    ${active\n                      ? \'bg-primary/10 text-primary font-bold\'\n                      : \'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-semibold\'\n                    }\n                    ${item.disabled ? \'opacity-50 cursor-not-allowed\' : \'cursor-pointer active:scale-[0.98]\'}\n                  `}\n                >', to: '                  disabled={item.disabled}\n                  className={`group relative flex w-full justify-start items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 outline-none ${active ? \'bg-primary/10 text-primary font-bold\' : \'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-semibold\'}`}\n                >' },
      { from: '<button\n            onClick={() => onNavigate(\'add\')}', to: '<Button variant="unstyled"\n            onClick={() => onNavigate(\'add\')}' },
      { from: '            className="absolute -top-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"\n            aria-label="Add transaction"\n          >', to: '            className="absolute -top-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"\n            aria-label="Add transaction"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/WishlistView.tsx',
    changes: [
      { from: '</button>', to: '</Button>' },
      { from: '<button\n              onClick={() => onNavigate(\'dashboard\')}', to: '<Button variant="ghost" size="icon"\n              onClick={() => onNavigate(\'dashboard\')}' },
      { from: '              className="mt-0.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"\n              aria-label="Back to Today"\n            >', to: '              aria-label="Back to Today"\n            >' }
    ]
  }
];

for (const rep of replacements) {
  let content = fs.readFileSync(rep.file, 'utf8');
  let original = content;
  // First make sure Button is imported if not present
  if (!content.includes("from './ui/Button'") && !content.includes("from '../ui/Button'") && !content.includes("from '../../ui/Button'")) {
    // figure out depth
    const depth = rep.file.split('/').length - 2; // src/App.tsx -> 1-2 = -1 (wait, src is 0, App is 1)
    let importPath = './components/ui/Button'; // for App.tsx, TopNav.tsx
    if (rep.file.startsWith('src/components/')) {
      importPath = './ui/Button';
    }
    // inject at top after react
    content = `import { Button } from '${importPath}'\n` + content;
  }

  for (const {from, to} of rep.changes) {
    if (typeof from === 'string') {
      content = content.split(from).join(to);
    } else {
      content = content.replace(from, to);
    }
  }
  if (content !== original) {
    fs.writeFileSync(rep.file, content);
    console.log(`Updated ${rep.file}`);
  }
}
