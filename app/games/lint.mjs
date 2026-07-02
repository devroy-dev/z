// no-undef gate for all game modules — catches the bug class Metro bundling misses
import { ESLint } from 'eslint';
const eslint = new ESLint({ useEslintrc: false, overrideConfig: {
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  env: { es2021: true, browser: true, node: true },
  rules: { 'no-undef': 'error' },
}});
const results = await eslint.lintFiles(['games/**/*.js']);
let bad = 0;
for (const r of results) for (const m of r.messages) {
  if (m.ruleId === 'no-undef') { bad++; console.error(`${r.filePath.split('/app/')[1]}:${m.line} — ${m.message}`); }
}
console.log(bad === 0 ? 'NO-UNDEF GATE PASSED ✔' : `${bad} undefined identifiers ✘`);
process.exit(bad ? 1 : 0);
