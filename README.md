# Group memory v2 — per-persona room reads + continuity (SERVER, Railway)

Builds on v1. Two layers:
- v2a PER-PERSONA: each persona now also keeps its OWN read of the room (persona_key set)
  — how IT sees the members, who it needles, its running dynamic — layered on the collective
  memory (persona_key null) everyone shares. Room memory is now read PER PERSONA in the turn.
- v2b CONTINUITY: the memory block nudges a returning persona to pick up the thread; its own
  moving life (the nightly diary) is already injected, so "come back with news" works naturally.
Verified: real `npm run build` (tsc) passes; transactional + idempotent.

## Contents
- 0038_room_memory_persona.sql — adds persona_key to z.room_memory (RUN IN SUPABASE FIRST)
- roomMemory.ts                — v2 (overwrites v1): per-persona harvest + read + continuity
- apply_group_memory_v2.py     — places both files + wires groupLoop (per-persona read)

## Apply — order matters
    unzip -o group-memory-v2.zip
    # 1) run 0038_room_memory_persona.sql in the Supabase SQL editor
    # 2) then from repo root:
    python3 apply_group_memory_v2.py       # Staged 3 (+2 files placed)
    npm run build
    git add -A && git commit -m "group memory v2: per-persona room reads + continuity" && git push

## Test
Re-harvest a room you've chatted in (same curl as v1):
    curl -X POST https://z-production-c79a.up.railway.app/diagnostics/room-memory/THREAD_ID \
      -H "Authorization: Bearer YOUR_TOKEN"
- The returned "block" still shows the COLLECTIVE memory.
- NEW: in Supabase, `select * from z.room_memory where persona_key is not null` shows each
  persona's own read (key='room_read') — e.g. the comic: "needles Dev about dodging with cricket".
- The real proof is chatting: a persona now treats members coloured by ITS read, and a
  returning persona weaves in a callback / a line of its own news naturally.

## Notes
- v1 rows (persona_key null) are untouched and still work; v2 adds the per-persona layer on top.
- Same conservative harvest (best-effort, no ages, needs >4 messages).
