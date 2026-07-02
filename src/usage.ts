// ════════════════════════════════════════════════════════════════════════
//  yourZ — the usage meter. Every model call logs what it cost, per user,
//  per surface. Fire-and-forget: metering must never slow or break a reply.
//  This table is the foundation of unit economics + tier caps (#51).
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './db.js';
import { calcCostInr, usageFromApi, type Usage } from './models.js';

export function logUsage(args: {
  userId: string; threadId?: string | null; personaKey?: string | null;
  surface: 'chat' | 'group' | 'banter' | 'director' | 'seatbelt' | 'other';
  model: string; usage: Usage | any;
}) {
  try {
    const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);
    const { inr } = calcCostInr(args.model, u);
    void supabase.from('usage_log').insert({
      user_id: args.userId, thread_id: args.threadId ?? null, persona_key: args.personaKey ?? null,
      surface: args.surface, model: args.model,
      tok_in: u.in, tok_out: u.out, tok_cache_read: u.cacheRead, tok_cache_write: u.cacheWrite,
      cost_inr: inr,
    }).then(() => {});
  } catch (_) { /* the meter never breaks the machine */ }
}
