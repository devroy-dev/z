// ════════════════════════════════════════════════════════════════════════
//  yourZ — TEEN PATTI ai. The differentiator: bluffing tempo as character.
//  Each style: how long they ride blind, what they fold seen, when they
//  raise on nothing (the bluff), sideshow appetite, show timing.
//  Strength = percentile of the eval score against all 3-card hands (approx).
// ════════════════════════════════════════════════════════════════════════
import { available } from './rules.js';
import { resolveStyle } from '../personas.js';
import { evalHand } from './eval.js';

// coarse strength 0..1 from category + top key (good enough for taste)
export function strength(cards) {
  const { cat, key } = evalHand(cards);
  const base = [0, 0.62, 0.74, 0.82, 0.90, 0.97][cat];
  const span = [0.62, 0.12, 0.08, 0.08, 0.07, 0.03][cat];
  const hi = (key[0] - 2) / 27;                        // rough within-category position
  return Math.min(0.999, base * 0 + [0, 0.62, 0.74, 0.82, 0.90, 0.97][cat] + span * Math.min(1, hi));
}

export const STYLES = {
  // rides blind forever, raises on air, never backs down — the table's engine
  the_wannabe:  { blindLove: 0.85, foldAt: 0.30, bluffRaise: 0.35, sideshow: 0.15, showEarly: 0.3, tell: 0.1 },
  // sees immediately, folds anything under a pair, never bluffs
  the_cynic:    { blindLove: 0.05, foldAt: 0.62, bluffRaise: 0.02, sideshow: 0.55, showEarly: 0.7, tell: 0.0 },
  // plays the odds; occasional calculated bluff; loves the sideshow
  the_brainiac: { blindLove: 0.25, foldAt: 0.50, bluffRaise: 0.12, sideshow: 0.7, showEarly: 0.5, tell: 0.0 },
  // vibes; medium everything, chaos raises
  the_comic:    { blindLove: 0.5, foldAt: 0.40, bluffRaise: 0.25, sideshow: 0.3, showEarly: 0.4, tell: 0.3 },
  the_diva:     { blindLove: 0.35, foldAt: 0.52, bluffRaise: 0.18, sideshow: 0.4, showEarly: 0.5, tell: 0.05 },
  the_brother:  { blindLove: 0.4, foldAt: 0.45, bluffRaise: 0.15, sideshow: 0.45, showEarly: 0.5, tell: 0.1 },
};
const D = STYLES.the_brother;

export function chooseMove(state, styleKey, rng = Math.random) {
  const W = resolveStyle(STYLES, styleKey, D);
  const mv = available(state);
  if (!mv.length) return null;
  const p = state.players[state.turn];
  const has = (t) => mv.find((m) => m.t === t);
  const bets = mv.filter((m) => m.t === 'bet');
  const flat = bets.find((m) => !m.raise), raise = bets.find((m) => m.raise);
  const potPressure = Math.min(1, state.pot / Math.max(1, p.stack + state.pot) * 2);

  if (p.blind) {
    // stay blind (the ride) or see
    if (rng() < W.blindLove && flat) return flat;
    if (has('see')) return { t: 'see' };
    if (flat) return flat;
    return { t: 'pack' };
  }

  const str = strength(p.cards);
  // strong hand: bet, sometimes raise; near-nuts consider show/sideshow
  if (str >= 0.85) {
    if (has('show') && rng() < W.showEarly + 0.3) return has('show');
    if (raise && rng() < 0.6) return raise;
    if (flat) return flat;
  }
  if (str >= W.foldAt) {
    if (has('sideshow') && rng() < W.sideshow) return has('sideshow');
    if (has('show') && rng() < W.showEarly * str) return has('show');
    if (raise && rng() < 0.15 + potPressure * 0.1) return raise;
    if (flat) return flat;
    return { t: 'pack' };
  }
  // weak hand: bluff or fold
  if (rng() < W.bluffRaise && raise) return raise;
  if (rng() < W.bluffRaise * 0.8 && flat) return flat;
  return { t: 'pack' };
}

// does the asked player ACCEPT a sideshow? confident hands accept.
export function acceptSideshow(state, seat, styleKey, rng = Math.random) {
  const W = resolveStyle(STYLES, styleKey, D);
  const str = strength(state.players[seat].cards);
  return rng() < (str * 0.9 + W.sideshow * 0.2);
}

export function banterMoment(events, nameOf) {
  for (const e of events) {
    if (e.type === 'win' && e.unshown) return { line: `${nameOf(e.seat)} took the whole pot WITHOUT showing — everyone folded` };
    if (e.type === 'show') return { line: `SHOWDOWN between ${nameOf(e.by)} and ${nameOf(e.against)} — cards on the table` };
    if (e.type === 'sideshowResult') return { line: `sideshow between ${nameOf(e.from)} and ${nameOf(e.to)} — ${nameOf(e.loser)} lost it and packs` };
    if (e.type === 'sideshowDecline') return { line: `${nameOf(e.to)} REFUSED the sideshow — nerves or a monster?`, minor: false };
    if (e.type === 'autoSee') return { line: `${nameOf(e.seat)} has ridden blind to the cap — forced to look`, minor: true };
    if (e.type === 'bet' && e.raise && e.blind) return { line: `${nameOf(e.seat)} RAISED without even looking at their cards` };
    if (e.type === 'pack') return { line: `${nameOf(e.seat)} packs`, minor: true };
  }
  return null;
}
