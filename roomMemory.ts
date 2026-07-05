// roomMemory.ts — GROUP MEMORY (the moat). A shared room's COLLECTIVE memory:
// what the personas remember about THIS room and its people across sessions —
// who's who, the running jokes, what happened. Harvested ONLY from what was said
// IN the room (which every member already saw), injected back ONLY into that
// room. Distinct from per-user private memory (memory.ts), which stays
// suppressed in shared rooms — nothing here crosses the room boundary.
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

// Pull the room's collective memory into a context block for a persona's turn.
export async function readRoomMemoryBlock(threadId: string): Promise<string> {
  const { data } = await supabase
    .from('room_memory')
    .select('kind, key, value, subject_name')
    .eq('thread_id', threadId)
    .order('weight', { ascending: false })
    .limit(50);
  if (!data || data.length === 0) return '';
  const facts = data.filter((m: any) => m.kind !== 'bit');
  const bits = data.filter((m: any) => m.kind === 'bit');
  const fmt = (m: any) => {
    const who = m.subject_name ? `${m.subject_name} — ` : '';
    return m.key ? `- ${who}${m.key}: ${m.value}` : `- ${who}${m.value}`;
  };
  let block = `\n\n[WHAT YOU REMEMBER ABOUT THIS ROOM — your shared history with these people, built over your time together here. This is the room's collective memory: only what has happened in THIS room. You know no private history about anyone from outside it. Speak from this the way a regular remembers the regulars — naturally, never recited back as a list.]\n${facts.map(fmt).join('\n')}\n`;
  if (bits.length) {
    block += `\n[THE ROOM'S RUNNING JOKES & DYNAMICS — inside jokes, nicknames, recurring bits this room made together. The law of a bit: use SPARINGLY (a callback lands because it's rare), never explain the joke, never force one — but the right callback three sessions later is what makes a room feel like home.]\n${bits.map(fmt).join('\n')}\n`;
  }
  return block;
}

// Harvest the room's collective memory from its recent transcript. Extracts
// facts about members BY NAME + bits (the running gags), grounded only in what
// people actually said in the room. Upserts by (thread_id, key). Best-effort.
// Returns the number of items written/updated.
export async function harvestRoomMemory(threadId: string): Promise<number> {
  try {
    const { data: history } = await supabase
      .from('messages')
      .select('role, content, persona_key, sender_user_id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(80);
    if (!history || history.length < 4) return 0;   // too thin to harvest
    const rows = (history as any[]).slice().reverse();
    const uids = [...new Set(rows.map((m) => m.sender_user_id).filter(Boolean))];
    const nameByUid: Record<string, string> = {};
    if (uids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name').in('id', uids);
      for (const u of (us ?? []) as any[]) nameByUid[u.id] = u.display_name || 'someone';
    }
    const nameFor = (key: string) => personaByKey(key)?.defaultName || key;
    const transcript = rows.map((m) => {
      const who = m.role === 'user'
        ? ((m.sender_user_id && nameByUid[m.sender_user_id]) || 'someone')
        : nameFor(m.persona_key || '');
      return `${who}: ${m.content}`;
    }).join('\n');

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        'You maintain the COLLECTIVE MEMORY of a group chat room — what a regular would remember about this room and the people in it, built from what was actually said HERE. '
        + 'From the TRANSCRIPT, grounded ONLY in what people actually said, extract two things: '
        + '(1) durable FACTS about the members — who they are, what they are into, ongoing situations, stable preferences, how they tend to act in the room. Attribute each to the member BY NAME in "subject". '
        + '(2) BITS — the room\'s inside jokes, nicknames, recurring teases, running gags, phrases that became the room\'s own. A bit must be genuinely re-usable later ("the samosa incident — never explained, always funny", "they call Rahul \'the professor\'"), not one-off banter. Mark these "kind":"bit". '
        + 'This is a SHARED room: everything here was said in front of everyone, so it is fair for the room to remember together — but keep it to what belongs to the ROOM (who-we-are, our jokes, our dynamics), not a deep private confession that happened to be typed here. '
        + 'NEVER store anyone\'s age or date of birth, in any form. No passing mood or one-off chit-chat. '
        + 'Return ONLY a JSON array of {"key":"short label","value":"in plain language","kind":"fact"|"bit","subject":"member name or empty string"}. Empty array [] if nothing durable. No prose, no markdown.',
      messages: [{ role: 'user', content: `ROOM TRANSCRIPT (most recent):\n${transcript}` }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const items: { key: string; value: string; kind?: string; subject?: string }[] = JSON.parse(clean);
    if (!Array.isArray(items) || items.length === 0) return 0;
    let n = 0;
    for (const f of items) {
      if (!f?.value) continue;
      const kind = (f as any).kind === 'bit' ? 'bit' : 'note';
      const subject = ((f as any).subject || '').trim() || null;
      if (f.key) {
        const { data: ex } = await supabase
          .from('room_memory').select('id').eq('thread_id', threadId).eq('key', f.key).maybeSingle();
        if (ex) {
          await supabase.from('room_memory')
            .update({ value: f.value, subject_name: subject, kind, updated_at: new Date().toISOString() })
            .eq('id', (ex as any).id);
          n++; continue;
        }
      }
      await supabase.from('room_memory').insert({ thread_id: threadId, key: f.key ?? null, value: f.value, kind, subject_name: subject });
      n++;
    }
    return n;
  } catch {
    return 0;   // best-effort; never break anything over memory
  }
}

// Nightly: harvest every shared room with recent activity.
export async function runRoomMemoryHarvest(): Promise<{ rooms: number; items: number }> {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from('messages').select('thread_id, created_at').gte('created_at', since);
  const threadIds = [...new Set((active ?? []).map((r: any) => String(r.thread_id)))];
  if (!threadIds.length) return { rooms: 0, items: 0 };
  const { data: shared } = await supabase
    .from('threads').select('id').in('id', threadIds).eq('is_shared', true).is('deleted_at', null);
  let rooms = 0, items = 0;
  for (const t of (shared ?? []) as any[]) {
    const n = await harvestRoomMemory(t.id);
    if (n > 0) { rooms++; items += n; }
  }
  console.log(`[room-memory] harvested ${items} items across ${rooms} rooms`);
  return { rooms, items };
}
