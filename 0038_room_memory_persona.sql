-- ════════════════════════════════════════════════════════════════════════
--  0038_room_memory_persona — GROUP MEMORY v2 (per-persona layer).
--  Adds persona_key to z.room_memory: NULL = the room's COLLECTIVE memory
--  (everyone shares it, v1 behavior); SET = that persona's OWN read of the
--  room (its relationships/dynamic), layered on top of the collective.
-- ════════════════════════════════════════════════════════════════════════
alter table z.room_memory add column if not exists persona_key text;
create index if not exists room_memory_thread_persona_idx on z.room_memory(thread_id, persona_key);
