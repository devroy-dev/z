// ════════════════════════════════════════════════════════════════════════
//  yourZ — LIAR'S DICE ENGINE. Everyone rolls five dice under a cup. Bids
//  name a quantity of a face across ALL cups ("four 5s"). Each bid must
//  climb: more dice, or the same count at a higher face. Call LIAR and the
//  cups lift: bid stands → caller loses a die; bid was a lie → bidder
//  loses one. Last player holding dice wins. No wilds (v1) — clean odds,
//  honest AI. Deterministic; harness-proven.
// ════════════════════════════════════════════════════════════════════════

export function newGame(playerCount, rnd = Math.random) {
  return {
    n: playerCount,
    dice: Array.from({ length: playerCount }, () => 5),   // dice remaining
    cups: [], round: 0,
    bid: null,                    // { qty, face, by }
    toAct: 0,
    phase: 'idle',                // idle | bidding | reveal | over
    out: new Array(playerCount).fill(false),
    lastResult: null, winner: null,
  };
}

export function rollRound(g, rnd = Math.random) {
  g.cups = g.dice.map((n, i) => (g.out[i] ? [] : Array.from({ length: n }, () => 1 + Math.floor(rnd() * 6)).sort()));
  g.bid = null;
  g.phase = 'bidding';
  g.round++;
  // opener: previous loser if still in, else next alive
  if (g.lastResult) {
    let s = g.lastResult.loser;
    while (g.out[s]) s = (s + 1) % g.n;
    g.toAct = s;
  } else g.toAct = firstAlive(g, 0);
  return g;
}
const firstAlive = (g, from) => { let i = from % g.n; while (g.out[i]) i = (i + 1) % g.n; return i; };
export const nextAlive = (g, from) => { let i = (from + 1) % g.n; while (g.out[i]) i = (i + 1) % g.n; return i; };
export const totalDice = (g) => g.dice.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0);

export function legalBids(g) {
  if (g.phase !== 'bidding') return [];
  const max = totalDice(g);
  const out = [];
  const start = g.bid ? g.bid.qty : 1;
  for (let q = start; q <= max; q++) {
    for (let f = 1; f <= 6; f++) {
      if (!g.bid || q > g.bid.qty || (q === g.bid.qty && f > g.bid.face)) out.push({ qty: q, face: f });
    }
  }
  return out;
}

export function placeBid(g, seat, qty, face) {
  if (g.phase !== 'bidding' || seat !== g.toAct) throw new Error('not your turn');
  if (face < 1 || face > 6) throw new Error('bad face');
  if (qty < 1 || qty > totalDice(g)) throw new Error('bad qty');
  if (g.bid && !(qty > g.bid.qty || (qty === g.bid.qty && face > g.bid.face))) throw new Error('bid must climb');
  g.bid = { qty, face, by: seat };
  g.toAct = nextAlive(g, seat);
  return g;
}

export function callLiar(g, seat) {
  if (g.phase !== 'bidding' || seat !== g.toAct) throw new Error('not your turn');
  if (!g.bid) throw new Error('nothing to call');
  const actual = g.cups.flat().filter((d) => d === g.bid.face).length;
  const truthful = actual >= g.bid.qty;
  const loser = truthful ? seat : g.bid.by;
  g.dice[loser]--;
  if (g.dice[loser] <= 0) { g.out[loser] = true; g.dice[loser] = 0; }
  g.lastResult = { caller: seat, bidder: g.bid.by, bid: { ...g.bid }, actual, truthful, loser, eliminated: g.out[loser] };
  g.phase = 'reveal';
  const alive = g.out.filter((o) => !o).length;
  if (alive === 1) { g.phase = 'over'; g.winner = g.out.findIndex((o) => !o); }
  return g;
}
