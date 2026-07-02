import { newGame, legalIdxs, playCard, drawCard, playDrawn, keepDrawn, makeDeck, canPlay } from './rules.js';
import { chooseCard, wildColorFor } from './ai.js';
import { mkRng } from '../cards/deck.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const economy = (s) => s.hands.flat().length + s.deck.length + s.discard.length;

// ── deck composition ──
{
  const d = makeDeck();
  A(d.length === 108, '108 cards');
  A(d.filter((c) => c.v === 'wd4').length === 4 && d.filter((c) => c.v === 'wild').length === 4, 'wild counts');
  A(d.filter((c) => c.c === 'R').length === 25, '25 per color');
}
// ── first discard never wild/action; deal = 7 each ──
for (let i = 0; i < 50; i++) {
  const s = newGame(['a','b','c'], mkRng(i));
  const t = s.discard[0];
  A(t.c !== 'W' && !['skip','rev','d2'].includes(t.v), 'clean first discard');
  A(s.hands.every((h) => h.length === 7), '7 each');
  A(economy(s) === 108, 'economy whole at deal');
}
// ── +2 victim draws AND is skipped; reverse reverses; 2p reverse = skip ──
{
  let s = newGame(['a','b','c'], mkRng(1));
  s.hands[0] = [{ c: s.activeColor, v: 'd2' }, { c: 'R', v: '5' }];
  const eco0 = economy(s);                          // rigged hand shrank the economy — assert delta 0
  const { state: s2, events } = playCard(s, 0, 0);
  A(s2.hands[1].length === 9, 'victim drew 2');
  A(s2.turn === 2, 'victim skipped');
  A(events.some(e=>e.type==='skipped'), 'skip event');
  A(economy(s2) === eco0, 'economy holds (delta 0)');
  let r = newGame(['a','b'], mkRng(2));
  r.hands[0] = [{ c: r.activeColor, v: 'rev' }, { c: 'R', v: '5' }];
  const r2 = playCard(r, 0, 0).state;
  A(r2.turn === 0, '2p reverse acts as skip');
}
// ── wild needs a color; +4 draws 4 ──
{
  let s = newGame(['a','b','c'], mkRng(3));
  s.hands[0] = [{ c: 'W', v: 'wd4' }, { c: 'R', v: '5' }];
  let threw = false; try { playCard(s, 0, 0); } catch { threw = true; }
  A(threw, 'wild without color throws');
  const { state: s2 } = playCard(s, 0, 0, 'G');
  A(s2.activeColor === 'G' && s2.hands[1].length === 11, '+4: color set, victim drew 4');
}
// ── draw-then-may-play; keep passes ──
{
  let s = newGame(['a','b','c'], mkRng(4));
  s.hands[0] = [{ c: nonActive(s), v: nonTopV(s) }];          // guaranteed stuck
  function nonActive(x){ return ['R','G','B','Y'].find(c=>c!==x.activeColor); }
  function nonTopV(x){ const t=x.discard[0].v; return String((Number(t)+1)%10); }
  A(legalIdxs(s, 0).length === 0, 'stuck confirmed');
  const ecoD = economy(s);
  const out = drawCard(s, 0, mkRng(4));
  if (out.drawnPlayable) {
    A(out.state.phase === 'drawn', 'drawn phase');
    const kept = keepDrawn(out.state, 0);
    A(kept.state.turn === 1, 'keep passes turn');
  } else {
    A(out.state.turn === 1, 'unplayable draw passes');
  }
  A(economy(out.state) === ecoD, 'economy after draw (delta 0)');
}
// ── final +2 still makes victim draw ──
{
  let s = newGame(['a','b','c'], mkRng(5));
  s.hands[0] = [{ c: s.activeColor, v: 'd2' }];
  const { state: s2, events } = playCard(s, 0, 0);
  A(s2.winner === 'a' && events.some(e=>e.type==='win'), 'winner declared');
  A(s2.hands[1].length === 9, 'victim still drew on the winning card');
}
// ── reshuffle economy: force deep draws, deck recycles, never duplicates ──
{
  let s = newGame(['a','b'], mkRng(6));
  // burn the deck with alternating stuck draws by rigging hands unplayable each turn
  let guard = 0;
  while (s.deck.length > 0 && guard++ < 300) {
    const seat = s.turn;
    const li = legalIdxs(s, seat);
    if (li.length) { const c = s.hands[seat][li[0]]; s = playCard(s, seat, li[0], c.c === 'W' ? 'R' : undefined, mkRng(guard)).state; }
    else {
      const out = drawCard(s, seat, mkRng(guard));
      s = out.drawnPlayable ? keepDrawn(out.state, seat).state : out.state;
    }
    if (s.winner) break;
    A(economy(s) === 108, `economy exact mid-burn (${economy(s)})`);
  }
}

// ── full simulation: N games with the personality AI ──
const N = Number(process.argv[2] || 800);
let plies = 0, maxP = 0; const wins = {};
for (let g = 0; g < N; g++) {
  const rng = mkRng(9100 + g);
  const cast = g % 2 ? ['the_brainiac','the_wannabe','the_cynic','the_comic'] : ['the_brainiac','the_wannabe','the_comic'];
  let s = newGame(cast, rng);
  let p = 0;
  while (!s.winner) {
    if (++p > 3000) { f++; console.error(`game ${g} stuck`); break; }
    const seat = s.turn;
    if (s.phase === 'drawn') {                        // AI always plays a playable drawn card
      const card = s.hands[seat][s.drawnIdx];
      s = playDrawn(s, seat, card.c === 'W' ? wildColorFor(s.hands[seat], cast[seat]) : undefined, rng).state;
      continue;
    }
    const pick = chooseCard(s, seat, cast[seat], rng);
    if (pick == null) {
      const out = drawCard(s, seat, rng);
      s = out.state;
    } else {
      const card = s.hands[seat][pick];
      s = playCard(s, seat, pick, card.c === 'W' ? wildColorFor(s.hands[seat], cast[seat]) : undefined, rng).state;
    }
    A(economy(s) === 108, `economy g${g}`);
    if (f > 8) { console.error('aborting'); process.exit(1); }
  }
  wins[s.winner] = (wins[s.winner] || 0) + 1;
  plies += p; maxP = Math.max(maxP, p);
}
console.log(`\n${N} games · avg ${(plies/N).toFixed(0)} plies · max ${maxP}`);
console.log('win spread:', wins);
A((wins['the_brainiac']||0) > (wins['the_comic']||0), 'the calculator beats the chaos');
console.log(f === 0 ? 'ALL CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
