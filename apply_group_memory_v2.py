#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  Group memory v2 — per-persona room reads + continuity nudge.
#  Run from repo root: python3 apply_group_memory_v2.py   (SERVER, Railway)
#  Ships with 0038_room_memory_persona.sql (RUN IN SUPABASE FIRST) and the v2
#  roomMemory.ts (overwrites v1). Transactional + idempotent.
#
#  v2a: each persona also keeps its OWN read of the room (persona_key set),
#       layered on the collective memory (persona_key null) — so the room memory
#       is now read PER PERSONA inside the turn loop (was once-per-turn).
#  v2b: continuity nudge (baked into the memory block text) — a returning persona
#       naturally picks up the thread; its own moving life (diary) is already injected.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

G = 'src/groupLoop.ts'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# 1) memoryBlock: shared rooms are now handled PER PERSONA in the loop → '' here
E("  const memoryBlock = t.is_shared ? await readRoomMemoryBlock(threadId) : await readMemoryBlock(userId);",
  "  const memoryBlock = t.is_shared ? '' : await readMemoryBlock(userId);",
  "groupLoop memoryBlock per-persona")

# 2) per-persona room memory, right after lifeBlock (uses this persona's `key`)
E("""    let lifeBlock = '';
    if (!scenarioKey) {
      try { lifeBlock = await stateBlockFor(key); } catch (e: any) { console.error('[life] block failed:', e?.message || e); }
    }""",
  """    let lifeBlock = '';
    if (!scenarioKey) {
      try { lifeBlock = await stateBlockFor(key); } catch (e: any) { console.error('[life] block failed:', e?.message || e); }
    }
    let roomMemBlock = '';
    if (t.is_shared) {
      try { roomMemBlock = await readRoomMemoryBlock(threadId, key); } catch (e: any) { console.error('[roommem] block failed:', e?.message || e); }
    }""",
  "groupLoop per-persona roomMemBlock", marker="let roomMemBlock = '';")

# 3) inject it into the dynamic block
E("${lifeBlock}${memoryBlock}`;",
  "${lifeBlock}${memoryBlock}${roomMemBlock}`;",
  "groupLoop dynamic +roomMemBlock", marker="${memoryBlock}${roomMemBlock}")

# ── apply ───────────────────────────────────────────────────────────────
if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)

# overwrite roomMemory.ts (v2) + place migration 0038 (both shipped in the zip)
placed = []
if os.path.isfile('roomMemory.ts'):
    io.open('src/roomMemory.ts', 'w', encoding='utf-8').write(io.open('roomMemory.ts', encoding='utf-8').read())
    placed.append('src/roomMemory.ts (v2)')
if os.path.isfile('0038_room_memory_persona.sql') and not os.path.isfile('migrations/0038_room_memory_persona.sql'):
    io.open('migrations/0038_room_memory_persona.sql', 'w', encoding='utf-8').write(io.open('0038_room_memory_persona.sql', encoding='utf-8').read())
    placed.append('migrations/0038_room_memory_persona.sql')

src = io.open(G, encoding='utf-8').read()
planned, skipped = [], []
staged = src
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT (nothing written)"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(G, 'w', encoding='utf-8').write(staged)
for p in placed: print(f"  + placed {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}.")
print("Run migrations/0038_room_memory_persona.sql in Supabase FIRST, then: npm run build → push.")
