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
    .select('id, auth_user_id, display_name, region, locale, timezone, pin_hash, pin_set_at')
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
    .select('id, auth_user_id, display_name, region, locale, timezone, pin_hash, pin_set_at')
    .single();
  if (error) throw new Error('user create failed: ' + error.message);

  // seed the access row — best-effort, never fatal to user creation
  try { await supabase.from('access').insert({ user_id: created.id }); } catch { /* non-fatal */ }
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
