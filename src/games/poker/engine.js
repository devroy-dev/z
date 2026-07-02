// ════════════════════════════════════════════════════════════════════════
//  yourZ — MULTIWAY NO-LIMIT HOLD'EM ENGINE (2–6 seats; the house plays
//  5-handed). Code owns every rule. The hard part is SIDE POTS: layered
//  awards from per-player total commitment, folded money staying in the
//  layers it reached. The harness storms this with forced short stacks.
//  Blinds: SB left of button, BB next (heads-up: button IS the SB).
//  Action closing: a live, non-all-in player set that must act; a raise
//  refills it. BB's preflop option falls out naturally.
// ════════════════════════════════════════════════════════════════════════
import { freshDeck, shuffle, score7, cmpScore, handName } from './eval.js';

export const SB = 10, BB = 20;

const nextLive = (g, from) => {
  let i = from;
  for (let k = 0; k < g.n; k++) {
    i = (i + 1) % g.n;
    if (!g.folded[i] && !g.allIn[i]) return i;
  }
  return -1;
};
const liveCount = (g) => g.folded.filter((f, i) => !f).length;
const actableCount = (g) => g.folded.filter((f, i) => !f && !g.allIn[i]).length;

export function newHand(stacks, dealer, rnd = Math.random) {
  const n = stacks.length;
  const deck = shuffle(freshDeck(), rnd);
  const g = {
    n, dealer,
    stacks: stacks.slice(),
    hole: Array.from({ length: n }, (_, i) => [deck[i], deck[i + n]]),
    deck: deck.slice(n * 2),
    board: [],
    street: 'preflop',
    committed: new Array(n).fill(0),      // this street
    totalCommit: new Array(n).fill(0),    // whole hand (side-pot math)
    folded: new Array(n).fill(false),
    allIn: new Array(n).fill(false),
    toMatch: 0, lastRaise: BB,
    need: new Set(),                      // seats that still must act this street
    toAct: -1,
    winner: null, results: null, street_: null,
  };
  const sbSeat = n === 2 ? dealer : (dealer + 1) % n;
  const bbSeat = n === 2 ? (dealer + 1) % n : (dealer + 2) % n;
  post(g, sbSeat, Math.min(SB, g.stacks[sbSeat]));
  post(g, bbSeat, Math.min(BB, g.stacks[bbSeat]));
  g.toMatch = BB;
  for (let i = 0; i < n; i++) { g.allIn[i] = g.stacks[i] === 0; if (!g.allIn[i]) g.need.add(i); }
  g.toAct = n === 2 ? dealer : (bbSeat + 1) % n;
  while (g.toAct >= 0 && (g.folded[g.toAct] || g.allIn[g.toAct])) g.toAct = nextLive(g, g.toAct);
  if (actableCount(g) <= 1 && !openBettingPossible(g)) maybeRunOut(g);
  return g;
}
function openBettingPossible(g) {
  // betting matters only if 2+ actable, or 1 actable who still owes
  if (actableCount(g) >= 2) return true;
  for (let i = 0; i < g.n; i++) if (!g.folded[i] && !g.allIn[i] && g.committed[i] < g.toMatch) return true;
  return false;
}
function post(g, seat, amt) {
  g.stacks[seat] -= amt;
  g.committed[seat] += amt;
  g.totalCommit[seat] += amt;
}

export function potTotal(g) {
  let awarded = g._awarded || 0;
  return g.totalCommit.reduce((a, b) => a + b, 0) - awarded;
}

export function legalActions(g) {
  if (g.street === 'over' || g.toAct < 0) return [];
  const me = g.toAct;
  if (g.folded[me] || g.allIn[me]) return [];
  const owe = g.toMatch - g.committed[me];
  const acts = [];
  if (owe > 0) {
    acts.push({ type: 'fold' });
    acts.push({ type: 'call', amount: Math.min(owe, g.stacks[me]) });
  } else acts.push({ type: 'check' });
  // can raise if any other live player could still respond with chips
  const someoneCanRespond = g.folded.some((f, i) => i !== me && !f && !g.allIn[i]);
  if (g.stacks[me] > Math.max(owe, 0) && someoneCanRespond) {
    const minTo = g.toMatch + g.lastRaise;
    const maxTo = g.committed[me] + g.stacks[me];
    if (maxTo > g.toMatch) acts.push({ type: owe > 0 ? 'raise' : 'bet', minTo: Math.min(minTo, maxTo), maxTo });
  } else if (g.stacks[me] > 0 && g.stacks[me] <= owe) {
    //短 call-all-in already covered by 'call'
  }
  return acts;
}

export function act(g, action) {
  const me = g.toAct;
  const owe = g.toMatch - g.committed[me];

  if (action.type === 'fold') {
    g.folded[me] = true; g.need.delete(me);
    if (liveCount(g) === 1) { settleFoldout(g); return g; }
    passOrClose(g, me); return g;
  }
  if (action.type === 'check') {
    if (owe > 0) throw new Error('illegal check');
    g.need.delete(me);
    passOrClose(g, me); return g;
  }
  if (action.type === 'call') {
    if (owe <= 0) throw new Error('nothing to call');
    const amt = Math.min(owe, g.stacks[me]);
    post(g, me, amt);
    if (g.stacks[me] === 0) g.allIn[me] = true;
    g.need.delete(me);
    passOrClose(g, me); return g;
  }
  if (action.type === 'bet' || action.type === 'raise') {
    const legal = legalActions(g).find((a) => a.type === action.type);
    if (!legal) throw new Error('illegal ' + action.type);
    const to = Math.min(Math.max((action.to | 0) || legal.minTo, legal.minTo), legal.maxTo);
    const add = to - g.committed[me];
    g.lastRaise = Math.max(to - g.toMatch, BB);
    g.toMatch = Math.max(g.toMatch, to);
    post(g, me, add);
    if (g.stacks[me] === 0) g.allIn[me] = true;
    // everyone else live+actable must respond
    g.need = new Set();
    for (let i = 0; i < g.n; i++) if (i !== me && !g.folded[i] && !g.allIn[i]) g.need.add(i);
    g.toAct = nextLive(g, me);
    if (g.toAct < 0 || g.need.size === 0) closeStreet(g);
    return g;
  }
  throw new Error('unknown action: ' + action.type);
}

function passOrClose(g, me) {
  if (g.need.size === 0) { closeStreet(g); return; }
  let nxt = nextLive(g, me);
  // walk to the next seat that still needs to act
  let guard = 0;
  while (nxt >= 0 && !g.need.has(nxt) && guard++ < g.n) nxt = nextLive(g, nxt);
  if (nxt < 0 || !g.need.has(nxt)) { closeStreet(g); return; }
  g.toAct = nxt;
}
function closeStreet(g) {
  if (liveCount(g) === 1) { settleFoldout(g); return; }
  if (actableCount(g) <= 1) { maybeRunOut(g); return; }
  g.committed = new Array(g.n).fill(0);
  g.toMatch = 0; g.lastRaise = BB;
  if (g.street === 'preflop') { g.board.push(g.deck.shift(), g.deck.shift(), g.deck.shift()); g.street = 'flop'; }
  else if (g.street === 'flop') { g.board.push(g.deck.shift()); g.street = 'turn'; }
  else if (g.street === 'turn') { g.board.push(g.deck.shift()); g.street = 'river'; }
  else { showdown(g); return; }
  g.need = new Set();
  for (let i = 0; i < g.n; i++) if (!g.folded[i] && !g.allIn[i]) g.need.add(i);
  g.toAct = nextLive(g, g.dealer);
  let guard = 0;
  while (g.toAct >= 0 && !g.need.has(g.toAct) && guard++ < g.n) g.toAct = nextLive(g, g.toAct);
  if (g.need.size === 0) closeStreet(g);
}
function maybeRunOut(g) {
  // one or zero actable seats and bets matched → run the board out
  while (g.board.length < 5) g.board.push(g.deck.shift());
  showdown(g);
}

// ── SIDE POTS: layered awards from totalCommit; folded chips stay in ──
function showdown(g) {
  g.street = 'showdown';
  const scores = g.hole.map((h, i) => (g.folded[i] ? null : score7([...h, ...g.board])));
  const levels = [...new Set(g.totalCommit.filter((c) => c > 0))].sort((a, b) => a - b);
  const awards = new Array(g.n).fill(0);
  const pots = [];
  let prev = 0;
  for (const L of levels) {
    let amount = 0;
    for (let i = 0; i < g.n; i++) amount += Math.max(0, Math.min(g.totalCommit[i], L) - prev);
    const eligible = [];
    for (let i = 0; i < g.n; i++) if (!g.folded[i] && g.totalCommit[i] >= L) eligible.push(i);
    if (amount > 0 && eligible.length) {
      let best = [eligible[0]];
      for (const e of eligible.slice(1)) {
        const c = cmpScore(scores[e], scores[best[0]]);
        if (c > 0) best = [e]; else if (c === 0) best.push(e);
      }
      const share = Math.floor(amount / best.length);
      let rem = amount - share * best.length;
      // odd chips: earliest seat left of the button among winners
      const order = [];
      for (let k = 1; k <= g.n; k++) order.push((g.dealer + k) % g.n);
      const sorted = best.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
      for (const w of best) awards[w] += share;
      for (const w of sorted) { if (rem <= 0) break; awards[w] += 1; rem--; }
      pots.push({ amount, winners: best });
    } else if (amount > 0 && !eligible.length) {
      // impossible while one player is live; guard anyway: return by contribution
      for (let i = 0; i < g.n; i++) awards[i] += Math.max(0, Math.min(g.totalCommit[i], L) - prev);
    }
    prev = L;
  }
  for (let i = 0; i < g.n; i++) g.stacks[i] += awards[i];
  g._awarded = g.totalCommit.reduce((a, b) => a + b, 0);
  const mainWinners = pots.length ? pots[pots.length - 1].winners : [];
  g.winner = mainWinners.length === 1 ? mainWinners[0] : 'chop';
  g.results = {
    pots, awards, scores,
    reason: mainWinners.length ? handName(scores[mainWinners[0]]) : 'the fold',
  };
  g.street = 'over';
}
function settleFoldout(g) {
  const w = g.folded.findIndex((f) => !f);
  const total = g.totalCommit.reduce((a, b) => a + b, 0);
  g.stacks[w] += total;
  g._awarded = total;
  g.winner = w;
  g.results = { pots: [{ amount: total, winners: [w] }], awards: g.stacks.map((_, i) => (i === w ? total : 0)), scores: null, reason: 'fold' };
  g.street = 'over';
}
