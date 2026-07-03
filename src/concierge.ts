// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE CONCIERGE. The desk's hands: bookings, reminders, feedback,
//  and the clock that delivers them. Tags the desk emits are EXECUTED here
//  server-side, then stripped from the persisted reply.
//
//  BOOK v1 scope: creates the ROOM (with the persona seated) + a scheduled
//  ping that lands at the hour, walking the user in. The game session itself
//  is dealt when they sit — pre-dealt tables go stale; a set table doesn't.
//
//  Delivery: startPingScheduler sweeps z.scheduled_pings every minute and
//  drops each due row as a real message in the right thread. When FCM lands,
//  only the delivery layer changes — these rows stay the source of truth.
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './db.js';
import { personaByKey } from './personas.js';

// ── natural time, IST-aware: "9pm", "tonight 9", "tomorrow 5pm", "in 2 hours", ISO ──
const IST_MS = 5.5 * 3600e3;
export function parseWhen(raw: string, now = new Date()): Date | null {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  const iso = new Date(s);
  if (!isNaN(iso.getTime()) && /\d{4}-\d{2}-\d{2}/.test(s)) return iso;
  const rel = s.match(/^in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const ms = /^h/.test(rel[2]) ? n * 3600e3 : n * 60e3;
    return new Date(now.getTime() + ms);
  }
  // clock time, optionally with a day word
  const tm = s.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s|$)/);
  if (!tm) return null;
  let hour = parseInt(tm[1], 10);
  const min = tm[2] ? parseInt(tm[2], 10) : 0;
  if (tm[3] === 'pm' && hour < 12) hour += 12;
  if (tm[3] === 'am' && hour === 12) hour = 0;
  // no am/pm given: single digits and up to 11 lean evening in chat ("at 9" = 9pm)
  if (!tm[3] && hour >= 1 && hour <= 11) hour += 12;
  const istNow = new Date(now.getTime() + IST_MS);
  const day = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), hour, min));
  let due = new Date(day.getTime() - IST_MS); // back to UTC
  if (/tomorrow/.test(s)) due = new Date(due.getTime() + 864e5);
  else if (due.getTime() <= now.getTime()) due = new Date(due.getTime() + 864e5); // past today → tomorrow
  return due;
}

const GAME_NAMES: Record<string, string> = {
  poker: "hold'em", callbreak: 'callbreak', pusoy: 'pusoy dos', ludo: 'ludo',
  liarsdice: "liar's dice", teenpatti: 'teen patti', blackjack: 'blackjack',
  bluff: 'bluff', uno: 'uno', snakes: 'snakes & ladders', trivia: 'trivia',
  debate: 'debate', riddle: 'riddle me', twenty: '20 questions', wyr: 'would you rather', dilemma: 'dilemma',
};

// executes concierge tags in a desk reply; returns the reply with tags stripped
export async function executeConciergeTags(reply: string, userId: string): Promise<string> {
  let out = reply;
  let m: RegExpExecArray | null;

  // [[REMIND: text | when]]
  const remRe = /\[\[REMIND:\s*([^\]]+)\]\]/gi;
  while ((m = remRe.exec(reply)) !== null) {
    const [text, when] = m[1].split('|').map((x) => x.trim());
    const due = parseWhen(when || '');
    if (!text || !due) continue;
    await supabase.from('scheduled_pings').insert({
      user_id: userId, persona_key: 'the_front_desk', kind: 'reminder',
      body: `a reminder you asked me to hold: ${text.slice(0, 240)}`, due_at: due.toISOString(),
    });
  }

  // [[BOOK: game | persona_key | when]]
  const bookRe = /\[\[BOOK:\s*([^\]]+)\]\]/gi;
  while ((m = bookRe.exec(reply)) !== null) {
    const [game, pkey, when] = m[1].split('|').map((x) => x.trim().toLowerCase());
    const persona = personaByKey(pkey || '');
    const due = parseWhen(when || '');
    if (!game || !persona || !due) continue;
    const gname = GAME_NAMES[game] || game;
    const { data: room } = await supabase.from('threads').insert({
      user_id: userId, is_group: true, is_shared: true, member_keys: [persona.key],
      companion_name: `${gname} with ${persona.defaultName}`,
    }).select('id, companion_name').single();
    if (!room) continue;
    await supabase.from('room_members').insert({ thread_id: room.id, user_id: userId, role: 'owner' });
    await supabase.from('scheduled_pings').insert({
      user_id: userId, persona_key: 'the_front_desk', kind: 'booking', thread_id: null,
      body: `your table's ready — ${gname} with ${persona.defaultName}, as booked. the room's set; go sit.`,
      payload: { game, room_id: room.id, persona: persona.key }, due_at: due.toISOString(),
    });
  }

  // [[FEEDBACK: text]]
  const fbRe = /\[\[FEEDBACK:\s*([^\]]+)\]\]/gi;
  while ((m = fbRe.exec(reply)) !== null) {
    const body = m[1].trim().slice(0, 2000);
    if (body) await supabase.from('feedback').insert({ user_id: userId, body, context: 'the_front_desk chat' });
  }

  out = out.replace(/\[\[(?:REMIND|BOOK|FEEDBACK):[^\]]*\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

async function threadFor(userId: string, personaKey: string): Promise<string | null> {
  const p = personaByKey(personaKey);
  if (!p) return null;
  const { data: ex } = await supabase.from('threads')
    .select('id').eq('user_id', userId).eq('persona_key', personaKey)
    .eq('is_group', false).is('deleted_at', null)
    .order('last_active', { ascending: false }).limit(1).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from('threads').insert({
    user_id: userId, persona_key: personaKey, codex_key: p.codex, companion_name: p.defaultName,
  }).select('id').single();
  return error ? null : data.id;
}

// sweep due pings → real messages in the right thread
export async function firePings(): Promise<{ due: number; delivered: number }> {
  const { data: due } = await supabase.from('scheduled_pings')
    .select('id, user_id, persona_key, thread_id, kind, body')
    .is('fired_at', null).lte('due_at', new Date().toISOString()).limit(50);
  let delivered = 0;
  for (const p of (due ?? []) as any[]) {
    try {
      const tid = p.thread_id || await threadFor(p.user_id, p.persona_key);
      if (!tid) continue;
      await supabase.from('messages').insert({ thread_id: tid, user_id: p.user_id, role: 'assistant', content: p.body, persona_key: p.persona_key });
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', tid);
      await supabase.from('scheduled_pings').update({ fired_at: new Date().toISOString() }).eq('id', p.id);
      delivered++;
    } catch (e: any) { console.error('[pings] delivery failed', p.id, e?.message || e); }
  }
  return { due: (due ?? []).length, delivered };
}

export function startPingScheduler() {
  setInterval(async () => {
    try { const r = await firePings(); if (r.due) console.log('[pings]', r); }
    catch (e: any) { console.error('[pings] sweep failed:', e?.message || e); }
  }, 60 * 1000);
  console.log('[pings] delivery scheduler armed (every 60s)');
}
