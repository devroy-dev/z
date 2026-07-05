-- 0036: fine-grained function tag on the usage meter. Lets the cost dashboard
-- break usage down by ACTUAL function (chat / banter / group / gm_turn /
-- bf_verdict / …) instead of the coarse `surface`. Nullable; back-rows stay null.
alter table z.usage_log add column if not exists fn text;
create index if not exists usage_log_fn_day on z.usage_log (fn, created_at desc);
