// ════════════════════════════════════════════════════════════════════════
//  yourZ — CALLBREAK AI. Bids from honest hand-counting; plays from the
//  legal set with style-shaped judgment. Never free-forms a move.
// ════════════════════════════════════════════════════════════════════════
import { legalCards, SPADE } from './engine.js';

export function suggestBid(hand, styleKey = 'steady') {
  let pts = 0;
  const bySuit = [[], [], [], []];
  hand.forEach((c) => bySuit[c.s].push(c));
  for (let s = 0; s < 4; s++) {
    const rs = bySuit[s].map((c) => c.r).sort((a, b) => b - a);
    if (s === SPADE) {
      rs.forEach((r, i) => { if (r >= 13) pts += 1; else if (r >= 10 && i < 4) pts += 0.5; });
      if (rs.length >= 5) pts += (rs.length - 4) * 0.7;          // long trumps rule the room
    } else {
      if (rs[0] === 14) pts += 1;
      if (rs[0] === 13 || rs[1] === 13) pts += bySuit[s].length <= 2 ? 0.7 : 0.4;
      if (bySuit[s].length <= 1 && bySuit[SPADE].length >= 2) pts += 0.6;   // void/singleton + trumps
    }
  }
  const lean = { gambler: 0.6, chaos: 0.5, calculator: -0.2, guardian: -0.5, smooth: 0.1, steady: 0 }[styleKey] || 0;
  return Math.max(1, Math.min(8, Math.round(pts + lean)));
}

export function chooseCard(g, seat, styleKey = 'steady', rnd = Math.random) {
  const legal = legalCards(g, seat);
  if (!legal.length) return null;
  if (legal.length === 1) return legal[0];
  const need = g.bids[seat] != null ? g.bids[seat] - g.tricks[seat] : 1;
  const hungry = need > 0;
  const led = g.trick[0]?.card.s;
  const lowest = legal.slice().sort((a, b) => a.r - b.r)[0];
  const highest = legal.slice().sort((a, b) => b.r - a.r)[0];

  if (g.trick.length === 0) {
    // leading: hungry → lead strength (ace-first, or long spade); satisfied → dump low
    if (hungry) {
      const aces = legal.filter((c) => c.r === 14 && c.s !== SPADE);
      if (aces.length) return aces[Math.floor(rnd() * aces.length)];
      const bigSpade = legal.filter((c) => c.s === SPADE && c.r >= 12);
      if (bigSpade.length && rnd() < 0.5) return bigSpade[0];
      return legal.slice().sort((a, b) => b.r - a.r)[Math.floor(rnd() * Math.min(3, legal.length))];
    }
    return lowest;
  }
  // following: the engine already forces heading when possible;
  // among beaters pick the CHEAPEST that wins; when we can't win, dump lowest.
  const last = g.trick.length === 3;
  const winningNow = (c) => {
    const bestI = g.trick.reduce((bi, t, i) => {
      const a = g.trick[bi].card, b = t.card;
      const aP = a.s === SPADE ? 100 + a.r : a.s === led ? a.r : 0;
      const bP = b.s === SPADE ? 100 + b.r : b.s === led ? b.r : 0;
      return bP > aP ? i : bi;
    }, 0);
    const best = g.trick[bestI].card;
    const cP = c.s === SPADE ? 100 + c.r : c.s === led ? c.r : 0;
    const bP = best.s === SPADE ? 100 + best.r : best.s === led ? best.r : 0;
    return cP > bP;
  };
  const winners = legal.filter(winningNow);
  if (winners.length && (hungry || (last && rnd() < 0.3))) {
    return winners.sort((a, b) => (a.s === SPADE ? 100 + a.r : a.r) - (b.s === SPADE ? 100 + b.r : b.r))[0];
  }
  if (!hungry && winners.length < legal.length) {
    const losers = legal.filter((c) => !winningNow(c));
    return losers.sort((a, b) => b.r - a.r)[0];                 // shed the biggest safe card
  }
  return lowest;
}
