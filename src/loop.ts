// loop.ts — the Z turn. One Haiku agent. Forked from the consult path:
//   STATIC (cached): soul (with [companion_name] injected) + the thread's Codex(es).
//                    Identical every turn → cache_control:ephemeral, ~10% cost on reads.
//   DYNAMIC (uncached): today's date + the shared memory block. Changes per turn.
// No Donna, no two-agent rig. The Codex IS the preparation; Z names it to no one.
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { buildStaticPrefix } from './content.js';
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
}

interface ThreadRow {
  id: string; user_id: string; persona_key: string; codex_key: string;
  companion_name: string; companion_gender: string | null;
}

export async function runZTurn(input: ZTurnInput): Promise<ZTurnResult> {
  const { userId, threadId, message } = input;

  // load the thread (the persona instance)
  const { data: thread } = await supabase
    .from('threads')
    .select('id, user_id, persona_key, codex_key, companion_name, companion_gender')
    .eq('id', threadId).eq('user_id', userId).is('deleted_at', null)
    .maybeSingle();
  if (!thread) throw new Error('thread not found');
  const t = thread as ThreadRow;

  const persona = personaByKey(t.persona_key);
  const codexKeys: CodexKey[] = [t.codex_key as CodexKey];

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
    .select('display_name, region')
    .eq('id', userId).maybeSingle();
  let ownerLine = '';
  if (owner && (owner.display_name || owner.region)) {
    const who = owner.display_name ? owner.display_name : 'this person';
    const where = owner.region ? `, from ${owner.region}` : '';
    ownerLine = `\n\n[WHO YOU'RE TALKING TO: ${who}${where}. This is the real person on the other end — speak to them by name when it's natural, mirror how people talk where they're from, and never read this aloud as a label.]`;
  }

  const dynamic = `\n\n[${todayLine}]${ownerLine}${memoryBlock}`;

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

  const reply = final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
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

  return { reply, usage };
}
