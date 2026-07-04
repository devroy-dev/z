-- 0035_user_avatar.sql — the user's own profile photo.
-- The engine's POST /me and GET /me reference users.avatar_url (a data-URI, same
-- pattern as thread avatars), but the column was never added to z.users — only
-- z.threads has one. That mismatch made every profile save fail ("Could not find
-- the 'avatar_url' column of 'users'") AND made GET /me throw, so the name fell
-- back to "you". This adds the missing column.

alter table z.users add column if not exists avatar_url text;
