// ════════════════════════════════════════════════════════════════════════
//  yourZ — LIAR'S DICE AI. Honest probability core (my dice are known,
//  the rest are uniform), style-shaped nerve. Never an illegal bid.
// ════════════════════════════════════════════════════════════════════════
import { legalBids, totalDice, nextAlive } from './engine.js';

const STYLE = {
  calculator: { nerve: 0.28, push: 0.3, liarBar: 0.42 },
  gambler:    { nerve: 0.6,  push: 0.7, liarBar: 0.3  },
  guardian:   { nerve: 0.2,  push: 0.25, liarBar: 0.5 },
  chaos:      { nerve: 0.75, push: 0.8, liarBar: 0.25 },
  smooth:     { nerve: 0.45, push: 0.5, liarBar: 0.38 },
  steady:     { nerve: 0.35, push: 0.4, liarBar: 0.4  },
};

// P(at least q dice showing face) given my cup + unknown others ~ Binomial(u, 1/6)
export function chance(g, seat, qty, face) {
  const mine = g.cups[seat].filter((d) => d === face).length;
  const need = qty - mine;
  if (need <= 0) return 1;
  const u = totalDice(g) - g.cups[seat].length;
  if (need > u) return 0;
  // P(X >= need), X ~ Bin(u, 1/6)
  let p = 0;
  const pr = 1 / 6, q1 = 5 / 6;
  let comb = 1;
  for (let k = 0; k <= u; k++) {
    if (k > 0) comb = comb * (u - k + 1) / k;
    if (k >= need) p += comb * Math.pow(pr, k) * Math.pow(q1, u - k);
  }
  return Math.min(1, p);
}

export function decide(g, seat, styleKey = 'steady', rnd = Math.random) {
  const st = STYLE[styleKey] || STYLE.steady;
  // consider calling liar
  if (g.bid) {
    const pTrue = chance(g, seat, g.bid.qty, g.bid.face);
    if (pTrue < st.liarBar * (0.8 + rnd() * 0.4)) return { type: 'liar' };
  }
  // pick a bid: prefer high-probability climbs, sometimes push a bluff
  const options = legalBids(g).slice(0, 200);
  if (!options.length) return { type: 'liar' };
  const scored = options.map((b) => ({ b, p: chance(g, seat, b.qty, b.face) }));
  const safe = scored.filter((s) => s.p > 0.55);
  const spicy = scored.filter((s) => s.p > 0.25 && s.p <= 0.55);
  const bluffing = rnd() < st.push * 0.4;
  let pick;
  if (safe.length && !bluffing) pick = safe[Math.floor(rnd() * Math.min(3, safe.length))];
  else if (spicy.length && rnd() < st.nerve + 0.3) pick = spicy[Math.floor(rnd() * Math.min(4, spicy.length))];
  else if (safe.length) pick = safe[0];
  else if (g.bid) return { type: 'liar' };
  else pick = scored.sort((a, b2) => b2.p - a.p)[0];
  return { type: 'bid', qty: pick.b.qty, face: pick.b.face };
}
