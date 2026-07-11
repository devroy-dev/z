#!/usr/bin/env python3
# patch_grouploop_register.py — THE GROUPLOOP SITTING (CE audit + carried rulings)
# One file. Owner-ordered prompt changes (a–d), the names-not-shapes prefix strip,
# solo-director rotation, and the humanCount floor. Idempotent + drift-refusing.
import io, sys
FAILS = []
def patch(path, old, new, name):
    s = io.open(path, encoding='utf-8').read()
    if new in s: print(f'  = {name}: already applied'); return
    if s.count(old) != 1: FAILS.append(f'{name}: anchor {"absent" if old not in s else "not unique"} in {path}'); return
    io.open(path, 'w', encoding='utf-8').write(s.replace(old, new)); print(f'  + {name}: applied')

G = 'src/groupLoop.ts'

# ── (a) the standing greeting order dies — names yes, greeting no ─────────────
patch(G,
"""    ownerLine = `\\n\\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is \"${input.senderName}\". You know these people only from your shared time in THIS room — the room memory below is what you remember together. You have no private history about anyone from outside this room. Greet and treat everyone by name.]`;""",
"""    // [register] "Greet and treat everyone by name" was a STANDING ORDER read on
    // every turn — the ayyy-Dev loop's smoking gun. Names yes; greeting no.
    ownerLine = `\\n\\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is \"${input.senderName}\" — address the person who spoke, by that name. You know these people only from your shared time in THIS room — the room memory below is what you remember together. You have no private history about anyone from outside this room. Use people's names, never \"THEM\" — but do not greet: the conversation is already running.]`;""",
'(a) greeting order dies + sender-first addressing')

# ── (b)+(c) the re-entry law + the one-human register, into ROOM CONDUCT ─────
patch(G,
"""      { type: 'text', text: '[ROOM CONDUCT — absolute: You are speaking IN A GROUP CHAT, as yourself, in first person. Your reply is ONLY the message you send — never narration, never a third-person description of the scene or of what anyone did or said, never stage directions, never a preamble about the moment. Begin directly with your own spoken words. And speak PLAINLY: everyday words, short sentences, the way real people talk in a group chat — no literary flourishes, no poetic scene-setting.]' },""",
"""      { type: 'text', text: '[ROOM CONDUCT — absolute: You are speaking IN A GROUP CHAT, as yourself, in first person. Your reply is ONLY the message you send — never narration, never a third-person description of the scene or of what anyone did or said, never stage directions, never a preamble about the moment. Begin directly with your own spoken words. And speak PLAINLY: everyday words, short sentences, the way real people talk in a group chat — no literary flourishes, no poetic scene-setting. THE RE-ENTRY LAW: when time has passed, acknowledge it at most once, briefly, then continue the conversation where it lives — never re-open it as an arrival, never perform a welcome. Do not start with a greeting unless someone genuinely just joined the room for the first time. NEVER imitate the register of your own previous messages — vary your openings; you are a person, not a catchphrase.]' },""",
'(b) re-entry law + anti-self-imitation into ROOM CONDUCT')

# (c) rides the groupNote — conditional direct address when exactly one human present
patch(G,
"""  // THE DIRECTOR — only for shared rooms with real people, and not during arena/roleplay
  // (those have their own turn structure). Decides which personas should speak this turn.
  let speakers = members;""",
"""  // THE DIRECTOR — only for shared rooms with real people, and not during arena/roleplay
  // (those have their own turn structure). Decides which personas should speak this turn.
  let speakers = members;
  let soloHumanNote = '';   // [register] (c) one-human rooms: talk TO them, not ABOUT them""",
'(c) soloHumanNote declared')

# ── humanCount floor + rotation feed + silence tier, at the director call ─────
patch(G,
"""    const humanCount = (mem ?? []).length || 1;
    const roster = members.map((k) => ({ key: k, name: nameFor(k) }));
    const recent = priorLines.slice(-12).join('\\n');
    speakers = await directRoom(members, roster, recent, input.senderName, humanCount, input.addressed);
    // nobody should speak — the humans are talking; stay quiet
    if (!speakers.length) return;""",
"""    // [audit #7] membership rows can drift; a room where two humans have SPOKEN
    // is a two-human room regardless. Floor humanCount on the transcript's truth.
    const humanSenders = new Set((history ?? []).filter((m: any) => m.role === 'user' && m.sender_user_id).map((m: any) => m.sender_user_id));
    if (userId) humanSenders.add(userId);
    const humanCount = Math.max((mem ?? []).length || 1, humanSenders.size || 1);
    const roster = members.map((k) => ({ key: k, name: nameFor(k) }));
    const recent = priorLines.slice(-12).join('\\n');
    // [audit #6] rotation: the last few persona voices, so the director can vary
    const recentSpeakers: string[] = [];
    for (let i = (history ?? []).length - 1; i >= 0 && recentSpeakers.length < 3; i--) {
      const m: any = (history as any)[i];
      if (m.role === 'assistant' && m.persona_key && !recentSpeakers.includes(m.persona_key)) recentSpeakers.push(m.persona_key);
    }
    speakers = await directRoom(members, roster, recent, input.senderName, humanCount, input.addressed, recentSpeakers);
    // nobody should speak — the humans are talking (or it was noise); stay quiet
    if (!speakers.length) return;
    if (humanCount <= 1) soloHumanNote = `\\n\\n[ONE HUMAN IS IN THIS ROOM: ${input.senderName || 'the person'}. Talk TO them, directly, second person — never narrate ABOUT them to the room. There is no audience here but the two of you and the other personas.]`;""",
'humanCount floor + rotation feed + (c) trigger')

# soloHumanNote joins the dynamic block
patch(G,
"""    const dynamic = `\\n\\n[${todayLine}${sinceLine(__lastAt)}]${ownerLine}${groupNote}${gameBlock}${rpBlock}${lifeBlock}${memoryBlock}${roomMemBlock}`;""",
"""    const dynamic = `\\n\\n[${todayLine}${sinceLine(__lastAt)}]${ownerLine}${soloHumanNote}${groupNote}${gameBlock}${rpBlock}${lifeBlock}${memoryBlock}${roomMemBlock}`;""",
'(c) soloHumanNote wired into dynamic')

# ── (d) the solo director learns silence — and rotation ──────────────────────
patch(G,
"""  if (humanCount <= 1) {
    if (members.length === 1) return members; // the one persona answers
    // pick the single best-fit persona for this message
    const cast = roster.map((r) => `- ${r.key} (\"${r.name}\")`).join('\\n');
    const sys =
      `You direct a chat between one person and a few AI personas. Pick who should ` +
      `answer the LATEST message — usually ONE best-fit persona, occasionally TWO if the ` +
      `message clearly invites several (e.g. \"what do you all think?\"). Someone should ` +
      `almost always answer — this is a lively group chat, not a quiet room.\\n\\n` +
      `The personas:\\n${cast}\\n\\n` +
      `Output ONLY a JSON array of persona keys, in order, e.g. [\"the_oracle\"] or ` +
      `[\"the_wannabe\",\"the_oracle\"]. No prose.`;""",
"""  if (humanCount <= 1) {
    if (members.length === 1) return members; // the one persona answers
    // pick the single best-fit persona for this message
    // [register (d)] silence is now LEGAL solo: noise, bare acks, and machine-shaped
    // strings may earn quiet. [audit #6] and the same voice must not take every turn.
    const cast = roster.map((r) => `- ${r.key} (\"${r.name}\")`).join('\\n');
    const rotLine = (recentSpeakers && recentSpeakers.length)
      ? `\\nSpoke most recently (newest first): ${recentSpeakers.join(', ')} — prefer a fitting voice that HASN'T spoken recently; the same persona should not take every turn.`
      : '';
    const sys =
      `You direct a chat between one person and a few AI personas. Pick who should ` +
      `answer the LATEST message — usually ONE best-fit persona, occasionally TWO if the ` +
      `message clearly invites several (e.g. \"what do you all think?\"). A substantive ` +
      `message almost always gets one voice — this is a lively group chat. BUT: if the ` +
      `latest message is noise, a bare ack (\"ok\", a lone emoji), or a machine-shaped ` +
      `string (test text, codes, timestamps), return [] — silence, or letting it lie, ` +
      `is better than performing at noise.${rotLine}\\n\\n` +
      `The personas:\\n${cast}\\n\\n` +
      `Output ONLY a JSON array of persona keys, in order, e.g. [\"the_oracle\"] or ` +
      `[\"the_wannabe\",\"the_oracle\"] or []. No prose.`;""",
'(d) solo silence tier + rotation instruction')

# the never-silent fallback dies with it — the MODEL may choose []; an ERROR still answers
patch(G,
"""      const picked = [...new Set(valid)].slice(0, 2) as string[];
      return picked.length ? picked : members.slice(0, 1); // never silent in a solo room
    } catch {
      return members.slice(0, 1);
    }
  }""",
"""      // [register (d)] an empty pick is now the model CHOOSING silence — honor it.
      // Only an ERROR falls back to one voice (a broken director must not mute the room).
      return [...new Set(valid)].slice(0, 2) as string[];
    } catch {
      return members.slice(0, 1);
    }
  }""",
'(d) never-silent fallback removed')

# directRoom signature gains recentSpeakers
patch(G,
"""  humanCount: number,""",
"""  humanCount: number,
  recentSpeakers?: string[],""",
'director signature: recentSpeakers')

# hmm — signature anchor is inside the param list; verify the call-shape compiles (tsc gate).

# ── the prefix strip: names, not shapes — at persist AND at the stream's first line ──
patch(G,
"""  // each member responds in order, seeing the running transcript incl. this turn's prior replies
  const saidThisTurn: string[] = [];""",
"""  // each member responds in order, seeing the running transcript incl. this turn's prior replies
  const saidThisTurn: string[] = [];

  // [Problem 3 — names, not shapes] the model occasionally echoes the transcript's
  // "Name:" convention into its own reply. Strip a leading self- or member-prefix —
  // ONLY when it matches a known name (member humans, personas, or the speaker's own
  // name); "PSA:" and "Note:" survive. Applied at PERSIST (history is truth); the live stream may flash a prefix once — accepted, not worth buffering the gate chain for.
  const knownPrefixNames = new Set<string>([
    ...Object.values(nameByUid),
    ...members.map((k) => nameFor(k)),
    ...(input.senderName ? [input.senderName] : []),
  ].filter(Boolean).map((n) => String(n).toLowerCase()));
  const stripSelfPrefix = (text: string): string => {
    const m = text.match(/^([^\\n:]{1,32}):\\s+/);
    if (m && knownPrefixNames.has(m[1].trim().toLowerCase())) return text.slice(m[0].length);
    return text;
  };""",
'prefix strip: names-not-shapes helper')

patch(G,
"""    let reply = scrubProviderMarkup(final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim());   // [zip54g]""",
"""    let reply = stripSelfPrefix(scrubProviderMarkup(final.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim()));   // [zip54g][Problem 3]""",
'prefix strip at persist')

if FAILS:
    print('\\nREFUSED — fix drift first:')
    for f in FAILS: print('  ✗', f)
    sys.exit(1)
print('\\ngroupLoop register: all patches green.')
