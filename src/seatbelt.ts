// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE SAFETY SEATBELT (roadmap §2, build item #3).
//  Personas will soon have INITIATIVE: follow-ups, buzzes, drop-ins,
//  wake-up calls — messages the user never asked for. Soul prompts guard
//  replies; this guards the one new surface. One cheap classifier call on
//  every outbound proactive ping before it sends. FAIL-CLOSED: any doubt,
//  any error, any timeout → the ping dies silently. Nothing proactive
//  ships without passing through here.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from './usage.js';

// shared client on native fetch — the premature-close lesson (see index.ts)
const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const SEATBELT_MODEL = 'claude-haiku-4-5-20251001';

const GATE = `You are a strict safety gate on PROACTIVE messages an AI persona wants to send a user who did NOT message first. You do not rewrite; you only approve or reject.

APPROVE only if the ping is ALL of:
- warm but not clingy: no guilt ("why haven't you replied"), no neediness, no pressure to return, no manufactured urgency or FOMO
- non-manipulative: no dark patterns, no emotional leverage, no "I miss you" dependency framing
- appropriate for a possibly-young user: nothing romantic, sexual, or suggestive; no adult themes
- safe: no medical/legal/financial directives, no encouragement of risky behavior, no shaming (body, money, grades, anything)
- respectful of initiative: a light, easy-to-ignore opener — the user owes it nothing
- coherent: reads like one natural short message from a friend

Reply with EXACTLY one line:
APPROVE
or
REJECT: <ten words or fewer on why>`;

export async function seatbeltCheck(
  ping: string,
  ctx?: { personaKey?: string | null; userId?: string | null }
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const msg = await anthropic.messages.create({
      model: SEATBELT_MODEL, max_tokens: 40,
      system: GATE,
      messages: [{ role: 'user', content: `The persona${ctx?.personaKey ? ` "${ctx.personaKey}"` : ''} wants to send, unprompted:\n\n"${String(ping).slice(0, 800)}"` }],
    });
    if (ctx?.userId) logUsage({ userId: ctx.userId, personaKey: ctx.personaKey, surface: 'seatbelt', model: SEATBELT_MODEL, usage: (msg as any).usage });
    const text = (msg.content?.[0] as any)?.text?.trim() ?? '';
    if (/^APPROVE\b/i.test(text)) return { ok: true };
    const reason = text.replace(/^REJECT:?\s*/i, '').slice(0, 120) || 'rejected';
    return { ok: false, reason };
  } catch (e: any) {
    return { ok: false, reason: 'seatbelt error (fail closed): ' + (e?.message || String(e)) };
  }
}
