// groupLoop.ts — a group chat: several personas in one thread, talking to the user
// and riffing off each other. Sequential turn-taking: each member responds in order,
// and each one SEES what the members before it just said this turn (so they react).
//
// Built on the same spine as runZTurn (soul + per-persona codex + dynamic owner block),
// just looped over members. Each member's reply is tagged with its persona key so the
// surface can show the right name/face per bubble.
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { buildStaticPrefix, readContentFile } from './content.js';
import { readMemoryBlock } from './memory.js';
import { personaByKey, type CodexKey } from './personas.js';
import { broadcastRoomMessage } from './broadcast.js';

const anthropic = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';

export interface GroupTurnInput {
  userId: string;
  threadId: string;
  message: string;
  senderName?: string;   // in a shared room: the human who just spoke
  onPersonaStart?: (personaKey: string, name: string) => void;
  onToken?: (personaKey: string, t: string) => void;
  onPersonaEnd?: (personaKey: string, full: string) => void;
}

interface GroupThreadRow {
  id: string; user_id: string; is_group: boolean; is_shared?: boolean;
  member_keys: string[]; companion_name: string | null; game_mode?: string | null;
}

export async function runGroupTurn(input: GroupTurnInput): Promise<void> {
  const { userId, threadId, message } = input;

  const { data: thread } = await supabase
    .from('threads')
    .select('id, user_id, is_group, is_shared, member_keys, companion_name, game_mode')
    .eq('id', threadId).is('deleted_at', null)
    .maybeSingle();
  if (!thread) throw new Error('thread not found');
  const t = thread as GroupThreadRow;
  let members = (t.member_keys || []).filter(Boolean);
  if (!members.length) throw new Error('group has no members');

  // ARENA: if a game is active, the moderator is the neutral JUDGE and always goes LAST,
  // so it can score the round after seeing the opponent's and the player's moves.
  const gameMode = t.game_mode || null;
  let gamesText = '';
  if (gameMode) {
    try { gamesText = await readContentFile('GAMES.md'); } catch {}
    // ensure the moderator is present and ordered last
    members = members.filter((k) => k !== 'the_moderator');
    members.push('the_moderator');
  }

  // owner identity (shared across all members this turn)
  const { data: owner } = await supabase
    .from('users').select('display_name, region').eq('id', userId).maybeSingle();
  let ownerLine = '';
  if (owner && (owner.display_name || owner.region)) {
    const who = owner.display_name || 'this person';
    const where = owner.region ? `, from ${owner.region}` : '';
    ownerLine = `\n\n[WHO YOU'RE TALKING TO: ${who}${where}.]`;
  }
  const memoryBlock = await readMemoryBlock(userId);
  const todayLine = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

  // prior conversation in this group thread (all members + user)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content, persona_key')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(50);

  // persist the user message
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'user', content: message, sender_user_id: userId });
  if (t.is_shared) {
    await broadcastRoomMessage(threadId, { role: 'user', content: message, sender_user_id: userId, sender_name: input.senderName ?? null });
  }

  // build a readable transcript: each assistant line prefixed with WHO said it (by name),
  // so each persona knows who's in the room and who said what.
  const nameFor = (key: string) => personaByKey(key)?.defaultName || key;
  const priorLines: string[] = (history ?? []).map((m: any) =>
    m.role === 'user' ? `THEM: ${m.content}` : `${nameFor(m.persona_key || '')}: ${m.content}`
  );
  priorLines.push(`${input.senderName ? input.senderName : 'THEM'}: ${message}`);

  // each member responds in order, seeing the running transcript incl. this turn's prior replies
  const saidThisTurn: string[] = [];
  for (const key of members) {
    const persona = personaByKey(key);
    if (!persona) continue;
    const codexKeys: CodexKey[] = [persona.codex as CodexKey];
    const staticPrefix = buildStaticPrefix(t.companion_name || persona.defaultName, null, codexKeys, (owner as any)?.region ?? null);

    const others = members.filter((k) => k !== key).map(nameFor).join(', ');
    const sharedNote = input.senderName
      ? ` REAL PEOPLE are in this room with you — not personas. Address them by name, react to what they actually said, be a guest in their conversation. Don't dominate, don't speak for them.`
      : '';
    let groupNote = `\n\n[THIS IS A GROUP CHAT. In the room with you: ${others}. You are "${nameFor(key)}". Speak only as yourself — short, like a real group chat, react to what was just said. Don't speak for the others. Don't narrate. One natural message.${sharedNote}]`;

    // ARENA roles
    let gameBlock = '';
    if (gameMode) {
      if (key === 'the_moderator') {
        const playerName = (owner && (owner as any).display_name) ? (owner as any).display_name : 'the player';
        const oppName = members.filter((k)=>k!=='the_moderator').map(nameFor).join(', ') || 'the opponent';
        gameBlock = `\n\n[ARENA — YOU ARE THE MODERATOR & NEUTRAL JUDGE of a "${gameMode}" match. You do NOT take a side. The player is ${playerName}. The opponent is ${oppName}. ALWAYS use these real names — NEVER write placeholders like [opponent], [player], {player}, or [name] in brackets; say "${playerName}" and "${oppName}" directly. After the opponent and the player have spoken this round, you: (1) judge the round fairly and out loud with a SHORT clear REASON (e.g. "Point to ${playerName} — that rebuttal dismantled the GDP claim and ${oppName} couldn't recover it."), (2) keep the running score, (3) end your message with the score tag on its own line. Be impartial, decisive, brief. Game rules:]\n${gamesText}`;
        groupNote = `\n\n[You are "the moderator", the neutral referee of this match. In the room: ${oppName} (the opponent) and ${playerName} (the player). You are NOT a debater — you judge. Use their real names. Give a short, reasoned verdict each round and keep score.]`;
      } else {
        gameBlock = `\n\n[ARENA — a "${gameMode}" match is on. You are the player's OPPONENT. Play to win, in your own voice, per these rules. You do NOT keep score — the moderator judges. Just play your best.]\n${gamesText}`;
      }
    }

    const dynamic = `\n\n[${todayLine}]${ownerLine}${groupNote}${gameBlock}${memoryBlock}`;

    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: staticPrefix, cache_control: { type: 'ephemeral' } } as Anthropic.TextBlockParam,
    ];
    if (dynamic.trim()) system.push({ type: 'text', text: dynamic });

    // feed the whole running transcript (incl. replies already made this turn) as the user message
    const runningTranscript = [...priorLines, ...saidThisTurn.map((s) => s)].join('\n');
    const userBlock = `Here's the group chat so far. Respond as ${nameFor(key)} — your next message only.\n\n${runningTranscript}`;

    input.onPersonaStart?.(key, nameFor(key));
    const stream = anthropic.messages.stream({
      model: MODEL, max_tokens: 400, system,
      messages: [{ role: 'user', content: userBlock }],
    });
    stream.on('text', (d) => input.onToken?.(key, d));
    const final = await stream.finalMessage();
    const reply = final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();

    // persist with persona_key so the surface knows who spoke
    await supabase.from('messages').insert({
      thread_id: threadId, user_id: userId, role: 'assistant', content: reply, persona_key: key,
    });
    if (t.is_shared) {
      await broadcastRoomMessage(threadId, { role: 'assistant', content: reply, persona_key: key });
    }
    saidThisTurn.push(`${nameFor(key)}: ${reply}`);
    input.onPersonaEnd?.(key, reply);
  }

  await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
}
