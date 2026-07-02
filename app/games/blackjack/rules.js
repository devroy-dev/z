// ════════════════════════════════════════════════════════════════════════
//  yourZ — BLACKJACK rules engine. Pure JS, seedable, node-testable.
//  Home-table rules, play-money only (Arena law):
//   • 4-deck shoe, reshuffled each round (simple + honest for a home game)
//   • dealer STANDS on all 17s (S17), hole card hidden until players done
//   • blackjack pays 3:2 · win 1:1 · push returns the bet · no insurance
//   • double on any first two cards (one card, then stand)
//   • split equal RANKS, once per round; split aces get ONE card each;
//     21 after a split counts as 21, not blackjack
//  Multi-seat: several players vs the dealer (personas bet alongside you).
//
//  API:
//   newRound(seats:[{id,bet}], rng?) → state (phase 'act' | 'settle')
//   actions(state) → ['hit','stand','double','split'] for state.active hand
//   act(state, action, rng?) → { state, events }
//   settle(state, rng?) → { state, events, results:[{id,hand,delta}] }  (dealer plays)
//  Hands: { seat, cards, bet, done, bust, doubled, fromSplit, blackjack }
// ════════════════════════════════════════════════════════════════════════
import { freshDeck, shuffle } from '../cards/deck.js';

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 14) { total += 11; aces++; }
    else total += Math.min(c.r, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

const clone = (s) => JSON.parse(JSON.stringify(s));

export function newRound(seats, rng = Math.random) {
  if (!seats?.length || seats.length > 4) throw new Error('1-4 seats');
  seats.forEach((s) => { if (!(s.bet > 0)) throw new Error('every seat needs a bet'); });
  const shoe = shuffle(freshDeck(4), rng);
  const draw = () => shoe.pop();
  const hands = seats.map((s, i) => ({
    seat: i, id: s.id, cards: [draw(), draw()], bet: s.bet,
    done: false, bust: false, doubled: false, fromSplit: false, blackjack: false,
  }));
  const dealer = { cards: [draw(), draw()], revealed: false };   // cards[1] = hole
  hands.forEach((h) => { if (isBlackjack(h.cards)) { h.blackjack = true; h.done = true; } });
  const st = {
    shoe, hands, dealer,
    active: hands.findIndex((h) => !h.done),
    phase: 'act', splitUsed: {},
  };
  if (st.active === -1) st.phase = 'settle';
  return st;
}

export function actions(state) {
  if (state.phase !== 'act') return [];
  const h = state.hands[state.active];
  if (!h || h.done) return [];
  const a = ['hit', 'stand'];
  if (h.cards.length === 2 && !h.fromSplit) a.push('double');
  if (h.cards.length === 2 && h.cards[0].r === h.cards[1].r && !h.fromSplit && !state.splitUsed[h.seat]) a.push('split');
  if (h.fromSplit && h.cards.length === 2 && !state.splitUsed[`dbl${h.seat}`]) {
    if (!a.includes('double')) a.push('double');       // double after split allowed (house-friendly fun)
  }
  return a;
}

function advance(s) {
  const next = s.hands.findIndex((h, i) => i > s.active && !h.done);
  if (next !== -1) s.active = next;
  else {
    const any = s.hands.findIndex((h) => !h.done);
    if (any !== -1) s.active = any; else { s.phase = 'settle'; s.active = -1; }
  }
}

export function act(state, action, rng = Math.random) {
  if (state.phase !== 'act') throw new Error('not act phase');
  if (!actions(state).includes(action)) throw new Error(`illegal action ${action}`);
  const s = clone(state);
  const h = s.hands[s.active];
  const draw = () => s.shoe.pop();
  const events = [];

  if (action === 'hit') {
    const c = draw(); h.cards.push(c);
    events.push({ type: 'hit', seat: h.seat, card: c });
    const v = handValue(h.cards);
    if (v.total > 21) { h.bust = true; h.done = true; events.push({ type: 'bust', seat: h.seat, total: v.total }); advance(s); }
    else if (v.total === 21) { h.done = true; advance(s); }
  } else if (action === 'stand') {
    h.done = true; events.push({ type: 'stand', seat: h.seat, total: handValue(h.cards).total }); advance(s);
  } else if (action === 'double') {
    h.bet *= 2; h.doubled = true;
    const c = draw(); h.cards.push(c);
    events.push({ type: 'double', seat: h.seat, card: c, bet: h.bet });
    const v = handValue(h.cards);
    if (v.total > 21) { h.bust = true; events.push({ type: 'bust', seat: h.seat, total: v.total }); }
    h.done = true; advance(s);
  } else if (action === 'split') {
    s.splitUsed[h.seat] = true;
    const isAces = h.cards[0].r === 14;
    const twin = {
      seat: h.seat, id: h.id, cards: [h.cards.pop()], bet: h.bet,
      done: false, bust: false, doubled: false, fromSplit: true, blackjack: false,
    };
    h.fromSplit = true;
    h.cards.push(draw()); twin.cards.push(draw());
    events.push({ type: 'split', seat: h.seat });
    s.hands.splice(s.active + 1, 0, twin);
    if (isAces) {                                       // split aces: one card each, done
      h.done = true; twin.done = true;
      events.push({ type: 'splitAcesStand', seat: h.seat });
      advance(s);
    }
  }
  return { state: s, events };
}

// dealer plays (S17), then results
export function settle(state, rng = Math.random) {
  if (state.phase !== 'settle') throw new Error('players still acting');
  const s = clone(state);
  const events = [];
  s.dealer.revealed = true;
  events.push({ type: 'reveal', card: s.dealer.cards[1] });
  const anyLive = s.hands.some((h) => !h.bust && !h.blackjack);
  if (anyLive) {
    let v = handValue(s.dealer.cards);
    while (v.total < 17) {                              // S17: stand on ALL 17s
      const c = s.shoe.pop(); s.dealer.cards.push(c);
      events.push({ type: 'dealerHit', card: c });
      v = handValue(s.dealer.cards);
    }
    if (v.total > 21) events.push({ type: 'dealerBust', total: v.total });
  }
  const dv = handValue(s.dealer.cards);
  const dealerBJ = isBlackjack(s.dealer.cards);
  const results = s.hands.map((h) => {
    const pv = handValue(h.cards);
    let delta;
    if (h.blackjack) delta = dealerBJ ? 0 : Math.round(h.bet * 1.5);
    else if (h.bust) delta = -h.bet;
    else if (dealerBJ) delta = -h.bet;
    else if (dv.total > 21) delta = h.bet;
    else if (pv.total > dv.total) delta = h.bet;
    else if (pv.total < dv.total) delta = -h.bet;
    else delta = 0;
    return { seat: h.seat, id: h.id, bet: h.bet, total: pv.total, delta, blackjack: h.blackjack, bust: h.bust, doubled: h.doubled, fromSplit: h.fromSplit };
  });
  events.push({ type: 'results', results, dealerTotal: dv.total });
  s.phase = 'over'; s.results = results;
  return { state: s, events, results };
}
