import { newGame, legalPlays, play, pass, challenge, noChallenge } from './rules.js';
import { chooseTurn, wantsChallenge } from './ai.js';
import { mkRng } from '../cards/deck.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const count52 = (s) => s.hands.flat().length + s.pile.reduce((a, p) => a + p.cards.length, 0);

// ── unit: deal covers the deck ──
{
  const s = newGame(['a','b','c'], mkRng(1));
  A(count52(s) === 52, 'all 52 dealt');
  A(Math.max(...s.hands.map(h=>h.length)) - Math.min(...s.hands.map(h=>h.length)) <= 1, 'even-ish deal');
}
// ── unit: leader must play; must follow rank; pass only after a claim ──
{
  const s = newGame(['a','b','c'], mkRng(2));
  A(legalPlays(s).canPass === false, 'leader cannot pass');
  let out = play(s, 0, [0], s.hands[0][0].r === 14 ? 14 : s.hands[0][0].r);
  A(out.state.phase === 'window', 'play opens the window');
  let s2 = noChallenge(out.state).state;
  A(s2.turn === 1 && legalPlays(s2).mustClaim === out.state.claimRank, 'rank in force for next seat');
  let threw = false;
  try { play(s2, 1, [0], out.state.claimRank === 2 ? 3 : 2); } catch { threw = true; }
  A(threw, 'cannot claim a different rank');
}
// ── unit: challenge on a LIE → liar picks up; on TRUTH → challenger picks up ──
{
  let s = newGame(['a','b','c'], mkRng(3));
  // force a known lie: seat 0 plays a card and claims a rank it is NOT
  const c0 = s.hands[0][0];
  const lieRank = c0.r === 14 ? 2 : c0.r + 1;
  let { state: w } = play(s, 0, [0], lieRank);
  const before = w.hands[0].length;
  const { state: r, events } = challenge(w, 1);
  A(events.find(e=>e.type==='challenge').lied === true, 'lie detected');
  A(r.hands[0].length === before + 1, 'liar picked up the pile');
  A(r.turn === 1, 'truth-caller leads');
  A(count52(r) === 52, 'conservation after challenge');
  // truth case
  let s3 = newGame(['a','b','c'], mkRng(4));
  const t0 = s3.hands[0][0];
  let { state: w3 } = play(s3, 0, [0], t0.r);
  const chBefore = w3.hands[1].length;
  const out3 = challenge(w3, 1);
  A(out3.events.find(e=>e.type==='challenge').lied === false, 'truth stands');
  A(out3.state.hands[1].length === chBefore + 1, 'challenger eats the pile');
  A(out3.state.turn === 0, 'honest player leads again');
}
// ── unit: all-pass burns the pile ──
{
  let s = newGame(['a','b','c'], mkRng(5));
  let { state: w } = play(s, 0, [0], s.hands[0][0].r);
  let p = noChallenge(w).state;
  p = pass(p, 1).state;
  const out = pass(p, 2);
  A(out.events.some(e=>e.type==='burn'), 'pile burns after all pass');
  A(out.state.pile.length === 0 && out.state.claimRank === null && out.state.turn === 0, 'last player leads fresh');
  A(count52(out.state) === 52 - 1, 'burned cards leave the economy');   // 1 card burned
}
// ── unit: final-play window — honest wins, lie is denied ──
{
  let s = newGame(['a','b','c'], mkRng(6));
  s.hands[0] = [s.hands[0][0]];                       // rig: one card left
  const cr = s.hands[0][0].r;
  let { state: w, events } = play(s, 0, [0], cr);
  A(events.some(e=>e.type==='lastCard'), 'last-card flagged');
  const win = noChallenge(w);
  A(win.state.winner === 'a', 'unchallenged final play wins');
  // challenged honest final play also wins
  let s2 = newGame(['a','b','c'], mkRng(7));
  s2.hands[0] = [s2.hands[0][0]];
  let w2 = play(s2, 0, [0], s2.hands[0][0].r).state;
  const res = challenge(w2, 2);
  A(res.state.winner === 'a' && res.events.some(e=>e.type==='win'), 'honest final play survives challenge → win');
  // lying final play denied
  let s3 = newGame(['a','b','c'], mkRng(8));
  s3.hands[0] = [s3.hands[0][0]];
  const lie = s3.hands[0][0].r === 14 ? 2 : s3.hands[0][0].r + 1;
  let w3 = play(s3, 0, [0], lie).state;
  const res3 = challenge(w3, 1);
  A(res3.state.winner === null && res3.events.some(e=>e.type==='winDenied'), 'lying final play denied');
  A(res3.state.hands[0].length > 0, 'liar holds cards again');
}

// ── simulation: N full AI games — termination, conservation, sane lengths ──
const N = Number(process.argv[2] || 500);
const styles3 = ['the_wannabe', 'the_cynic', 'the_brainiac'];
const styles4 = ['the_wannabe', 'the_cynic', 'the_brainiac', 'the_comic'];
let totalPlies = 0, maxPlies = 0; const wins = {}; let burned = 0;
for (let g = 0; g < N; g++) {
  const rng = mkRng(600 + g);
  const cast = g % 2 ? styles4 : styles3;
  let s = newGame(cast, rng);
  let expect = 52, plies = 0;
  while (!s.winner) {
    if (++plies > 4000) { f++; console.error(`game ${g} stuck`); break; }
    if (s.phase === 'play') {
      const seat = s.turn;
      const t = chooseTurn(s, seat, cast[seat], rng);
      if (t.action === 'pass') {
        const out = pass(s, seat);
        if (out.events.some(e=>e.type==='burn')) { expect -= out.events.find(e=>e.type==='burn').count; burned++; }
        s = out.state;
      } else {
        s = play(s, seat, t.cardIdxs, t.claimRank).state;
      }
    } else if (s.phase === 'window') {
      const others = s.ids.map((_, i) => i).filter((i) => i !== s.lastPlay.seat && s.hands[i].length > 0);
      const challenger = others.find((i) => wantsChallenge(s, i, cast[i], rng));
      s = (challenger != null ? challenge(s, challenger) : noChallenge(s)).state;
    }
    A(count52(s) === expect, `card conservation g${g} (have ${count52(s)}, expect ${expect})`);
    if (f > 10) { console.error('aborting'); process.exit(1); }
  }
  A(!!s.winner, `game ${g} has a winner`);
  A(s.hands[s.ids.indexOf(s.winner)].length === 0, 'winner hand empty');
  wins[s.winner] = (wins[s.winner] || 0) + 1;
  totalPlies += plies; maxPlies = Math.max(maxPlies, plies);
}
console.log(`\n${N} games · avg ${(totalPlies/N).toFixed(0)} plies · max ${maxPlies} · burns ${burned}`);
console.log('win spread:', wins);
console.log(f === 0 ? 'ALL CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
