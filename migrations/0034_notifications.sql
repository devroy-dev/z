-- 0034_notifications.sql — the notify layer's storage.
--   • push_token  — the device's Expo push token (so the engine can reach it)
--   • notif_prefs — per-user on/off switches for each kind of proactive nudge.
-- Delivery (actually sending) rides the scheduled_pings clock + the §2 seatbelt;
-- this migration only stores the address + the consent.

alter table z.users add column if not exists push_token  text;
alter table z.users add column if not exists notif_prefs jsonb not null default '{}'::jsonb;

-- default shape (documented, not enforced): {
--   "friend_requests": true,   -- someone added you
--   "follow_ups":      true,   -- a persona follows up ("did you take the interview?")
--   "buzzes":          true,   -- a persona buzzes you
--   "room_invites":    true,   -- invited to a room
--   "all":             true    -- master switch
-- }
