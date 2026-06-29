-- 0009_serious.sql — global "serious mode" toggle per user.
-- When on, the supportive counselor-grade personas behave with extra care + guardrails,
-- and the frontend shows only those personas.
alter table z.users add column if not exists serious_mode boolean not null default false;
