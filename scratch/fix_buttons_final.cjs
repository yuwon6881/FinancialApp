const fs = require('fs');

function replaceAllButtons(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Add import if missing
  if (!content.includes('import { Button }')) {
    const depth = file.split('/').length - 2;
    let importPath = '../ui/Button';
    if (depth === 0) importPath = './components/ui/Button';
    if (depth === 2 && file.includes('/ui/')) importPath = './Button';
    if (depth === -1) importPath = './components/ui/Button'; // App.tsx, TopNav.tsx
    content = `import { Button } from '${importPath}'\n` + content;
  }

  // Replace all <button with <Button variant="unstyled"
  content = content.replace(/<button\b/g, '<Button variant="unstyled"');
  content = content.replace(/<\/button>/g, '</Button>');
  
  // Make sure to add cursor-pointer to unstyled buttons so they still look clickable if they didn't have it
  content = content.replace(/<Button variant="unstyled"([^>]*?)className="([^"]*?)"/g, '<Button variant="unstyled"$1className="$2 cursor-pointer"');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
}

const files = [
  'src/components/DraftStagingView.tsx',
  'src/components/FailedSyncModal.tsx',
  'src/components/LedgerView.tsx',
  'src/components/ReportsView.tsx',
  'src/components/SettingsView.tsx',
  'src/components/TwoFactorSection.tsx',
  'src/components/WishlistView.tsx',
  'src/components/PasswordPromptModal.tsx',
  'src/components/PendingSubscriptionsModal.tsx',
  'src/components/SecurityQuestionSetup.tsx',
  'src/App.tsx',
  'src/TopNav.tsx'
];

files.forEach(replaceAllButtons);
