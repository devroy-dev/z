// ════════════════════════════════════════════════════════════════════════
//  yourZ — HEADS-UP NO-LIMIT HOLD'EM ENGINE. Deterministic state machine:
//  code owns every rule; the persona only supplies mouth and style.
//  Heads-up law: dealer posts SMALL blind and acts FIRST preflop;
//  dealer acts LAST postflop. Min-raise = size of the last raise.
//  Chip conservation is exact by construction; the harness proves it.
//  Seats: 0 = you, 1 = them. All amounts integers.
// ════════════════════════════════════════════════════════════════════════
import { freshDeck, shuffle, score7, cmpScore, handName } from './eval.js';

export const SB = 10, BB = 20;

export function newHand(stacks, dealer, rnd = Math.random) {
  const deck = shuffle(freshDeck(), rnd);
  const g = {
    stacks: stacks.slice(),            // live stacks (blinds removed below)
    dealer,                            // seat with the button (posts SB)
    hole: [[deck[0], deck[2]], [deck[1], deck[3]]],
    board: [],
    deck: deck.slice(4),
    street: 'preflop',                 // preflop|flop|turn|river|showdown|over
    pot: 0,
    committed: [0, 0],                 // this street's chips per seat
    toAct: dealer,                     // heads-up: dealer first preflop
    lastRaise: BB,                     // min-raise anchor
    folded: null,
    acted: 0,
    allIn: [false, false],
    winner: null, reason: null, result: null,
  };
  post(g, dealer, Math.min(SB, g.stacks[dealer]));
  post(g, 1 - dealer, Math.min(BB, g.stacks[1 - dealer]));
  g.allIn = [g.stacks[0] === 0, g.stacks[1] === 0];
  if (g.allIn[0] || g.allIn[1]) maybeRunOut(g);
  return g;
}

function post(g, seat, amt) {
  g.stacks[seat] -= amt;
  g.committed[seat] += amt;
  g.pot += amt;
}

export function legalActions(g) {
  if (g.street === 'over' || g.street === 'showdown') return [];
  const me = g.toAct, them = 1 - me;
  if (g.allIn[me]) return [];
  const owe = g.committed[them] - g.committed[me];
  const acts = [];
  if (owe > 0) {
    acts.push({ type: 'fold' });
    acts.push({ type: 'call', amount: Math.min(owe, g.stacks[me]) });
  } else {
    acts.push({ type: 'check' });
  }
  if (g.stacks[me] > owe && !g.allIn[them]) {
    const minTo = g.committed[them] + g.lastRaise;             // raise TO at least this
    const maxTo = g.committed[me] + g.stacks[me];              // all-in TO
    if (maxTo > g.committed[them]) {
      acts.push({ type: owe > 0 ? 'raise' : 'bet', minTo: Math.min(minTo, maxTo), maxTo });
    }
  }
  return acts;
}

export function act(g, action) {
  const me = g.toAct, them = 1 - me;
  const owe = g.committed[them] - g.committed[me];
  if (g.acted == null) g.acted = 0;

  if (action.type === 'fold') { g.folded = me; settleFold(g); return g; }

  if (action.type === 'check') {
    if (owe !== 0) throw new Error('illegal check');
    g.acted++;
    if (g.acted >= 2) nextStreet(g); else g.toAct = them;
    return g;
  }

  if (action.type === 'call') {
    if (owe <= 0) throw new Error('nothing to call');
    const amt = Math.min(owe, g.stacks[me]);
    post(g, me, amt);
    if (g.stacks[me] === 0) g.allIn[me] = true;
    // called all-in short → refund the uncallable excess to the bettor
    const excess = g.committed[them] - g.committed[me];
    if (excess > 0 && g.allIn[me]) {
      g.committed[them] -= excess; g.stacks[them] += excess; g.pot -= excess;
      if (g.allIn[them]) g.allIn[them] = g.stacks[them] === 0;
    }
    g.acted++;
    // the ONE call that never closes: the preflop small-blind limp (BB keeps the option)
    const preflopLimp = g.street === 'preflop' && g.acted === 1 && !g.allIn[me] && !g.allIn[them];
    if (preflopLimp) g.toAct = them;
    else nextStreet(g);
    return g;
  }

  if (action.type === 'bet' || action.type === 'raise') {
    const legal = legalActions(g).find((a) => a.type === action.type);
    if (!legal) throw new Error('illegal ' + action.type);
    const to = Math.min(Math.max((action.to | 0) || legal.minTo, legal.minTo), legal.maxTo);
    const add = to - g.committed[me];
    g.lastRaise = Math.max(to - g.committed[them], BB);
    post(g, me, add);
    if (g.stacks[me] === 0) g.allIn[me] = true;
    g.acted++;
    g.toAct = them;
    return g;
  }
  throw new Error('unknown action: ' + action.type);
}

function nextStreet(g) {
  if (g.folded != null || g.street === 'over') return;
  if (g.allIn[0] || g.allIn[1]) { maybeRunOut(g); return; }
  g.committed = [0, 0];
  g.lastRaise = BB;
  g.acted = 0;
  if (g.street === 'preflop') { g.board.push(g.deck.shift(), g.deck.shift(), g.deck.shift()); g.street = 'flop'; }
  else if (g.street === 'flop') { g.board.push(g.deck.shift()); g.street = 'turn'; }
  else if (g.street === 'turn') { g.board.push(g.deck.shift()); g.street = 'river'; }
  else { showdown(g); return; }
  g.toAct = 1 - g.dealer;                              // postflop: non-dealer acts first
}
function maybeRunOut(g) {
  while (g.board.length < 5) g.board.push(g.deck.shift());
  showdown(g);
}
function showdown(g) {
  g.street = 'showdown';
  const s0 = score7([...g.hole[0], ...g.board]);
  const s1 = score7([...g.hole[1], ...g.board]);
  const c = cmpScore(s0, s1);
  if (c > 0) { g.winner = 0; g.reason = handName(s0); g.stacks[0] += g.pot; }
  else if (c < 0) { g.winner = 1; g.reason = handName(s1); g.stacks[1] += g.pot; }
  else {
    g.winner = 'chop'; g.reason = 'a chop — ' + handName(s0);
    const half = Math.floor(g.pot / 2);
    g.stacks[0] += half; g.stacks[1] += g.pot - half;
    if (g.pot % 2) { g.stacks[1] -= 1; g.stacks[1 - g.dealer] += 1; }   // odd chip off the button
  }
  g.result = { winner: g.winner, reason: g.reason, scores: [s0, s1] };
  g.pot = 0;
  g.street = 'over';
}

function settleFold(g) {
  const winner = 1 - g.folded;
  g.winner = winner; g.reason = 'the fold';
  g.stacks[winner] += g.pot;
  g.result = { winner, reason: 'fold' };
  g.pot = 0;
  g.street = 'over';
}
