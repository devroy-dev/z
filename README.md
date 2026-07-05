# Group memory v1 — the room remembers US (SERVER, Railway)

A shared room's COLLECTIVE memory: personas now remember THIS room across sessions —
who's who, the running jokes, what happened — built ONLY from what was said in the room
(visible to every member) and injected back ONLY into that room. Distinct from per-user
private memory (that stays suppressed in rooms). Verified: real `npm run build` (tsc) passes.

## Contents
- 0037_room_memory.sql  — the z.room_memory table (RUN IN SUPABASE FIRST)
- roomMemory.ts         — readRoomMemoryBlock + harvestRoomMemory + runRoomMemoryHarvest
- apply_group_memory.py — places the two files + wires groupLoop / overseer / index

## Apply — order matters
    unzip -o group-memory.zip
    # 1) run the SQL in the Supabase SQL editor:
    #    (paste 0037_room_memory.sql and run)
    # 2) then, from repo root:
    python3 apply_group_memory.py          # places files + wires (Staged 7)
    npm run build
    git add -A && git commit -m "group memory v1: room-collective memory" && git push

## How it works
- On each shared-room turn, every persona now gets the room's collective memory block
  (facts about members by name + the room's running bits) instead of "you know nothing here".
- Harvested nightly for active rooms by the overseer run (runRoomMemoryHarvest).

## Test on demand (founder-gated to your account)
After chatting a bit in a room, grab its threadId and harvest immediately:
    curl -X POST https://z-production-c79a.up.railway.app/diagnostics/room-memory/THREAD_ID \
      -H "Authorization: Bearer YOUR_TOKEN"
Returns { harvested: N, block: "...the memory it will inject..." }.
Then keep chatting in that room — the personas should reference the room's history/jokes.
GET the same URL to just read the current memory without re-harvesting.

## Notes
- v1 is ONE shared memory per room (all personas draw from it). Per-persona relationship
  nuance ("the comic teases Rahul specifically") is a clean v2 layer on top.
- Best-effort + conservative: won't store ages, won't harvest from thin transcripts (<4 msgs).
