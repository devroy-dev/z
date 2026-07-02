// ════════════════════════════════════════════════════════════════════════
//  yourZ — HOLD'EM HAND EVALUATOR. Best five of seven, full ranking with
//  kickers. Deterministic; the harness proves it against known hands and
//  pairwise ordering before anything renders.
//  Card: { r: 2..14, s: 0..3 }   (14 = Ace)
//  score(): returns an integer-comparable array [cat, ...tiebreaks],
//  cat: 8 straight-flush · 7 quads · 6 full house · 5 flush · 4 straight
//       3 trips · 2 two pair · 1 pair · 0 high card
// ════════════════════════════════════════════════════════════════════════

export const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14];
export const SUITS = [0,1,2,3];

export function freshDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
  return d;
}
export function shuffle(deck, rnd = Math.random) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// straight top from a set of ranks (wheel A-5 counts, top = 5)
function straightTop(rankSet) {
  const rs = new Set(rankSet);
  if (rs.has(14)) rs.add(1);                          // ace low
  let run = 0, best = 0;
  for (let r = 1; r <= 14; r++) {
    if (rs.has(r)) { run++; if (run >= 5) best = r; }
    else run = 0;
  }
  return best;                                         // 0 = none
}

// score the best 5-card hand from 5..7 cards
export function score7(cards) {
  const byRank = new Map();                            // rank → count
  const bySuit = new Map();                            // suit → ranks[]
  for (const c of cards) {
    byRank.set(c.r, (byRank.get(c.r) || 0) + 1);
    if (!bySuit.has(c.s)) bySuit.set(c.s, []);
    bySuit.get(c.s).push(c.r);
  }
  const ranksDesc = [...byRank.keys()].sort((a, b) => b - a);

  // flush / straight flush
  let flushRanks = null;
  for (const [, rs] of bySuit) if (rs.length >= 5) flushRanks = rs.sort((a, b) => b - a);
  if (flushRanks) {
    const sfTop = straightTop(flushRanks);
    if (sfTop) return [8, sfTop];
    return [5, ...flushRanks.slice(0, 5)];
  }

  const groups = ranksDesc.map((r) => ({ r, n: byRank.get(r) }));
  const quads = groups.find((g) => g.n === 4);
  if (quads) {
    const kick = ranksDesc.find((r) => r !== quads.r);
    return [7, quads.r, kick];
  }
  const trips = groups.filter((g) => g.n === 3).map((g) => g.r);
  const pairs = groups.filter((g) => g.n === 2).map((g) => g.r);
  if (trips.length && (pairs.length || trips.length > 1)) {
    const t = trips[0];
    const p = trips.length > 1 ? trips[1] : pairs[0];
    return [6, t, p];
  }
  const st = straightTop(ranksDesc);
  if (st) return [4, st];
  if (trips.length) {
    const kicks = ranksDesc.filter((r) => r !== trips[0]).slice(0, 2);
    return [3, trips[0], ...kicks];
  }
  if (pairs.length >= 2) {
    const [p1, p2] = pairs;
    const kick = ranksDesc.find((r) => r !== p1 && r !== p2);
    return [2, p1, p2, kick];
  }
  if (pairs.length === 1) {
    const kicks = ranksDesc.filter((r) => r !== pairs[0]).slice(0, 3);
    return [1, pairs[0], ...kicks];
  }
  return [0, ...ranksDesc.slice(0, 5)];
}

// compare two score arrays: >0 a wins, <0 b wins, 0 chop
export function cmpScore(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

export const CAT_NAMES = ['high card', 'a pair', 'two pair', 'trips', 'a straight', 'a flush', 'a full house', 'quads', 'a straight flush'];
export function handName(sc) { return CAT_NAMES[sc[0]]; }
