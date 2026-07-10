// ════════════════════════════════════════════════════════════════════════
//  gen_roster_fallback.mjs — regenerates the bundled snapshot inside
//  app/roster.js from the BUILT server manifest. The snapshot is never
//  hand-synced again: edit personas.ts → bump ROSTER_VERSION → npm run
//  build → node scripts/gen_roster_fallback.mjs → gate → ship.
//  Run from repo root, AFTER npm run build (it imports dist/manifest.js).
// ════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'fs';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy';

const { rosterManifest } = await import('../dist/manifest.js');
const m = rosterManifest();

const START = '// ── ROSTER_FALLBACK_START (machine-written — run scripts/gen_roster_fallback.mjs, never edit by hand) ──';
const END = '// ── ROSTER_FALLBACK_END ──';

const p = new URL('../app/roster.js', import.meta.url).pathname;
const s = readFileSync(p, 'utf8');
const i = s.indexOf(START), j = s.indexOf(END);
if (i < 0 || j < 0) { console.error('ABORT: fallback anchors not found in app/roster.js'); process.exit(1); }

const body = START + '\nconst FALLBACK = ' + JSON.stringify(m, null, 0) + ';\n' + END;
writeFileSync(p, s.slice(0, i) + body + s.slice(j + END.length));
console.log(`app/roster.js fallback regenerated — version ${m.version}, ${m.personas.length} personas, ${m.groups.length} groups.`);
