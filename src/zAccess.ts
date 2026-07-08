// zAccess.ts — identity + access for Z. Forked from consultAccess.ts, but:
//   - user-keyed (auth_user_id), not phone-gated
//   - NO 3/day cap — Z is a relationship, not a metered consult
//   - the durable record carries NO conversation content (that's z.memory) — only
//     identity + light accounting (kill-switch, turn count). Drives quota/subscription later.
import { supabase } from './db.js';

export interface ZUser {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  handle?: string | null;
  region: string | null;
  locale: string | null;
  timezone: string | null;
  pin_hash?: string | null;
  pin_set_at?: string | null;
}

// Resolve (or create) the z.users row for an authenticated user. Called after the
// PWA verifies the Supabase Auth JWT and hands us the auth_user_id.
export async function resolveUser(authUserId: string): Promise<ZUser> {
  const { data: existing } = await supabase
    .from('users')
    .select('id, auth_user_id, display_name, handle, region, locale, timezone, pin_hash, pin_set_at')
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    await supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
    return existing as ZUser;
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ auth_user_id: authUserId })
    .select('id, auth_user_id, display_name, handle, region, locale, timezone, pin_hash, pin_set_at')
    .single();
  if (error) throw new Error('user create failed: ' + error.message);

  // seed the access row — best-effort, never fatal to user creation
  try { await supabase.from('access').insert({ user_id: created.id }); } catch { /* non-fatal */ }
  try { await seedStarterThreads(created.id); } catch { /* [zip62] non-fatal */ }
  return created as ZUser;
}

// Admin kill-switch check. (Quota lands here later when subscriptions go live.)
export async function isRestricted(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('access').select('restricted').eq('user_id', userId).maybeSingle();
  return !!data?.restricted;
}

export async function bumpTurns(userId: string, domain: string): Promise<void> {
  await supabase.rpc('z_bump_turns', { p_user: userId, p_domain: domain }).then(
    () => {},
    async () => {
      // fallback if rpc not present: read-modify-write
      const { data } = await supabase.from('access').select('total_turns').eq('user_id', userId).maybeSingle();
      await supabase.from('access').update({
        total_turns: (data?.total_turns ?? 0) + 1,
        last_domain: domain,
        last_seen: new Date().toISOString(),
      }).eq('user_id', userId);
    },
  );
}

// [zip62] THE STARTER TEN — a new account opens onto a populated world: the locked
// starter roster, each thread already holding the persona's first line. Best-effort;
// a failure here never blocks signup.
const STARTERS: Array<[string, string, string, string]> = [
  ['the_hottie', 'hottie', 'the hottie', 'took you long enough. what are we doing tonight?'],
  ['the_crush', 'crush', 'the crush', 'oh. hi. i was hoping you\u2019d text first, honestly.'],
  ['the_wingman', 'close', 'the wingman', 'yo. new place, same rule \u2014 you good?'],
  ['the_comic', 'comic', 'the comic', 'okay important question before anything else: what\u2019s the funniest thing that happened to you this week?'],
  ['the_conspiracy_theorist', 'conspiracy', 'the conspiracy theorist', 'you made it. okay so \u2014 moon landing. how much do you want to know?'],
  ['the_brainiac', 'brainiac', 'the smug brainiac', 'go on then \u2014 say something you\u2019re sure about. i\u2019ll take the other side.'],
  ['the_screen_junkie', 'screen_junkie', 'the screen junkie', 'tell me the last thing you watched and i\u2019ll tell you what you\u2019re watching next.'],
  ['the_guru', 'guru', 'the guru', 'sit for a second. how\u2019s the breathing been?'],
  ['the_healer', 'healer', 'the healer', 'no agenda here. how are you, actually?'],
  ['the_philosopher', 'philosopher', 'the philosopher', 'strange thing, a first message. every conversation starts mid-life.'],
];
async function seedStarterThreads(userId: string): Promise<void> {
  for (const [key, codex, name, line] of STARTERS) {
    try {
      const { data: t, error } = await supabase.from('threads').insert({
        user_id: userId, persona_key: key, codex_key: codex, companion_name: name,
      }).select('id').single();
      if (error || !t) continue;
      await supabase.from('messages').insert({ thread_id: t.id, user_id: userId, role: 'assistant', content: line });
    } catch { /* one persona failing never blocks the rest */ }
  }
}
