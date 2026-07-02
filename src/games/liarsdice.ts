// ════════════════════════════════════════════════════════════════════════
//  yourZ — LIAR'S DICE, server side. The same harness-proven rules as the
//  native engine, ported to run authoritatively. Plus the multiplayer
//  essentials the client version never needed: per-viewer state filtering
//  (your cup is YOURS) and AI seat advancement.
// ════════════════════════════════════════════════════════════════════════

export type LDState = {
  n: number; dice: number[]; cups: number[][]; round: number;
  bid: { qty: number; face: number; by: number } | null;
  toAct: number; phase: 'bidding' | 'reveal' | 'over';
  out: boolean[]; lastResult: any; winner: number | null;
};

export function newGame(n: number): LDState {
  return { n, dice: new Array(n).fill(5), cups: [], round: 0, bid: null, toAct: 0, phase: 'bidding', out: new Array(n).fill(false), lastResult: null, winner: null };
}
export function rollRound(g: LDState) {
  g.cups = g.dice.map((n, i) => (g.out[i] ? [] : Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort()));
  g.bid = null; g.phase = 'bidding'; g.round++;
  if (g.lastResult) { let s = g.lastResult.loser; while (g.out[s]) s = (s + 1) % g.n; g.toAct = s; }
  else { let i = 0; while (g.out[i]) i = (i + 1) % g.n; g.toAct = i; }
  return g;
}
const nextAlive = (g: LDState, from: number) => { let i = (from + 1) % g.n; while (g.out[i]) i = (i + 1) % g.n; return i; };
export const totalDice = (g: LDState) => g.dice.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0);

export function placeBid(g: LDState, seat: number, qty: number, face: number) {
  if (g.phase !== 'bidding' || seat !== g.toAct) throw new Error('not your turn');
  if (face < 1 || face > 6 || qty < 1 || qty > totalDice(g)) throw new Error('bad bid');
  if (g.bid && !(qty > g.bid.qty || (qty === g.bid.qty && face > g.bid.face))) throw new Error('bid must climb');
  g.bid = { qty, face, by: seat };
  g.toAct = nextAlive(g, seat);
  return g;
}
export function callLiar(g: LDState, seat: number) {
  if (g.phase !== 'bidding' || seat !== g.toAct) throw new Error('not your turn');
  if (!g.bid) throw new Error('nothing to call');
  const actual = g.cups.flat().filter((d) => d === g.bid!.face).length;
  const truthful = actual >= g.bid.qty;
  const loser = truthful ? seat : g.bid.by;
  g.dice[loser]--;
  if (g.dice[loser] <= 0) { g.out[loser] = true; g.dice[loser] = 0; }
  g.lastResult = { caller: seat, bidder: g.bid.by, bid: { ...g.bid }, actual, truthful, loser, eliminated: g.out[loser], cupsShown: g.cups.map((c) => c.slice()) };
  g.phase = 'reveal';
  const alive = g.out.filter((o) => !o).length;
  if (alive === 1) { g.phase = 'over'; g.winner = g.out.findIndex((o) => !o); }
  return g;
}
export function nextRound(g: LDState) {
  if (g.phase !== 'reveal') throw new Error('not at a reveal');
  rollRound(g);
  return g;
}

// ── the AI seat (same policy family as the native table) ──
function chance(g: LDState, seat: number, qty: number, face: number) {
  const mine = g.cups[seat].filter((d) => d === face).length;
  const need = qty - mine;
  if (need <= 0) return 1;
  const u = totalDice(g) - g.cups[seat].length;
  if (need > u) return 0;
  let p = 0, comb = 1;
  for (let k = 0; k <= u; k++) {
    if (k > 0) comb = comb * (u - k + 1) / k;
    if (k >= need) p += comb * Math.pow(1 / 6, k) * Math.pow(5 / 6, u - k);
  }
  return Math.min(1, p);
}
export function aiMove(g: LDState, seat: number) {
  if (g.bid) {
    const pTrue = chance(g, seat, g.bid.qty, g.bid.face);
    if (pTrue < 0.34 + Math.random() * 0.12) return callLiar(g, seat);
  }
  const max = totalDice(g);
  const options: { qty: number; face: number; p: number }[] = [];
  const startQ = g.bid ? g.bid.qty : 1;
  for (let q = startQ; q <= Math.min(max, startQ + 3); q++) for (let f = 1; f <= 6; f++) {
    if (!g.bid || q > g.bid.qty || (q === g.bid.qty && f > g.bid.face)) options.push({ qty: q, face: f, p: chance(g, seat, q, f) });
  }
  const safe = options.filter((o) => o.p > 0.5);
  const spicy = options.filter((o) => o.p > 0.25);
  const pick = safe.length ? safe[Math.floor(Math.random() * Math.min(3, safe.length))]
    : spicy.length ? spicy[Math.floor(Math.random() * Math.min(3, spicy.length))] : null;
  if (!pick) return g.bid ? callLiar(g, seat) : placeBid(g, seat, 1, 6);
  return placeBid(g, seat, pick.qty, pick.face);
}

// ── per-viewer filtering: your cup is yours; reveal shows everything ──
export function viewFor(g: LDState, mySeat: number) {
  return {
    ...g,
    cups: g.cups.map((cup, i) => (i === mySeat || g.phase !== 'bidding' ? cup : cup.map(() => 0))),   // 0 = hidden die
  };
}
