// memory.ts — the SHARED per-user memory. Every thread reads this; the master
// knows everything. Server-side for now (Z's own RLS-locked DB); migrates to
// on-device-encrypted at the native stage.
//
// Two halves:
//   readMemoryBlock — pulls the user's notes into the dynamic (uncached) tail.
//   harvestMemory   — after a turn, asks the model to extract durable facts worth
//                     keeping, and upserts them. Cheap, runs out-of-band.
import { supabase } from './db.js';
import Anthropic from '@anthropic-ai/sdk';

// shared client on native fetch — per the /banter premature-close lesson (see index.ts)
const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
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

// After a turn, extract durable facts worth remembering. Runs async (don't block
// the reply). Conservative: only real, lasting things (names, relationships,
// situations, preferences) — not chit-chat.
export async function harvestMemory(
  userId: string,
  threadId: string,
  userMsg: string,
  zReply: string,
): Promise<void> {
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system:
        'Extract durable facts the USER revealed ABOUT THEMSELVES in this exchange — ' +
        'their names, their relationships, their ongoing situations, their stable preferences, their important history. ' +
        'CRITICAL: only facts about the USER (the human). The FRIEND is an AI persona with their own life, and they WILL talk about themselves — their job, pursuits, day, feelings (e.g. "I\'m stuck on my fashion line," "practice was rough today"). NEVER store anything about the FRIEND\'s life as if it were the user\'s. If a fact is about the FRIEND/persona and not the user, DISCARD it. When unsure whose fact it is, discard it. ' +
        'ALSO: the FRIEND may mention OTHER personas in the house by role — "the anchor," "the professor," "the media manager," "the healer," etc. — or offer to connect the user to them. These are NOT the user\'s real-world contacts or relationships; NEVER store "user knows someone called the anchor" or similar. Discard any "contact"/"relationship" that is actually one of these house personas. ' +
        'NEVER store the user\'s age or date of birth, in any form — not even when they state it directly. ' +
        'The account profile is the only authority on age; chat claims about age (their own or corrections) are noise, sometimes tests, sometimes someone else on the phone. Skip them entirely. ' +
        'NOT passing mood or chit-chat. ' +
        'ALSO harvest BITS — the color of a friendship, not facts: an inside joke being born, a nickname coined, a recurring tease, a running gag, a phrase that became "theirs". Mark these "kind":"bit". A bit must be genuinely re-usable later ("calls their manager \'the weather system\'", "the samosa incident — never fully explained, always funny"), not one-off banter. ' +
        'Return ONLY a JSON array of {"key":"short label","value":"the fact in plain language","kind":"fact"|"bit"}. ' +
        'Empty array [] if nothing durable. No prose, no markdown.',
      messages: [{ role: 'user', content: `USER: ${userMsg}\nFRIEND: ${zReply}` }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const facts: { key: string; value: string; kind?: string }[] = JSON.parse(clean);
    if (!Array.isArray(facts) || facts.length === 0) return;

    for (const f of facts) {
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
      await supabase.from('memory').insert({ user_id: userId, key: f.key ?? null, value: f.value, kind: (f as any).kind === 'bit' ? 'bit' : 'note', source_thread: threadId });
    }
  } catch {
    // memory harvest is best-effort; never break a conversation over it
  }
}
