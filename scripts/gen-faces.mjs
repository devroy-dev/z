#!/usr/bin/env node
/**
 * gen-faces.mjs — generate callmeZ persona avatars via REPLICATE (FLUX).
 *
 * USAGE (run in your Codespace terminal — NEVER paste the token in chat):
 *   export REPLICATE_API_TOKEN="r8_your_token_here"
 *   node scripts/gen-faces.mjs               # generate all
 *   node scripts/gen-faces.mjs the_cynic     # regenerate one (or several, space-separated)
 *
 * Model: defaults to FLUX 1.1 Pro (great quality). For cheaper/free test runs:
 *   export REPLICATE_MODEL="black-forest-labs/flux-schnell"
 * For top quality (if available on your account):
 *   export REPLICATE_MODEL="black-forest-labs/flux-2-pro"
 *
 * Output: public/faces/<key>.jpg  +  public/faces/manifest.js
 * Cost: ~$0.01–0.04/image on Replicate → ~30c-$1 for all 26. Often covered by free runs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('Set your token first:  export REPLICATE_API_TOKEN="r8_..."'); process.exit(1); }

const MODEL = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-1.1-pro';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'faces');
fs.mkdirSync(OUT, { recursive: true });

// ---- SHARED STYLE: makes all 26 read as ONE coherent cast ----
const STYLE =
  'head and shoulders portrait of a FICTIONAL person (not any real or famous individual), ' +
  'semi-realistic painterly digital portrait, soft cinematic studio lighting, ' +
  'muted desaturated editorial color palette, plain dark charcoal background, ' +
  'calm dignified mood, centered, facing camera, high detail face, ' +
  'no text, no watermark, no logo, single person';

// ---- PER-PERSONA CHARACTER PROMPTS ----
const PERSONAS = {
  the_brainiac:    'a sharp brilliant young academic, wire-rim glasses, curious intense eyes, faint knowing half-smile, slightly messy intellectual hair',
  the_professor:   'a warm seasoned teacher in their 50s, kind eyes behind glasses, gentle encouraging expression',
  the_philosopher: 'a contemplative thinker, weathered thoughtful face, deep-set reflective eyes, short beard, distant searching gaze',
  the_historian:   'a cultured scholar, refined features, glasses, a quiet storyteller smile, vintage scholarly air',
  the_cosmologist: 'a dreamy wonder-struck scientist, eyes full of awe, slightly wild hair, gazing as if at the stars',
  the_economist:   'a precise analytical strategist, crisp composed face, glasses, measured serious expression',
  the_leader_opp:  'a formidable debater, strong jaw, piercing confident stare, faint challenging expression, commanding presence',
  the_wingman:     'a charismatic confident friend, easy roguish smile, stylish, relaxed magnetic charm',
  the_crush:       'a gentle attractive person with soft warm eyes, a shy hopeful smile, natural beauty, tender expression',
  the_hottie:      'a strikingly attractive confident person, sultry knowing half-smile, magnetic bold eyes, effortlessly glamorous',
  the_colleague:   'a friendly capable coworker, approachable professional warmth, neat, easy reassuring smile',
  the_media_manager:'a sharp trendy creative, stylish modern look, quick confident smile, social-media-savvy energy',
  the_orator:      'a commanding public speaker, charismatic strong features, mid-speech passion, inspiring confident gaze',
  the_wannabe:     'a brash flashy hustler, big grin, gold-chain bravado, larger-than-life cocky charm',
  the_healer:      'a deeply calm compassionate presence, soft kind eyes, serene gentle face, quiet healing warmth',
  the_brother:     'a dependable older-brother type, warm grounded face, short beard, easy protective smile, steady eyes',
  the_stranger:    'a quietly trustworthy person, calm steady eyes, gentle non-judgmental expression, understated and warm',
  the_guru:        'a serene enlightened mentor, eyes softly closed in calm, peaceful beard, aura of stillness and wisdom',
  the_mentor:      'an energizing motivating coach, encouraging fired-up expression, strong warm eyes, believe-in-you smile',
  the_addict:      'a person in recovery with hard-won gentle strength, honest weathered face, compassionate understanding eyes',
  the_self_obsessed:'a protective guardian-angel figure, soft reassuring face, tender steady gaze, gently uplifting warmth',
  the_oracle:      'a mysterious knowing seer, half-lidded calm eyes, faint enigmatic smile, otherworldly serene presence',
  the_screen_junkie:'a fun pop-culture-obsessed friend, bright excited eyes, playful grin, casual hoodie energy',
  the_comic:       'a mischievous comedian, wide playful eyes, big infectious grin, expressive animated face',
  the_cynic:       'a dry skeptical wit, one eyebrow raised, knowing smirk, sharp unimpressed but clever eyes',
  the_moderator:   'a fair impartial referee figure, composed neutral face, steady balanced gaze, calm authority',
  the_hippie:      'a serene free-spirited person, long relaxed hair, soft knowing half-smile, peaceful unbothered eyes, gentle bohemian warmth, faint earthy calm',
  the_diva:        'a striking confident fashionable person, impeccable style, sharp arched brow, chic knowing smirk, magnetic editorial glamour, effortlessly current',
  the_cousin:      'a shy gentle person, slightly hunched, soft hesitant eyes looking just away from camera, faint nervous half-smile, endearing awkward warmth',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function gen(key, prompt) {
  // create prediction
  const create = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait' },
    body: JSON.stringify({
      input: {
        prompt: `${prompt}. ${STYLE}`,
        aspect_ratio: '1:1',
        output_format: 'jpg',
        safety_tolerance: 2,
      },
    }),
  });
  if (!create.ok) { console.error(`  ✗ ${key}: ${create.status} ${(await create.text()).slice(0,160)}`); return; }
  let pred = await create.json();
  // poll if not done (Prefer: wait usually returns completed, but be safe)
  let tries = 0;
  while (pred.status !== 'succeeded' && pred.status !== 'failed' && tries < 60) {
    await sleep(1500); tries++;
    pred = await (await fetch(pred.urls.get, { headers: { 'Authorization': `Bearer ${TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') { console.error(`  ✗ ${key}: ${pred.status} ${JSON.stringify(pred.error||'').slice(0,160)}`); return; }
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) { console.error(`  ✗ ${key}: no output url`); return; }
  const img = await (await fetch(url)).arrayBuffer();
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), Buffer.from(img));
  console.log(`  ✓ ${key}.jpg`);
}

const only = process.argv.slice(2);
const keys = only.length ? only : Object.keys(PERSONAS);
console.log(`Generating ${keys.length} face(s) with ${MODEL} → ${OUT}\n`);
for (const k of keys) {
  if (!PERSONAS[k]) { console.error(`  ? unknown persona: ${k}`); continue; }
  await gen(k, PERSONAS[k]);
  await sleep(300); // gentle on the rate limit
}
// write manifest so the frontend auto-detects shipped faces
const have = fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg',''));
fs.writeFileSync(path.join(OUT, 'manifest.js'), 'window.Z_FACE_IMAGES=' + JSON.stringify(have) + ';');
console.log(`\nWrote manifest with ${have.length} faces.`);
console.log('Done. Commit public/faces/ — the app uses them automatically.');
