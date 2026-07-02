// undefined-identifier gate for all game modules — flat-config (eslint 9),
// covers BOTH plain identifiers (no-undef) and JSX components (jsx-no-undef).
import { ESLint } from 'eslint';
import reactPlugin from 'eslint-plugin-react';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.js'],
    plugins: { react: reactPlugin },
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { require: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', process: 'readonly', Math: 'readonly', JSON: 'readonly', Date: 'readonly', Promise: 'readonly' },
    },
    rules: { 'no-undef': 'error', 'react/jsx-no-undef': 'error' },
  }],
});
const results = await eslint.lintFiles(['games/**/*.js']);
let bad = 0;
for (const r of results) for (const m of r.messages) {
  if (m.ruleId === 'no-undef' || m.ruleId === 'react/jsx-no-undef') {
    bad++; console.error(`${r.filePath.split('/app/')[1]}:${m.line} — ${m.message}`);
  }
}
console.log(bad === 0 ? 'UNDEF GATE PASSED ✔ (identifiers + JSX components, all games)' : `${bad} undefined identifiers ✘`);
process.exit(bad ? 1 : 0);
