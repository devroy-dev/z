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
  const dynamic = `\n\n[${todayLine}]${memoryBlock}`;

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

  // persist the user's message
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'user', content: message });

  const messages: Anthropic.MessageParam[] = [...priorTurns, { role: 'user', content: message }];

  // ── the one Haiku call (streamed) ─────────────────────────────────────
  // INTELLECT-only web tool wiring goes here later (persona.webEnabled).
  const stream = anthropic.messages.stream({ model: MODEL, max_tokens: 1024, system, messages });
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
