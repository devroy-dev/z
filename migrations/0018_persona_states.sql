-- 0018: daily persona states — the pursuit diary. House-wide, one row per
-- persona per day: a nostalgic status line + the private log that keeps
-- the serial honest. No user_id: this is the HOUSE's life, shared by all.
create table if not exists z.persona_states (
  persona_key text not null,
  date date not null,
  status_line text not null,
  log_entry text not null,
  created_at timestamptz not null default now(),
  primary key (persona_key, date)
);
alter table z.persona_states enable row level security;
