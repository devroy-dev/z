// roomMemory.ts — GROUP MEMORY (the moat).
//
// v1: a shared room's COLLECTIVE memory — facts about members + the room's bits,
//     harvested only from in-room talk, injected back only into that room.
// v2: adds a PER-PERSONA layer. Each persona also keeps its OWN read of the room
//     (persona_key set) — how it sees the members, who it needles, its running
//     dynamic — on top of the collective memory (persona_key null) everyone shares.
//     Plus a continuity nudge so a returning persona picks up the thread.
//
// Still distinct from per-user PRIVATE memory (memory.ts), which stays suppressed
// in shared rooms. Nothing here crosses the room boundary.
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import Anthropic from '@anthropic-ai/sdk';
import { llm } from './llm.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

// Pull the room's memory for THIS persona's turn: the collective memory everyone
// shares, plus (if a persona is given) that persona's own read of the room.
export async function readRoomMemoryBlock(threadId: string, personaKey?: string): Promise<string> {
  let q = supabase.from('room_memory')
    .select('kind, key, value, subject_name, persona_key')
    .eq('thread_id', threadId);
  q = personaKey ? q.or(`persona_key.is.null,persona_key.eq.${personaKey}`) : q.is('persona_key', null);
  const { data } = await q.order('weight', { ascending: false }).limit(60);
  if (!data || data.length === 0) return '';

  const collective = (data as any[]).filter((m) => !m.persona_key);
  const mine = personaKey ? (data as any[]).filter((m) => m.persona_key === personaKey) : [];
  const facts = collective.filter((m) => m.kind !== 'bit');
  const bits = collective.filter((m) => m.kind === 'bit');
  const fmt = (m: any) => {
    const who = m.subject_name ? `${m.subject_name} — ` : '';
    return m.key ? `- ${who}${m.key}: ${m.value}` : `- ${who}${m.value}`;
  };

  let block = '';
  if (facts.length) {
    block += `\n\n[WHAT YOU REMEMBER ABOUT THIS ROOM — your shared history with these people, built over your time together here. This is the room's collective memory: only what has happened in THIS room. You know no private history about anyone from outside it. You've shared time here before; a regular returning naturally picks up the thread — a callback to the room's history, or (from YOUR LIFE OUTSIDE) a bit of your own news — when it fits, never forced, never recited as a list.]\n${facts.map(fmt).join('\n')}\n`;
  }
  if (bits.length) {
    block += `\n[THE ROOM'S RUNNING JOKES & DYNAMICS — inside jokes, nicknames, recurring bits this room made together. The law of a bit: use SPARINGLY (a callback lands because it's rare), never explain the joke, never force one — but the right callback three sessions later is what makes a room feel like home.]\n${bits.map(fmt).join('\n')}\n`;
  }
  if (mine.length) {
    block += `\n[YOUR OWN READ OF THIS ROOM — how YOU in particular see these people and this room: who you click with, who you needle, your running dynamic here. This is yours, not the room's — it colours how you treat each person, quietly. Never announce it.]\n${mine.map((m) => (m.key ? `- ${m.key}: ${m.value}` : `- ${m.value}`)).join('\n')}\n`;
  }
  return block;
}

// Harvest the room's memory from its recent transcript in ONE pass:
//   - collective FACTS about members (by name) + BITS (the running gags)
//   - each present persona's OWN read of the room (its relationships/dynamic)
// Upserts collective by (thread_id, null, key) and per-persona by (thread_id, persona_key, key).
// Best-effort. Returns the number of items written/updated.
export async function harvestRoomMemory(threadId: string): Promise<number> {
  try {
    const { data: th } = await supabase.from('threads')
      .select('member_keys, is_session').eq('id', threadId).maybeSingle();
    if ((th as any)?.is_session) return 0;   // [R4] THE WALL: the function itself refuses sessions — every caller is covered
    const roomPersonaKeys: string[] = ((th as any)?.member_keys || []).filter(Boolean);

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
    // name -> key, for mapping the model's per-persona reads back to a key
    const keyByName: Record<string, string> = {};
    for (const k of roomPersonaKeys) keyByName[nameFor(k).toLowerCase()] = k;
    const personaList = roomPersonaKeys.map(nameFor).join(', ') || '(none)';

    const transcript = rows.map((m) => {
      const who = m.role === 'user'
        ? ((m.sender_user_id && nameByUid[m.sender_user_id]) || 'someone')
        : nameFor(m.persona_key || '');
      return `${who}: ${m.content}`;
    }).join('\n');

    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        'You maintain the MEMORY of a group chat room — what a regular would remember about this room and the people in it, built from what was actually said HERE. '
        + 'From the TRANSCRIPT, grounded ONLY in what people actually said, produce THREE things: '
        + '(1) "facts": durable facts about the human members — who they are, what they are into, ongoing situations, stable preferences, how they tend to act. Attribute each to the member BY NAME in "subject". '
        + '(2) "bits": the room\'s inside jokes, nicknames, recurring teases, running gags, phrases that became the room\'s own — genuinely re-usable later ("the samosa incident — always funny"), not one-off banter. '
        + '(3) "personaReads": for EACH of the room\'s PERSONAS (' + personaList + '), that persona\'s OWN read of the room — its attitude toward the members, who it clicks with or needles, its running dynamic here — one short line, in third person, keyed by the persona\'s name in "persona". Only include personas that actually appeared. '
        + 'This is a SHARED room: everything here was said in front of everyone, so it is fair for the room to remember together — but keep it to what belongs to the ROOM (who-we-are, our jokes, our dynamics), not a deep private confession that happened to be typed here. '
        + 'NEVER store anyone\'s age or date of birth. No passing mood or one-off chit-chat. '
        + 'Return ONLY JSON: {"facts":[{"key","value","subject"}],"bits":[{"key","value"}],"personaReads":[{"persona","read"}]}. Empty arrays if nothing durable. No prose, no markdown.',
      messages: [{ role: 'user', content: `ROOM PERSONAS: ${personaList}\n\nROOM TRANSCRIPT (most recent):\n${transcript}` }],
    });
    const text = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean) as {
      facts?: { key?: string; value?: string; subject?: string }[];
      bits?: { key?: string; value?: string }[];
      personaReads?: { persona?: string; read?: string }[];
    };
    let n = 0;

    const upsert = async (personaKey: string | null, kind: string, key: string | null, value: string, subject: string | null) => {
      if (!value) return;
      if (key) {
        let sel = supabase.from('room_memory').select('id').eq('thread_id', threadId).eq('key', key);
        sel = personaKey ? sel.eq('persona_key', personaKey) : sel.is('persona_key', null);
        const { data: ex } = await sel.maybeSingle();
        if (ex) {
          await supabase.from('room_memory')
            .update({ value, subject_name: subject, kind, updated_at: new Date().toISOString() })
            .eq('id', (ex as any).id);
          n++; return;
        }
      }
      await supabase.from('room_memory').insert({ thread_id: threadId, persona_key: personaKey, key: key ?? null, value, kind, subject_name: subject });
      n++;
    };

    for (const f of (parsed.facts ?? [])) await upsert(null, 'note', f.key ?? null, (f.value || '').trim(), (f.subject || '').trim() || null);
    for (const b of (parsed.bits ?? [])) await upsert(null, 'bit', b.key ?? null, (b.value || '').trim(), null);
    for (const pr of (parsed.personaReads ?? [])) {
      const pkey = keyByName[(pr.persona || '').trim().toLowerCase()];
      if (!pkey || !pr.read) continue;
      await upsert(pkey, 'note', 'room_read', pr.read.trim(), null);
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
    .from('threads').select('id').in('id', threadIds).eq('is_shared', true).eq('is_session', false).is('deleted_at', null);   // [R4] the wall: sessions are never harvested
  let rooms = 0, items = 0;
  for (const t of (shared ?? []) as any[]) {
    const nn = await harvestRoomMemory(t.id);
    if (nn > 0) { rooms++; items += nn; }
  }
  console.log(`[room-memory] harvested ${items} items across ${rooms} rooms`);
  return { rooms, items };
}
