// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO ai. Personality as parameters (replaces coin-flip play):
//  color control, action hoarding vs venting, wild timing, spite (targeting
//  whoever's about to win), and wild-color choice from actual hand depth.
// ════════════════════════════════════════════════════════════════════════
import { legalIdxs, COLORS } from './rules.js';
import { resolveStyle } from '../personas.js';

export const STYLES = {
  the_brainiac: { hoardWild: 0.9, spite: 0.9, colorControl: 0.9, aggro: 0.5, noise: 0.05 },
  the_wannabe:  { hoardWild: 0.2, spite: 0.5, colorControl: 0.3, aggro: 0.95, noise: 0.2 },   // fires actions on sight
  the_cynic:    { hoardWild: 0.8, spite: 0.7, colorControl: 0.7, aggro: 0.3, noise: 0.05 },
  the_comic:    { hoardWild: 0.3, spite: 0.3, colorControl: 0.2, aggro: 0.6, noise: 0.6 },
  the_brother:  { hoardWild: 0.5, spite: 0.6, colorControl: 0.6, aggro: 0.6, noise: 0.15 },
  the_diva:     { hoardWild: 0.6, spite: 0.8, colorControl: 0.8, aggro: 0.5, noise: 0.1 },
};
const D = STYLES.the_brother;

export function wildColorFor(hand, styleKey) {
  const counts = { R: 0, G: 0, B: 0, Y: 0 };
  hand.forEach((c) => { if (c.c !== 'W') counts[c.c]++; });
  return COLORS.reduce((a, b) => (counts[b] > counts[a] ? b : a), 'R');
}

export function chooseCard(state, seat, styleKey, rng = Math.random) {
  const W = resolveStyle(STYLES, styleKey, D);
  const legal = legalIdxs(state, seat);
  if (!legal.length) return null;
  const hand = state.hands[seat];
  const nextS = ((seat + state.dir) % state.ids.length + state.ids.length) % state.ids.length;
  const threat = state.hands[nextS].length <= 2;      // next player near UNO
  const counts = { R: 0, G: 0, B: 0, Y: 0 };
  hand.forEach((c) => { if (c.c !== 'W') counts[c.c]++; });

  let best = legal[0], bestScore = -Infinity;
  for (const i of legal) {
    const c = hand[i];
    let score = 0;
    const isAction = ['skip', 'rev', 'd2'].includes(c.v);
    const isWild = c.c === 'W';
    if (isWild) score -= W.hoardWild * 5;             // save wilds…
    if (isWild && hand.length <= 2) score += 8;       // …unless closing
    if (isAction) score += W.aggro * 2;
    if ((c.v === 'd2' || c.v === 'wd4' || c.v === 'skip') && threat) score += W.spite * 6;   // hit the leader
    if (!isWild) score += W.colorControl * counts[c.c] * 0.8;   // stay in our deep color
    if (!isWild && !isAction) score += 1;             // vent numbers by default
    score += (rng() - 0.5) * 2 * (W.noise * 5);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function banterMoment(events, nameOf) {
  for (const e of events) {
    if (e.type === 'win') return { line: `${nameOf(e.seat)} just played their last card and WON` };
    if (e.type === 'uno') return { line: `${nameOf(e.seat)} is on their LAST card — UNO` };
    if (e.type === 'draw' && e.n >= 4) return { line: `${nameOf(e.seat)} just ate a +4` };
    if (e.type === 'draw' && e.n === 2) return { line: `${nameOf(e.seat)} picked up a +2`, minor: true };
  }
  return null;
}
