import fs from 'fs';
import path from 'path';

const searchDir = 'c:/Users/User/App/FinancialApp/src';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(searchDir);

const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for hardcoded large widths or min-widths
    const widthMatch = line.match(/(w-\[\d{3,}px\]|min-w-\[\d{3,}px\])/g);
    if (widthMatch) {
      issues.push({ file, lineNum, type: 'Hardcoded Large Width', match: widthMatch.join(', ') });
    }

    // Check for grid with 3+ cols without md: responsive
    const gridMatch = line.match(/grid-cols-[3-9]/g);
    if (gridMatch && !line.includes('md:grid-cols-')) {
      issues.push({ file, lineNum, type: 'Grid without md: variant', match: gridMatch.join(', ') });
    }

    // Check for lg: display changes without md: display changes
    // e.g. hidden lg:block or flex lg:flex-row
    const lgMatch = line.match(/lg:(block|flex|grid|hidden|w-)/g);
    if (lgMatch && !line.includes('md:')) {
      issues.push({ file, lineNum, type: 'lg: variant without md: variant (potential jump)', match: lgMatch.join(', ') });
    }
    
    // Look for <table without overflow wrapper
    if (line.includes('<table')) {
      // Very naive check: does the file have overflow-x-auto?
      if (!content.includes('overflow-x-auto')) {
        issues.push({ file, lineNum, type: 'Table potentially without horizontal scrolling', match: '<table' });
      }
    }
  });
});

fs.writeFileSync('c:/Users/User/App/FinancialApp/scratch/issues_clean.json', JSON.stringify(issues, null, 2));
