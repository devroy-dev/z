// memory.ts — the SHARED per-user memory. Every thread reads this; the master
// knows everything. Server-side for now (Z's own RLS-locked DB); migrates to
// on-device-encrypted at the native stage.
//
// Two halves:
//   readMemoryBlock — pulls the user's notes into the dynamic (uncached) tail.
//   harvestMemory   — after a turn, extracts durable facts worth keeping.
//
// [zip03] HARDENED after the Vaibhav incident (third-party facts stored as the
// user's own; "not investing right now" stored as durable; triplicate rows):
//   1. THIRD-PARTY RULE — facts about people/figures the user is DISCUSSING are
//      never user facts. The extractor must tag subject: user|other; code discards 'other'.
//   2. DURABILITY BAR — transient state (mood, "right now", temporary plans) is
//      tagged transient and discarded. Only lasting facts survive.
//   3. VERIFY PASS — a second, temperature-0 call audits the surviving candidates
//      against the user's actual words (the coach answer-key pattern). Reject on doubt.
//   4. Literal-duplicate guard at insert (same value, case-insensitive).
// Semantic dedupe / contradiction resolution across OLD rows = memoryGardener.ts.
import { supabase } from './db.js';
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from './llm.js';
import { logUsage } from './usage.js';

// shared client on native fetch — per the /banter premature-close lesson (see index.ts)
const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

// Pull the user's memory into a context block. Ordered by weight, capped so it
// never bloats context. Plain language — Z reads it as "what I know about them".
export async function readMemoryBlock(userId: string): Promise<string> {
  const { data } = await supabase
    .from('memory')
    .select('kind, key, value')
    .eq('user_id', userId)
    .order('weight', { ascending: false })
    .limit(60);
  if (!data || data.length === 0) return '';
  const facts = data.filter((m) => m.kind !== 'bit');
  const bits = data.filter((m) => m.kind === 'bit');
  const lines = facts.map((m) => (m.key ? `- ${m.key}: ${m.value}` : `- ${m.value}`));
  let block = `\n\n[WHAT YOU KNOW ABOUT THEM — everything they've told you, across all your conversations. You remember as one self. Speak from this naturally, the way a friend recalls; never recite it back as a list.]\n${lines.join('\n')}\n`;
  if (bits.length) {
    const bitLines = bits.map((m) => (m.key ? `- ${m.key}: ${m.value}` : `- ${m.value}`));
    block += `\n[THE BITS — inside jokes, nicknames, running gags you two share. The law of a bit: use SPARINGLY (a callback lands because it's rare), never explain the joke, never force one in — but when the moment is right, a callback three weeks later is what friendship feels like.]\n${bitLines.join('\n')}\n`;
  }
  return block;
}

type Candidate = { key?: string; value: string; kind?: string; subject?: string; durability?: string };

// After a turn, extract durable facts worth remembering. Runs async (don't block
// the reply). Conservative: only real, lasting things the USER said about THEMSELVES.
export async function harvestMemory(
  userId: string,
  threadId: string,
  userMsg: string,
  zReply: string,
): Promise<void> {
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        'You extract durable facts from ONE source only: THE USER\'S OWN MESSAGE (the text under "USER SAID"). '
        + 'That is the ONLY place a fact may come from. Extract what the user revealed about THEMSELVES — their names, relationships, ongoing situations, stable preferences, important history. '
        + 'THE THIRD-PARTY RULE (absolute): a fact about a person, public figure, character, team, or entity the user is merely DISCUSSING or ASKING ABOUT is NEVER a fact about the user. '
        + 'If the user asks "did Vaibhav make his debut?" or discusses a cricketer\'s tour, a politician\'s statement, a friend\'s job — those are facts about OTHERS. Tag them "subject":"other". '
        + 'Only what the user states about their OWN life is "subject":"user". Asking about a topic is interest at most, not biography. '
        + 'THE DURABILITY BAR: transient state is not memory. Current mood, what they are doing right now, today\'s plan, a temporary stance ("not investing at this time", "busy this week") — tag "durability":"transient". '
        + 'Only lasting facts (name, family, work, home, enduring preferences, real history) are "durability":"durable". '
        + 'The block under "CONTEXT" is the friend\'s reply and exists ONLY to help you resolve what the user meant. NEVER extract a fact FROM the context. The friend is an AI persona with their own life; none of that is ever a fact about the user. '
        // [zip46] THE SINCERITY LAWS — the persona-confusion fix
        + 'THE PERFORMANCE LAW: a position the user takes inside a debate, spar, argument practice, roleplay, hypothetical, or while TESTING or INSTRUCTING the friend is a PERFORMANCE, never a belief. If the exchange reads as adversarial practice, a game, or product testing, tag any stance "durability":"transient". A creed becomes memory only when stated sincerely in ordinary conversation. '
        + 'THE MIRROR LAW: anything describing the FRIEND — their manner, their style, the advice they give, what they said, offered, or are like — is never a fact about the user, even when the USER is the one saying it. Tag "subject":"other". '
        + 'THE META LAW: talk about this app, its personas, its features, tests, plans, or this conversation itself is product noise, never biography. Tag "subject":"other". '
        + 'NEVER store the user\'s age or date of birth, in any form — not even when they state it directly. '
        + 'The account profile is the only authority on age; chat claims about age are noise. Skip them entirely. '
        + 'ALSO harvest BITS — the color of the friendship, not facts: an inside joke being born, a nickname coined, a recurring tease. Mark these "kind":"bit". A bit must be genuinely re-usable later and grounded in what the USER said. '
        + 'Return ONLY a JSON array of {"key":"short label","value":"the fact in plain language","kind":"fact"|"bit","subject":"user"|"other","durability":"durable"|"transient"}. '
        + 'Empty array [] if nothing qualifies. No prose, no markdown.',
      messages: [{ role: 'user', content: `USER SAID (extract facts ONLY from here):\n${userMsg}\n\nCONTEXT (the friend's reply — DO NOT extract from this; it only helps you resolve what the user meant):\n${zReply}` }],
    });
    try { logUsage({ userId, threadId, personaKey: null, surface: 'other', fn: 'memory_harvest', model: MODEL, usage: (resp as any).usage }); } catch {}
    const raw = (firstText(resp) || '[]');
    const clean = String(raw).replace(/```json|```/g, '').trim();
    let facts: Candidate[] = [];
    try { facts = JSON.parse(clean); } catch { return; }
    if (!Array.isArray(facts) || facts.length === 0) return;

    // hard filters the model tagged for us — subject + durability are LAWS, not hints
    const survivors = facts.filter((f) => f?.value
      && (f.subject ?? 'user') === 'user'
      && (f.durability ?? 'durable') === 'durable');
    if (!survivors.length) return;

    // THE VERIFY PASS — a second mind audits the candidates against the user's actual
    // words (temp 0, structured). A fact enters memory only if the auditor agrees the
    // USER stated it about THEMSELVES and it is durable. (Coach answer-key pattern.)
    let verified: Candidate[] = survivors;
    try {
      const audit = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 300,
        temperature: 0,
        system:
          'You are an auditor. Given the user\'s message and candidate memory facts, verify EACH candidate: '
          + 'ok=true ONLY if (a) the USER themselves stated it, (b) it is about the USER\'S own life (not someone they were discussing or asking about), (c) it is a lasting fact, not a passing state, (d) it was said SINCERELY in ordinary conversation — never a stance performed inside a debate, spar, roleplay, hypothetical, or test, and (e) it is about the user\'s life OUTSIDE this app — never about the app, its personas, or the conversation itself. '   // [zip46]
          + 'When in doubt, ok=false. Return ONLY a JSON array of {"i":<index>,"ok":true|false}. No prose.',
        messages: [{ role: 'user', content: `USER'S MESSAGE:\n${userMsg}\n\nCANDIDATES:\n${survivors.map((f, i) => `${i}. ${f.key ? f.key + ': ' : ''}${f.value}`).join('\n')}` }],
      });
      try { logUsage({ userId, threadId, personaKey: null, surface: 'other', fn: 'memory_verify', model: MODEL, usage: (audit as any).usage }); } catch {}
      const araw = (firstText(audit) || '[]');
      const verdicts: { i: number; ok: boolean }[] = JSON.parse(String(araw).replace(/```json|```/g, '').trim());
      if (Array.isArray(verdicts)) {
        const okSet = new Set(verdicts.filter((v) => v && v.ok === true).map((v) => v.i));
        verified = survivors.filter((_, i) => okSet.has(i));
      }
    } catch { /* auditor unavailable → fail CLOSED for facts, open for bits */
      verified = survivors.filter((f) => f.kind === 'bit');
    }
    if (!verified.length) return;

    for (const f of verified) {
      if (!f?.value) continue;
      // upsert by (user, key): refine existing rather than duplicate
      if (f.key) {
        const { data: ex } = await supabase
          .from('memory').select('id').eq('user_id', userId).eq('key', f.key).maybeSingle();
        if (ex) {
          await supabase.from('memory').update({ value: f.value, updated_at: new Date().toISOString(), source_thread: threadId }).eq('id', ex.id);
          continue;
        }
      }
      // literal-duplicate guard: same value already on file (case-insensitive) → skip
      const { data: dupe } = await supabase
        .from('memory').select('id').eq('user_id', userId).ilike('value', f.value).maybeSingle();
      if (dupe) continue;
      await supabase.from('memory').insert({ user_id: userId, key: f.key ?? null, value: f.value, kind: (f as any).kind === 'bit' ? 'bit' : 'note', source_thread: threadId });
    }
  } catch {
    // memory harvest is best-effort; never break a conversation over it
  }
}


// [zip74] THE TRIP HARVEST — the engine records the Wanderer's trip file directly,
// so persistence never depends on the model emitting a [[TRIP:]] tag. Observes the
// USER's own message, extracts a trip if one is present, upserts per destination.
// Fire-and-forget, cheap, out-of-band. Same shape as harvestMemory.
export async function harvestTrip(userId: string, threadId: string, userMsg: string): Promise<void> {
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        'You extract TRAVEL PLANS from the user\'s message for their travel file. '
        + 'Look ONLY at what the user said. If they mention or refine a trip — a place they are going or considering, how long, who is going, or what they want from it — capture it. '
        + 'A trip needs at minimum a DESTINATION. Everything else is optional; leave blank if not said. '
        + 'Do NOT invent. Do NOT extract a place they are merely discussing abstractly (e.g. "is Paris expensive" with no intent to go) unless intent to travel is clear. '
        + 'Return ONLY a JSON array (usually 0 or 1 items) of '
        + '{"destination":"place","dates":"duration or dates or empty","travelers":"who/how many or empty","notes":"what they want / constraints / taste, short, or empty"}. '
        + 'Empty array [] if no trip is present. No prose, no markdown.',
      messages: [{ role: 'user', content: `USER SAID:\n${userMsg}` }],
    });
    try { logUsage({ userId, threadId, personaKey: 'the_wanderer', surface: 'other', fn: 'trip_harvest', model: MODEL, usage: (resp as any).usage }); } catch {}
    const raw = firstText(resp) || '[]';
    const clean = String(raw).replace(/```json|```/g, '').trim();
    let trips: any[] = [];
    try { trips = JSON.parse(clean); } catch { return; }
    if (!Array.isArray(trips) || !trips.length) return;
    for (const tr of trips) {
      const destination = String(tr?.destination || '').trim().slice(0, 120);
      if (!destination) continue;
      const dates = String(tr?.dates || '').trim().slice(0, 120) || null;
      const travelers = String(tr?.travelers || '').trim().slice(0, 120) || null;
      const notes = String(tr?.notes || '').trim().slice(0, 400) || null;
      const { error } = await supabase.from('trip_files').upsert(
        { user_id: userId, destination, dates, travelers, notes, updated_at: new Date().toISOString() } as any,
        { onConflict: 'user_id,destination' }
      );
      if (error) console.error('[trip-harvest] save failed:', error.message, '| dest:', destination);
      else console.log('[trip-harvest] filed:', destination, '(' + (dates || '?') + ')');
    }
  } catch (e: any) { console.error('[trip-harvest] failed:', e?.message || e); }
}
