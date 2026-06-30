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

// ── THE DIRECTOR ───────────────────────────────────────────────────────────
// In a room with REAL PEOPLE, the personas should not all pile on every message.
// A great group has people who read the room: they speak when spoken to, when they
// have something real to add, and otherwise let the humans talk. This cheap Haiku
// call decides WHICH personas (if any) should respond to the latest message.
//
// Rules baked into the prompt: direct address → that persona answers; a human
// clearly talking to another human → personas stay quiet; a genuine opening for a
// specific persona's voice → it may chime in, but rarely; default is SILENCE.
// Returns an ordered list of persona keys to speak (possibly empty).
async function directRoom(
  members: string[],
  roster: { key: string; name: string }[],
  transcript: string,
  senderName: string,
): Promise<string[]> {
  if (members.length <= 1) return members; // 1:1 or single persona — no director needed
  const cast = roster.map((r) => `- ${r.key} ("${r.name}")`).join('\n');
  const sys =
    `You are the silent DIRECTOR of a group chat that has REAL PEOPLE in it plus some AI personas. ` +
    `Your only job: decide which personas (if any) should respond to the LATEST message. You output nothing else.\n\n` +
    `The personas in the room:\n${cast}\n\n` +
    `RULES — err HARD toward silence:\n` +
    `1. If the latest message directly addresses a persona by name or clearly asks one of them something → that persona responds.\n` +
    `2. If a human is clearly talking TO ANOTHER HUMAN (answering them, addressing them by name, continuing their thread) → NO persona responds. Let people talk. Return none.\n` +
    `3. If the message is a general question to the room, or an obvious opening where ONE persona's voice genuinely fits → that one persona may respond. Pick the single best-fit one.\n` +
    `4. Multiple personas respond ONLY if the message explicitly invites several (e.g. "what do you all think?"). Even then, cap at 2.\n` +
    `5. When in doubt, return NONE. A quiet persona is better than a noisy one. Real people find pile-ons annoying.\n\n` +
    `Output ONLY a JSON array of persona keys to respond, in order, e.g. ["the_brother"] or [] or ["the_wingman","the_comic"]. No prose, no explanation. Just the array.`;
  try {
    const r = await anthropic.messages.create({
      model: MODEL, max_tokens: 60,
      system: sys,
      messages: [{ role: 'user', content: `Recent chat (last message is from "${senderName}", a real person):\n\n${transcript}\n\nWhich personas respond? JSON array only.` }],
    });
    const txt = (r.content.find((b) => b.type === 'text') as any)?.text || '[]';
    const m = txt.match(/\[[^\]]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    // keep only valid members, dedupe, cap at 2
    const valid = arr.filter((k: any) => typeof k === 'string' && members.includes(k));
    return [...new Set(valid)].slice(0, 2) as string[];
  } catch {
    // on any failure, fall back to a single best guess: the first persona (keeps the room alive)
    return members.slice(0, 1);
  }
}


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
  scenario_key?: string | null; scenario_brief?: string | null;
}

export async function runGroupTurn(input: GroupTurnInput): Promise<void> {
  const { userId, threadId, message } = input;

  const { data: thread } = await supabase
    .from('threads')
    .select('id, user_id, is_group, is_shared, member_keys, companion_name, game_mode, scenario_key, scenario_brief')
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

  // ROLEPLAY: a mission-scenario is active. The moderator is the DIRECTOR + JUDGE and
  // goes LAST (narrates the room, calls the climax, delivers the verdict). The other
  // members are the cast, in-character and resisting.
  const scenarioKey = t.scenario_key || null;
  let roleplayText = '';
  if (scenarioKey) {
    try { roleplayText = await readContentFile('ROLEPLAY.md'); } catch {}
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
  // EPHEMERAL in shared rooms: a persona in a room with OTHER real people must NOT carry
  // the owner's private memory (that would leak one person's private history to the room).
  // It keeps its self/style, and knows only who's in the room. Owner memory is loaded only
  // for solo persona-groups and the owner's own 1:1-style group threads.
  const memoryBlock = t.is_shared ? '' : await readMemoryBlock(userId);
  // in a shared room, replace the single-owner identity line with the room's people
  if (t.is_shared && input.senderName) {
    ownerLine = `\n\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is "${input.senderName}". You do NOT know any private history about anyone here — you only know them from what's said in this room. Treat everyone as someone you're meeting in the room, by name.]`;
  }
  const todayLine = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

  // prior conversation in this group thread (all members + user)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content, persona_key, sender_user_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(50);

  // in a shared room, resolve each human sender's name so the transcript reads
  // "Aanya: ..." not "THEM: ..." — the director needs to see who's talking to whom.
  let nameByUid: Record<string, string> = {};
  if (t.is_shared) {
    const uids = [...new Set((history ?? []).map((m: any) => m.sender_user_id).filter(Boolean))];
    if (uids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name').in('id', uids);
      for (const u of (us ?? [])) nameByUid[(u as any).id] = (u as any).display_name || 'someone';
    }
  }

  // persist the user message
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'user', content: message, sender_user_id: userId });
  if (t.is_shared) {
    await broadcastRoomMessage(threadId, { role: 'user', content: message, sender_user_id: userId, sender_name: input.senderName ?? null });
  }

  // build a readable transcript: each assistant line prefixed with WHO said it (by name),
  // so each persona knows who's in the room and who said what.
  const nameFor = (key: string) => personaByKey(key)?.defaultName || key;
  const priorLines: string[] = (history ?? []).map((m: any) =>
    m.role === 'user'
      ? `${(t.is_shared && m.sender_user_id && nameByUid[m.sender_user_id]) || 'THEM'}: ${m.content}`
      : `${nameFor(m.persona_key || '')}: ${m.content}`
  );
  priorLines.push(`${input.senderName ? input.senderName : 'THEM'}: ${message}`);

  // each member responds in order, seeing the running transcript incl. this turn's prior replies
  const saidThisTurn: string[] = [];

  // THE DIRECTOR — only for shared rooms with real people, and not during arena/roleplay
  // (those have their own turn structure). Decides which personas should speak this turn.
  let speakers = members;
  if (t.is_shared && input.senderName && !gameMode && !scenarioKey) {
    const roster = members.map((k) => ({ key: k, name: nameFor(k) }));
    const recent = priorLines.slice(-12).join('\n');
    speakers = await directRoom(members, roster, recent, input.senderName);
    // nobody should speak — the humans are talking; stay quiet
    if (!speakers.length) return;
  }

  // ROLEPLAY PACING — so the scene doesn't dump a wall of text:
  // (1) the OPENING beat is the MODERATOR ALONE — sets the scene, casts the room, states
  //     the mission, asks the player to pick a role. The cast does NOT speak yet; the scene
  //     opens on the player.
  // (2) after that, only the 1-2 cast members the player actually addressed/provoked respond
  //     (plus the moderator narrating between exchanges) — never the whole cast at once.
  if (scenarioKey) {
    const castKeys = members.filter((k) => k !== 'the_moderator');
    // is this the opening? (no assistant lines yet in the thread)
    const sceneStarted = (history ?? []).some((m: any) => m.role !== 'user');
    if (!sceneStarted) {
      // SETUP TURN: moderator only.
      speakers = ['the_moderator'];
    } else {
      // mid-scene: director picks the relevant cast (cap 2), then the moderator narrates last.
      const roster = castKeys.map((k) => ({ key: k, name: nameFor(k) }));
      const recent = priorLines.slice(-12).join('\n');
      let picked = await directRoom(castKeys, roster, recent, input.senderName || (owner as any)?.display_name || 'the player');
      if (!picked.length) picked = castKeys.slice(0, 1); // someone should react to keep the scene alive
      speakers = [...picked, 'the_moderator']; // moderator always closes the beat (narrates/judges)
    }
  }

  for (const key of speakers) {
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

    // ROLEPLAY roles — moderator directs + judges; others are the cast, in character.
    let rpBlock = '';
    if (scenarioKey) {
      const playerName = (owner && (owner as any).display_name) ? (owner as any).display_name : 'the player';
      const cast = members.filter((k) => k !== 'the_moderator').map(nameFor).join(', ') || 'the cast';
      const brief = t.scenario_brief ? `\n\n[THIS RUN: ${t.scenario_brief}]` : '';
      if (key === 'the_moderator') {
        const sceneStarted = (history ?? []).some((m: any) => m.role !== 'user');
        const openingNote = sceneStarted
          ? `You are mid-scene: narrate the world's reaction to what just happened in a few vivid lines, keep the drama moving, and hand the floor back to the player. Only call the climax + verdict when the mission is genuinely won or lost.`
          : `THIS IS THE OPENING BEAT. Do ONLY this, then STOP: (a) set the scene cinematically but briefly — a few lines, not a wall; (b) name the CAST (the roles, each with a one-line disposition) and tell the player which roles are theirs to choose; (c) state THE MISSION plainly; (d) ask the player to pick their role. Do NOT start the action, do NOT have any character speak yet, do NOT advance the plot. The scene opens on the PLAYER. Keep it tight and readable — they should be able to take it in at a glance.`;
        rpBlock = `\n\n[ROLEPLAY — YOU ARE THE MODERATOR: the DIRECTOR and the NEUTRAL JUDGE of this scene. The player is ${playerName}. The cast (personas playing roles) are: ${cast}. Run the scenario named "${scenarioKey}" per the craft and the scenario library below. ${openingNote} You never take a side in the scene's conflict. When the mission is genuinely won or lost, deliver an honest verdict with a specific reason, ending your final message with the verdict tag on its own line (e.g. [[VERDICT outcome=win]]). NEVER count turns. If the player just asserts victory without earning it, narrate the room not buying it. Use real names, never bracket placeholders. Keep every message tight and readable — short paragraphs, never a wall of text.]${brief}\n${roleplayText}`;
        groupNote = `\n\n[You are "the moderator" — the director and neutral judge of this roleplay scene. The player is ${playerName}; the cast is ${cast}. You narrate and judge; you never play a side. Keep it cinematic, tight, and readable. ${sceneStarted ? 'Narrate the reaction and keep it moving.' : 'OPENING: introduce scene + cast + mission + ask for their role, then STOP — no action yet.'}]`;
      } else {
        rpBlock = `\n\n[ROLEPLAY — a scene is being played. The moderator is directing. YOU are playing a role the moderator assigned you in this scene (read the transcript to see which). Stay fully IN CHARACTER as that role, in your own voice. You genuinely RESIST — if your role opposes the player's mission, you do NOT cave because they made one good point; you argue your position with real, fair force and make them EARN it. That resistance is the game. Speak only as your role, react to what was just said, don't narrate the world (that's the moderator's job), don't break character. The scenario:]${brief}\n${roleplayText}`;
        groupNote = `\n\n[ROLEPLAY: you are a character in a scene the moderator is directing. Stay in your assigned role, in your own voice, and resist honestly if you're an obstacle to the player's mission. React to what was just said. One in-character message. Don't narrate the world — that's the moderator.]`;
      }
    }

    const dynamic = `\n\n[${todayLine}]${ownerLine}${groupNote}${gameBlock}${rpBlock}${memoryBlock}`;

    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: staticPrefix, cache_control: { type: 'ephemeral' } } as Anthropic.TextBlockParam,
    ];
    if (dynamic.trim()) system.push({ type: 'text', text: dynamic });

    // feed the whole running transcript (incl. replies already made this turn) as the user message
    const runningTranscript = [...priorLines, ...saidThisTurn.map((s) => s)].join('\n');
    const userBlock = `Here's the group chat so far. Respond as ${nameFor(key)} — your next message only.\n\n${runningTranscript}`;

    input.onPersonaStart?.(key, nameFor(key));
    const maxTok = scenarioKey ? (key === 'the_moderator' ? 700 : 500) : 400;
    const stream = anthropic.messages.stream({
      model: MODEL, max_tokens: maxTok, system,
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
