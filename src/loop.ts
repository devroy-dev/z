// loop.ts — the Z turn. One Haiku agent. Forked from the consult path:
//   STATIC (cached): soul (with [companion_name] injected) + the thread's Codex(es).
//                    Identical every turn → cache_control:ephemeral, ~10% cost on reads.
//   DYNAMIC (uncached): today's date + the shared memory block. Changes per turn.
// No Donna, no two-agent rig. The Codex IS the preparation; Z names it to no one.
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { buildStaticPrefix, readContentFile } from './content.js';
import { readMemoryBlock, harvestMemory } from './memory.js';
import { personaByKey, type CodexKey } from './personas.js';

const anthropic = new Anthropic();
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

  // ── STATIC (cached): soul + name + Codex ──────────────────────────────
  const staticPrefix = buildStaticPrefix(t.companion_name, t.companion_gender, codexKeys, (thread as any).region ?? null);

  // ── DYNAMIC (uncached): date + shared memory ──────────────────────────
  const todayLine = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  const memoryBlock = await readMemoryBlock(userId);

  // ── OWNER IDENTITY (dynamic, uncached): who Z is talking to ──────────────
  // Per-user, not per-persona, so it lives in the dynamic block and never busts
  // the cached soul. Z greets and reasons knowing the actual person.
  const { data: owner } = await supabase
    .from('users')
    .select('display_name, region, serious_mode, dob')
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
    ownerLine = `\n\n[WHO YOU'RE TALKING TO: ${who}${where}${ageBit}. This is the real person on the other end — speak to them by name when it's natural, mirror how people talk where they're from, meet them at their age (a 19-year-old and a 45-year-old need very different things from the same words), and never read this aloud as a label.]`;
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
    frontDeskBlock = `\n\n[THE LIST YOU HOLD — these are the user's open tasks.${listText}\n\nTO MANAGE THE LIST, emit a tag on its OWN line (the app reads these; the user never sees the raw tag):\n  • add a task:    [[TASK_ADD: the task title | due: tomorrow 5pm | room: the_orator]]   (due and room optional)\n  • mark it done:  [[TASK_DONE: <the {id} of the task>]]\nTO SUGGEST PEOPLE TO TALK TO (your concierge routing), emit one tag per suggested persona on its OWN line — the app turns each into a tappable chip:\n  • [[GOTO: the_brother]]   (use the persona key; also valid: the_stage for roleplay, the_arena for games)\nWhen someone's unsure what they need or you're greeting them fresh, do the mood read: a warm light question, then suggest 2-3 people with GOTO tags. When you add/complete a task, still say it warmly ("added — it's on your list"). Emit at most a couple of tags per turn. Never show the user the {id} or the raw tags.]`;
  }

  const dynamic = `\n\n[${todayLine}]${ownerLine}${seriousLine}${gameLine}${frontDeskBlock}${memoryBlock}`;

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

  // build this turn's user content — text, plus a vision image block when attached
  let userContent: any = message;
  if (input.image && /^image\/(jpeg|png|gif|webp)$/.test(input.image.media_type)) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: input.image.media_type, data: input.image.data } },
      { type: 'text', text: message || 'what do you make of this?' },
    ];
  }
  const messages: Anthropic.MessageParam[] = [...priorTurns, { role: 'user', content: userContent }];

  // ── the Haiku call (streamed) ─────────────────────────────────────────
  // Web-enabled personas (brainiac, comic, screen junkie) get Anthropic's server-side
  // web_search tool so they can reach live facts (current films, what's streaming, today's
  // references) instead of bluffing from training data. The model runs the search itself;
  // no manual tool round-trip needed. Capped to keep turns tight and cheap.
  const tools: any[] = [];
  if (persona?.webEnabled) {
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 4 });
  }
  const streamArgs: any = { model: MODEL, max_tokens: 1024, system, messages };
  if (tools.length) streamArgs.tools = tools;
  const stream = anthropic.messages.stream(streamArgs);
  stream.on('text', (d) => input.onToken?.(d));
  const final = await stream.finalMessage();

  let reply = final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');

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
        if (dm) { const d = new Date(dm[1]); if (!isNaN(d.getTime())) row.due_at = d.toISOString(); }
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
    // strip the raw GOTO tags from the visible/persisted text — the chips carry them now
    reply = reply.replace(/\[\[GOTO:[^\]]*\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
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
  void harvestMemory(userId, threadId, message, reply);

  return { reply, usage, sources, routes };
}
