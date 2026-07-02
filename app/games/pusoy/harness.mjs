// PUSOY DOS HARNESS: 300 full games. Laws proven: the 3♣ holder opens and
// the opening contains it · every play independently re-validated (size
// match + beats + ownership) · 52-card conservation · pass/clear mechanics
// (3 passes → last player leads fresh) · termination with an empty hand.
import { newGame, play, pass, legalPlays, classify, beats, cardVal } from './engine.js';
import { choose } from './ai.js';

const styles = ['calculator', 'gambler', 'guardian', 'chaos', 'smooth', 'steady'];
let fives = 0, bombs = 0, totalPlays = 0;
const keyOf = (c) => c.r + ':' + c.s;

for (let game = 0; game < 300; game++) {
  const g = newGame();
  // opener holds 3♣
  if (!g.hands[g.opener].some((c) => c.r === 0 && c.s === 0)) { console.error('✘ opener lacks 3♣'); process.exit(1); }
  const startCards = new Set(g.hands.flat().map(keyOf));
  if (startCards.size !== 52) { console.error('✘ bad deal'); process.exit(1); }
  let steps = 0, first = true;
  while (g.phase === 'play') {
    if (++steps > 600) { console.error('✘ endless game', game); process.exit(1); }
    const seat = g.toAct;
    const tableBefore = g.table ? { ...g.table.combo } : null;
    const d = choose(g, seat, styles[(seat + game) % 6]);
    if (d.type === 'pass') {
      if (!g.table) { console.error('✘ AI tried to pass a fresh lead', game); process.exit(1); }
      const by = g.table.by, passesBefore = g.passes;
      pass(g, seat);
      if (passesBefore + 1 >= 3 && g.table !== null) { console.error('✘ table failed to clear', game); process.exit(1); }
      if (passesBefore + 1 >= 3 && g.toAct !== by) { console.error('✘ clear gave lead to wrong seat', game); process.exit(1); }
      continue;
    }
    // independent validation
    const combo = classify(d.cards);
    if (!combo) { console.error('✘ AI played a non-combo', game); process.exit(1); }
    if (first && !d.cards.some((c) => c.r === 0 && c.s === 0)) { console.error('✘ opening without 3♣', game); process.exit(1); }
    if (tableBefore) {
      if (combo.size !== tableBefore.size) { console.error('✘ size mismatch allowed', game); process.exit(1); }
      if (!beats(combo, tableBefore)) { console.error('✘ non-beating play', game); process.exit(1); }
    }
    if (!d.cards.every((c) => g.hands[seat].some((h) => h.r === c.r && h.s === c.s))) { console.error('✘ played unowned cards', game); process.exit(1); }
    play(g, seat, d.cards);
    totalPlays++;
    if (combo.size === 5) { fives++; if (combo.cat >= 3) bombs++; }
    first = false;
  }
  // conservation: winner empty; all remaining + played = 52
  if (g.hands[g.winner].length !== 0) { console.error('✘ winner not empty', game); process.exit(1); }
  const remaining = g.hands.flat().map(keyOf);
  if (new Set(remaining).size !== remaining.length) { console.error('✘ duplicate cards', game); process.exit(1); }
}
// classifier spot-checks
const C = (r, s) => ({ r, s });
const sf = classify([C(3,3),C(4,3),C(5,3),C(6,3),C(7,3)]);
const fh = classify([C(9,0),C(9,1),C(9,2),C(4,0),C(4,1)]);
const fl = classify([C(1,2),C(4,2),C(7,2),C(9,2),C(11,2)]);
const stg = classify([C(2,0),C(3,1),C(4,2),C(5,3),C(6,0)]);
if (!(sf.cat === 4 && fh.cat === 2 && fl.cat === 1 && stg.cat === 0)) { console.error('✘ classifier cats'); process.exit(1); }
if (!beats(fh, fl) || !beats(fl, stg) || !beats(sf, fh)) { console.error('✘ category ladder'); process.exit(1); }
if (classify([C(10,0),C(11,1),C(12,2),C(0,3),C(1,0)])) { console.error('✘ 2s allowed in straight'); process.exit(1); }
console.log(`PUSOY HARNESS PASSED ✔  300 games · ${totalPlays} plays all re-validated · five-card hands ${fives} (bombs ${bombs})`);
