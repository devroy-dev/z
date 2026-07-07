#!/usr/bin/env python3
# zip54d (server) — THE CLIENT BRIEF SPINE
#   1) migration 0049_mm_brief.sql copied into migrations/ (Dev runs it in Supabase)
#   2) GET/POST /mm/brief endpoints (user-auth, whitelist upsert)
#   3) loop.ts: the brief rides every Media Manager turn as his own working notes
# Anchored, idempotent, atomic. Run from repo root with 0049_mm_brief.sql alongside.
import sys, shutil, pathlib

INDEX = pathlib.Path('src/index.ts'); LOOP = pathlib.Path('src/loop.ts')
index = INDEX.read_text(encoding='utf-8'); loop = LOOP.read_text(encoding='utf-8')

if 'zip54d' in index:
    print('zip54d server already applied — nothing to do.'); sys.exit(0)

HERE = pathlib.Path(__file__).parent
if not (HERE / '0049_mm_brief.sql').exists():
    print('MISSING PAYLOAD: 0049_mm_brief.sql'); sys.exit(1)

ENDPOINTS = (
"// [zip54d] ── THE CLIENT BRIEF ── the advisor's working notes on the one client he\n"
"// manages (the user). The room writes it; the loop reads it every turn.\n"
"app.get('/mm/brief', async (req: any, res: any) => {\n"
"  try {\n"
"    const authId = await authUser(req);\n"
"    if (!authId) return res.status(401).json({ error: 'unauthorized' });\n"
"    const user = await resolveUser(authId);\n"
"    const { data } = await supabase.from('mm_brief').select('*').eq('user_id', user.id).maybeSingle();\n"
"    res.json({ brief: data ?? null });\n"
"  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }\n"
"});\n"
"app.post('/mm/brief', async (req: any, res: any) => {\n"
"  try {\n"
"    const authId = await authUser(req);\n"
"    if (!authId) return res.status(401).json({ error: 'unauthorized' });\n"
"    const user = await resolveUser(authId);\n"
"    const FIELDS = ['display_name', 'handle', 'platforms', 'niche', 'pillars', 'audience', 'stage', 'goal', 'deals', 'cadence', 'notes'];\n"
"    const row: any = { user_id: user.id, updated_at: new Date().toISOString() };\n"
"    for (const f of FIELDS) if (f in (req.body ?? {})) row[f] = String(req.body[f] ?? '').slice(0, 800) || null;\n"
"    const { error } = await supabase.from('mm_brief').upsert(row, { onConflict: 'user_id' });\n"
"    if (error) return res.status(500).json({ error: error.message });\n"
"    res.json({ ok: true });\n"
"  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }\n"
"});\n\n"
)

OLD_ECHO_ROUTE = "app.post('/dev/echo', async (req, res) => {"
NEW_ECHO_ROUTE = ENDPOINTS + OLD_ECHO_ROUTE

MM_BLOCK = (
"  // [zip54d] THE CLIENT BRIEF — the advisor never asks for what he has already been\n"
"  // told; his own working notes on this client ride every turn.\n"
"  let mmBlock = '';\n"
"  if (String(t.persona_key || '') === 'the_media_manager') {\n"
"    try {\n"
"      const { data: brief } = await supabase.from('mm_brief').select('*').eq('user_id', t.user_id).maybeSingle();\n"
"      if (brief) {\n"
"        const f = (label: string, v: any) => (v ? `\\n  ${label}: ${String(v).slice(0, 400)}` : '');\n"
"        mmBlock = `\\n\\n[THE CLIENT BRIEF — your own working notes on the client in front of you, gathered quietly over your time together. This is what you already know; never ask for what is written here. An empty line is a gap you hold in your notes and fill in its own time, never by interrogation.${f('name / handle', brief.display_name || brief.handle)}${f('platforms', brief.platforms)}${f('niche', brief.niche)}${f('content pillars', brief.pillars)}${f('audience', brief.audience)}${f('stage', brief.stage)}${f('the goal', brief.goal)}${f('active deals', brief.deals)}${f('cadence', brief.cadence)}${f('standing notes', brief.notes)}]`;\n"
"      }\n"
"    } catch (e: any) { console.error('[mm] brief failed:', e?.message || e); }\n"
"  }\n"
)

OLD_DESK = "  let frontDeskBlock = '';"
NEW_DESK = MM_BLOCK + OLD_DESK

OLD_DYN = "  const dynamic = `\\n\\n[${todayLine}]${ownerLine}${seriousLine}${gameLine}${frontDeskBlock}${lifeBlock}${memoryBlock}${registerNote}`;"
NEW_DYN = "  const dynamic = `\\n\\n[${todayLine}]${ownerLine}${seriousLine}${gameLine}${frontDeskBlock}${mmBlock}${lifeBlock}${memoryBlock}${registerNote}`;   // [zip54d] the brief rides"

for path, text, pairs in (('src/index.ts', index, [(OLD_ECHO_ROUTE, NEW_ECHO_ROUTE)]),
                          ('src/loop.ts', loop, [(OLD_DESK, NEW_DESK), (OLD_DYN, NEW_DYN)])):
    for old, _ in pairs:
        n = text.count(old)
        if n != 1:
            print(f'ANCHOR FAIL in {path} (count={n}): {old[:70]!r}...'); sys.exit(1)

index = index.replace(OLD_ECHO_ROUTE, NEW_ECHO_ROUTE)
loop = loop.replace(OLD_DESK, NEW_DESK).replace(OLD_DYN, NEW_DYN)

shutil.copyfile(HERE / '0049_mm_brief.sql', pathlib.Path('migrations') / '0049_mm_brief.sql')

for p, text in ((INDEX, index), (LOOP, loop)):
    tmp = p.with_suffix('.ts.tmp'); tmp.write_text(text, encoding='utf-8'); tmp.replace(p)

print('zip54d server applied: the brief has a home, the endpoints stand, the advisor reads his notes every turn.')
