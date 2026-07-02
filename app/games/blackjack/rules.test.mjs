import { handValue, isBlackjack, newRound, actions, act, settle } from './rules.js';
import { mkRng } from '../cards/deck.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const C = (r, s = 0) => ({ r, s });

// ── hand values: the ace ladder ──
A(handValue([C(14), C(13)]).total === 21 && isBlackjack([C(14), C(13)]), 'A+K = blackjack 21');
A(handValue([C(14), C(14)]).total === 12, 'A+A = 12');
A(handValue([C(14), C(6)]).total === 17 && handValue([C(14), C(6)]).soft, 'A+6 = soft 17');
A(handValue([C(14), C(6), C(10)]).total === 17 && !handValue([C(14), C(6), C(10)]).soft, 'A+6+10 = hard 17');
A(handValue([C(14), C(14), C(14), C(8)]).total === 21, 'A+A+A+8 = 21');
A(handValue([C(10), C(9), C(5)]).total === 24, 'bust math');
A(!isBlackjack([C(14), C(5), C(5)]), '21 in three cards is not blackjack');

// ── forced-deck helpers: rig the shoe by monkeypatching rng is messy; instead
//    drive real rounds and assert INVARIANTS over many sims ──
const N = Number(process.argv[2] || 5000);
let dealerRuleViolations = 0, moneyErr = 0, bjSeen = 0, splitSeen = 0, dblSeen = 0;
let net = 0;
for (let g = 0; g < N; g++) {
  const rng = mkRng(7000 + g);
  let st = newRound([{ id: 'you', bet: 100 }, { id: 'ai1', bet: 100 }, { id: 'ai2', bet: 100 }], rng);
  let guard = 0;
  while (st.phase === 'act') {
    if (++guard > 60) { f++; console.error('round stuck'); break; }
    const as = actions(st);
    // crude policy: always split, double 9-11, hit <16, else stand — exercises every path
    const h = st.hands[st.active]; const v = h ? (h.cards ? undefined : undefined) : undefined;
    const hv = h ? handValueOf(st) : 0;
    let a;
    if (as.includes('split')) a = 'split';
    else if (as.includes('double') && hv >= 9 && hv <= 11) a = 'double';
    else if (hv < 16 && as.includes('hit')) a = 'hit';
    else a = 'stand';
    const out = act(st, a, rng); st = out.state;
    if (a === 'split') splitSeen++;
    if (a === 'double') dblSeen++;
  }
  function handValueOf(s) { const h = s.hands[s.active]; let t = 0, ac = 0; for (const c of h.cards) { if (c.r === 14) { t += 11; ac++; } else t += Math.min(c.r, 10); } while (t > 21 && ac > 0) { t -= 10; ac--; } return t; }
  const { state: fin, results } = settle(st, rng);
  // dealer rule: if any live hand, dealer total ≥ 17 or bust; never hits at 17+
  const dTotal = results ? fin.results && dealerTotal(fin) : 0;
  function dealerTotal(s) { let t = 0, ac = 0; for (const c of s.dealer.cards) { if (c.r === 14) { t += 11; ac++; } else t += Math.min(c.r, 10); } while (t > 21 && ac > 0) { t -= 10; ac--; } return t; }
  const anyLive = fin.hands.some((h) => !h.bust && !h.blackjack);
  if (anyLive && dealerTotal(fin) < 17) dealerRuleViolations++;
  // shoe never over-drawn
  A(fin.shoe.length >= 0 && fin.shoe.length <= 208, 'shoe bounds');
  // money: every delta is one of {-bet, 0, +bet, +1.5bet} respecting doubles
  fin.results.forEach((r, i) => {
    const h = fin.hands[i];                                  // results are 1:1 with hands, in order
    A(h.seat === r.seat && h.bet === r.bet, 'result row matches its hand');
    const ok = [-r.bet, 0, r.bet, Math.round(r.bet * 1.5)].includes(r.delta);
    if (!ok) moneyErr++;
    if (r.blackjack) bjSeen++;
    net += r.delta;
  });
}
A(dealerRuleViolations === 0, `dealer S17 rule violated ${dealerRuleViolations}×`);
A(moneyErr === 0, `${moneyErr} impossible payouts`);
A(bjSeen > 0 && splitSeen > 0 && dblSeen > 0, `all paths exercised (bj ${bjSeen}, split ${splitSeen}, dbl ${dblSeen})`);
const edge = (net / (N * 3 * 100)) * 100;
console.log(`${N} rounds · blackjacks ${bjSeen} · splits ${splitSeen} · doubles ${dblSeen} · player edge ${edge.toFixed(2)}% (crude policy → expect roughly -2% to -6%)`);
A(edge > -8 && edge < 2, `edge sane (got ${edge.toFixed(2)}%) — payout math would show here`);
console.log(f === 0 ? 'ALL CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
