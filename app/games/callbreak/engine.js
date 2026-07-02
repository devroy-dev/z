// ════════════════════════════════════════════════════════════════════════
//  yourZ — CALLBREAK ENGINE. Four players, 13 tricks, spades always trump.
//  THE rule that makes it Callbreak: you must try to HEAD the trick —
//  follow suit and beat the best if you can; void in the led suit, you
//  must overtrump if you can. Scoring: make your call → call + 0.1 per
//  extra trick; miss → minus your call. Five rounds, highest total wins.
//  Deterministic throughout; the harness proves every law.
//  Card: { r: 2..14, s: 0..3 }  ·  suit 0 = SPADES (trump)
// ════════════════════════════════════════════════════════════════════════
export const SPADE = 0;
export const N = 4;

export function dealRound(rnd = Math.random) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  hands.forEach((h) => h.sort((a, b) => (a.s - b.s) || (b.r - a.r)));
  return hands;
}

export function newRound(hands, leader) {
  return {
    hands: hands.map((h) => h.slice()),
    bids: [null, null, null, null],
    tricks: [0, 0, 0, 0],
    trick: [],                     // [{seat, card}]
    leader, toPlay: leader,
    phase: 'bidding',              // bidding | play | over
    toBid: leader,
    history: [],
  };
}

export function placeBid(g, seat, bid) {
  if (g.phase !== 'bidding' || seat !== g.toBid) throw new Error('not your bid');
  const b = Math.max(1, Math.min(8, bid | 0));
  g.bids[seat] = b;
  const nxt = (seat + 1) % N;
  if (g.bids[nxt] != null) { g.phase = 'play'; g.toPlay = g.leader; }
  else g.toBid = nxt;
  return g;
}

function trickBest(trick) {
  // returns index in trick[] of the current winner
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const a = trick[best].card, b = trick[i].card;
    const led = trick[0].card.s;
    const aP = a.s === SPADE ? 100 + a.r : a.s === led ? a.r : 0;
    const bP = b.s === SPADE ? 100 + b.r : b.s === led ? b.r : 0;
    if (bP > aP) best = i;
  }
  return best;
}

export function legalCards(g, seat) {
  if (g.phase !== 'play' || seat !== g.toPlay) return [];
  const hand = g.hands[seat];
  if (g.trick.length === 0) return hand.slice();               // any lead
  const led = g.trick[0].card.s;
  const bestI = trickBest(g.trick);
  const bestCard = g.trick[bestI].card;
  const inSuit = hand.filter((c) => c.s === led);
  if (inSuit.length) {
    // must HEAD if possible (unless the trick is already spaded and led isn't spades)
    const spaded = led !== SPADE && bestCard.s === SPADE;
    if (spaded) return inSuit;                                  // can't beat a trump in-suit; any follow
    const beaters = inSuit.filter((c) => c.r > bestCard.r);
    return beaters.length ? beaters : inSuit;
  }
  // void in led suit: must overtrump if possible
  const spades = hand.filter((c) => c.s === SPADE);
  if (spades.length) {
    if (bestCard.s === SPADE) {
      const over = spades.filter((c) => c.r > bestCard.r);
      return over.length ? over : hand.slice();                 // can't overtrump → anything
    }
    return spades;                                              // must trump
  }
  return hand.slice();
}

export function playCard(g, seat, card) {
  const legal = legalCards(g, seat);
  if (!legal.find((c) => c.r === card.r && c.s === card.s)) throw new Error('illegal card');
  g.hands[seat] = g.hands[seat].filter((c) => !(c.r === card.r && c.s === card.s));
  g.trick.push({ seat, card });
  if (g.trick.length === N) {
    const w = g.trick[trickBest(g.trick)].seat;
    g.tricks[w]++;
    g.history.push({ trick: g.trick.slice(), winner: w });
    g.trick = [];
    g.leader = w; g.toPlay = w;
    if (g.hands.every((h) => h.length === 0)) g.phase = 'over';
  } else {
    g.toPlay = (seat + 1) % N;
  }
  return g;
}

// round scores in tenths (integers ×10 to keep math exact): make = bid*10 + overtricks; miss = -bid*10
export function roundScores(g) {
  return g.bids.map((bid, i) => (g.tricks[i] >= bid ? bid * 10 + (g.tricks[i] - bid) : -bid * 10));
}
export const fmtScore = (tenths) => (tenths / 10).toFixed(1).replace(/\.0$/, '');
