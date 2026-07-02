// ════════════════════════════════════════════════════════════════════════
//  yourZ — shared card primitives. Blackjack, Teen Patti, Poker, Rummy,
//  Callbreak all deal from HERE. Pure JS, seedable, node-testable.
//  A card is { r: 2..14, s: 0..3 }  (11=J 12=Q 13=K 14=A; s: ♠♥♦♣)
// ════════════════════════════════════════════════════════════════════════
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANK_NAME = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A' };
export const cardName = (c) => `${RANK_NAME[c.r]}${SUITS[c.s]}`;
export const isRed = (c) => c.s === 1 || c.s === 2;

export function freshDeck(nDecks = 1) {
  const d = [];
  for (let n = 0; n < nDecks; n++)
    for (let s = 0; s < 4; s++)
      for (let r = 2; r <= 14; r++) d.push({ r, s });
  return d;
}

// Fisher–Yates, injectable rng (sims are seedable, tables use Math.random)
export function shuffle(deck, rng = Math.random) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function mkRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
