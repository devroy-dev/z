-- 0005_group.sql
-- Group chat: several personas in one thread. Adds group flag + member list to threads,
-- and a persona_key tag to messages so each assistant line knows who spoke.

-- threads: mark groups + hold the member persona keys
alter table z.threads add column if not exists is_group boolean not null default false;
alter table z.threads add column if not exists member_keys text[];

-- a group thread doesn't need a single persona_key/codex_key — make them nullable.
alter table z.threads alter column persona_key drop not null;
alter table z.threads alter column codex_key drop not null;

-- messages: tag which persona said an assistant line (null for user lines and 1:1 threads)
alter table z.messages add column if not exists persona_key text;
