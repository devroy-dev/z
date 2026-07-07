// groupLoop.ts — a group chat: several personas in one thread, talking to the user
// and riffing off each other. Sequential turn-taking: each member responds in order,
// and each one SEES what the members before it just said this turn (so they react).
//
// Built on the same spine as runZTurn (soul + per-persona codex + dynamic owner block),
// just looped over members. Each member's reply is tagged with its persona key so the
// surface can show the right name/face per bubble.
import Anthropic from '@anthropic-ai/sdk';
import { llm } from './llm.js';
import { withGapMarker, sinceLine } from './timegap.js';
import { logUsage } from './usage.js';
import { supabase } from './db.js';
import { buildStaticPrefix, readContentFile } from './content.js';
import { readMemoryBlock } from './memory.js';
import { readRoomMemoryBlock } from './roomMemory.js';
import { personaByKey, type CodexKey } from './personas.js';
import { broadcastRoomMessage } from './broadcast.js';
import { stateBlockFor } from './personaStates.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
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
  humanCount: number,
  addressed?: string[],
): Promise<string[]> {
  if (members.length === 0) return members; // no personas to direct
  // EXPLICIT ADDRESS — the human named/tapped specific personas (@name or a face
  // tap). Honor it directly: those personas answer, director bypassed. Up to 3.
  if (addressed && addressed.length) {
    const valid = [...new Set(addressed.filter((k) => members.includes(k)))].slice(0, 3);
    if (valid.length) return valid;
  }
  // SOLO ROOM (just this person + personas): there's no "talking to another human"
  // case, so it should behave like a normal group chat — someone almost always
  // answers. Skip the human-restraint director entirely and let the best-fit
  // persona respond (the director below is tuned for multi-human restraint).
  if (humanCount <= 1) {
    if (members.length === 1) return members; // the one persona answers
    // pick the single best-fit persona for this message
    const cast = roster.map((r) => `- ${r.key} ("${r.name}")`).join('\n');
    const sys =
      `You direct a chat between one person and a few AI personas. Pick who should ` +
      `answer the LATEST message — usually ONE best-fit persona, occasionally TWO if the ` +
      `message clearly invites several (e.g. "what do you all think?"). Someone should ` +
      `almost always answer — this is a lively group chat, not a quiet room.\n\n` +
      `The personas:\n${cast}\n\n` +
      `Output ONLY a JSON array of persona keys, in order, e.g. ["the_oracle"] or ` +
      `["the_wannabe","the_oracle"]. No prose.`;
    try {
      const r = await anthropic.messages.create({
        model: MODEL, max_tokens: 60, system: sys,
        messages: [{ role: 'user', content: `Chat so far:\n\n${transcript}\n\nWho answers? JSON array only.` }],
      });
      const txt = (r.content.find((b) => b.type === 'text') as any)?.text || '[]';
      const m = txt.match(/\[[^\]]*\]/);
      const arr = m ? JSON.parse(m[0]) : [];
      const valid = (Array.isArray(arr) ? arr : []).filter((k: any) => typeof k === 'string' && members.includes(k));
      const picked = [...new Set(valid)].slice(0, 2) as string[];
      return picked.length ? picked : members.slice(0, 1); // never silent in a solo room
    } catch {
      return members.slice(0, 1);
    }
  }
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
  image?: { media_type: string; data: string } | null;  // a shared photo, base64 — seen by every persona this turn
  addressed?: string[];  // explicit  / tapped faces — those personas answer
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
  // the scene has OPENED only if the moderator has actually raised the curtain —
  // a real opening always carries a [[TENSION tag. A clarifying/broken reply does
  // not, so threads poisoned by one self-heal on the next message.
  const sceneOpened = (hist: any[]) => (hist ?? []).some((m: any) =>
    m.role !== 'user' && typeof m.content === 'string' && m.content.includes('[[TENSION'));
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
    ownerLine = `\n\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is "${input.senderName}". You know these people only from your shared time in THIS room — the room memory below is what you remember together. You have no private history about anyone from outside this room. Greet and treat everyone by name.]`;
  }
  const todayLine = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

  // prior conversation in this group thread (all members + user)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content, persona_key, sender_user_id, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(50);
  const __lastAt = (history && history.length) ? (history as any)[history.length - 1].created_at : null;

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

  // persist the user message (mark an attached photo so the transcript shows it)
  const imgOk = !!input.image && /^image\/(jpeg|png|gif|webp)$/.test(input.image.media_type);
  const storedContent = imgOk ? (message ? message + '\n[shared a photo]' : '[shared a photo]') : message;
  await supabase.from('messages').insert({ thread_id: threadId, user_id: userId, role: 'user', content: storedContent, sender_user_id: userId });
  if (t.is_shared) {
    await broadcastRoomMessage(threadId, { role: 'user', content: storedContent, sender_user_id: userId, sender_name: input.senderName ?? null });
  }

  // build a readable transcript: each assistant line prefixed with WHO said it (by name),
  // so each persona knows who's in the room and who said what.
  const nameFor = (key: string) => personaByKey(key)?.defaultName || key;
  const priorLines: string[] = (history ?? []).map((m: any, i: number) => {
    const line = m.role === 'user'
      ? `${(t.is_shared && m.sender_user_id && nameByUid[m.sender_user_id]) || 'THEM'}: ${m.content}`
      : `${nameFor(m.persona_key || '')}: ${m.content}`;
    // temporal grounding: name real silences so old messages don't read as "now"
    return withGapMarker(line, i > 0 ? (history as any)[i - 1].created_at : null, m.created_at);
  });
  if (__lastAt) {
    const nowMark = withGapMarker('', __lastAt, new Date().toISOString());
    if (nowMark) priorLines.push(nowMark.trim());
  }
  priorLines.push(`${input.senderName ? input.senderName : 'THEM'}: ${message}`);

  // each member responds in order, seeing the running transcript incl. this turn's prior replies
  const saidThisTurn: string[] = [];

  // THE DIRECTOR — only for shared rooms with real people, and not during arena/roleplay
  // (those have their own turn structure). Decides which personas should speak this turn.
  let speakers = members;
  if (t.is_shared && input.senderName && !gameMode && !scenarioKey) {
    // how many real people are in this room? solo (just the sender) → lively;
    // multiple humans → the restraint director (let people talk to each other).
    const { data: mem } = await supabase.from('room_members').select('user_id').eq('thread_id', threadId);
    const humanCount = (mem ?? []).length || 1;
    const roster = members.map((k) => ({ key: k, name: nameFor(k) }));
    const recent = priorLines.slice(-12).join('\n');
    speakers = await directRoom(members, roster, recent, input.senderName, humanCount, input.addressed);
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
    const sceneStarted = sceneOpened(history as any[]);
    if (!sceneStarted) {
      // SETUP TURN: moderator only.
      speakers = ['the_moderator'];
    } else {
      // mid-scene: director picks the relevant cast (cap 2), then the moderator narrates last.
      const roster = castKeys.map((k) => ({ key: k, name: nameFor(k) }));
      const recent = priorLines.slice(-12).join('\n');
      let picked = await directRoom(castKeys, roster, recent, input.senderName || (owner as any)?.display_name || 'the player', 2);
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
    const roomPremise = (t.companion_name && t.companion_name !== 'the room') ? ` THIS ROOM WAS GATHERED AROUND: "${t.companion_name}" — that is the standing topic; you know what the room is about.` : '';
    const webNote = persona?.webEnabled
      ? ` You HAVE live web search here — when something is past your knowledge or contested (a new release, a claim, a score), SEARCH before you pronounce; never declare a thing nonexistent or false without actually checking, and never bluff a check you did not run.`
      : ` You cannot browse or check anything from inside a room — if something is past what you know, say so plainly and let someone who can check carry it; NEVER claim to have just checked or verified something.`;
    let groupNote = `\n\n[THIS IS A GROUP CHAT.${roomPremise}${webNote} In the room with you: ${others}. You are "${nameFor(key)}". Speak only as yourself — short, like a real group chat, react to what was just said. Don't speak for the others. Don't narrate. One natural message.${sharedNote}]`;

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
      const brief = t.scenario_brief ? `\n\n[THE SCENE — AUTHORITATIVE, already chosen by the player. This is the scenario; NEVER ask which scenario to run: ${t.scenario_brief}]` : '';
      if (key === 'the_moderator') {
        const sceneStarted = sceneOpened(history as any[]);
        const openingNote = sceneStarted
          ? `You are mid-scene: narrate the world's reaction to what just happened in a few vivid lines, keep the drama moving, and hand the floor back to the player. Only call the climax + verdict when the mission is genuinely won or lost.`
          : `THIS IS THE OPENING BEAT. Do ONLY this, then STOP: (a) set the scene cinematically but briefly — a few lines, not a wall; (b) name the CAST (the roles, each with a one-line disposition) and tell the player which roles are theirs to choose; (c) state THE MISSION plainly; (d) ask the player to pick their role. Do NOT start the action, do NOT have any character speak yet, do NOT advance the plot. The scene opens on the PLAYER. Keep it tight and readable — they should be able to take it in at a glance.`;
        rpBlock = `\n\n[ROLEPLAY — YOU ARE THE MODERATOR: the DIRECTOR and the NEUTRAL JUDGE of this scene. The player is ${playerName}. The cast (personas playing roles) are: ${cast}. The scene to run is given in THE SCENE block below — if present it is final; otherwise run the scenario named "${scenarioKey}" from the library. Treat the craft notes + scenario library below purely as reference for HOW to direct — never as a menu to offer the player. An empty transcript means the curtain has not yet risen: your first message OPENS the scene; never ask to see a chat, never ask which scenario to run. ${openingNote} You never take a side in the scene's conflict. When the mission is genuinely won or lost, deliver an honest verdict with a specific reason, ending your final message with the verdict tag on its own line (e.g. [[VERDICT outcome=win]]). NEVER count turns. THE PRESSURE DIAL: end EVERY message with [[TENSION n]] on its own line — n from 1 (calm) to 10 (breaking point) — the scene's current dramatic pressure. Tension should generally RISE as the scene develops; a scene that plateaus is a scene dying. It may dip a point when the player genuinely wins ground. When the scene stalls, drifts, or needs a second act (roughly every few exchanges, never twice in a row), force the issue with a COMPLICATION — one concrete new problem (the witness changes her story; the vault timer starts; the other delegation walks in) — narrate it vividly inside your message AND tag it on its own line as [[COMPLICATION: a five-to-eight word label]]. THE HIDDEN TRUTH (mysteries & any hidden-role scene — a killer, a mole, a secret): your OPENING message must COMMIT to the truth in a hidden tag on its own line: [[COMMIT: who/what the truth is, the motive, and three concrete clues you will plant]]. The player never sees this tag. From then on you are BOUND by it — plant those clues in the scene, judge every accusation against this commitment, never contradict it. A player who names the truth WITH reasoning that matches the planted clues wins; a lucky guess without reasoning gets asked to show their work. PERFORMANCE NOTES: alongside your verdict tag, add on its own line [[NOTES: one honest line on what won or lost it; one line on what nearly went the other way]]. If the player just asserts victory without earning it, narrate the room not buying it. Use real names, never bracket placeholders. Keep every message tight and readable — short paragraphs, never a wall of text.]${brief}\n${roleplayText}`;
        groupNote = `\n\n[You are "the moderator" — the director and neutral judge of this roleplay scene. The player is ${playerName}; the cast is ${cast}. You narrate and judge; you never play a side. Keep it cinematic, tight, and readable. ${sceneStarted ? 'Narrate the reaction and keep it moving.' : 'OPENING: introduce scene + cast + mission + ask for their role, then STOP — no action yet.'}]`;
      } else {
        rpBlock = `\n\n[ROLEPLAY — a scene is being played. The moderator is directing. YOU are playing a role the moderator assigned you in this scene (read the transcript to see which). Stay fully IN CHARACTER as that role, in your own voice. You genuinely RESIST — if your role opposes the player's mission, you do NOT cave because they made one good point; you argue your position with real, fair force and make them EARN it. That resistance is the game. If the transcript contains a [[COMMIT: ...]] line from the moderator, that is the scene's hidden truth — play perfectly consistently with it and NEVER reveal or reference it directly. Speak only as your role, react to what was just said, don't narrate the world (that's the moderator's job), don't break character.]${brief}\n${roleplayText}`;
        groupNote = `\n\n[ROLEPLAY: you are a character in a scene the moderator is directing. Stay in your assigned role, in your own voice, and resist honestly if you're an obstacle to the player's mission. React to what was just said. One in-character message. Don't narrate the world — that's the moderator.]`;
      }
    }

    // THE LIFE OUTSIDE — their diary, so "what's up" has a real answer in rooms
    // too. Skipped in roleplay: an assigned role must not bleed the persona's
    // own life into the scene. Kept at game tables — that grumbling is texture.
    let lifeBlock = '';
    if (!scenarioKey) {
      try { lifeBlock = await stateBlockFor(key); } catch (e: any) { console.error('[life] block failed:', e?.message || e); }
    }
    let roomMemBlock = '';
    if (t.is_shared) {
      try { roomMemBlock = await readRoomMemoryBlock(threadId, key); } catch (e: any) { console.error('[roommem] block failed:', e?.message || e); }
    }

    const dynamic = `\n\n[${todayLine}${sinceLine(__lastAt)}]${ownerLine}${groupNote}${gameBlock}${rpBlock}${lifeBlock}${memoryBlock}${roomMemBlock}`;

    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: staticPrefix, cache_control: { type: 'ephemeral' } } as Anthropic.TextBlockParam,
      // [zip51] THE ROOM CONDUCT LAW — the one surface that had no conduct law,
      // and exactly where the narration leak appeared ("Dev walks in, drops
      // three letters, and the silence waits."). Written law beats implicit norm.
      { type: 'text', text: '[ROOM CONDUCT — absolute: You are speaking IN A GROUP CHAT, as yourself, in first person. Your reply is ONLY the message you send — never narration, never a third-person description of the scene or of what anyone did or said, never stage directions, never a preamble about the moment. Begin directly with your own spoken words. And speak PLAINLY: everyday words, short sentences, the way real people talk in a group chat — no literary flourishes, no poetic scene-setting.]' },
    ];
    if (dynamic.trim()) system.push({ type: 'text', text: dynamic });

    // feed the whole running transcript (incl. replies already made this turn) as the user message
    const runningTranscript = [...priorLines, ...saidThisTurn.map((s) => s)].join('\n');
    let userBlock = `Here's the group chat so far. Respond as ${nameFor(key)} — your next message only.\n\n${runningTranscript}`;
    // OPENING BEAT of a roleplay: the transcript is just the player pressing start —
    // don't frame it as a chat to respond to. Issue the stage command directly, scenario
    // inline, so there is no gray zone for the model to "clarify".
    if (scenarioKey && key === 'the_moderator' && !sceneOpened(history as any[])) {
      userBlock = `CURTAIN UP. The player has taken their seat and pressed start — that is all the authorization that exists or is needed. Open the scene NOW.\n\nSCENARIO (final, already chosen): "${scenarioKey.replace(/_/g, ' ')}"${t.scenario_brief ? `\nTHE SCENE: ${t.scenario_brief}` : ''}\n\nYour setup beat, per your instructions: set the scene cinematically but briefly; name the cast and the roles the player may take; state the mission; ask the player to pick their role. Then stop. Do not ask any other question. Do not mention instructions, transcripts, or scenarios as concepts — you are the director, the lights are down, begin.`;
    }

    input.onPersonaStart?.(key, nameFor(key));
    const maxTok = scenarioKey ? (key === 'the_moderator' ? 700 : 500) : 400;
    // a shared photo rides on THIS turn's content for every persona (they all see it, like a
    // real group). the vision block + web_search can't ride the same request, so an image turn
    // drops web — the persona just says it'll look something up next turn (that's a natural line).
    const turnHasImage = imgOk && !scenarioKey;
    const turnContent: any = turnHasImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: input.image!.media_type, data: input.image!.data } },
          { type: 'text', text: userBlock },
        ]
      : userBlock;
    // web access for web-enabled personas (e.g. the moderator running "Ripped from the Headlines").
    const streamArgs: any = {
      model: MODEL, max_tokens: maxTok, system,
      messages: [{ role: 'user', content: turnContent }],
    };
    if (persona?.webEnabled && !turnHasImage) {
      streamArgs.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
    }
    const stream = anthropic.messages.stream(streamArgs);
    let __chars = 0;
    stream.on('text', (d) => { __chars += d.length; input.onToken?.(key, key === 'the_media_manager' ? d.replace(/\u20B9\s*/g, 'Rs ') : d); });   // [zip54b] the Rs law rides the room stream
    const final = await stream.finalMessage().catch((err: any) => {
      // DIAGNOSTIC: pinpoint the second premature-close. Which persona died, was
      // web_search on, and how far did it get (0 = died at prefill; >0 = mid-stream)?
      console.error('[groupLoop] stream error persona=', key, 'web=', !!persona?.webEnabled,
        'streamedChars=', __chars, 'name=', err?.name, 'code=', err?.code, 'msg=', err?.message);
      if (err?.cause) console.error('[groupLoop] cause=', err.cause);
      throw err;
    });
    let reply = final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    if (key === 'the_media_manager') reply = reply.replace(/\u20B9\s*/g, 'Rs ');   // [zip54b] the Rs law in rooms
    logUsage({ userId, threadId, personaKey: key, surface: 'group', fn: 'group_turn', model: MODEL, usage: (final as any).usage });

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
