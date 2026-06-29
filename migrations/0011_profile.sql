-- 0011_profile.sql — richer onboarding: date of birth + sex, for Z's first-read of the person.
-- Stored on the user. dob lets Z reason about age; sex genders the hottie/crush/wingman/loyal-friend.
-- Both nullable (user may pick "rather not say").

alter table z.users add column if not exists dob date;
alter table z.users add column if not exists sex text;   -- 'female' | 'male' | 'na' | null
