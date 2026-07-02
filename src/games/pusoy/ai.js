// ════════════════════════════════════════════════════════════════════════
//  yourZ — PUSOY DOS AI. Plays from legalPlays only. Judgment: shed low,
//  save 2s and bombs, pressure short stacks; style shapes the nerve.
// ════════════════════════════════════════════════════════════════════════
import { legalPlays, cardVal } from './engine.js';

const STYLE = {
  calculator: { hold: 0.8, aggro: 0.4 },
  gambler:    { hold: 0.4, aggro: 0.75 },
  guardian:   { hold: 0.9, aggro: 0.3 },
  chaos:      { hold: 0.3, aggro: 0.7 },
  smooth:     { hold: 0.65, aggro: 0.55 },
  steady:     { hold: 0.7, aggro: 0.5 },
};
const comboCost = (p) => p.cards.reduce((a, c) => a + cardVal(c), 0) / p.cards.length + (p.cards.length === 5 ? -6 : 0);

export function choose(g, seat, styleKey = 'steady', rnd = Math.random) {
  const st = STYLE[styleKey] || STYLE.steady;
  const options = legalPlays(g, seat);
  if (!options.length) return { type: 'pass' };
  const someoneShort = g.counts.some((c, i) => i !== seat && c <= 3);
  // holding back: don't burn 2s/bombs early unless pressured or closing
  const my = g.hands[seat].length;
  const filtered = options.filter((p) => {
    const has2 = p.cards.some((c) => c.r === 12);
    const bomb = p.combo.size === 5 && p.combo.cat >= 3;
    if ((has2 || bomb) && !someoneShort && my > 6 && rnd() < st.hold) return false;
    return true;
  });
  const pool = filtered.length ? filtered : options;
  // if we can dump our whole hand, do it
  const finisher = pool.find((p) => p.cards.length === my);
  if (finisher) return { type: 'play', cards: finisher.cards };
  // leading: shed the cheapest; following: cheapest that beats, more willing when pressured
  const sorted = pool.slice().sort((a, b) => comboCost(a) - comboCost(b));
  if (!g.table) return { type: 'play', cards: sorted[0].cards };
  const willing = someoneShort ? 0.95 : st.aggro + (my <= 5 ? 0.3 : 0);
  if (rnd() < willing) return { type: 'play', cards: sorted[0].cards };
  return { type: 'pass' };
}
