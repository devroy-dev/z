// ════════════════════════════════════════════════════════════════════════
//  yourZ — the usage meter. Every model call logs what it cost, per user,
//  per surface. Fire-and-forget: metering must never slow or break a reply.
//  This table is the foundation of unit economics + tier caps (#51).
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './db.js';
import { calcCostInr, usageFromApi, type Usage } from './models.js';

// ── the diagnostic cost ring (founder-only). usage_log stays the source of
// truth; this bounded in-memory ring lets an endpoint sum the cost of a single
// run (a whole duel, a session) by snapshotting before and diffing after.
export type CostEntry = {
  ts: number; userId: string; personaKey: string | null; surface: string;
  fn: string | null; model: string; usage: Usage; inr: number;
};
const RING_MAX = 1000;
export const recentUsage: CostEntry[] = [];
export function costSnapshot(): number { return recentUsage.length; }
export function costSince(startLen: number): {
  total_inr: number; calls: number; byFn: Record<string, { inr: number; calls: number }>;
} {
  const slice = recentUsage.slice(Math.max(0, startLen));
  const byFn: Record<string, { inr: number; calls: number }> = {};
  let total = 0;
  for (const e of slice) {
    total += e.inr;
    const k = e.fn || e.surface || 'other';
    (byFn[k] ||= { inr: 0, calls: 0 });
    byFn[k].inr = Math.round((byFn[k].inr + e.inr) * 10000) / 10000;
    byFn[k].calls += 1;
  }
  return { total_inr: Math.round(total * 10000) / 10000, calls: slice.length, byFn };
}

// the founder gate: cost is echoed to the client ONLY for Dev's id, so cost
// data is never even sent to other accounts. The in-app whisper reads this.
export const DIAG_USER_ID = 'd91a137e-46d4-4d85-91e4-6092007e8501';
export function diagEcho(userId: string, args: { usage: Usage | any; model: string; fn: string }):
  { cost_inr: number; fn: string; usage: Usage } | undefined {
  if (userId !== DIAG_USER_ID) return undefined;
  const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);
  const { inr } = calcCostInr(args.model, u);
  return { cost_inr: Math.round(inr * 10000) / 10000, fn: args.fn, usage: u };
}

export function logUsage(args: {
  userId: string; threadId?: string | null; personaKey?: string | null;
  surface: 'chat' | 'group' | 'banter' | 'director' | 'seatbelt' | 'other';
  fn?: string | null;
  model: string; usage: Usage | any;
}): { inr: number } {
  try {
    const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);
    const { inr } = calcCostInr(args.model, u);
    // the diagnostic ring (bounded; fn is ring-only for now — no DB column yet)
    recentUsage.push({
      ts: Date.now(), userId: args.userId, personaKey: args.personaKey ?? null,
      surface: args.surface, fn: args.fn ?? null, model: args.model, usage: u, inr,
    });
    if (recentUsage.length > RING_MAX) recentUsage.splice(0, recentUsage.length - RING_MAX);
    void supabase.from('usage_log').insert({
      user_id: args.userId, thread_id: args.threadId ?? null, persona_key: args.personaKey ?? null,
      surface: args.surface, fn: args.fn ?? null, model: args.model,
      tok_in: u.in, tok_out: u.out, tok_cache_read: u.cacheRead, tok_cache_write: u.cacheWrite,
      cost_inr: inr,
    }).then(() => {});
    return { inr };
  } catch (_) { return { inr: 0 }; }  /* the meter never breaks the machine */
}
