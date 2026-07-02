// ════════════════════════════════════════════════════════════════════════
//  yourZ — PUSOY DOS ENGINE (Filipino Big Two). 4 players, 13 cards each.
//  Rank order: 3 low → 2 high. Suit order: ♣ < ♠ < ♥ < ♦ (diamonds boss).
//  The 3♣ opens the game and must be in the opening play. Combos: singles,
//  pairs, trios, and five-card hands (straight < flush < full house <
//  quads < straight flush). Follow with the SAME SIZE, strictly higher —
//  or pass. Three passes clear the table; last player leads anything.
//  First to empty their hand wins. Deterministic; harness-proven.
//  Card: { r: 0..12 (3..A,2), s: 0..3 (♣,♠,♥,♦) }
// ════════════════════════════════════════════════════════════════════════
export const RANK_LABEL = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
export const SUIT_LABEL = ['♣','♠','♥','♦'];
export const N = 4;

export const cardVal = (c) => c.r * 4 + c.s;                 // total order of singles

export function deal(rnd = Math.random) {
  const deck = [];
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  hands.forEach((h) => h.sort((a, b) => cardVal(a) - cardVal(b)));
  return hands;
}

// ── combo classification ──
// returns { size, cat, key } or null. cat for size 5: 0 straight, 1 flush,
// 2 full house, 3 quads, 4 straight flush. key = comparison tuple.
export function classify(cards) {
  const n = cards.length;
  if (n === 1) return { size: 1, cat: 0, key: [cardVal(cards[0])] };
  const rs = cards.map((c) => c.r).sort((a, b) => a - b);
  if (n === 2) {
    if (rs[0] !== rs[1]) return null;
    const hiSuit = Math.max(...cards.map((c) => c.s));
    return { size: 2, cat: 0, key: [rs[0], hiSuit] };
  }
  if (n === 3) {
    if (!(rs[0] === rs[1] && rs[1] === rs[2])) return null;
    return { size: 3, cat: 0, key: [rs[0]] };
  }
  if (n !== 5) return null;
  const counts = {}; rs.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
  const vals = Object.values(counts).sort((a, b) => b - a);
  const suits = new Set(cards.map((c) => c.s));
  const flush = suits.size === 1;
  // straights: natural 3..A run, NO 2s, no wraps
  const straight = rs.every((r) => r < 12) && rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);
  const top = () => { const t = cards.slice().sort((a, b) => cardVal(a) - cardVal(b))[4]; return [t.r, t.s]; };
  if (straight && flush) return { size: 5, cat: 4, key: top() };
  if (vals[0] === 4) { const quad = +Object.keys(counts).find((k) => counts[k] === 4); return { size: 5, cat: 3, key: [quad] }; }
  if (vals[0] === 3 && vals[1] === 2) { const trio = +Object.keys(counts).find((k) => counts[k] === 3); return { size: 5, cat: 2, key: [trio] }; }
  if (flush) { const t = top(); return { size: 5, cat: 1, key: [t[0], t[1]] }; }
  if (straight) return { size: 5, cat: 0, key: top() };
  return null;
}

// does combo a beat combo b (same size assumed)
export function beats(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  if (a.size === 5 && a.cat !== b.cat) return a.cat > b.cat;
  const n = Math.max(a.key.length, b.key.length);
  for (let i = 0; i < n; i++) {
    const d = (a.key[i] || 0) - (b.key[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

export function newGame(rnd = Math.random) {
  const hands = deal(rnd);
  const opener = hands.findIndex((h) => h.some((c) => c.r === 0 && c.s === 0));   // 3♣
  return {
    hands, toAct: opener, opener,
    table: null,                 // { cards, combo, by }
    passes: 0,
    firstPlay: true,             // 3♣ must be included
    phase: 'play', winner: null,
    counts: hands.map((h) => h.length),
    lastEvent: null,
  };
}

const has3c = (cards) => cards.some((c) => c.r === 0 && c.s === 0);
const removeFrom = (hand, cards) => hand.filter((h) => !cards.some((c) => c.r === h.r && c.s === h.s));

export function play(g, seat, cards) {
  if (g.phase !== 'play' || seat !== g.toAct) throw new Error('not your turn');
  const owned = cards.every((c) => g.hands[seat].some((h) => h.r === c.r && h.s === c.s));
  if (!owned) throw new Error('cards not in hand');
  const combo = classify(cards);
  if (!combo) throw new Error('not a valid combo');
  if (g.firstPlay && !has3c(cards)) throw new Error('opening must include the 3♣');
  if (g.table) {
    if (combo.size !== g.table.combo.size) throw new Error('must match the size on the table');
    if (!beats(combo, g.table.combo)) throw new Error('must beat the table');
  }
  g.hands[seat] = removeFrom(g.hands[seat], cards);
  g.counts[seat] = g.hands[seat].length;
  g.table = { cards: cards.slice(), combo, by: seat };
  g.passes = 0;
  g.firstPlay = false;
  g.lastEvent = { type: 'play', seat, cards: cards.slice(), combo };
  if (g.hands[seat].length === 0) { g.phase = 'over'; g.winner = seat; return g; }
  g.toAct = (seat + 1) % N;
  return g;
}

export function pass(g, seat) {
  if (g.phase !== 'play' || seat !== g.toAct) throw new Error('not your turn');
  if (!g.table) throw new Error('cannot pass a fresh lead');
  g.passes++;
  g.lastEvent = { type: 'pass', seat };
  if (g.passes >= N - 1) {
    // table clears; the last player to play leads anything
    g.toAct = g.table.by;
    g.table = null;
    g.passes = 0;
    g.lastEvent = { type: 'clear', to: g.toAct };
  } else {
    g.toAct = (seat + 1) % N;
  }
  return g;
}

// all legal plays for a seat (used by AI and the harness cross-check)
export function legalPlays(g, seat) {
  const hand = g.hands[seat];
  const out = [];
  const consider = (cards) => {
    const combo = classify(cards);
    if (!combo) return;
    if (g.firstPlay && !has3c(cards)) return;
    if (g.table) {
      if (combo.size !== g.table.combo.size) return;
      if (!beats(combo, g.table.combo)) return;
    }
    out.push({ cards, combo });
  };
  // singles
  for (const c of hand) consider([c]);
  // pairs / trios / quads-in-5
  const byRank = {};
  hand.forEach((c) => { (byRank[c.r] = byRank[c.r] || []).push(c); });
  for (const r in byRank) {
    const g2 = byRank[r];
    if (g2.length >= 2) {
      for (let i = 0; i < g2.length; i++) for (let j = i + 1; j < g2.length; j++) consider([g2[i], g2[j]]);
    }
    if (g2.length >= 3) {
      for (let i = 0; i < g2.length; i++) for (let j = i + 1; j < g2.length; j++) for (let k = j + 1; k < g2.length; k++) consider([g2[i], g2[j], g2[k]]);
    }
  }
  // five-card hands: only when leading or table is size 5 (keep the search bounded)
  if (!g.table || g.table.combo.size === 5) {
    const n = hand.length;
    if (n >= 5 && n <= 13) {
      // straights & straight flushes: scan runs
      const byRankSets = byRank;
      for (let start = 0; start <= 7; start++) {           // ranks 3..9 can start a run (no 2s)
        const run = [0, 1, 2, 3, 4].map((k) => byRankSets[start + k]).filter(Boolean);
        if (run.length === 5) {
          // one representative per rank (cheapest), plus the all-same-suit variant if it exists
          consider(run.map((cs) => cs[0]));
          for (let s = 0; s < 4; s++) {
            const suited = [0, 1, 2, 3, 4].map((k) => (byRankSets[start + k] || []).find((c) => c.s === s));
            if (suited.every(Boolean)) consider(suited);
          }
        }
      }
      // flushes: per suit, take combinations of the top few
      for (let s = 0; s < 4; s++) {
        const suited = hand.filter((c) => c.s === s);
        if (suited.length >= 5) consider(suited.slice(-5));
      }
      // full houses & quads
      const trips = Object.keys(byRank).filter((r) => byRank[r].length >= 3);
      const pairs = Object.keys(byRank).filter((r) => byRank[r].length >= 2);
      for (const t of trips) for (const p of pairs) {
        if (t === p) continue;
        consider([...byRank[t].slice(0, 3), ...byRank[p].slice(0, 2)]);
      }
      const quads = Object.keys(byRank).filter((r) => byRank[r].length === 4);
      for (const q of quads) {
        const kicker = hand.find((c) => c.r !== +q);
        if (kicker) consider([...byRank[q], kicker]);
      }
    }
  }
  return out;
}
