#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  THE TRAITORS — reality game v1 (phase 1: engine + curl-playable endpoints).
#  Run from repo root: python3 apply_traitors.py   (SERVER, Railway)
#  Ships src/games/traitors.ts (engine; state machine unit-verified locally).
#  Adds three endpoints:
#    POST /games/traitors/start        {personas:[...], humanPlays?, traitors?}
#    POST /games/traitors/:id/step     {vote?}   → advance one phase
#    GET  /games/traitors/:id/watch    → spectator view (sees the traitors — irony)
#  Transactional + idempotent.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

I = 'src/index.ts'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# import the engine
E("import { broadcastRoomMessage } from './broadcast.js';",
  "import { broadcastRoomMessage } from './broadcast.js';\nimport { createTraitors, stepTraitors, viewTraitors, type Seat as TSeat } from './games/traitors.js';",
  "index import traitors", marker="createTraitors, stepTraitors, viewTraitors")

# endpoints (inserted before the battlefield spectator endpoint)
TRAITORS_ROUTES = '''// ── THE TRAITORS (reality game v1) ──────────────────────────────────────
app.post('/games/traitors/start', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const bodyKeys: string[] = Array.isArray(req.body?.personas) ? req.body.personas : [];
    let keys = [...new Set(bodyKeys.filter((k: any) => typeof k === 'string' && SHAREABLE_PERSONAS.has(k)))].slice(0, 7);
    if (keys.length < 3) keys = ['the_comic', 'the_brainiac', 'the_historian', 'the_philosopher', 'the_wannabe'];
    const humanPlays = !!req.body?.humanPlays;
    const nameFor = (k: string) => personaByKey(k)?.defaultName || k;
    const seats: TSeat[] = keys.map((k) => ({ kind: 'persona' as const, id: k, name: nameFor(k) }));
    if (humanPlays) seats.push({ kind: 'user' as const, id: user.id, name: user.display_name || 'you' });
    const traitors = Math.max(1, Math.min(Number(req.body?.traitors) || Math.max(1, Math.floor(seats.length / 4)), seats.length - 1));
    const state = createTraitors(seats, { traitors });
    const { data: thread } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, is_shared: false, member_keys: keys, companion_name: 'The Traitors',
    }).select('id').single();
    const { data: sess, error } = await supabase.from('game_sessions').insert({
      thread_id: thread?.id, game: 'traitors', state, seats, created_by: user.id,
    }).select('id, version').single();
    if (error || !sess) return res.status(500).json({ error: error?.message || 'session insert failed' });
    const mySeat = humanPlays ? seats.length - 1 : -1;
    res.json({ sessionId: sess.id, version: sess.version, mySeat, view: viewTraitors(state, mySeat) });
  } catch (e: any) { res.status(500).json({ error: 'traitors start failed: ' + (e?.message || String(e)) }); }
});

app.post('/games/traitors/:id/step', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('id, state, seats').eq('id', req.params.id).eq('game', 'traitors').maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such game' });
    const seats = (s.seats || []) as TSeat[];
    const mySeat = seats.findIndex((x) => x.kind === 'user' && x.id === user.id);
    const humanMove = (typeof req.body?.vote === 'number' && mySeat >= 0) ? { seat: mySeat, vote: req.body.vote } : undefined;
    const next = await stepTraitors(s.state, humanMove);
    await supabase.from('game_sessions').update({ state: next, status: next.winner ? 'done' : 'live' }).eq('id', s.id);
    res.json({ view: viewTraitors(next, mySeat >= 0 ? mySeat : -1) });
  } catch (e: any) { res.status(500).json({ error: 'traitors step failed: ' + (e?.message || String(e)) }); }
});

app.get('/games/traitors/:id/watch', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const { data: s } = await supabase.from('game_sessions').select('state').eq('id', req.params.id).eq('game', 'traitors').maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such game' });
    res.json({ view: viewTraitors(s.state, -1) });   // spectator sees ALL — the dramatic irony
  } catch (e: any) { res.status(500).json({ error: 'watch failed: ' + (e?.message || String(e)) }); }
});

'''
E("app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  TRAITORS_ROUTES + "app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  "index traitors endpoints", marker="/games/traitors/start")

# ── apply ───────────────────────────────────────────────────────────────
if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
placed = []
if os.path.isfile('traitors.ts') and not os.path.isfile('src/games/traitors.ts'):
    io.open('src/games/traitors.ts', 'w', encoding='utf-8').write(io.open('traitors.ts', encoding='utf-8').read())
    placed.append('src/games/traitors.ts')
elif os.path.isfile('src/games/traitors.ts'):
    placed.append('src/games/traitors.ts (already present)')

src = io.open(I, encoding='utf-8').read()
planned, skipped = [], []
staged = src
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(I, 'w', encoding='utf-8').write(staged)
for p in placed: print(f"  + {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}. SERVER: npm run build → push.")
