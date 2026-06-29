-- 0008_pin.sql — server-side 4-digit PIN for fast re-login (OTP only first time + recovery).
-- The PIN is stored HASHED (never plaintext). Verified server-side against the account.
alter table z.users add column if not exists pin_hash text;
alter table z.users add column if not exists pin_set_at timestamptz;
