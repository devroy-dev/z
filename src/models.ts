// ════════════════════════════════════════════════════════════════════════
//  yourZ — the model registry + cost meter (ported from Dream Engine's
//  models.ts / calcCostInr, trimmed to what callmeZ needs today).
//  Doctrine: the model tier IS the product tier — entry rides Haiku,
//  top rides Sonnet. Nothing here decides tiers yet; this is the plumbing
//  that makes tier decisions (and unit economics) possible.
//  Cache pricing: write = 1.25× input rate · read = 0.10× input rate.
// ════════════════════════════════════════════════════════════════════════

export type Tier = 'entry' | 'top';

export const MODELS: Record<string, { tier: Tier; usdInPerM: number; usdOutPerM: number }> = {
  'claude-haiku-4-5-20251001': { tier: 'entry', usdInPerM: 1, usdOutPerM: 5 },
  'claude-haiku-4-5':          { tier: 'entry', usdInPerM: 1, usdOutPerM: 5 },
  'claude-sonnet-4-6':         { tier: 'top',   usdInPerM: 3, usdOutPerM: 15 },
};

export const USD_TO_INR = 100;   // the working conversion (Dream Engine convention)

export const modelForTier = (tier: Tier): string =>
  tier === 'top' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';

export type Usage = { in: number; out: number; cacheRead: number; cacheWrite: number };

export function calcCostInr(model: string, u: Usage): { usd: number; inr: number } {
  const m = MODELS[model] ?? MODELS['claude-haiku-4-5-20251001'];
  const usd =
    (u.in * m.usdInPerM +
      u.out * m.usdOutPerM +
      u.cacheWrite * m.usdInPerM * 1.25 +
      u.cacheRead * m.usdInPerM * 0.1) / 1_000_000;
  return { usd, inr: usd * USD_TO_INR };
}

export function usageFromApi(u: any): Usage {
  return {
    in: u?.input_tokens ?? 0,
    out: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}
