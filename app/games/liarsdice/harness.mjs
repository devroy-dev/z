// LIAR'S DICE HARNESS: 300 full games, 4 seats. Laws proven: bids only ever
// climb (re-checked independently) · reveal math correct (actual count
// recomputed) · the right player loses the right die · dice totals only
// ever decrease by exactly 1 per reveal · games terminate with one winner.
import { newGame, rollRound, placeBid, callLiar, totalDice, legalBids } from './engine.js';
import { decide, chance } from './ai.js';

const styles = ['calculator', 'gambler', 'guardian', 'chaos', 'smooth', 'steady'];
let reveals = 0, truthCalls = 0, lieCalls = 0, maxRounds = 0;

for (let game = 0; game < 300; game++) {
  const g = newGame(4);
  let guard = 0;
  while (g.phase !== 'over') {
    rollRound(g);
    const before = totalDice(g);
    let steps = 0;
    while (g.phase === 'bidding') {
      if (++steps > 400) { console.error('✘ endless bidding', game); process.exit(1); }
      const seat = g.toAct;
      const d = decide(g, seat, styles[(seat + game) % 6]);
      if (d.type === 'bid') {
        const prev = g.bid ? { ...g.bid } : null;
        placeBid(g, seat, d.qty, d.face);
        if (prev && !(d.qty > prev.qty || (d.qty === prev.qty && d.face > prev.face))) {
          console.error('✘ non-climbing bid accepted', game); process.exit(1);
        }
        if (d.qty > before) { console.error('✘ bid above table dice', game); process.exit(1); }
      } else {
        if (!g.bid) { const lb = legalBids(g); placeBid(g, seat, lb[0].qty, lb[0].face); continue; }
        const claimed = { ...g.bid };
        callLiar(g, seat);
        reveals++;
        const actual = g.cups.flat().filter((x) => x === claimed.face).length;
        if (actual !== g.lastResult.actual) { console.error('✘ reveal count wrong', game); process.exit(1); }
        const expectLoser = actual >= claimed.qty ? g.lastResult.caller : claimed.by;
        if (g.lastResult.loser !== expectLoser) { console.error('✘ wrong player lost the die', game); process.exit(1); }
        if (g.lastResult.truthful) truthCalls++; else lieCalls++;
      }
    }
    const after = totalDice(g);
    if (g.phase !== 'over' && after !== before - 1) { console.error('✘ dice not conserved-minus-one', before, after, game); process.exit(1); }
    if (++guard > 300) { console.error('✘ endless game', game); process.exit(1); }
    maxRounds = Math.max(maxRounds, g.round);
  }
  if (g.winner == null || g.out[g.winner]) { console.error('✘ no valid winner', game); process.exit(1); }
}
// sanity on the probability core
const fake = { cups: [[2, 3, 3], [], [], []], dice: [3, 3, 3, 3], out: [false, false, false, false] };
const p1 = chance(fake, 0, 2, 3);   // have 2 already → certainty
if (p1 !== 1) { console.error('✘ chance() certainty broken'); process.exit(1); }
console.log(`LIAR'S DICE HARNESS PASSED ✔  300 games · reveals ${reveals} (bid stood ${truthCalls} / caught lying ${lieCalls}) · longest game ${maxRounds} rounds`);
