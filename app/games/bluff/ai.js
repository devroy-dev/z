// ════════════════════════════════════════════════════════════════════════
//  yourZ — BLUFF ai. THE game where personality IS strategy. Each style is
//  (a) a lying policy and (b) a suspicion policy — both parameterised.
//  The AI sees ONLY what a player at the table would: its own hand, claim
//  counts, pile size, who's low on cards. Never other hands, never the pile.
// ════════════════════════════════════════════════════════════════════════
import { legalPlays } from './rules.js';

export const STYLES = {
  // counts everything; lies only when cornered; challenges on the math
  the_brainiac: { lieAppetite: 0.15, bigLies: 0.1, suspicion: 0.35, mathTrust: 1.0, endgameNerves: 0.9 },
  // lies constantly, big and proud; challenges on vibes
  the_wannabe:  { lieAppetite: 0.75, bigLies: 0.6, suspicion: 0.30, mathTrust: 0.3, endgameNerves: 0.4 },
  // paranoid: challenges everything, lies rarely
  the_cynic:    { lieAppetite: 0.20, bigLies: 0.1, suspicion: 0.70, mathTrust: 0.6, endgameNerves: 1.0 },
  // smooth: mixes truth and small lies, hard to read
  the_diva:     { lieAppetite: 0.45, bigLies: 0.2, suspicion: 0.40, mathTrust: 0.6, endgameNerves: 0.7 },
  // chaos: unreadable by definition
  the_comic:    { lieAppetite: 0.50, bigLies: 0.5, suspicion: 0.50, mathTrust: 0.2, endgameNerves: 0.3 },
  the_brother:  { lieAppetite: 0.35, bigLies: 0.25, suspicion: 0.45, mathTrust: 0.7, endgameNerves: 0.7 },
};
const D = STYLES.the_brother;

// decide a turn: returns { action:'play', cardIdxs, claimRank } or { action:'pass' }
export function chooseTurn(state, seat, styleKey, rng = Math.random) {
  const W = STYLES[styleKey] || D;
  const hand = state.hands[seat];
  const { canPass, mustClaim } = legalPlays(state);
  const byRank = {};
  hand.forEach((c, i) => { (byRank[c.r] = byRank[c.r] || []).push(i); });

  if (mustClaim === null) {
    // leading: pick our deepest rank, play it honestly (a strong lead)
    const best = Object.entries(byRank).sort((a, b) => b[1].length - a[1].length)[0];
    const idxs = best[1].slice(0, 4);
    return { action: 'play', cardIdxs: idxs, claimRank: Number(best[0]) };
  }

  const truth = byRank[mustClaim] || [];
  if (truth.length > 0) {
    // has real cards: usually honest; sometimes pads the truth with a lie card
    const idxs = truth.slice(0, 4);
    if (rng() < W.bigLies && hand.length > idxs.length && idxs.length < 4) {
      const spare = hand.findIndex((c, i) => !idxs.includes(i));
      if (spare !== -1) idxs.push(spare);              // truth + one smuggled card
    }
    return { action: 'play', cardIdxs: idxs, claimRank: mustClaim };
  }

  // no real cards: lie or pass
  const pressure = hand.length <= 3 ? 0.3 : 0;         // near the end, dump harder
  if (!canPass || rng() < W.lieAppetite + pressure) {
    const n = rng() < W.bigLies ? Math.min(2 + Math.floor(rng() * 2), hand.length, 4) : 1;
    const idxs = [];
    for (let i = 0; i < hand.length && idxs.length < n; i++) idxs.push(i);
    return { action: 'play', cardIdxs: idxs, claimRank: mustClaim };
  }
  return { action: 'pass' };
}

// decide whether to challenge the last play. Math: if claimed count + what I
// hold of that rank exceeds 4, someone is lying — certainty. Below that,
// suspicion scales with claim size, pile size, and the endgame.
export function wantsChallenge(state, seat, styleKey, rng = Math.random) {
  const W = STYLES[styleKey] || D;
  if (!state.lastPlay || state.lastPlay.seat === seat) return false;
  const lp = state.pile[state.pile.length - 1];
  const mine = state.hands[seat].filter((c) => c.r === lp.claimRank).length;
  const claimedSoFar = state.pile.filter((p) => p.claimRank === lp.claimRank).reduce((a, p) => a + p.claimCount, 0);
  if (mine + claimedSoFar > 4 && rng() < W.mathTrust) return true;      // impossible claim → the counters pounce
  let p = W.suspicion * 0.25;
  p += (lp.claimCount - 1) * 0.10 * W.suspicion;                        // big claims smell
  const playerCardsLeft = state.hands[lp.seat].length;
  if (playerCardsLeft === 0) p += W.endgameNerves * 0.55;               // final play — nerves
  else if (playerCardsLeft <= 2) p += W.endgameNerves * 0.2;
  const pileSize = state.pile.reduce((a, x) => a + x.cards.length, 0);
  p -= Math.min(pileSize * 0.012, 0.15);                                // big pile = big risk to be wrong
  return rng() < Math.max(0, Math.min(p, 0.95));
}

// the moments worth a line (UI throttles, /banter phrases)
export function banterMoment(events, nameOf) {
  for (const e of events) {
    if (e.type === 'win') return { line: `${nameOf(e.seat)} just emptied their hand and WON the bluff game` };
    if (e.type === 'winDenied') return { line: `${nameOf(e.seat)} was ONE card from winning, got called, was LYING, and picked up the whole pile — brutal` };
    if (e.type === 'challenge') {
      return { line: e.lied
        ? `${nameOf(e.by)} called bluff on ${nameOf(e.against)} — and they WERE lying. Caught red-handed`
        : `${nameOf(e.by)} called bluff on ${nameOf(e.against)} — but it was TRUE. The challenger eats the pile` };
    }
    if (e.type === 'burn') return { line: `everyone passed — the pile burns, fresh start`, minor: true };
    if (e.type === 'lastCard') return { line: `${nameOf(e.seat)} just played what they SAY is their last card — someone should think hard` };
  }
  return null;
}
