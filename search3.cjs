const fs = require('fs');
const path = require('path');

function search(dir, pattern) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) continue;
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(search(filePath, pattern));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (pattern.test(content)) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            results.push(`${filePath}:${index + 1}:${line.trim()}`);
          }
        });
      }
    }
  }
  return results;
}

const res = search('c:/Users/User/App/FinancialApp/src/components', /api\.[a-zA-Z]+\(|useOutbox/);
console.log(res.join('\n'));
