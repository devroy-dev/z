import { buildStaticPrefix } from './content.js';
// index.ts — the Z engine HTTP surface. Express. Verifies the Supabase Auth JWT
// the PWA sends, resolves the z.users row, and exposes:
//   POST /threads          create a named companion (persona instance)
//   GET  /threads          list the user's roster
//   POST /chat             one turn (SSE stream of tokens)
//   GET  /healthz          liveness
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { resolveUser, isRestricted } from './zAccess.js';
import { transcribeAndStore, transcribeAudio, storeJournalText } from './journal.js';
import { runZTurn } from './loop.js';
import { runGroupTurn } from './groupLoop.js';
import { personaByKey } from './personas.js';
import { supabase } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// serve the PWA (single-file B Field surface) from /public
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname2 = dirname(fileURLToPath(import.meta.url));
// no-cache for HTML so a deploy is always reflected on next load (ends stale-cache confusion)
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
app.use(express.static(join(__dirname2, 'public')));

// public config for the browser realtime client (anon key is public by design; RLS protects rows)
app.get('/config', (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// verify the caller's Supabase JWT → auth_user_id. Uses anon client just to read the token's user.
const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!);
// OTP uses the anon-key client (the real Supabase phone-auth path; Twilio Verify is the
// configured SMS provider in the Supabase dashboard).
const otpClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!);

// OPEN_MODE: no auth wall yet. The frontend sends a stable anonymous id in the
// x-z-user header; we use it as the auth_user_id directly. Flip OPEN_MODE off
// (and the header path is ignored) once Twilio Verify / Supabase auth is wired —
// one env switch, no rebuild.
// personas allowed in shared multi-human rooms — the safe-social/intellect set only.
// NEVER the crush, self-loathing/self-obsessed, addict, hottie, wingman, stranger (1:1 only).
const SHAREABLE_PERSONAS = new Set([
  'the_guru','the_oracle','the_brainiac','the_brother','the_healer',
  'the_comic','the_mentor','the_colleague','the_philosopher','the_historian',
  'the_cosmologist','the_moderator','the_cynic','the_media_manager','the_teacher',
  'the_economist','the_leader_opp','the_wannabe','the_screen_junkie','the_orator',
  'the_hippie','the_diva','the_cousin',
]);

const OPEN_MODE = (process.env.OPEN_MODE ?? 'true') === 'true';

async function authUser(req: express.Request): Promise<string | null> {
  if (OPEN_MODE) {
    const anon = (req.headers['x-z-user'] as string | undefined)?.trim();
    if (anon && /^[a-zA-Z0-9_-]{8,64}$/.test(anon)) return `open:${anon}`;
    // fall through to JWT if a real token is present even in open mode
  }
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const { data, error } = await authClient.auth.getUser(h.slice(7));
  if (error || !data?.user) return null;
  return data.user.id;
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// create a companion
app.post('/threads', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { personaKey, name, gender, avatarUrl, accent } = req.body ?? {};
    const persona = personaByKey(personaKey);
    if (!persona) return res.status(400).json({ error: 'unknown persona: ' + personaKey });
    // reuse the user's existing 1:1 thread for this persona if one exists (no duplicates, history stays)
    const { data: existing } = await supabase.from('threads')
      .select('id, persona_key, companion_name, avatar_url, accent')
      .eq('user_id', user.id).eq('persona_key', persona.key)
      .eq('is_group', false).is('deleted_at', null)
      .order('last_active', { ascending: false }).limit(1).maybeSingle();
    if (existing) return res.json(existing);
    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id,
      persona_key: persona.key,
      codex_key: persona.codex,
      companion_name: name || persona.defaultName,
      companion_gender: gender ?? null,
      avatar_url: avatarUrl ?? null,
      accent: accent ?? null,
    }).select('id, persona_key, companion_name, avatar_url, accent').single();
    if (error) return res.status(500).json({ error: 'thread insert: ' + error.message });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'threads failed: ' + (e?.message || String(e)) });
  }
});

// ── ARENA ─────────────────────────────────────────────────────────────────
// start (or resume) a game: reuse the persona's 1:1 thread, set its game_mode.
app.post('/arena/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { game, personaKey } = req.body ?? {};
    const allowed = ['debate', 'trivia', 'dilemma', 'twenty', 'wyr', 'riddle', 'learn'];
    if (!allowed.includes(String(game))) return res.status(400).json({ error: 'unknown game' });
    const persona = personaByKey(personaKey);
    if (!persona) return res.status(400).json({ error: 'unknown persona: ' + personaKey });

    // QUIZ & LEARN is COOPERATIVE — a solo session with the professor, no moderator, no score.
    if (game === 'learn') {
      let lid: string;
      const { data: ex } = await supabase.from('threads')
        .select('id').eq('user_id', user.id).eq('persona_key', persona.key)
        .eq('is_group', false).is('deleted_at', null)
        .order('last_active', { ascending: false }).limit(1).maybeSingle();
      if (ex) { lid = ex.id; await supabase.from('threads').update({ game_mode: 'learn' }).eq('id', lid); }
      else {
        const { data, error } = await supabase.from('threads').insert({
          user_id: user.id, persona_key: persona.key, codex_key: persona.codex,
          companion_name: persona.defaultName, game_mode: 'learn',
        }).select('id').single();
        if (error) return res.status(500).json({ error: 'learn start: ' + error.message });
        lid = data.id;
      }
      return res.json({ threadId: lid, game, persona: persona.key, isGroup: false });
    }

    // The competitive Arena match is a GROUP: the opponent + the moderator (neutral judge).
    const members = [persona.key, 'the_moderator'];
    const arenaName = 'the arena';
    let threadId: string;
    // reuse a prior arena group for THIS game+opponent (so a player's match thread is stable), else create
    const { data: existing } = await supabase.from('threads')
      .select('id').eq('user_id', user.id).eq('is_group', true)
      .contains('member_keys', members).eq('companion_name', arenaName)
      .is('deleted_at', null).order('last_active', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      threadId = existing.id;
      await supabase.from('threads').update({ game_mode: game, member_keys: members }).eq('id', threadId);
    } else {
      const { data, error } = await supabase.from('threads').insert({
        user_id: user.id, is_group: true, member_keys: members,
        companion_name: arenaName, game_mode: game,
      }).select('id').single();
      if (error) return res.status(500).json({ error: 'arena start: ' + error.message });
      threadId = data.id;
    }
    res.json({ threadId, game, persona: persona.key, members, isGroup: true });
  } catch (e: any) { res.status(500).json({ error: 'arena start failed: ' + (e?.message || String(e)) }); }
});

// ── ROLEPLAY (the Freedom Space) ────────────────────────────────────────────
// start a mission-roleplay: a GROUP thread with a scenario + a cast of personas
// + the moderator (director/judge). The moderator's first turn sets the scene.
app.post('/roleplay/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { scenario, brief, cast } = req.body ?? {};
    // accept any scenario id (the Stage library rotates through many); just sanitize it.
    // the id is passed to the moderator as context; it generates the scene from the premise.
    const scenarioKey = String(scenario || '').replace(/[^a-z0-9_]/gi, '').slice(0, 40);
    if (!scenarioKey) return res.status(400).json({ error: 'unknown scenario' });
    // cast = persona keys that will play the roles (3-5); fall back to a sensible default set
    let castKeys: string[] = Array.isArray(cast) ? cast.filter((k: any) => typeof k === 'string') : [];
    if (castKeys.length < 3) {
      castKeys = ['the_leader_opp', 'the_orator', 'the_cynic', 'the_brother'];
    }
    castKeys = castKeys.filter((k) => k !== 'the_moderator').slice(0, 5);
    const members = [...castKeys, 'the_moderator'];
    const safeBrief = typeof brief === 'string' ? brief.slice(0, 1000) : '';

    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, member_keys: members,
      companion_name: 'roleplay', scenario_key: scenarioKey, scenario_brief: safeBrief || null,
    }).select('id').single();
    if (error) return res.status(500).json({ error: 'roleplay start: ' + error.message });
    res.json({ threadId: data.id, scenario: scenarioKey, members, isGroup: true });
  } catch (e: any) { res.status(500).json({ error: 'roleplay start failed: ' + (e?.message || String(e)) }); }
});

// the player's win/loss record per game
// ── THE FRONT DESK: tasks (the concierge holds the user's list) ──────────────
// list open (and recently-done) tasks for the user
app.get('/tasks', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('tasks')
      .select('id, title, notes, due_at, status, suggested_persona, created_at, done_at')
      .eq('user_id', user.id)
      .order('status', { ascending: true })       // open first
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100);
    res.json({ tasks: data ?? [] });
  } catch (e: any) { res.status(500).json({ error: 'tasks list failed: ' + (e?.message || String(e)) }); }
});

// add a task
app.post('/tasks', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { title, notes, due_at, suggested_persona } = req.body ?? {};
    const t = typeof title === 'string' ? title.trim().slice(0, 300) : '';
    if (!t) return res.status(400).json({ error: 'a task needs a title' });
    const row: any = { user_id: user.id, title: t, status: 'open' };
    if (typeof notes === 'string' && notes.trim()) row.notes = notes.trim().slice(0, 1000);
    if (due_at) { const d = new Date(due_at); if (!isNaN(d.getTime())) row.due_at = d.toISOString(); }
    if (typeof suggested_persona === 'string') row.suggested_persona = suggested_persona.replace(/[^a-z_]/gi, '').slice(0, 40);
    const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
  } catch (e: any) { res.status(500).json({ error: 'task add failed: ' + (e?.message || String(e)) }); }
});

// toggle done / update a task
app.patch('/tasks/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const id = String(req.params.id);
    const { status, title, due_at } = req.body ?? {};
    const patch: any = {};
    if (status === 'done') { patch.status = 'done'; patch.done_at = new Date().toISOString(); }
    else if (status === 'open') { patch.status = 'open'; patch.done_at = null; }
    if (typeof title === 'string' && title.trim()) patch.title = title.trim().slice(0, 300);
    if (due_at !== undefined) { const d = due_at ? new Date(due_at) : null; patch.due_at = (d && !isNaN(d.getTime())) ? d.toISOString() : null; }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const { error } = await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'task update failed: ' + (e?.message || String(e)) }); }
});

// delete a task
app.delete('/tasks/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const id = String(req.params.id);
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'task delete failed: ' + (e?.message || String(e)) }); }
});

app.get('/arena/record', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('arena_matches')
      .select('game, winner').eq('user_id', user.id);
    const rec: Record<string, { wins: number; losses: number; draws: number }> = {};
    (data ?? []).forEach((m: any) => {
      rec[m.game] = rec[m.game] || { wins: 0, losses: 0, draws: 0 };
      if (m.winner === 'you') rec[m.game].wins++;
      else if (m.winner === 'z') rec[m.game].losses++;
      else rec[m.game].draws++;
    });
    res.json(rec);
  } catch (e: any) { res.status(500).json({ error: 'arena record failed: ' + (e?.message || String(e)) }); }
});

// capture / update the owner's identity (name + region) onto their durable user row.
// called at onboarding and whenever they edit name/region. This is owner binding:
// the AI and the overseer both speak/write knowing who the person actually is.
// the Letters tab: the anecdotes (daily) + letters (weekly) the overseer wrote.
// the user's own file — they read it, mark it read, and can delete any of it.
app.get('/letters', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data, error } = await supabase
      .from('user_summaries')
      .select('id, kind, body, period_start, period_end, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(120);
    if (error) return res.status(500).json({ error: 'letters: ' + error.message });
    res.json(data ?? []);
  } catch (e: any) {
    res.status(500).json({ error: 'letters failed: ' + (e?.message || String(e)) });
  }
});

// mark a letter read
app.post('/letters/:id/read', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('user_summaries').update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// delete a letter (their file, their call)
app.delete('/letters/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('user_summaries').delete()
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// ── AUDIO JOURNAL ──────────────────────────────────────────────────────────
// "just record." Raw audio in, Sarvam transcribes, we keep the text, discard audio.
// The transcript is overseer material under the same care rules as chat (no separate path).
// Accepts raw body (audio/*) with a small size cap; engine forwards to Sarvam.
import express2 from 'express';
app.post('/journal', express2.raw({ type: 'audio/*', limit: '12mb' }), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const audio = req.body as Buffer;
    if (!audio || !audio.length) return res.status(400).json({ error: 'no audio' });
    const mime = (req.headers['content-type'] as string) || 'audio/wav';
    const result = await transcribeAndStore(user.id, audio, 'journal.wav', mime);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'journal failed: ' + (e?.message || String(e)) });
  }
});

// transcribe a chat voice note via Sarvam — returns TEXT only, stores nothing.
// (the journal stores; chat voice notes just drop text into the composer.)
app.post('/transcribe', express2.raw({ type: 'audio/*', limit: '12mb' }), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    await resolveUser(authId);
    const audio = req.body as Buffer;
    if (!audio || !audio.length) return res.status(400).json({ error: 'no audio' });
    const mime = (req.headers['content-type'] as string) || 'audio/webm';
    const result = await transcribeAudio(audio, mime);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'transcribe failed: ' + (e?.message || String(e)) });
  }
});

// typed journal entry — store text directly, no transcription
app.post('/journal/text', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const text = (req.body?.text ?? '').toString();
    if (!text.trim()) return res.status(400).json({ error: 'no text' });
    const result = await storeJournalText(user.id, text);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'journal text failed: ' + (e?.message || String(e)) });
  }
});

// read the journal (their own entries)
app.get('/journal', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, transcript, lang, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: 'journal read: ' + error.message });
    res.json(data ?? []);
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// delete a journal entry (their file, their call)
app.delete('/journal/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('journal_entries').delete()
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// ── CLEAR CHAT: wipe the messages in one of the user's threads (keeps the thread + persona).
app.post('/thread/clear', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { threadId } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: 'threadId required' });
    // only the owner may clear; verify ownership
    const { data: th } = await supabase.from('threads')
      .select('id, user_id').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!th || th.user_id !== user.id) return res.status(403).json({ error: 'not your chat' });
    // wipe messages + any per-thread summary/memory derived state for a clean slate
    await supabase.from('messages').delete().eq('thread_id', threadId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'clear failed: ' + (e?.message || String(e)) }); }
});

// ── BANTER: a single short in-character line (for games like blackjack). No thread/history.
app.post('/banter', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const { persona, prompt } = req.body ?? {};
    const p = personaByKey(persona);
    if (!p || !prompt) return res.status(400).json({ error: 'persona and prompt required' });
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const staticPrefix = buildStaticPrefix(p.defaultName, null, [p.codex as any], null);

    // The non-streaming create() intermittently hits "Premature close" on this host.
    // Use the plain-string system form (like memory/overseer, which work) and retry
    // a couple of times on transient connection drops before giving up.
    const doCall = async () => {
      const anthropic = new Anthropic({ maxRetries: 3 });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 60,
        system: staticPrefix,
        messages: [{ role: 'user', content: String(prompt).slice(0, 600) }],
      });
      return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    };

    let line = '', lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { line = await doCall(); if (line) break; }
      catch (e: any) { lastErr = e; await new Promise(r => setTimeout(r, 300 * (attempt + 1))); }
    }
    if (!line && lastErr) throw lastErr;
    res.json({ line });
  } catch (e: any) { res.status(500).json({ error: 'banter failed: ' + (e?.message || String(e)) }); }
});

// ── DEV ECHO ── stateless persona probe for voice/codex testing via curl.
// Exercises the REAL persona → codex → buildStaticPrefix path + model, but with
// NO thread, NO DB writes, NO memory harvest. Gated by a server secret (DEV_KEY),
// never a user token. Inert (404) unless DEV_KEY is set in the environment.
//   curl .../dev/echo -H 'x-dev-key: $DEV_KEY' -H 'content-type: application/json' \
//        -d '{"persona":"the_screen_junkie","message":"recommend me something"}'
// Optional: "dob":"2011-01-01" injects the age line (probe the quiet-minor case),
//           "serious":true injects serious mode, "region":"Lucknow" for slang.
app.post('/dev/echo', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    const { persona, message, region, dob, serious } = req.body ?? {};
    const p = personaByKey(persona);
    if (!p || !message) return res.status(400).json({ error: 'need { persona, message }' });

    const staticPrefix = buildStaticPrefix(p.defaultName, null, [p.codex as any], region ?? null);

    // optional dynamic block — mirrors loop.ts so we can probe age-aware behaviour
    let dyn = '';
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        const now = new Date(); let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if (age > 0 && age < 120) dyn += `\n\n[WHO YOU'RE TALKING TO: this person is ${age} years old. Meet them at their age; never read this aloud as a label.]`;
      }
    }
    if (serious) dyn += `\n\n[SERIOUS MODE IS ON. Set the bits and deflection aside; be warm, grounded, careful. If real danger shows, steer to real human help.]`;

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const system: any[] = [{ type: 'text', text: staticPrefix }];
    if (dyn) system.push({ type: 'text', text: dyn });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: String(message).slice(0, 2000) }],
    });
    const reply = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    res.json({ persona: p.key, codex: p.codex, model: 'claude-haiku-4-5-20251001', reply });
  } catch (e: any) { res.status(500).json({ error: 'dev echo failed: ' + (e?.message || String(e)) }); }
});

// ── PIN AUTH ──────────────────────────────────────────────────────────────
// hash a pin with a per-app secret salt (sha256). Not bcrypt, but server-side,
// rate-limited by Supabase, and a 4-digit pin's real protection is the phone+OTP gate.
import { createHash } from 'crypto';
function hashPin(pin: string, userId: string): string {
  const salt = process.env.PIN_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'z-pin';
  return createHash('sha256').update(`${salt}:${userId}:${pin}`).digest('hex');
}

// set (or change) the PIN — requires a valid auth token (just verified via OTP)
app.post('/auth/pin/set', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { pin } = req.body ?? {};
    if (!/^[0-9]{4}$/.test(String(pin || ''))) return res.status(400).json({ error: 'pin must be 4 digits' });
    const { error } = await supabase.from('users')
      .update({ pin_hash: hashPin(String(pin), user.id), pin_set_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'pin set failed: ' + (e?.message || String(e)) }); }
});

// verify a PIN for a known account (fast re-login). Takes userId + pin, returns a fresh session.
// NOTE: this re-issues a session WITHOUT OTP, so it's gated by knowing the userId (stored on the
// device after first login) + the correct PIN. Wrong-pin attempts are counted and lock out.
const pinAttempts: Record<string, { n: number; t: number }> = {};
app.post('/auth/pin/verify', async (req, res) => {
  try {
    const { userId, pin, refreshToken } = req.body ?? {};
    if (!userId || !/^[0-9]{4}$/.test(String(pin || ''))) return res.status(400).json({ error: 'userId and 4-digit pin required' });
    // simple lockout: 5 wrong attempts → 60s cooldown
    const a = pinAttempts[userId] || { n: 0, t: 0 };
    if (a.n >= 5 && Date.now() - a.t < 60000) return res.status(429).json({ error: 'too many tries — wait a minute or use OTP' });
    const { data: u } = await supabase.from('users').select('id, pin_hash, auth_user_id, display_name').eq('id', userId).is('deleted_at', null).maybeSingle();
    if (!u || !u.pin_hash) return res.status(404).json({ error: 'no pin set — sign in with OTP' });
    if (u.pin_hash !== hashPin(String(pin), u.id)) {
      pinAttempts[userId] = { n: a.n + 1, t: Date.now() };
      return res.status(401).json({ error: 'wrong pin' });
    }
    delete pinAttempts[userId];
    // PIN correct → mint a fresh session from the stored refresh token (kept on device)
    if (refreshToken) {
      const { data: rs } = await otpClient.auth.refreshSession({ refresh_token: refreshToken });
      if (rs?.session) {
        return res.json({ token: rs.session.access_token, refreshToken: rs.session.refresh_token, expiresIn: rs.session.expires_in, userId: u.id, hasName: !!u.display_name, hasPin: true });
      }
    }
    // no usable refresh token → PIN is correct but session can't be minted; ask for OTP
    return res.status(409).json({ error: 'session expired — sign in with OTP once', needOtp: true });
  } catch (e: any) { res.status(500).json({ error: 'pin verify failed: ' + (e?.message || String(e)) }); }
});

// fetch the stored identity (so the client can hydrate name/region after a cache loss)
app.get('/me', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('users')
      .select('display_name, region, dob, sex, serious_mode')
      .eq('id', user.id).maybeSingle();
    res.json({
      displayName: data?.display_name ?? null,
      region: data?.region ?? null,
      dob: (data as any)?.dob ?? null,
      sex: (data as any)?.sex ?? null,
      seriousMode: !!(data as any)?.serious_mode,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'me fetch failed: ' + (e?.message || String(e)) });
  }
});

app.post('/me', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { displayName, region } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim()) patch.display_name = displayName.trim().slice(0, 80);
    if (typeof req.body?.seriousMode === 'boolean') patch.serious_mode = req.body.seriousMode;
    if (typeof region === 'string') patch.region = region.trim().slice(0, 120) || null;
    if (typeof req.body?.dob === 'string') patch.dob = req.body.dob.trim() || null;   // 'YYYY-MM-DD'
    if (typeof req.body?.sex === 'string' && ['female','male','na'].includes(req.body.sex)) patch.sex = req.body.sex;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('users').update(patch).eq('id', user.id);
      if (error) return res.status(500).json({ error: 'me update: ' + error.message });
    }
    res.json({ id: user.id, displayName: patch.display_name ?? user.display_name, region: patch.region ?? user.region });
  } catch (e: any) {
    res.status(500).json({ error: 'me failed: ' + (e?.message || String(e)) });
  }
});

// list roster
app.get('/threads', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('threads')
      .select('id, persona_key, companion_name, avatar_url, accent, last_active')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('last_active', { ascending: false });
    res.json(data ?? []);
  } catch (e: any) {
    res.status(500).json({ error: 'roster failed: ' + (e?.message || String(e)) });
  }
});

// one turn — SSE stream
// ── AUTH: phone OTP (Supabase phone auth, Twilio Verify as SMS provider) ──────
// send a one-time code to the phone number.
app.post('/auth/otp', async (req, res) => {
  try {
    const { phone } = req.body ?? {};
    if (!phone || !/^\+[1-9][0-9]{6,15}$/.test(phone)) return res.status(400).json({ error: 'enter a valid number with country code' });
    const { error } = await otpClient.auth.signInWithOtp({ phone });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'otp failed: ' + (e?.message || String(e)) }); }
});

// refresh: exchange a refresh token for a fresh access token (silent re-auth)
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: 'no refresh token' });
    const { data, error } = await otpClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) return res.status(401).json({ error: 'session expired' });
    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    });
  } catch (e: any) { res.status(500).json({ error: 'refresh failed: ' + (e?.message || String(e)) }); }
});

// verify the code → returns a Supabase session token. Optionally claims an anon user's
// existing threads/letters/journal onto the now-verified identity (so nobody loses history).
app.post('/auth/verify', async (req, res) => {
  try {
    const { phone, code, claimAnon } = req.body ?? {};
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
    const { data, error } = await otpClient.auth.verifyOtp({ phone, token: String(code), type: 'sms' });
    if (error || !data?.session || !data?.user) return res.status(400).json({ error: error?.message || 'invalid code' });

    const authId = data.user.id;
    // ensure a z.users row exists for this verified identity
    const realUser = await resolveUser(authId);

    // claim anon history: if the browser had an anon id with data, move it to this user.
    if (claimAnon && /^[a-zA-Z0-9_-]{8,64}$/.test(claimAnon)) {
      const anonAuthId = `open:${claimAnon}`;
      const { data: anonRow } = await supabase.from('users').select('id').eq('auth_user_id', anonAuthId).is('deleted_at', null).maybeSingle();
      if (anonRow && anonRow.id !== realUser.id) {
        // repoint all the anon user's content to the real user, then soft-delete the anon row
        await supabase.from('threads').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('messages').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('user_summaries').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('user_notes').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('journal_entries').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', anonRow.id);
      }
    }

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      userId: realUser.id,
      hasName: !!realUser.display_name,
      hasPin: !!(realUser as any).pin_hash,
    });
  } catch (e: any) { res.status(500).json({ error: 'verify failed: ' + (e?.message || String(e)) }); }
});

// ── WHAT Z REMEMBERS — the user's own view of their notes (read-only) + delete ──
// returns the durable facts (z.memory) and the overseer's anecdotes (z.user_notes).
// the user can read these and delete any of them — never edit (the record stays honest).
app.get('/notes', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const [facts, notes] = await Promise.all([
      supabase.from('memory').select('id, key, value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('user_notes').select('id, body, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    res.json({ facts: facts.data ?? [], notes: notes.data ?? [] });
  } catch (e: any) { res.status(500).json({ error: 'notes failed: ' + (e?.message || String(e)) }); }
});

// delete one remembered item — a fact or an overseer note. kind: 'fact' | 'note'.
app.delete('/notes/:kind/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { kind, id } = req.params;
    const table = kind === 'fact' ? 'memory' : kind === 'note' ? 'user_notes' : null;
    if (!table) return res.status(400).json({ error: 'bad kind' });
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) }); }
});

// delete a thread / group (soft-delete, user-scoped)
app.delete('/threads/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { error } = await supabase.from('threads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) }); }
});

// rename a thread (and/or set its avatar) — so the persona actually knows its current name.
app.patch('/threads/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, avatar_url } = req.body ?? {};
    const patch: any = {};
    if (typeof name === 'string' && name.trim()) patch.companion_name = name.trim();
    if (typeof avatar_url === 'string') patch.avatar_url = avatar_url;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const { data, error } = await supabase.from('threads')
      .update(patch).eq('id', req.params.id).eq('user_id', user.id).is('deleted_at', null)
      .select('id, companion_name, avatar_url').maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'thread not found' });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: 'rename failed: ' + (e?.message || String(e)) }); }
});

// a thread's saved conversation — so reopening shows the real history (persistent memory, visible)
app.get('/threads/:id/messages', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const threadId = req.params.id;
    // load the thread; for shared rooms, ANY member may read (not just owner)
    const { data: thread } = await supabase
      .from('threads').select('id, is_group, is_shared, user_id').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'thread not found' });
    const isOwner = thread.user_id === user.id;
    if (!isOwner) {
      // not the owner — allowed only if they're a member of this (shared) thread
      if (!thread.is_shared || !(await isRoomMember(threadId, user.id))) {
        return res.status(404).json({ error: 'thread not found' });
      }
    }
    // shared room: return EVERYONE's messages (the whole room). solo thread: just this user's.
    let q = supabase.from('messages')
      .select('role, content, persona_key, created_at, sender_user_id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!thread.is_shared) q = q.eq('user_id', user.id);
    const { data: msgs } = await q;
    // resolve a roster of member names (id -> display_name) for shared rooms
    let roster: Record<string,string> = {};
    if (thread.is_shared) {
      const { data: mem } = await supabase.from('room_members').select('user_id').eq('thread_id', threadId);
      const ids = (mem ?? []).map((m: any) => m.user_id);
      if (ids.length) {
        const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
        (us ?? []).forEach((u: any) => { roster[u.id] = u.display_name || 'someone'; });
      }
    }
    // attach sender_name to each message
    const out = (msgs ?? []).map((m: any) => ({ ...m, sender_name: m.sender_user_id ? (roster[m.sender_user_id] || 'someone') : null }));
    res.json({ messages: out, is_group: !!thread.is_group, is_shared: !!thread.is_shared, roster, you: user.id });
  } catch (e: any) { res.status(500).json({ error: 'history failed: ' + (e?.message || String(e)) }); }
});

// create a group chat thread with chosen member personas
// is this user a member of this thread/room? (the gate for shared rooms)
async function isRoomMember(threadId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('room_members')
    .select('user_id').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// create a shared room: one persona, owner auto-joined as a member
app.post('/rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, persona, personas } = req.body ?? {};
    // accept a single persona (back-compat) OR an array of up to 5
    let keys: string[] = Array.isArray(personas) ? personas : (persona ? [persona] : []);
    keys = [...new Set(keys.filter((k: any) => typeof k === 'string' && SHAREABLE_PERSONAS.has(k)))].slice(0, 5);
    if (!keys.length) {
      return res.status(400).json({ error: 'pick at least one persona that can be invited into a shared room' });
    }
    const { data: thread, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, is_shared: true, member_keys: keys,
      companion_name: (name && String(name).trim()) || 'the room',
    }).select('id, companion_name, member_keys').single();
    if (error) return res.status(500).json({ error: 'room create: ' + error.message });
    await supabase.from('room_members').insert({ thread_id: thread.id, user_id: user.id, role: 'owner' });
    res.json({ id: thread.id, name: thread.companion_name, personas: keys, persona: keys[0] });
  } catch (e: any) { res.status(500).json({ error: 'room failed: ' + (e?.message || String(e)) }); }
});

// owner mints (or returns) the room's invite link
app.post('/rooms/:id/invite', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!(await isRoomMember(req.params.id, user.id))) return res.status(403).json({ error: 'not a member' });
    // reuse an existing live invite if present
    const { data: existing } = await supabase.from('room_invites')
      .select('token').eq('thread_id', req.params.id).eq('revoked', false).limit(1).maybeSingle();
    let token = existing?.token;
    if (!token) {
      token = (await import('crypto')).randomBytes(9).toString('base64url');
      const { error } = await supabase.from('room_invites').insert({
        token, thread_id: req.params.id, created_by: user.id,
      });
      if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ token });
  } catch (e: any) { res.status(500).json({ error: 'invite failed: ' + (e?.message || String(e)) }); }
});

// PUBLIC: preview a room from an invite token (no join yet) — for the join screen
app.get('/join/:token', async (req, res) => {
  try {
    const { data: inv } = await supabase.from('room_invites')
      .select('thread_id, revoked, expires_at, max_uses, uses').eq('token', req.params.token).maybeSingle();
    if (!inv || inv.revoked) return res.status(404).json({ error: 'this invite is no longer active' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this invite expired' });
    if (inv.max_uses != null && inv.uses >= inv.max_uses) return res.status(410).json({ error: 'this invite is used up' });
    const { data: thread } = await supabase.from('threads')
      .select('companion_name, member_keys').eq('id', inv.thread_id).is('deleted_at', null).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'room not found' });
    res.json({ name: thread.companion_name, persona: (thread.member_keys || [])[0] || null });
  } catch (e: any) { res.status(500).json({ error: 'preview failed: ' + (e?.message || String(e)) }); }
});

// authed join: add the verified user to the room
app.post('/join/:token', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'sign in first' });
    const user = await resolveUser(authId);
    const { data: inv } = await supabase.from('room_invites')
      .select('thread_id, revoked, expires_at, max_uses, uses').eq('token', req.params.token).maybeSingle();
    if (!inv || inv.revoked) return res.status(404).json({ error: 'this invite is no longer active' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this invite expired' });
    if (inv.max_uses != null && inv.uses >= inv.max_uses) return res.status(410).json({ error: 'this invite is used up' });
    // add membership (idempotent) + bump uses
    await supabase.from('room_members').insert({ thread_id: inv.thread_id, user_id: user.id, role: 'member' })
      .select().maybeSingle();
    await supabase.from('room_invites').update({ uses: (inv.uses || 0) + 1 }).eq('token', req.params.token);
    res.json({ threadId: inv.thread_id });
  } catch (e: any) { res.status(500).json({ error: 'join failed: ' + (e?.message || String(e)) }); }
});

// rooms the user is a member of (server is source of truth)
app.get('/rooms/:id/members', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!(await isRoomMember(req.params.id, user.id))) return res.status(403).json({ error: 'not a member' });
    const { data: mems } = await supabase.from('room_members').select('user_id').eq('thread_id', req.params.id);
    const ids = (mems ?? []).map((m: any) => m.user_id);
    const map: Record<string,string> = {};
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
      (us ?? []).forEach((u: any) => { map[u.id] = u.display_name || 'someone'; });
    }
    res.json({ members: map, meId: user.id });
  } catch (e: any) { res.status(500).json({ error: 'members failed: ' + (e?.message || String(e)) }); }
});

app.get('/rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: mem } = await supabase.from('room_members').select('thread_id').eq('user_id', user.id);
    const ids = (mem ?? []).map((m: any) => m.thread_id);
    if (!ids.length) return res.json([]);
    const { data: threads } = await supabase.from('threads')
      .select('id, companion_name, member_keys, last_active')
      .in('id', ids).eq('is_shared', true).is('deleted_at', null)
      .order('last_active', { ascending: false });
    const rooms = (threads ?? []).map((t: any) => ({
      id: t.id, name: t.companion_name,
      personas: (t.member_keys || []), persona: (t.member_keys || [])[0] || null,
    }));
    res.json(rooms);
  } catch (e: any) { res.status(500).json({ error: 'rooms list failed: ' + (e?.message || String(e)) }); }
});

// leave a room (members remove themselves)
app.post('/rooms/:id/leave', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('room_members').delete().eq('thread_id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'leave failed: ' + (e?.message || String(e)) }); }
});

// list the user's groups (server is the source of truth, not localStorage)
app.get('/groups', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('threads')
      .select('id, companion_name, member_keys, last_active')
      .eq('user_id', user.id).eq('is_group', true).eq('is_shared', false).is('deleted_at', null)
      .order('last_active', { ascending: false });
    const groups = (data ?? []).map((g: any) => ({ id: g.id, name: g.companion_name, members: g.member_keys || [] }));
    res.json(groups);
  } catch (e: any) { res.status(500).json({ error: 'groups list failed: ' + (e?.message || String(e)) }); }
});

app.post('/groups', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, members } = req.body ?? {};
    const keys: string[] = Array.isArray(members) ? members.filter((m: any) => typeof m === 'string') : [];
    if (keys.length < 2) return res.status(400).json({ error: 'a group needs at least 2 members' });
    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, member_keys: keys,
      companion_name: (name && String(name).trim()) || 'the group',
    }).select('id, is_group, member_keys, companion_name').single();
    if (error) return res.status(500).json({ error: 'group create: ' + error.message });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: 'group failed: ' + (e?.message || String(e)) }); }
});

app.post('/chat', express.json({ limit: '8mb' }), async (req, res) => {
  let user;
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    user = await resolveUser(authId);
    if (await isRestricted(user.id)) return res.status(403).json({ error: 'restricted' });
  } catch (e: any) {
    return res.status(500).json({ error: 'chat setup failed: ' + (e?.message || String(e)) });
  }

  const { threadId, message, image } = req.body ?? {};
  if (!threadId || !message) return res.status(400).json({ error: 'threadId and message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    // look up the thread. shared rooms: any MEMBER may chat (not just owner).
    const { data: th } = await supabase.from('threads')
      .select('is_group, is_shared, user_id').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!th) { res.write(`data: ${JSON.stringify({ error: 'thread not found' })}\n\n`); return res.end(); }
    const isOwner = th.user_id === user.id;
    if (th.is_shared) {
      // membership gate: only members of the room may post
      if (!isOwner && !(await isRoomMember(threadId, user.id))) {
        res.write(`data: ${JSON.stringify({ error: 'you are not in this room' })}\n\n`); return res.end();
      }
      await runGroupTurn({
        userId: user.id, threadId, message, senderName: user.display_name || 'someone',
        onPersonaStart: (key, name) => res.write(`data: ${JSON.stringify({ speaker: key, name })}\n\n`),
        onToken: (key, t) => res.write(`data: ${JSON.stringify({ speaker: key, token: t })}\n\n`),
        onPersonaEnd: (key, full) => res.write(`data: ${JSON.stringify({ speaker: key, end: true })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } else if (th.is_group && isOwner) {
      // ARENA support in groups: strip score tags from the moderator's visible stream,
      // and after its turn, parse + emit score/result + persist the match.
      const tagRe = /\[\[(SCORE|RESULT|VERDICT)[^\]]*\]\]/g;
      const tails: Record<string, string> = {};
      const flushVisible = (key: string, chunk: string, final = false) => {
        let buf = (tails[key] || '') + chunk;
        buf = buf.replace(tagRe, '');
        if (!final) {
          const lastOpen = buf.lastIndexOf('[[');
          if (lastOpen !== -1 && buf.indexOf(']]', lastOpen) === -1) { tails[key] = buf.slice(lastOpen); buf = buf.slice(0, lastOpen); }
          else { tails[key] = ''; }
        } else { tails[key] = ''; }
        if (buf) res.write(`data: ${JSON.stringify({ speaker: key, token: buf })}\n\n`);
      };
      await runGroupTurn({
        userId: user.id, threadId, message,
        onPersonaStart: (key, name) => res.write(`data: ${JSON.stringify({ speaker: key, name })}\n\n`),
        onToken: (key, t) => flushVisible(key, t),
        onPersonaEnd: (key, full) => {
          flushVisible(key, '', true);
          res.write(`data: ${JSON.stringify({ speaker: key, end: true })}\n\n`);
          // only the moderator carries score/result/verdict tags
          if (key === 'the_moderator') {
            const score = /\[\[SCORE\s+you=(\d+)\s+z=(\d+)\]\]/.exec(full);
            const r2 = /\[\[RESULT\s+winner=(you|z|draw)\s+you=(\d+)\s+z=(\d+)\]\]/.exec(full);
            const verdict = /\[\[VERDICT\s+outcome=(win|loss|draw)\]\]/.exec(full);
            if (score) res.write(`data: ${JSON.stringify({ score: { you: +score[1], z: +score[2] } })}\n\n`);
            if (r2) {
              res.write(`data: ${JSON.stringify({ result: { winner: r2[1], you: +r2[2], z: +r2[3] } })}\n\n`);
              supabase.from('threads').select('game_mode, member_keys').eq('id', threadId).maybeSingle().then(({ data: thg }: any) => {
                const opp = (thg?.member_keys || []).find((k: string) => k !== 'the_moderator') || null;
                supabase.from('arena_matches').insert({
                  user_id: user.id, game: thg?.game_mode || 'unknown', persona_key: opp,
                  you_score: +r2[2], z_score: +r2[3], winner: r2[1],
                }).then(() => {});
                supabase.from('threads').update({ game_mode: null }).eq('id', threadId).then(() => {});
              });
            }
            if (verdict) {
              const outcome = verdict[1];
              res.write(`data: ${JSON.stringify({ verdict: { outcome } })}\n\n`);
              supabase.from('threads').select('scenario_key, scenario_brief').eq('id', threadId).maybeSingle().then(({ data: thr }: any) => {
                supabase.from('roleplay_runs').insert({
                  user_id: user.id, scenario: thr?.scenario_key || 'unknown',
                  player_role: thr?.scenario_brief || null, outcome,
                }).then(() => {});
                // scene over — clear the scenario so the thread returns to normal
                supabase.from('threads').update({ scenario_key: null, scenario_brief: null }).eq('id', threadId).then(() => {});
              });
            }
          }
        },
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } else if (isOwner) {
      // ARENA: if a game is active, strip score tags from the player-visible stream.
      // Tags can split across tokens, so we hold back a small tail buffer.
      const tagRe = /\[\[(SCORE|RESULT|TASK_ADD|TASK_DONE|GOTO)[^\]]*\]\]/g;
      let tail = '';
      const flushVisible = (chunk: string, final = false) => {
        let buf = tail + chunk;
        buf = buf.replace(tagRe, '');                 // drop any complete tags
        if (!final) {
          // hold back a trailing partial "[[..." so we don't leak half a tag
          const lastOpen = buf.lastIndexOf('[[');
          if (lastOpen !== -1 && buf.indexOf(']]', lastOpen) === -1) {
            tail = buf.slice(lastOpen); buf = buf.slice(0, lastOpen);
          } else { tail = ''; }
        } else { tail = ''; }
        if (buf) res.write(`data: ${JSON.stringify({ token: buf })}\n\n`);
      };
      const result = await runZTurn({
        userId: user.id, threadId, message, image: image ?? null,
        onToken: (t) => flushVisible(t),
      });
      flushVisible('', true);
      // optional source pills for web-enabled personas (Z still speaks in her own voice)
      if (result.sources && result.sources.length) {
        res.write(`data: ${JSON.stringify({ sources: result.sources.slice(0, 4) })}\n\n`);
      }
      // the Front Desk's routing suggestions → tappable persona chips
      if ((result as any).routes && (result as any).routes.length) {
        res.write(`data: ${JSON.stringify({ routes: (result as any).routes })}\n\n`);
      }
      // parse score/result tags from the full reply, persist + tell the UI
      const score = /\[\[SCORE\s+you=(\d+)\s+z=(\d+)\]\]/.exec(result.reply);
      const res2  = /\[\[RESULT\s+winner=(you|z|draw)\s+you=(\d+)\s+z=(\d+)\]\]/.exec(result.reply);
      if (score) res.write(`data: ${JSON.stringify({ score: { you: +score[1], z: +score[2] } })}\n\n`);
      if (res2) {
        res.write(`data: ${JSON.stringify({ result: { winner: res2[1], you: +res2[2], z: +res2[3] } })}\n\n`);
        // persist the match + clear game_mode (match over)
        const { data: th } = await supabase.from('threads').select('game_mode, persona_key').eq('id', threadId).maybeSingle();
        await supabase.from('arena_matches').insert({
          user_id: user.id, game: (th as any)?.game_mode || 'unknown',
          persona_key: (th as any)?.persona_key || null,
          you_score: +res2[2], z_score: +res2[3], winner: res2[1],
        });
        await supabase.from('threads').update({ game_mode: null }).eq('id', threadId);
      }
      res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\n\n`);
      res.end();
    }
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`[z] engine on :${port}`));
