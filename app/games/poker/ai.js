// ════════════════════════════════════════════════════════════════════════
//  yourZ — POKER AI. Heuristic equity, casual-credible by design (we say
//  so honestly): preflop hand classes + postflop made-hand/draw strength
//  → an action policy shaped by the persona's table style. It NEVER
//  free-forms: every choice comes from legalActions().
// ════════════════════════════════════════════════════════════════════════
import { score7 } from './eval.js';
import { legalActions, BB } from './engine.js';

// preflop strength 0..1 (heads-up ranges are wide)
export function preflopStrength(hole) {
  const [a, b] = hole;
  const hi = Math.max(a.r, b.r), lo = Math.min(a.r, b.r);
  const pair = a.r === b.r, suited = a.s === b.s, gap = hi - lo;
  let v = (hi + lo) / 28 * 0.55;
  if (pair) v = 0.5 + (a.r / 14) * 0.5;
  else {
    if (suited) v += 0.08;
    if (gap === 1) v += 0.06; else if (gap === 2) v += 0.03; else if (gap > 4) v -= 0.07;
    if (hi === 14) v += 0.1;
  }
  return Math.max(0.05, Math.min(0.98, v));
}

// postflop strength 0..1: made-hand category + draw bonus
export function postflopStrength(hole, board) {
  const sc = score7([...hole, ...board]);
  let v = [0.18, 0.34, 0.52, 0.62, 0.72, 0.78, 0.88, 0.95, 0.99][sc[0]];
  if (sc[0] <= 1 && board.length < 5) {
    const cards = [...hole, ...board];
    const suits = {}; cards.forEach((c) => { suits[c.s] = (suits[c.s] || 0) + 1; });
    if (Object.values(suits).some((n) => n === 4)) v += 0.16;          // flush draw
    const rs = new Set(cards.map((c) => c.r)); if (rs.has(14)) rs.add(1);
    let run = 0; for (let r = 1; r <= 14; r++) { run = rs.has(r) ? run + 1 : 0; if (run >= 4) { v += 0.1; break; } }
  }
  // top-heavy boards devalue weak pairs slightly
  return Math.max(0.05, Math.min(0.99, v));
}

const STYLE = {
  calculator: { aggro: 0.45, loose: 0.35, bluff: 0.06 },
  gambler:    { aggro: 0.75, loose: 0.75, bluff: 0.2  },
  guardian:   { aggro: 0.3,  loose: 0.3,  bluff: 0.03 },
  chaos:      { aggro: 0.6,  loose: 0.85, bluff: 0.3  },
  smooth:     { aggro: 0.55, loose: 0.5,  bluff: 0.16 },
  steady:     { aggro: 0.45, loose: 0.45, bluff: 0.08 },
};

export function chooseAction(g, seat, styleKey = 'steady', rnd = Math.random) {
  const acts = legalActions(g);
  if (!acts.length) return null;
  const st = STYLE[styleKey] || STYLE.steady;
  const strength = g.street === 'preflop'
    ? preflopStrength(g.hole[seat])
    : postflopStrength(g.hole[seat], g.board);
  const owe = g.committed[1 - seat] - g.committed[seat];
  const potOdds = owe > 0 ? owe / (g.pot + owe) : 0;
  const bluffing = rnd() < st.bluff;
  const eff = bluffing ? Math.max(strength, 0.72) : strength;

  const canRaise = acts.find((a) => a.type === 'bet' || a.type === 'raise');
  const canCall = acts.find((a) => a.type === 'call');
  const canCheck = acts.find((a) => a.type === 'check');

  // strong (or bluffing) → aggression
  if (canRaise && eff > 0.62 && rnd() < st.aggro) {
    const potish = g.pot + owe;
    const sizing = eff > 0.85 ? potish : Math.max(Math.floor(potish * 0.6), BB * 2);
    const to = Math.min(canRaise.maxTo, Math.max(canRaise.minTo, g.committed[seat] + owe + sizing));
    return { type: canRaise.type, to };
  }
  if (canCheck) {
    if (canRaise && eff > 0.5 && rnd() < st.aggro * 0.6) {
      const to = Math.min(canRaise.maxTo, Math.max(canRaise.minTo, g.committed[seat] + Math.max(Math.floor(g.pot * 0.5), BB * 2)));
      return { type: canRaise.type, to };
    }
    return { type: 'check' };
  }
  // facing a bet: call on price + strength (looseness widens)
  if (canCall) {
    const callBar = potOdds * (1.35 - st.loose * 0.6);
    if (eff >= Math.max(callBar, 0.22 - st.loose * 0.1)) return { type: 'call', amount: canCall.amount };
  }
  return { type: 'fold' };
}
