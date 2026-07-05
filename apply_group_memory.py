#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  Group memory v1 — wiring. Run from repo root: python3 apply_group_memory.py
#  SERVER (Railway). Transactional + idempotent. Ships with:
#    - migrations/0037_room_memory.sql  (run in Supabase FIRST)
#    - src/roomMemory.ts                (the read/harvest/nightly module)
#  This patcher wires them in:
#    1. groupLoop.ts — inject the room's collective memory into shared-room turns
#       (replaces the old "you know nothing here" with the room's shared history).
#    2. overseer.ts — harvest room memory on the nightly run.
#    3. index.ts — a founder-gated test endpoint to harvest + inspect on demand.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

edits = []
def E(path, old, new, label, marker=None): edits.append((path, old, new, label, marker))

# ── groupLoop.ts ────────────────────────────────────────────────────────
G = 'src/groupLoop.ts'
E(G, "import { readMemoryBlock } from './memory.js';",
  "import { readMemoryBlock } from './memory.js';\nimport { readRoomMemoryBlock } from './roomMemory.js';",
  "groupLoop import roomMemory", marker="readRoomMemoryBlock } from './roomMemory.js'")
# inject room memory in shared rooms (was: '')
E(G, "  const memoryBlock = t.is_shared ? '' : await readMemoryBlock(userId);",
  "  const memoryBlock = t.is_shared ? await readRoomMemoryBlock(threadId) : await readMemoryBlock(userId);",
  "groupLoop inject room memory")
# the room identity line now reflects shared history (not 'you know nothing')
E(G, "    ownerLine = `\\n\\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is \"${input.senderName}\". You do NOT know any private history about anyone here — you only know them from what's said in this room. Treat everyone as someone you're meeting in the room, by name.]`;",
  "    ownerLine = `\\n\\n[THIS IS A SHARED ROOM with real people in it. The person who just spoke is \"${input.senderName}\". You know these people only from your shared time in THIS room — the room memory below is what you remember together. You have no private history about anyone from outside this room. Greet and treat everyone by name.]`;",
  "groupLoop room identity line")

# ── overseer.ts : nightly harvest ───────────────────────────────────────
O = 'src/overseer.ts'
E(O, "import { soulFor } from './content.js';",
  "import { soulFor } from './content.js';\nimport { runRoomMemoryHarvest } from './roomMemory.js';",
  "overseer import roomMemory", marker="runRoomMemoryHarvest } from './roomMemory.js'")
E(O, """  runOverseer({ weekly: process.argv.includes('weekly') })
    .then((r) => { console.log(r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });""",
  """  runOverseer({ weekly: process.argv.includes('weekly') })
    .then(async (r) => { const rm = await runRoomMemoryHarvest(); console.log(r, rm); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });""",
  "overseer nightly room harvest", marker="const rm = await runRoomMemoryHarvest()")

# ── index.ts : founder-gated test endpoint ──────────────────────────────
I = 'src/index.ts'
E(I, "import { broadcastRoomMessage } from './broadcast.js';",
  "import { broadcastRoomMessage } from './broadcast.js';\nimport { harvestRoomMemory, readRoomMemoryBlock } from './roomMemory.js';",
  "index import roomMemory", marker="harvestRoomMemory, readRoomMemoryBlock } from './roomMemory.js'")
E(I, "app.get('/diagnostics/costs', async (req, res) => {",
  """// group-memory test: harvest a room's collective memory on demand + return it (founder-gated)
app.post('/diagnostics/room-memory/:threadId', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });
    const threadId = String(req.params.threadId || '');
    const harvested = await harvestRoomMemory(threadId);
    const block = await readRoomMemoryBlock(threadId);
    res.json({ harvested, block });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.get('/diagnostics/room-memory/:threadId', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });
    const block = await readRoomMemoryBlock(String(req.params.threadId || ''));
    res.json({ block });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.get('/diagnostics/costs', async (req, res) => {""",
  "index room-memory test endpoint", marker="/diagnostics/room-memory/:threadId")

# ── apply (transactional across files + idempotent) ─────────────────────
if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
# stage the new files (copied alongside this patcher in the zip)
for fn, dest in [('roomMemory.ts', 'src/roomMemory.ts'), ('0037_room_memory.sql', 'migrations/0037_room_memory.sql')]:
    if os.path.isfile(fn) and not os.path.isfile(dest):
        io.open(dest, 'w', encoding='utf-8').write(io.open(fn, encoding='utf-8').read())
        print(f"  + placed {dest}")
    elif os.path.isfile(dest):
        print(f"  = {dest} (already present)")

cache = {}
def load(p):
    if p not in cache: cache[p] = io.open(p, encoding='utf-8').read()
    return cache[p]
planned, skipped = [], []
for (path, old, new, label, marker) in edits:
    src = load(path)
    if (marker and marker in src) or (not marker and old not in src):
        skipped.append(label); continue
    if src.count(old) != 1:
        print(f"  ! {label}: anchor x{src.count(old)} (need 1) in {path} — ABORT (nothing written)"); sys.exit(1)
    cache[path] = src.replace(old, new); planned.append(label)
for p, c in cache.items(): io.open(p, 'w', encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}.")
print("Run migrations/0037_room_memory.sql in Supabase FIRST, then: npm run build → push.")
