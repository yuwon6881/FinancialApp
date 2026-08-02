const fs = require('fs');

const replacements = [
  {
    file: 'src/components/TwoFactorSection.tsx',
    changes: [
      { from: '<button\n            onClick={() => setVerifyOpen(false)}', to: '<Button variant="ghost" size="icon"\n            onClick={() => setVerifyOpen(false)}' },
      { from: '            className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition"\n          >', to: '            className="text-muted-foreground"\n          >' },
      { from: '<button\n                  onClick={() => setRecoveryCodesOpen(false)}', to: '<Button variant="ghost" size="icon"\n                  onClick={() => setRecoveryCodesOpen(false)}' },
      { from: '                  className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition"\n                >', to: '                  className="text-muted-foreground"\n                >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/WishlistView.tsx',
    changes: [
      { from: '<button\n              onClick={() => onNavigate(\'dashboard\')}', to: '<Button variant="ghost" size="icon"\n              onClick={() => onNavigate(\'dashboard\')}' },
      { from: '              className="mt-0.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"\n              aria-label="Back to Today"\n            >', to: '              aria-label="Back to Today"\n            >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/PasswordPromptModal.tsx',
    changes: [
      { from: '<button\n            onClick={onCancel}', to: '<Button variant="ghost" size="icon"\n            onClick={onCancel}' },
      { from: '            className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition"\n          >', to: '            className="text-muted-foreground"\n          >' },
      { from: '<button\n            type="submit"', to: '<Button\n            type="submit"' },
      { from: '            className="w-full sm:w-auto rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"\n          >', to: '            className="w-full sm:w-auto px-6 py-2.5"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/PendingSubscriptionsModal.tsx',
    changes: [
      { from: '<button\n            onClick={onClose}', to: '<Button variant="ghost" size="icon"\n            onClick={onClose}' },
      { from: '            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition"\n          >', to: '            className="text-muted-foreground"\n          >' },
      { from: '<button\n                  onClick={() => confirmItem(item)}', to: '<Button\n                  onClick={() => confirmItem(item)}' },
      { from: '                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"\n                >', to: '                  className="px-4 py-2 text-xs font-bold"\n                >' },
      { from: '<button\n                  onClick={() => dismissItem(item.id)}', to: '<Button variant="ghost"\n                  onClick={() => dismissItem(item.id)}' },
      { from: '                  className="rounded-xl bg-muted px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted/80 disabled:opacity-50"\n                >', to: '                  className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80"\n                >' },
      { from: '<button\n            onClick={onClose}', to: '<Button variant="outline"\n            onClick={onClose}' },
      { from: '            className="w-full rounded-xl border border-border/60 bg-card px-6 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted"\n          >', to: '            className="w-full px-6 py-2.5"\n          >' },
      { from: '</button>', to: '</Button>' }
    ]
  },
  {
    file: 'src/components/SecurityQuestionSetup.tsx',
    changes: [
      { from: '<button\n          onClick={() => void document.getElementById(\'security-questions\')?.scrollIntoView({ behavior: \'smooth\' })}', to: '<Button variant="ghost" size="icon"\n          onClick={() => void document.getElementById(\'security-questions\')?.scrollIntoView({ behavior: \'smooth\' })}' },
      { from: '          className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"\n          title="Close details"\n        >', to: '          className="absolute right-4 top-4 hover:bg-muted/50 hover:text-foreground"\n          title="Close details"\n        >' },
      { from: '</button>', to: '</Button>' }
    ]
  }
];

for (const rep of replacements) {
  if (fs.existsSync(rep.file)) {
    let content = fs.readFileSync(rep.file, 'utf8');
    let original = content;
    // ensure Button import
    if (!content.includes("from './ui/Button'") && !content.includes("from '../ui/Button'") && !content.includes("from '../../ui/Button'")) {
      const depth = rep.file.split('/').length - 2;
      let importPath = '../ui/Button';
      if (depth === 0) importPath = './components/ui/Button';
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
}
