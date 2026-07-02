// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO rules engine. Pure JS, seedable, node-testable. Replaces the
//  rules-in-UI implementation (audited: racy, deck-duplicating, unverifiable).
//  Official-leaning house rules:
//   • 108-card deck: per color 1×0, 2×(1-9), 2×skip, 2×reverse, 2×+2; 4 wild, 4 wild+4
//   • when the draw pile empties, the DISCARD (minus its top) reshuffles — the
//     economy is closed; cards never duplicate
//   • no legal card → draw ONE; if the drawn card is playable you MAY play it,
//     else turn passes
//   • +2 / +4: victim draws and is skipped · reverse in 2p acts as skip
//   • first discard is never a wild/action (redrawn)
//   • winner = first empty hand; a final +2/+4 still makes the victim draw
//  Cards: { c: 'R'|'G'|'B'|'Y'|'W', v: '0'-'9'|'skip'|'rev'|'d2'|'wild'|'wd4' }
//
//  API (pure; state in → state out):
//   newGame(ids, rng?) → state
//   legalIdxs(state, seat) → number[]                (hand indexes playable now)
//   playCard(state, seat, handIdx, wildColor?) → { state, events }
//   drawCard(state, seat) → { state, events, drawnPlayable }  (phase→'drawn' if playable)
//   playDrawn(state, seat, wildColor?) / keepDrawn(state, seat) → { state, events }
// ════════════════════════════════════════════════════════════════════════
import { shuffle } from '../cards/deck.js';

export const COLORS = ['R', 'G', 'B', 'Y'];

export function makeDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push({ c, v: '0' });
    for (let n = 1; n <= 9; n++) { d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
    for (const a of ['skip', 'rev', 'd2']) { d.push({ c, v: a }); d.push({ c, v: a }); }
  }
  for (let i = 0; i < 4; i++) { d.push({ c: 'W', v: 'wild' }); d.push({ c: 'W', v: 'wd4' }); }
  return d;                                          // 108
}

export const canPlay = (card, top, activeColor) =>
  card.c === 'W' || card.c === activeColor || card.v === top.v;

const clone = (s) => JSON.parse(JSON.stringify(s));

export function newGame(ids, rng = Math.random) {
  if (!ids || ids.length < 2 || ids.length > 4) throw new Error('uno needs 2-4 players');
  let deck = shuffle(makeDeck(), rng);
  const hands = ids.map(() => deck.splice(0, 7));
  let top = deck.shift();
  while (top.c === 'W' || ['skip', 'rev', 'd2'].includes(top.v)) { deck.push(top); top = deck.shift(); }
  return {
    ids, hands, deck,
    discard: [top],
    activeColor: top.c,
    turn: 0, dir: 1,
    phase: 'play',                 // 'play' | 'drawn' | 'over'
    drawnIdx: null,                // index of the just-drawn playable card (phase 'drawn')
    winner: null,
    history: 0,
  };
}

const top = (s) => s.discard[s.discard.length - 1];

function refillIfNeeded(s, rng) {
  if (s.deck.length > 0) return;
  if (s.discard.length <= 1) return;                 // nothing to recycle (pathological; draw becomes no-op)
  const keep = s.discard.pop();
  s.deck = shuffle(s.discard, rng);
  s.discard = [keep];
}

function drawN(s, seat, n, rng, events) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    refillIfNeeded(s, rng);
    if (!s.deck.length) break;                       // economy exhausted — extremely rare, sim-proven
    s.hands[seat].push(s.deck.shift());
    got++;
  }
  if (got) events.push({ type: 'draw', seat, n: got });
  return got;
}

const nextSeat = (s, from, step = 1) => {
  const N = s.ids.length;
  return ((from + s.dir * step) % N + N) % N;
};

export function legalIdxs(state, seat) {
  if (state.phase !== 'play' || state.turn !== seat) return [];
  const t = top(state);
  return state.hands[seat].map((c, i) => (canPlay(c, t, state.activeColor) ? i : -1)).filter((i) => i >= 0);
}

function resolvePlay(s, seat, card, wildColor, rng, events) {
  s.discard.push(card);
  s.activeColor = card.c === 'W' ? wildColor : card.c;
  events.push({ type: 'play', seat, card, color: s.activeColor });
  const remaining = s.hands[seat].length;
  if (remaining === 1) events.push({ type: 'uno', seat });

  if (card.v === 'rev') { s.dir = -s.dir; events.push({ type: 'reverse', dir: s.dir }); }

  // victim of +2/+4 draws even if this was the winning card (official)
  if (card.v === 'd2' || card.v === 'wd4') {
    const victim = nextSeat(s, seat);
    drawN(s, victim, card.v === 'd2' ? 2 : 4, rng, events);
    events.push({ type: 'skipped', seat: victim });
  }

  if (remaining === 0) {
    s.winner = s.ids[seat]; s.phase = 'over';
    events.push({ type: 'win', seat });
    return;
  }

  let step = 1;
  const twoP = s.ids.length === 2;
  if (card.v === 'skip') { step = 2; events.push({ type: 'skipped', seat: nextSeat(s, seat) }); }
  else if (card.v === 'd2' || card.v === 'wd4') step = 2;
  else if (card.v === 'rev' && twoP) step = 2;       // 2p: reverse = skip
  s.turn = nextSeat(s, seat, step);
  s.phase = 'play'; s.drawnIdx = null;
  s.history += 1;
}

export function playCard(state, seat, handIdx, wildColor, rng = Math.random) {
  if (state.phase !== 'play') throw new Error('not play phase');
  if (state.turn !== seat) throw new Error('not your turn');
  const s = clone(state);
  const card = s.hands[seat][handIdx];
  if (!card) throw new Error('bad hand index');
  if (!canPlay(card, top(s), s.activeColor)) throw new Error('illegal card');
  if (card.c === 'W' && !COLORS.includes(wildColor)) throw new Error('wild needs a color');
  s.hands[seat].splice(handIdx, 1);
  const events = [];
  resolvePlay(s, seat, card, wildColor, rng, events);
  return { state: s, events };
}

export function drawCard(state, seat, rng = Math.random) {
  if (state.phase !== 'play') throw new Error('not play phase');
  if (state.turn !== seat) throw new Error('not your turn');
  if (legalIdxs(state, seat).length) throw new Error('you have a playable card');   // draw only when stuck
  const s = clone(state);
  const events = [];
  const got = drawN(s, seat, 1, rng, events);
  if (!got) {                                        // economy truly empty: pass
    s.turn = nextSeat(s, seat); s.history += 1;
    return { state: s, events, drawnPlayable: false };
  }
  const idx = s.hands[seat].length - 1;
  const playable = canPlay(s.hands[seat][idx], top(s), s.activeColor);
  if (playable) { s.phase = 'drawn'; s.drawnIdx = idx; }
  else { s.turn = nextSeat(s, seat); s.history += 1; }
  return { state: s, events, drawnPlayable: playable };
}

export function playDrawn(state, seat, wildColor, rng = Math.random) {
  if (state.phase !== 'drawn' || state.turn !== seat) throw new Error('no drawn card pending');
  const s = clone(state);
  const idx = s.drawnIdx;
  const card = s.hands[seat][idx];
  if (card.c === 'W' && !COLORS.includes(wildColor)) throw new Error('wild needs a color');
  s.hands[seat].splice(idx, 1);
  const events = [{ type: 'playDrawn', seat }];
  resolvePlay(s, seat, card, wildColor, rng, events);
  return { state: s, events };
}

export function keepDrawn(state, seat) {
  if (state.phase !== 'drawn' || state.turn !== seat) throw new Error('no drawn card pending');
  const s = clone(state);
  s.phase = 'play'; s.drawnIdx = null;
  s.turn = nextSeat(s, seat); s.history += 1;
  return { state: s, events: [{ type: 'keep', seat }] };
}

export function winnerOf(state) { return state.winner; }
export const _internals = { top, nextSeat };
