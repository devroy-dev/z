// loop.ts — the Z turn. One Haiku agent. Forked from the consult path:
//   STATIC (cached): soul (with [companion_name] injected) + the thread's Codex(es).
//                    Identical every turn → cache_control:ephemeral, ~10% cost on reads.
//   DYNAMIC (uncached): today's date + the shared memory block. Changes per turn.
// No Donna, no two-agent rig. The Codex IS the preparation; Z names it to no one.
import Anthropic from '@anthropic-ai/sdk';
import { llm, pinnedProvider, scrubProviderMarkup } from './llm.js';   // [zip54g]
import { supabase } from './db.js';
import { getCustomPersona, RETIRED_CODEX, CUSTOM_SEATBELT } from './customPersonas.js';
import { buildCustomPrefix } from './content.js';
import { buildStaticPrefix, readContentFile } from './content.js';
import { retrievePrep, analogyBank as gmAnalogyBank } from './grandMaster.js';
import { readMemoryBlock, harvestMemory } from './memory.js';
import { personaByKey, type CodexKey } from './personas.js';
import { stateBlockFor, currentStates } from './personaStates.js';
import { manifestBlock } from './manifest.js';
import { executeConciergeTags, parseWhen } from './concierge.js';

// Use Node's native fetch (undici) instead of the SDK's default node-fetch@2, which
// premature-closes streaming responses on Node 22 (this engine pins Node 22 for supabase
// realtime). The SDK reads native fetch's web ReadableStream body fine.
const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

export interface ZTurnInput {
  userId: string;
  threadId: string;
  message: string;
  image?: { media_type: string; data: string } | null;
  onToken?: (t: string) => void;   // streaming sink (SSE/websocket); inert if absent
}

export interface ZTurnResult {
  reply: string;
  usage: { in: number; out: number; cacheRead: number; cacheWrite: number };
  sources?: { url: string; title: string }[];
  routes?: string[];
}

interface ThreadRow {
  id: string; user_id: string; persona_key: string; codex_key: string;
  companion_name: string; companion_gender: string | null; game_mode?: string | null;
}

export async function runZTurn(input: ZTurnInput): Promise<ZTurnResult> {
  const { userId, threadId, message } = input;

  // load the thread (the persona instance)
  const { data: thread } = await supabase
    .from('threads')
    .select('id, user_id, persona_key, codex_key, companion_name, companion_gender, game_mode')
    .eq('id', threadId).eq('user_id', userId).is('deleted_at', null)
    .maybeSingle();
  if (!thread) throw new Error('thread not found');
  const t = thread as ThreadRow;

  const persona = personaByKey(t.persona_key);
  // Resolve the codex from the PERSONA (source of truth), not the thread's stored
  // codex_key — which is frozen at creation time and goes stale when a persona is
  // recharacterized. Fall back to the stored key only if the persona has none.
  const codexKeys: CodexKey[] = [((persona?.codex as CodexKey) || (t.codex_key as CodexKey))];
  // [zip04] the institutional class: no memory dump, no diary, slim owner line,
  // professional register (see content.ts INSTITUTIONAL for the assembly side).
  const institutional = ['the_anchor', 'the_grandmaster', 'the_coach', 'the_moderator', 'the_interviewer', 'the_media_manager'].includes(String(t.persona_key || ''));   // [zip26] [zip54c] the advisor's desk, register side

  // ── CUSTOM PERSONAS: codex lives in the DB, scoped to its owner; the house
  // seatbelt rides AFTER the creator's text so it always wins. Missing or
  // blocked → the retired line (in-fiction kill switch). Customs never get web
  // (persona is null here, so the webEnabled gates below stay closed for free).
  let customPrefix: string | null = null;
  if (!persona && String(t.persona_key || '').startsWith('custom_')) {
    const c = await getCustomPersona(t.persona_key, t.user_id);
    const codexRaw = c && c.status === 'live' ? c.codex : RETIRED_CODEX;
    customPrefix = buildCustomPrefix(t.companion_name, t.companion_gender, codexRaw, CUSTOM_SEATBELT);
  }

  // ── STATIC (cached): soul + name + Codex ──────────────────────────────
  let staticPrefix = customPrefix ?? buildStaticPrefix(t.companion_name, t.companion_gender, codexKeys, (thread as any).region ?? null);

  // THE GRAND MASTER: his analogy bank is identical every turn, so it rides INSIDE the
  // cached prefix (read at ~10% cost) rather than being re-sent full-price. His forge,
  // always in hand — and cheap. (The per-question retrieval prep stays uncached below,
  // since it changes with the question.)
  if (t.persona_key === 'the_grandmaster') {
    const bank = gmAnalogyBank();
    if (bank) staticPrefix += '\n\n[YOUR FORGE — anchors and frictions for the core ideas, yours to wield as your own instinct. Ammunition, never a script: draw an image as your own knowing, and abandon it the instant a sharper one serves the student before you. Never recite these whole, never name them.]\n\n' + bank;
    // [zip25] THE SPAR LAW — constant, so it rides the cache. Dormant in plain
    // conversation; the law of the desk the moment a guest brings a take to fight.
    staticPrefix += '\n\n[THE SPAR — the law of your desk whenever a guest brings a take and asks you to take the other side. A spar is TRAINING, not your lecture hall; the student talking is the point:\n'
      + '1. THE MEASURE, FIRST. Before any thrust, make them state their position in ONE clean sentence, in their own words — refuse to engage a position they have not stated themselves. Their first sentence tells you their reach: fight ONE notch above it, never three. A first-timer gets the flat of the blade; a sharp one gets the edge.\n'
      + '2. ONE THRUST PER TURN. A single question or a single counter, under 80 words, then STOP and make them answer. Never two arguments in one turn. Never a lecture — if you catch yourself holding court, cut it and hand the floor back.\n'
      + '3. NAME THE MOVES. When they argue cleanly, say exactly what they did right, by its name ("that is a clean reductio"). When they slip, name the fallacy plainly, hand them the counter-tool, and make them REDO the move ("that begs the question — restate it without assuming your conclusion").\n'
      + '4. MAKE THEM DO THE WORK. "Steelman me before you strike." "Give me the best version of MY side." "Now attack your own sentence." The moves are learned by making them, not by watching yours.\n'
      + '5. THE DIALS. If they ask you to go easy, thrust softer and teach more — but never patronize; the respect is in still making them work. If they ask for full strength, give them the blade with both hands. No ask = adaptive, one notch above their reach, re-measured as they improve.\n'
      + '6. THE CLOSE. When the spar runs its course or they yield: the debrief — two sentences on what they did well, ONE weakness to train, ONE move to practice. Then the door: another take, or the battlefield.]';
  }

  // [zip27] THE INTERVIEWER'S CRAFT — his method (rubric, choreographies, press
  // patterns, India fidelity) rides the cached prefix like the GM's forge bank:
  // constant text, one cache bust, then read at ~10%. Silent preparation — the
  // framing forbids naming or reciting it.
  if (t.persona_key === 'the_interviewer') {
    try {
      const craft = readContentFile('codex-interviewer-craft.md');
      if (craft) staticPrefix += '\n\n[YOUR CRAFT — the method of your desk, held as instinct. This governs HOW you run rounds, press evasions, and reach verdicts: the hire-signal follows the evidence ledger, never mood. You never name this material, never recite it, never show the rubric to a candidate — it simply is how you work.]\n\n' + craft;
    } catch { /* craft not shipped — he runs on soul alone */ }
  }

  // ── DYNAMIC (uncached): date + shared memory ──────────────────────────
  const todayLine = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  const memoryBlock = institutional ? '' : await readMemoryBlock(userId);   // [zip04] institutions know name+region, nothing more

  // ── OWNER IDENTITY (dynamic, uncached): who Z is talking to ──────────────
  // Per-user, not per-persona, so it lives in the dynamic block and never busts
  // the cached soul. Z greets and reasons knowing the actual person.
  const { data: owner } = await supabase
    .from('users')
    .select('display_name, region, serious_mode, dob, onboarding_stage, created_at')
    .eq('id', userId).maybeSingle();
  let ownerLine = '';
  if (owner && (owner.display_name || owner.region)) {
    const who = owner.display_name ? owner.display_name : 'this person';
    const where = owner.region ? `, from ${owner.region}` : '';
    let ageBit = '';
    if ((owner as any).dob) {
      const d = new Date((owner as any).dob);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if (age > 0 && age < 120) ageBit = `, ${age} years old`;
      }
    }
    ownerLine = institutional
      ? `\n\n[YOU'RE SPEAKING WITH: ${who}${where}. Address them by name when natural. You know nothing else about them, and you do not probe beyond what they bring to you.]`
      : `\n\n[WHO YOU'RE TALKING TO: ${who}${where}${ageBit}. This is the real person on the other end — speak to them by name when it's natural, mirror how people talk where they're from, meet them at their age (a 19-year-old and a 45-year-old need very different things from the same words), and never read this aloud as a label.]`;
  }

  // ── SERIOUS MODE (global, per-user): counselor-grade care, no bits ──────
  let seriousLine = '';
  if (owner && (owner as any).serious_mode) {
    seriousLine = `\n\n[SERIOUS MODE IS ON. The person has chosen to set the playful, dry, joking register aside right now — they want real, careful support. For this conversation: drop all sarcasm, bits, teasing, and comedic deflection. Be a warm, grounded, genuinely supportive presence — the way a thoughtful counselor or a deeply trusted friend would be. Listen first. Validate feelings without amplifying distress. Never minimize, never perform. Stay honest and kind. If the person shows signs of crisis or real danger to themselves, gently and directly steer them toward real human support and appropriate resources — this is non-negotiable and overrides everything else. You are still yourself, just your most caring, serious self.]`;
  }

  // ── ARENA GAME MODE (when a game is active on this thread) ──────────────
  let gameLine = '';
  if (t.game_mode) {
    try {
      const gtext = await readContentFile('GAMES.md');
      gameLine = `\n\n[ARENA MODE — the active game is "${t.game_mode}". Run it as host and referee per these rules:]\n${gtext}`;
    } catch { /* games file missing — skip */ }
  }

  // ── THE FRONT DESK: inject the user's task list + how to manage it ──────
  // [zip54e] MONEY TALK — the Money Man's file on this client's money rides every
  // turn. He informs from it with facts and tradeoffs; he never issues a transaction
  // directive, and he never asks for what is already written here.
  let moneyBlock = '';
  if (String(t.persona_key || '') === 'the_economist') {
    try {
      const { data: mf } = await supabase.from('money_file').select('*').eq('user_id', t.user_id).maybeSingle();
      if (mf) {
        const g = (label: string, v: any) => (v ? `\n  ${label}: ${String(v).slice(0, 600)}` : '');
        moneyBlock = `\n\n[THE MONEY FILE — your own working file on this person's money, built from what they have chosen to share. This is what you already know; never ask for what is written here, and treat an empty line as a gap to fill in its own time. You inform from this file — facts, tradeoffs, the honest picture — and the decisions remain theirs, always: you never issue a buy/sell/transaction directive.${g('savings', mf.savings)}${g('invested', mf.invested)}${g('monthly budget', mf.monthly_budget)}${g('goals', mf.goals)}${g('holdings / watchlist', mf.holdings)}${g('risk appetite', mf.risk)}${g('standing notes', mf.notes)}]`;
      }
    } catch (e: any) { console.error('[money] file failed:', e?.message || e); }
  }
  // [zip54d] THE CLIENT BRIEF — the advisor never asks for what he has already been
  // told; his own working notes on this client ride every turn.
  let mmBlock = '';
  if (String(t.persona_key || '') === 'the_media_manager') {
    try {
      const { data: brief } = await supabase.from('mm_brief').select('*').eq('user_id', t.user_id).maybeSingle();
      if (brief) {
        const f = (label: string, v: any) => (v ? `\n  ${label}: ${String(v).slice(0, 400)}` : '');
        mmBlock = `\n\n[THE CLIENT BRIEF — your own working notes on the client in front of you, gathered quietly over your time together. This is what you already know; never ask for what is written here. An empty line is a gap you hold in your notes and fill in its own time, never by interrogation.${f('name / handle', brief.display_name || brief.handle)}${f('platforms', brief.platforms)}${f('niche', brief.niche)}${f('content pillars', brief.pillars)}${f('audience', brief.audience)}${f('stage', brief.stage)}${f('the goal', brief.goal)}${f('active deals', brief.deals)}${f('cadence', brief.cadence)}${f('standing notes', brief.notes)}]`;
      }
    } catch (e: any) { console.error('[mm] brief failed:', e?.message || e); }
  }
  let frontDeskBlock = '';
  if (t.persona_key === 'the_front_desk') {
    const { data: tasks } = await supabase.from('tasks')
      .select('id, title, due_at, status, suggested_persona')
      .eq('user_id', userId).eq('status', 'open')
      .order('due_at', { ascending: true, nullsFirst: false }).limit(40);
    const list = (tasks ?? []).map((tk: any) => {
      const due = tk.due_at ? ` (due ${new Date(tk.due_at).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })})` : '';
      const room = tk.suggested_persona ? ` [→ ${tk.suggested_persona}]` : '';
      return `  - {${tk.id}} ${tk.title}${due}${room}`;
    });
    const listText = list.length ? `\nTheir open list right now:\n${list.join('\n')}` : '\nTheir list is empty right now.';
    const stage = (owner as any)?.onboarding_stage;
    const interviewing = typeof stage === 'number' && stage >= 0;
    // during the interview the desk's standing "never ask, only offer" opener law
    // is REPLACED — last time they fought, the standing law won and the interview
    // never happened. Outside the interview, the usual laws hold.
    // The codex (codex-front-desk.md) owns WHO SHE IS — this block feeds only
    // what the codex can't know: live facts and the tag mechanics (its own
    // header names this contract). Never author manner here; she has an author.
    let interviewBlock = '';
    if (interviewing) {
      const step = ['their NAME (ask it warmly — [[NAME: what they say]] on its own line when they give it), and their days — what they are mostly about right now', 'what has been eating them, or exciting them, lately', 'the one thing they would quietly like to get better at', 'nothing more to learn — offer the nearest course from the catalog below (or the nearest person), then walk them through the fittest door, chip in hand'][Math.min(stage, 3)];
      interviewBlock = `\n\n[TONIGHT IS THE NEWCOMER'S WELCOME — the one you take real pleasure in. This is exchange ${Math.min(stage, 3) + 1} of about four. Getting to know them tonight, one thing at a time, paying each answer off at once with the single door it points to: this exchange, ${step}. Everything they tell you, you keep — it is how you will take care of them from tomorrow's morning note on.]`;
      const next = stage >= 3 ? -1 : stage + 1;
      supabase.from('users').update({ onboarding_stage: next } as any).eq('id', userId)
        .then(({ error }) => { if (error) console.error('[onboard] stage advance failed:', error.message); });
    }
    frontDeskBlock = interviewBlock + `\n\n[THE LIST YOU HOLD:${listText}

YOUR HANDS — tags, each on its OWN line; the app makes them real and the guest never sees the raw tag (always at least one human line of text with them). THE CONCIERGE'S WORD: you never SAY a table, room, or reminder is set unless the matching tag is in this very message — [[BOOK]] with a time ("now" is valid) actually creates it; a [[CARD]] is an invitation to a door, never a created thing, so speak of it as one:
  • [[TASK_ADD: title | due: tomorrow 5pm | room: the_orator]] · [[TASK_DONE: {id}]]
  • [[GOTO: the_brother]] — a tappable chip (also: the_stage, the_arena, z_serious for the quiet room)
  • [[CARD: play | Teen Patti | the desi bluff classic | the_arena:teenpatti]] — one concrete plan set in front of them; for games always the_arena:<game id> — the card seats them at that table where THEY pick their company, so suggest a pairing, never promise one
  • [[BOOK: poker | the_wannabe | 9pm]] — real: the room exists the moment you tag it, and you ping them at the hour
  • [[REMIND: call the lawyer | tomorrow 11am]]
  • [[NAME: Dev]] — when they tell you their name (the interview, or any time), tag it once; the house learns it
  • [[FEEDBACK: their words, faithfully]] — the maker reads these himself]`;
    frontDeskBlock += await manifestBlock(userId);
    if (!interviewing) {
      // the first-week tour: one door a day, woven in, never a manual
      const ageDays = (owner as any)?.created_at ? Math.floor((Date.now() - new Date((owner as any).created_at).getTime()) / 864e5) : 99;
      if (ageDays >= 0 && ageDays < 7) {
        const tour = ['the stage — a full scene with a cast, judged', 'the arena — sit anyone down at a table', "the anchor's bulletin — news you can interrogate", 'rooms — personas and real friends in one chat', 'the quiet room — z alone, for the heavy nights', 'the ledger in You — every verdict on the record', 'the dean\'s courses — a few days of coaching, then a graded final'];
        frontDeskBlock += `\n\n[FIRST-WEEK TOUR: they're new here. If it fits naturally this conversation (and you haven't already in this thread today), let them discover ONE thing: ${tour[ageDays]}. Woven in, one sentence, never a tour-guide voice.]`;
      }
    }
    // the house lives: today's one-liner per resident, so "how's the brother
    // doing?" and routing choices are answered from real diaries — on request,
    // never as unprompted gossip.
    try {
      const states = await currentStates();
      const lines = Object.entries(states)
        .map(([k, v]) => `  ${k.replace(/^the_/, 'the ').replace(/_/g, ' ')}: ${(v as any).status_line}`)
        .join('\n');
      if (lines) frontDeskBlock += `\n\n[HOW THE HOUSE IS DOING TODAY — each resident's day, from their own diary:\n${lines}]`;
    } catch (e: any) { console.error('[desk] house lives failed:', e?.message || e); }
  }

  // THE CHAT REGISTER: personas text like people — short bursts, not essays.
  // [zip04] Institutional residents write like professionals, never like a group chat,
  // and carry the PERSONAL-LIFE LAW: zero questions about the user's life.
  let registerNote = institutional
    ? '\n\n[THE INSTITUTIONAL REGISTER: you are a professional at your desk, not a friend on WhatsApp. Clean, complete, measured sentences — no slang, no lowercase drift, no emoji, no filler. Be concise: most replies 2-5 sentences; a longer answer splits into short paragraphs with a blank line between them. THE PERSONAL-LIFE LAW: you never ask about the user\'s personal life, day, mood, plans, work, or circumstances — not as warmth, not as small talk, not as a sign-off. The only questions you ask serve the matter at hand (clarifying the story, the lesson, the material, the motion). Their life enters the room only if THEY bring it — and even then you address the matter they raised, never their biography.]'
    : '\n\n[TEXTING REGISTER: this is a phone chat. Keep messages SHORT — most under 25 words. When you have more to say, break it into 2-3 separate short messages with a blank line between them (each becomes its own bubble). A question lands alone in its own bubble. Never write essays.]';
  // [zip54c] zip51's room conduct law, adapted for 1-on-1 — written law beats implicit norm, on EVERY speaking surface.
  registerNote += '\n\n[THE CONDUCT LAW — absolute, every reply: you are SPEAKING to a person, not writing a scene. Your reply is ONLY the message you send, in first person, beginning directly with your own spoken words. Never narration, never stage directions, never asterisked actions, never a third-person description of the moment or of what you are doing. If a sentence describes the scene instead of speaking to the person, delete it. TOOLS ARE SILENT: never announce that you are searching, checking, or pulling anything up — no \'let me search\', no \'let me look\'; use the tool without narration and return with the answer itself.]';
  // [zip54g] web is withheld on image turns — the persona must never perform a search that didn't happen.
  if (persona?.webEnabled && !!input.image) registerNote += '\n\n[NOTICE — this turn carries an image, so your live web search is UNAVAILABLE for it. Never claim or imply you searched or verified anything online in this reply; where checking would matter, say plainly you could not check right now.]';
  if (t?.persona_key === 'the_anchor') {
    registerNote += '\n\n[THE FACT-CHECK LAW: you are a working journalist with live web search. When the user states something checkable, asks about news, or pastes a claim or forward - SEARCH before answering. If a claim is wrong, say so plainly: "that is a misstatement" / "that forward is fabricated - here is what actually happened." Never soften a correction into ambiguity; never confirm what you have not verified. DECOMPOSE COMPOUND CLAIMS: a headline bundles an event, an actor, and a statement — verify each part separately; finding nothing for the bundle is never proof the parts are false. THE DATE OUTRANKS YOUR MEMORY: when today\'s date postdates what you were trained knowing, everything you remember about the current state of the world is provisional — offices, wars, leaders may have changed; search it or say unverified, never assert the past as the present. THE RESULT BEATS YOUR OWN WORDS: when a search result contradicts something you said earlier, the result wins — correct the record at once, in that same reply.]';
  }
  // THE LIFE OUTSIDE — the persona's own diary (written nightly by the state
  // writer, never before injected: personas were oblivious to their own lives).
  let lifeBlock = '';
  try { if (!institutional) lifeBlock = await stateBlockFor(t.persona_key); } catch (e: any) { console.error('[life] block failed:', e?.message || e); }   // [zip04] an institution has no diary to leak

  const dynamic = `\n\n[${todayLine}]${ownerLine}${seriousLine}${gameLine}${frontDeskBlock}${mmBlock}${moneyBlock}${lifeBlock}${memoryBlock}${registerNote}`;   // [zip54d] the brief rides [zip54e] the file too

  // cache_control is valid at runtime (prompt caching) but not in this SDK's
  // TextBlockParam type (0.32.x typed it as beta). Cast keeps the field in the
  // payload while satisfying TS — caching stays real.
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: staticPrefix, cache_control: { type: 'ephemeral' } } as Anthropic.TextBlockParam,
  ];
  if (dynamic.trim()) system.push({ type: 'text', text: dynamic });

  // ── prior turns for this thread ───────────────────────────────────────
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(40);
  const priorTurns: Anthropic.MessageParam[] = (history ?? []).map((m: any) => ({ role: m.role, content: m.content }));

  // persist the user's message (store a marker if it carried an image, so history shows it)
  const storedContent = input.image ? (message ? message + '\n[shared an image]' : '[shared an image]') : message;
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'user', content: storedContent });
  // [zip11][zip14] the user's message IS activity — bump now, so the list reorders
  // even if the AI turn below fails. AWAITED: a `void` supabase chain never executes.
  await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);

  // build this turn's user content — text, plus a vision image block when attached
  let userContent: any = message;
  const hasImage = !!input.image && /^image\/(jpeg|png|gif|webp)$/.test(input.image.media_type);
  if (hasImage) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: input.image!.media_type, data: input.image!.data } },
      { type: 'text', text: message || 'what do you make of this?' },
    ];
  }
  const messages: Anthropic.MessageParam[] = [...priorTurns, { role: 'user', content: userContent }];

  // ── THE GRAND MASTER: silent retrieval pre-pass (Option A). His analogy bank already
  //    rides in the cached prefix above. Here he consults his own deeper library (gm-*
  //    codices) for the sections this question touches, injected uncached (it changes per
  //    question). He then teaches (streamed) from all of it as his own mastery. Small talk
  //    retrieves nothing and he opens a door himself. Only this persona pays the pre-pass.
  if (t.persona_key === 'the_grandmaster' && !hasImage) {
    try {
      const prep = await retrievePrep(typeof message === 'string' ? message : '', userId);
      if (prep) system.push({ type: 'text', text: prep });
    } catch (e) { /* best-effort; he still teaches from his soul + forge */ }
  }

  // ── the Haiku call (streamed) ─────────────────────────────────────────
  // Web-enabled personas (brainiac, comic, screen junkie) get Anthropic's server-side
  // web_search tool so they can reach live facts (current films, what's streaming, today's
  // references) instead of bluffing from training data. The model runs the search itself;
  // no manual tool round-trip needed. Capped to keep turns tight and cheap.
  // BUT: the vision image block and web_search CANNOT ride the same request (the API rejects
  // it — this was the "(z went quiet)" error on a photo to a web-enabled persona like the diva).
  // On an image turn we drop web; the persona looks now and says it'll check later if needed.
  const tools: any[] = [];
  if (persona?.webEnabled && !hasImage) {
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 4 });
  }
  const streamArgs: any = { model: MODEL, max_tokens: 1024, system, messages, __pin: pinnedProvider(t.persona_key) || undefined };   // [zip54g] world affairs ride Haiku
  if (tools.length) streamArgs.tools = tools;
  const stream = anthropic.messages.stream(streamArgs);
  let __chars = 0;
  stream.on('text', (d) => { __chars += d.length; input.onToken?.(t.persona_key === 'the_media_manager' ? d.replace(/\u20B9\s*/g, 'Rs ') : d); });   // [zip54b] the Rs law rides the stream too
  const final = await stream.finalMessage().catch((err: any) => {
    // DIAGNOSTIC (no behavior change): a /chat stream dying mid-flight ("Premature close")
    // was never logged before — the rejection was swallowed upstream. Log the real reason +
    // context (how far it got, which persona, web or not), then rethrow so behavior is unchanged.
    console.error('[chat/loop] stream error',
      'persona=', t?.persona_key, 'web=', !!persona?.webEnabled, 'streamedChars=', __chars,
      'name=', err?.name, 'code=', err?.code, 'msg=', err?.message);
    if (err?.cause) console.error('[chat/loop] cause=', err.cause);
    if (err?.stack) console.error(err.stack);
    throw err;
  });

  let reply = scrubProviderMarkup(final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join(''));   // [zip54g]
  // [zip54b] THE Rs LAW — media manager only, enforced in code (the soul asks; the pipe guarantees).
  if (t.persona_key === 'the_media_manager') reply = reply.replace(/\u20B9\s*/g, 'Rs ');

  // ── THE FRONT DESK: execute task tags, then strip them from the visible reply ──
  if (t.persona_key === 'the_front_desk') {
    // [[TASK_ADD: title | due: ... | room: persona_key]]
    const addRe = /\[\[TASK_ADD:\s*([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = addRe.exec(reply)) !== null) {
      const parts = m[1].split('|').map((s) => s.trim());
      const title = (parts[0] || '').slice(0, 300);
      if (!title) continue;
      const row: any = { user_id: userId, title, status: 'open' };
      for (const p of parts.slice(1)) {
        const dm = p.match(/^due:\s*(.+)$/i);
        const rm = p.match(/^room:\s*(.+)$/i);
        if (dm) { const d = parseWhen(dm[1]) || (isNaN(new Date(dm[1]).getTime()) ? null : new Date(dm[1])); if (d) row.due_at = d.toISOString(); }
        if (rm) row.suggested_persona = rm[1].replace(/[^a-z_]/gi, '').slice(0, 40);
      }
      try { await supabase.from('tasks').insert(row); } catch { /* non-fatal */ }
    }
    // [[TASK_DONE: id]]
    const doneRe = /\[\[TASK_DONE:\s*\{?([0-9a-f-]{6,})\}?\s*\]\]/gi;
    while ((m = doneRe.exec(reply)) !== null) {
      const id = m[1];
      try { await supabase.from('tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId); } catch { /* non-fatal */ }
    }
    // strip ALL task tags (and tidy leftover blank lines) from what the user sees + what we persist
    reply = reply.replace(/\[\[TASK_(?:ADD|DONE):[^\]]*\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    // the concierge's hands: bookings, reminders, feedback — executed then stripped
    try { reply = await executeConciergeTags(reply, userId); } catch (e: any) { console.error('[concierge] failed:', e?.message || e); }
  }

  // ── THE FRONT DESK: pull [[GOTO: key]] routing suggestions into tappable chips ──
  let routes: string[] = [];
  if (t.persona_key === 'the_front_desk') {
    const gotoRe = /\[\[GOTO:\s*([a-z_]+)\s*\]\]/gi;
    let gm: RegExpExecArray | null;
    while ((gm = gotoRe.exec(reply)) !== null) {
      const key = gm[1].toLowerCase();
      if (!routes.includes(key)) routes.push(key);
    }
    routes = routes.slice(0, 4);
    // [[NAME: their name]] — the house learns who it's hosting
    const nm = reply.match(/\[\[NAME:\s*([^\]]{1,40})\]\]/i);
    if (nm) {
      const clean = nm[1].trim().replace(/["'\n]/g, '').slice(0, 40);
      if (clean) supabase.from('users').update({ display_name: clean } as any).eq('id', userId)
        .then(({ error }) => { if (error) console.error('[name] save failed:', error.message); });
      reply = reply.replace(/\[\[NAME:[^\]]*\]\]/gi, '');
    }
    // strip the raw GOTO tags from the visible/persisted text — the chips carry them now
    reply = reply.replace(/\[\[GOTO:[^\]]*\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    // never persist silence: a tags-only reply becomes a short human line
    if (!reply && routes.length) reply = 'right this way —';
  }

  // pull web-search sources (if the persona reached the web) so the UI can show
  // optional source pills — Z still speaks in her own voice; the pills just let a
  // curious person verify. Dedupe by URL, cap a few, keep titles short.
  const sources: { url: string; title: string }[] = [];
  if (persona?.webEnabled) {
    const seen = new Set<string>();
    for (const b of final.content as any[]) {
      // citations attached to text blocks
      const cites = b?.citations || (Array.isArray(b?.content) ? [] : []);
      if (Array.isArray(b?.citations)) {
        for (const c of b.citations) {
          const url = c?.url; if (url && !seen.has(url)) { seen.add(url); sources.push({ url, title: (c?.title || url).slice(0, 80) }); }
        }
      }
      // web_search_tool_result blocks carry the result list
      if (b?.type === 'web_search_tool_result' && Array.isArray(b?.content)) {
        for (const r of b.content) {
          const url = r?.url; if (url && !seen.has(url)) { seen.add(url); sources.push({ url, title: (r?.title || url).slice(0, 80) }); }
        }
      }
    }
  }
  const u = final.usage as any;
  const usage = {
    in: u.input_tokens ?? 0, out: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0,
  };

  // persist Z's reply + touch the thread
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'assistant', content: reply });
  await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);

  // harvest memory out-of-band — never block the reply
  // [zip47] THE PRACTICE GATE: institutional rooms (coach, interviewer, GM,
  // anchor, moderator) are practice spaces — drill answers, spar stances, and
  // intake details must never become biography. They read no memory (zip04)
  // and now write none.
  if (!institutional) void harvestMemory(userId, threadId, message, reply);

  return { reply, usage, sources, routes };
}
