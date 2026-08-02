const fs = require('fs');

const file = 'c:/Users/User/App/FinancialApp/src/components/InvestmentsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file might be corrupted at the top, let's just replace all the imports up to `import type { AppTab`
const importEndIndex = content.indexOf('import type {\n  AppTab,');

if (importEndIndex > -1) {
  const newImports = `import { Input } from './ui/Input'
import React, { useEffect, useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  CloudOff,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
`;

  content = newImports + content.substring(importEndIndex);
  fs.writeFileSync(file, content);
  console.log("Fixed imports!");
} else {
  console.log("Could not find the target to replace");
}
