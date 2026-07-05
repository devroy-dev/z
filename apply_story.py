import io, os, sys
I='src/index.ts'
edits=[]
def E(old,new,label,marker=None): edits.append((old,new,label,marker))
E("import { createTraitors, stepTraitors, viewTraitors, type Seat as TSeat } from './games/traitors.js';",
  "import { createTraitors, stepTraitors, viewTraitors, type Seat as TSeat } from './games/traitors.js';\nimport { createStory, stepStory, viewStory, storyText, type Seat as StorySeat } from './games/storyCollab.js';",
  "index import story", marker="createStory, stepStory, viewStory, storyText")

ROUTES = r'''// ── STORY COLLAB (round-robin co-writing; lives in the Shows Play door) ──
app.post('/games/story/start', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const bodyKeys: string[] = Array.isArray(req.body?.personas) ? req.body.personas : [];
    let keys = [...new Set(bodyKeys.filter((k: any) => typeof k === 'string' && SHAREABLE_PERSONAS.has(k)))].slice(0, 6);
    if (keys.length < 2) keys = ['the_historian', 'the_philosopher', 'the_comic'];
    const mode = req.body?.mode === 'chaos' ? 'chaos' : 'coherent';
    const premise = String(req.body?.premise || '').slice(0, 500);
    const rounds = Math.max(1, Math.min(Number(req.body?.rounds) || 3, 8));
    const humanPlays = !!req.body?.humanPlays;
    const nameFor = (k: string) => personaByKey(k)?.defaultName || k;
    const seats: StorySeat[] = keys.map((k) => ({ kind: 'persona' as const, id: k, name: nameFor(k) }));
    if (humanPlays) seats.push({ kind: 'user' as const, id: user.id, name: user.display_name || 'you' });
    const state = createStory(seats, { mode, premise, rounds });
    const { data: thread } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, is_shared: false, member_keys: keys, companion_name: 'Story Collab',
    }).select('id').single();
    const { data: sess, error } = await supabase.from('game_sessions').insert({
      thread_id: thread?.id, game: 'story_collab', state, seats, created_by: user.id,
    }).select('id, version').single();
    if (error || !sess) return res.status(500).json({ error: error?.message || 'session insert failed' });
    const mySeat = humanPlays ? seats.length - 1 : -1;
    res.json({ storyId: sess.id, mySeat, view: viewStory(state, mySeat) });
  } catch (e: any) { res.status(500).json({ error: 'story start failed: ' + (e?.message || String(e)) }); }
});
app.post('/games/story/:id/step', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('id, state, seats').eq('id', req.params.id).eq('game', 'story_collab').maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such story' });
    const seats = (s.seats || []) as StorySeat[];
    const mySeat = seats.findIndex((x) => x.kind === 'user' && x.id === user.id);
    const text = typeof req.body?.text === 'string' ? req.body.text : undefined;
    const next = await stepStory(s.state, text);
    await supabase.from('game_sessions').update({ state: next, status: next.status === 'done' ? 'done' : 'live' }).eq('id', s.id);
    res.json({ view: viewStory(next, mySeat >= 0 ? mySeat : -1) });
  } catch (e: any) { res.status(500).json({ error: 'story step failed: ' + (e?.message || String(e)) }); }
});
app.post('/games/story/:id/publish', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('id, state, created_by').eq('id', req.params.id).eq('game', 'story_collab').maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such story' });
    if (s.created_by !== user.id) return res.status(403).json({ error: 'only the owner can publish' });
    // NOTE: content-moderation MUST gate this before a story becomes public (18+ helps, doesn't cover it).
    // Wire the mod pipeline here when it lands. v1 finalises for the owner only.
    const state = { ...(s.state as any), published: true };
    await supabase.from('game_sessions').update({ state }).eq('id', s.id);
    res.json({ published: true, premise: state.premise || 'Untitled', text: storyText(state as any), byline: (state.seats || []).map((x: any) => x.name) });
  } catch (e: any) { res.status(500).json({ error: 'publish failed: ' + (e?.message || String(e)) }); }
});
app.get('/games/story/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('state, seats').eq('id', req.params.id).eq('game', 'story_collab').maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such story' });
    const seats = (s.seats || []) as StorySeat[];
    const mySeat = seats.findIndex((x) => x.kind === 'user' && x.id === user.id);
    res.json({ view: viewStory(s.state, mySeat >= 0 ? mySeat : -1) });
  } catch (e: any) { res.status(500).json({ error: 'story fetch failed: ' + (e?.message || String(e)) }); }
});

'''
E("app.post('/games/traitors/start', express.json(), async (req, res) => {",
  ROUTES + "app.post('/games/traitors/start', express.json(), async (req, res) => {",
  "index story endpoints", marker="/games/story/start")

if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
placed=[]
for fn,dest in [('storyCollab.ts','src/games/storyCollab.ts')]:
    if os.path.isfile(fn) and not os.path.isfile(dest):
        io.open(dest,'w',encoding='utf-8').write(io.open(fn,encoding='utf-8').read()); placed.append(dest)
src=io.open(I,encoding='utf-8').read(); staged=src; planned,skipped=[],[]
for (old,new,label,marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged): skipped.append(label); continue
    if staged.count(old)!=1: print(f"  ! {label}: anchor x{staged.count(old)} — ABORT"); sys.exit(1)
    staged=staged.replace(old,new); planned.append(label)
if planned: io.open(I,'w',encoding='utf-8').write(staged)
for p in placed: print(f"  + {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
