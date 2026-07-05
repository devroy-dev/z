-- ════════════════════════════════════════════════════════════════════════
--  0040_coach_rag — COACH: bring-your-own-material (RAG). Layer 3.
--  Ported from the dreamai engine (reference/blueprint only; runtime never
--  touches dreamai), native to schema z. The chain: upload → distill into a
--  §-numbered, page-anchored BRIEF (with declared gaps) → per-§ index with
--  FTS + Voyage embedding → fused retrieval. Briefs are IMMUTABLE (re-distill
--  inserts a new brief, marks the old superseded). Citation chain: §→page→original.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists vector;

-- (1) the cupboard record: one row per uploaded original (bytes live in Storage)
create table if not exists z.coach_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references z.users(id) on delete cascade,
  course_id    uuid references z.coach_courses(id) on delete cascade,
  storage_ref  text not null,                       -- bucket path of the original
  filename     text not null,
  content_type text,
  uploaded_at  timestamptz not null default now()
);
create index if not exists coach_documents_user_idx on z.coach_documents(user_id);

-- (2) the shelf: one Brief per distilled document (the clerk's §-and-page index)
create table if not exists z.coach_briefs (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references z.coach_documents(id) on delete cascade,
  user_id       uuid not null references z.users(id) on delete cascade,
  course_id     uuid references z.coach_courses(id) on delete cascade,
  title         text not null,
  sections      jsonb not null default '[]'::jsonb, -- [{ "ref":"§3.2", "page":7, "text":"..." }]
  pages         int,
  declared_gaps text,
  distilled_by  text not null,
  superseded_by uuid references z.coach_briefs(id),
  created_at    timestamptz not null default now()
);
create index if not exists coach_briefs_user_idx   on z.coach_briefs(user_id);
create index if not exists coach_briefs_course_idx on z.coach_briefs(course_id);

-- (3) the per-§ search index (FTS live now; embedding filled by the embed door)
create table if not exists z.coach_brief_sections (
  id         uuid primary key default gen_random_uuid(),
  brief_id   uuid not null references z.coach_briefs(id) on delete cascade,
  user_id    uuid not null references z.users(id) on delete cascade,
  ref        text not null default '',
  page       int,
  body       text not null default '',
  tsv        tsvector generated always as (to_tsvector('english', coalesce(body, ''))) stored,
  embedding  vector(1024),
  created_at timestamptz not null default now()
);
create index if not exists coach_bs_tsv   on z.coach_brief_sections using gin (tsv);
create index if not exists coach_bs_user  on z.coach_brief_sections (user_id);
create index if not exists coach_bs_brief on z.coach_brief_sections (brief_id);
create index if not exists coach_bs_embed on z.coach_brief_sections using hnsw (embedding vector_cosine_ops);

-- (4) sync trigger: brief_sections is always a faithful projection of live briefs
create or replace function z.coach_brief_sections_sync() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    if (new.superseded_by is null) then
      insert into z.coach_brief_sections (brief_id, user_id, ref, page, body)
      select new.id, new.user_id, coalesce(elem->>'ref',''), nullif(elem->>'page','')::int, coalesce(elem->>'text','')
      from jsonb_array_elements(coalesce(new.sections,'[]'::jsonb)) elem
      where coalesce(elem->>'text','') <> '';
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if (new.superseded_by is not null and old.superseded_by is null) then
      delete from z.coach_brief_sections where brief_id = new.id;
    elsif (new.sections is distinct from old.sections and new.superseded_by is null) then
      delete from z.coach_brief_sections where brief_id = new.id;
      insert into z.coach_brief_sections (brief_id, user_id, ref, page, body)
      select new.id, new.user_id, coalesce(elem->>'ref',''), nullif(elem->>'page','')::int, coalesce(elem->>'text','')
      from jsonb_array_elements(coalesce(new.sections,'[]'::jsonb)) elem
      where coalesce(elem->>'text','') <> '';
    end if;
    return new;
  end if;
  return null;
end; $$;
drop trigger if exists trg_coach_bs_ins on z.coach_briefs;
create trigger trg_coach_bs_ins after insert on z.coach_briefs
  for each row execute function z.coach_brief_sections_sync();
drop trigger if exists trg_coach_bs_upd on z.coach_briefs;
create trigger trg_coach_bs_upd after update of superseded_by, sections on z.coach_briefs
  for each row execute function z.coach_brief_sections_sync();

-- (5) fused retrieval: lexical (FTS) ⊕ semantic (vector) via Reciprocal Rank Fusion.
--     NULL-SAFE: no query embedding (or none stored yet) → pure FTS, no regression.
drop function if exists z.coach_search_sections(uuid, text, int, text);
create or replace function z.coach_search_sections(
  p_user_id uuid, p_query text, p_limit int default 12, p_query_embedding text default null
) returns table(brief_id uuid, title text, ref text, page int, body text, rank real)
language sql stable as $$
  with qvec as (
    select case when p_query_embedding is null or p_query_embedding = ''
                then null else p_query_embedding::vector(1024) end as v
  ),
  fts as (
    select bs.id, row_number() over (order by ts_rank(bs.tsv, websearch_to_tsquery('english', p_query)) desc) as r
    from z.coach_brief_sections bs join z.coach_briefs b on b.id = bs.brief_id
    where bs.user_id = p_user_id and b.superseded_by is null
      and bs.tsv @@ websearch_to_tsquery('english', p_query)
    limit 50
  ),
  vec as (
    select bs.id, row_number() over (order by bs.embedding <=> q.v) as r
    from z.coach_brief_sections bs join z.coach_briefs b on b.id = bs.brief_id cross join qvec q
    where bs.user_id = p_user_id and b.superseded_by is null and q.v is not null and bs.embedding is not null
    order by bs.embedding <=> q.v limit 50
  ),
  fused as (
    select id, sum(score) as score from (
      select id, 1.0/(60+r) as score from fts
      union all select id, 1.0/(60+r) as score from vec
    ) u group by id
  )
  select bs.brief_id, b.title, bs.ref, bs.page, bs.body, f.score::real as rank
  from fused f join z.coach_brief_sections bs on bs.id = f.id join z.coach_briefs b on b.id = bs.brief_id
  order by f.score desc, b.title asc, bs.ref asc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;
grant execute on function z.coach_search_sections(uuid, text, int, text) to service_role;
