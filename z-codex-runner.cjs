#!/usr/bin/env node
/**
 * z-codex-runner.js — talk to Z (soul + ONE codex) in your terminal.
 *
 * This loads the CURRENT soul and one codex of your choice, exactly the way the
 * engine builds the cached static prefix, so you feel the RE-AUTHORED voice:
 * reason-don't-obey, owns it, reacts instead of interrogating.
 *
 * SETUP (you already have the sdk from before):
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   place Z_SOUL.md and the codex-*.md files next to this file (or in ./content)
 *
 * RUN — pick a persona by its codex:
 *   node z-codex-runner.js shadow      (Detox Doc — addiction)
 *   node z-codex-runner.js inner       (Mr. Anxiety — the heavy days)
 *   node z-codex-runner.js people      (Love Sucks / Close Cousin / Workplace)
 *   node z-codex-runner.js intellect   (The Devil's Advocate — debate)
 *   node z-codex-runner.js forward      (Mr. Confident — growth)
 *   node z-codex-runner.js close        (Wingman / Flame)
 *
 * Type to talk. Ctrl+C quits. /reset starts fresh.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

// find content dir (next to file, or ./content)
function findFile(name) {
  const candidates = [path.join(__dirname, name), path.join(__dirname, 'content', name)];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`can't find ${name} (looked next to the runner and in ./content)`);
}

const codexKey = (process.argv[2] || 'shadow').toLowerCase();
const CODEX_FILE = `codex-${codexKey}.md`;

const stripComment = (s) => s.replace(/<!--[\s\S]*?-->/g, '').trim();
const soul = stripComment(fs.readFileSync(findFile('Z_SOUL.md'), 'utf8'))
  .replaceAll('[companion_name]', 'you')
  .replaceAll('[companion_gender]', 'neither');

let codex;
try { codex = fs.readFileSync(findFile(CODEX_FILE), 'utf8'); }
catch (e) { console.error(`\n  No codex "${codexKey}". Try: shadow | inner | people | intellect | forward | close\n`); process.exit(1); }

// build the cached prefix exactly like the engine
const SYSTEM = soul +
  `\n\n[YOUR PREPARATION — what you already know, cold, before they came to you. ` +
  `It is yours; you speak from it as your own knowledge and you never name it, ` +
  `never point to it, never call it a reference. There is only you and what you know.]\n` +
  codex + '\n' +
  `\n\n[Today is ${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.]`;

const anthropic = new Anthropic();
const messages = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\x1b[36myou › \x1b[0m' });
console.log(`\n\x1b[2m── Z · codex: ${codexKey} · model: ${MODEL} ──\x1b[0m`);
console.log(`\x1b[2m   type to talk · /reset to clear · Ctrl+C to quit\x1b[0m\n`);
rl.prompt();

rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) { rl.prompt(); return; }
  if (text === '/reset') { messages.length = 0; console.log('\x1b[2m  (cleared)\x1b[0m\n'); rl.prompt(); return; }

  messages.push({ role: 'user', content: text });
  process.stdout.write('\x1b[35mZ › \x1b[0m');
  try {
    const stream = anthropic.messages.stream({
      model: MODEL, max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    let full = '';
    stream.on('text', (d) => { process.stdout.write(d); full += d; });
    const fin = await stream.finalMessage();
    messages.push({ role: 'assistant', content: full });
    const u = fin.usage || {};
    process.stdout.write(`\n\x1b[2m   [in ${u.input_tokens||0} · cached ${u.cache_read_input_tokens||0} · out ${u.output_tokens||0}]\x1b[0m\n\n`);
  } catch (e) {
    console.log(`\n\x1b[31m  error: ${e.message}\x1b[0m\n`);
  }
  rl.prompt();
});
rl.on('close', () => { console.log('\n\x1b[2m  later.\x1b[0m\n'); process.exit(0); });
