// ════════════════════════════════════════════════════════════════════════
//  Z — publicIdentity · THE IDENTITY WALL FOR THE FLOOR (ROOMS_SPEC v1 §7.1)
//  Real identity (display name, DP, phone) never renders in a public room.
//  Strangers meet HANDLES: one alias per member per room, chosen at the
//  doorway, doorman-checked, unique per room, IMMUTABLE after the member's
//  first message (accountability); rejoin restores the same handle.
//  Every server surface that would serve a name into a public thread resolves
//  it HERE — members, history roster, live broadcast, the DIRECTOR's
//  transcript. One law, one module. (R1 of ROOMS_SPEC_V2.)
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './db.js';
import { deterministicCheck } from './doorman.js';

// is this thread the floor? (public_rooms row keyed by thread — indexed in 0061)
export async function publicRoomOf(threadId: string):
  Promise<{ id: string; thread_id: string } | null> {
  if (!threadId) return null;
  const { data } = await supabase.from('public_rooms')
    .select('id, thread_id').eq('thread_id', threadId).maybeSingle();
  return (data as any) || null;
}

// handle map for a public thread: uid -> handle. Members who joined before
// 0063 landed have no row yet — they read as 'someone' until they next pass
// the doorway (which is mandatory on every entry and claims one).
export async function handlesFor(threadId: string, uids?: string[]):
  Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let q = supabase.from('room_handles').select('user_id, handle').eq('thread_id', threadId);
  if (uids && uids.length) q = q.in('user_id', uids);
  const { data } = await q;
  for (const r of (data ?? []) as any[]) out[r.user_id] = r.handle;
  return out;
}

export async function myHandle(threadId: string, userId: string): Promise<string | null> {
  const { data } = await supabase.from('room_handles')
    .select('handle').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
  return (data as any)?.handle || null;
}

// the handle shape: what the client's adjective-animal generator emits, plus
// room for a hand-edited one. lowercase letters/digits, hyphen-joined.
const HANDLE_SHAPE = /^[a-z0-9]+(-[a-z0-9]+){0,2}$/;

export type HandleResult =
  | { ok: true; handle: string }
  | { ok: false; code: 'handle_invalid' | 'handle_taken' | 'handle_locked'; error: string };

// claim (or change, pre-first-message) a handle in a public room.
export async function claimHandle(threadId: string, userId: string, raw: string): Promise<HandleResult> {
  const handle = String(raw || '').trim().toLowerCase();
  if (handle.length < 3 || handle.length > 24 || !HANDLE_SHAPE.test(handle)) {
    return { ok: false, code: 'handle_invalid', error: 'handles are 3–24 characters: lowercase letters, digits, hyphens.' };
  }
  // Layer 1 on the alias itself — same wall the room name passes (v1 §6.1.4)
  if (deterministicCheck(handle.replace(/-/g, ' ')).action === 'block') {
    return { ok: false, code: 'handle_invalid', error: "that handle won't fly — pick something civil." };
  }
  const existing = await myHandle(threadId, userId);
  if (existing && existing !== handle) {
    // immutable after first message (accountability)
    const { data: spoke } = await supabase.from('messages')
      .select('id').eq('thread_id', threadId).eq('sender_user_id', userId).limit(1);
    if (spoke && spoke.length) {
      return { ok: false, code: 'handle_locked', error: 'your handle is set for this room — it locked with your first message.' };
    }
  }
  if (existing === handle) return { ok: true, handle };
  // unique per room, case-insensitive (the 0063 index is the real guard —
  // this pre-check just makes the error friendly; the insert still races safe).
  const { data: clash } = await supabase.from('room_handles')
    .select('user_id').eq('thread_id', threadId).ilike('handle', handle).maybeSingle();
  if (clash && (clash as any).user_id !== userId) {
    return { ok: false, code: 'handle_taken', error: 'someone in this room already has that handle.' };
  }
  const { error } = await supabase.from('room_handles')
    .upsert({ thread_id: threadId, user_id: userId, handle }, { onConflict: 'thread_id,user_id' });
  if (error) {
    // unique-index race: two strangers, same handle, same instant
    if (/room_handles_uniq|duplicate/i.test(error.message || '')) {
      return { ok: false, code: 'handle_taken', error: 'someone in this room already has that handle.' };
    }
    return { ok: false, code: 'handle_invalid', error: 'handle save: ' + error.message };
  }
  return { ok: true, handle };
}

// the 18+ line from dob — null when dob is absent (its own error, dob_required)
export function isAdult(dob: string | null | undefined): boolean | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d <= cutoff;
}
