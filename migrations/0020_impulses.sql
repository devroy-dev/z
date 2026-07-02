-- 0020: the house's impulses — buzzes and drop-ins join the ping log.
-- status: 'sent' (delivered), 'offered' (drop-in at the door), 'accepted', 'ignored'.
alter table z.ping_log add column if not exists status text not null default 'sent';
