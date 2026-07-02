// ════════════════════════════════════════════════════════════════════════
//  yourZ — BLACKJACK ai: how each persona plays its own chips, and what's
//  worth a line. The dealer has no choices (S17 is law) — the dealer's
//  personality is PURE MOUTH; the co-players' shows in their decisions.
// ════════════════════════════════════════════════════════════════════════
import { handValue, actions } from './rules.js';
import { resolveStyle } from '../personas.js';

// stand thresholds vs dealer up-card + appetite for double/split.
export const STYLES = {
  the_brainiac:  { hardStand: (up) => (up >= 7 ? 17 : up >= 4 && up <= 6 ? 12 : 13), softStand: 18, dbl: [9,10,11], splitLove: 0.9, chase: 0 },
  the_wannabe:   { hardStand: () => 18, softStand: 19, dbl: [8,9,10,11], splitLove: 1.0, chase: 0.25 },  // hits too long, doubles wide
  the_cynic:     { hardStand: () => 14, softStand: 17, dbl: [11], splitLove: 0.2, chase: 0 },            // stands early, trusts nothing
  the_brother:   { hardStand: (up) => (up >= 7 ? 16 : 13), softStand: 18, dbl: [10,11], splitLove: 0.6, chase: 0.08 },
  the_comic:     { hardStand: () => 15, softStand: 18, dbl: [9,10,11], splitLove: 0.7, chase: 0.5 },     // coin-flip chaos
  the_diva:      { hardStand: (up) => (up >= 7 ? 17 : 12), softStand: 18, dbl: [10,11], splitLove: 0.4, chase: 0.05 },
};
const D = STYLES.the_brother;

export function chooseAction(state, styleKey, rng = Math.random) {
  const W = resolveStyle(STYLES, styleKey, D);
  const as = actions(state);
  if (!as.length) return null;
  const h = state.hands[state.active];
  const v = handValue(h.cards);
  const up = Math.min(state.dealer.cards[0].r === 14 ? 11 : state.dealer.cards[0].r, 10);
  if (as.includes('split') && rng() < W.splitLove) return 'split';
  if (as.includes('double') && W.dbl.includes(v.total) && !v.soft) return 'double';
  if (W.chase && rng() < W.chase && as.includes('hit') && v.total < 21) return 'hit';   // chaos hits
  const stand = v.soft ? W.softStand : W.hardStand(up);
  if (v.total >= stand) return 'stand';
  return as.includes('hit') ? 'hit' : 'stand';
}

// dealer-mouth + table-reaction moments (UI throttles, /banter phrases)
export function banterMoment(events, nameOf) {
  for (const e of events) {
    if (e.type === 'results') {
      const you = e.results.find((r) => r.id === 'you');
      if (you?.blackjack) return { line: `the player just hit BLACKJACK — pay them 3 to 2` };
      if (e.results.every((r) => r.delta < 0)) return { line: `the dealer swept the whole table — every hand lost` };
      if (you && you.delta > 0 && e.dealerTotal > 21) return { line: `the dealer BUST and the player got paid` };
      return null;
    }
    if (e.type === 'bust' && e.seat === 0) return { line: `the player just bust on ${e.total}` };
    if (e.type === 'dealerBust') return { line: `the dealer went bust on ${e.total} — the table wins` };
    if (e.type === 'double' && e.seat === 0) return { line: `the player doubled down — chips riding` };
    if (e.type === 'split') return { line: `${nameOf(e.seat)} split the pair — two hands now` };
  }
  return null;
}
