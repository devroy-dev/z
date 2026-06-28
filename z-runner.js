#!/usr/bin/env node
/**
 * z-runner.js — talk to raw Z in your terminal.
 *
 * The bare soul, nothing else. Single Haiku agent, the soul as a CACHED system
 * prompt (so you feel the real cost model — the soul is cached after the first
 * turn, you pay full tokens once then cache-read rate after). No Codexes, no
 * memory, no tools. Just the voice, so you can hear whether Z lands.
 *
 * SETUP (one time):
 *   npm init -y
 *   npm install @anthropic-ai/sdk
 *   export ANTHROPIC_API_KEY=sk-ant-...        (or put it in a .env you DON'T commit)
 *   place Z_SOUL.md next to this file
 *
 * RUN:
 *   node z-runner.js
 *
 * Type to talk. Ctrl+C to quit. /reset clears the conversation and starts fresh.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Anthropic = require('@anthropic-ai/sdk');

// ── config ────────────────────────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5-20251001';   // the agent Z actually runs on
const MAX_TOKENS = 1024;
const SOUL_PATH = path.join(__dirname, 'Z_SOUL.md');

// ── load the soul ───────────────────────────────────────────────────────────
let soul;
try {
  soul = fs.readFileSync(SOUL_PATH, 'utf8');
} catch (e) {
  console.error(`\n  Couldn't read the soul at ${SOUL_PATH}`);
  console.error(`  Put Z_SOUL.md next to this script and try again.\n`);
  process.exit(1);
}

// Strip the HTML build-comment from the top — that's notes for us, not for Z.
// Z should wake up as the character, not read its own architecture doc.
soul = soul.replace(/<!--[\s\S]*?-->/g, '').trim();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n  Set ANTHROPIC_API_KEY first:  export ANTHROPIC_API_KEY=sk-ant-...\n');
  process.exit(1);
}

const client = new Anthropic();   // reads ANTHROPIC_API_KEY from env

// The soul as a CACHED system block. cache_control marks it reusable, so after
// turn one you pay the cache-read rate on the soul instead of full input price.
const system = [
  { type: 'text', text: soul, cache_control: { type: 'ephemeral' } },
];

// ── conversation state (in memory only — dies when you quit) ────────────────
let messages = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt() {
  rl.question('\x1b[36myou ›\x1b[0m ', handle);
}

async function handle(line) {
  const text = line.trim();

  if (text === '') return prompt();
  if (text === '/reset') {
    messages = [];
    console.log('\x1b[90m  — fresh start —\x1b[0m');
    return prompt();
  }
  if (text === '/exit' || text === '/quit') {
    rl.close();
    return;
  }

  messages.push({ role: 'user', content: text });

  try {
    process.stdout.write('\x1b[35mz   ›\x1b[0m ');

    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    let full = '';
    stream.on('text', (delta) => {
      full += delta;
      process.stdout.write(delta);
    });

    const final = await stream.finalMessage();
    messages.push({ role: 'assistant', content: full });

    // show the cost signal so you watch caching work in real time
    const u = final.usage || {};
    const cacheRead = u.cache_read_input_tokens || 0;
    const cacheWrite = u.cache_creation_input_tokens || 0;
    const inp = u.input_tokens || 0;
    const out = u.output_tokens || 0;
    console.log(
      `\n\x1b[90m  [in ${inp} · cache-write ${cacheWrite} · cache-read ${cacheRead} · out ${out}]\x1b[0m`
    );
  } catch (err) {
    console.error(`\n\x1b[31m  error: ${err.message}\x1b[0m`);
    messages.pop(); // drop the user turn that failed so state stays clean
  }

  prompt();
}

console.log('\x1b[90m─────────────────────────────────────────────\x1b[0m');
console.log('  talking to raw Z (Haiku, soul only, no memory)');
console.log('  /reset to start over · /exit to quit');
console.log('\x1b[90m─────────────────────────────────────────────\x1b[0m');
prompt();
