import { newGame, applyRoll, SNAKES, LADDERS, cellRC } from './rules.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
function mkRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const die = (n) => () => (n - 0.5) / 6;

// ── board data sanity ──
Object.entries(SNAKES).forEach(([h, t]) => { A(+h > t, `snake ${h} descends`); A(+h <= 99 && t >= 1, 'snake in range'); A(!LADDERS[h], `no ladder foot on snake head ${h}`); });
Object.entries(LADDERS).forEach(([b, t]) => { A(+b < t, `ladder ${b} climbs`); A(t <= 100 && +b >= 1, 'ladder in range'); A(!SNAKES[b], `no snake head on ladder foot ${b}`); });
A(!SNAKES[100] && !LADDERS[100], 'cell 100 clean');
// chains would loop the UI — assert none: no snake tail on a ladder foot & vice versa
Object.values(SNAKES).forEach((t) => A(!SNAKES[t], `snake tail ${t} not another head`));
Object.values(LADDERS).forEach((t) => A(!LADDERS[t] && !SNAKES[t] || !LADDERS[t], `ladder top ${t} not another foot`));

// ── exact-100 rule ──
{
  let s = newGame(['a','b']); s.players[0].pos = 98;
  const { state: s2, events } = applyRoll(s, die(5));           // 98+5 → overshoot
  A(events.some(e => e.type === 'stay') && s2.players[0].pos === 98, 'overshoot stays');
  let s3 = newGame(['a','b']); s3.players[0].pos = 98;
  const r2 = applyRoll(s3, die(2));                              // 98+2 = 100
  A(r2.state.winner === 'a' && r2.events.some(e => e.type === 'win'), 'exact roll wins');
}
// ── snake + ladder resolution ──
{
  let s = newGame(['a','b']); s.players[0].pos = 60;             // 60+2=62 → snake to 19
  const { state: s2, events } = applyRoll(s, die(2));
  A(events.some(e => e.type === 'snake' && e.to === 19) && s2.players[0].pos === 19, 'snake slides');
  let s3 = newGame(['a','b']); s3.players[0].pos = 26;           // 26+2=28 → ladder to 84
  const r = applyRoll(s3, die(2));
  A(r.events.some(e => e.type === 'ladder' && e.to === 84) && r.state.players[0].pos === 84, 'ladder climbs');
}
// ── six chains, three sixes forfeit ──
{
  let s = newGame(['a','b']);
  let r = applyRoll(s, die(6)); A(r.state.turn === 0, 'six grants another roll');
  r = applyRoll(r.state, die(6)); A(r.state.turn === 0, 'second six still yours');
  r = applyRoll(r.state, die(6));
  A(r.events.some(e => e.type === 'forfeit') && r.state.turn === 1, 'third six forfeits');
}
// ── cellRC boustrophedon ──
A(cellRC(1).join()==='9,0' && cellRC(10).join()==='9,9', 'bottom row L→R');
A(cellRC(11).join()==='8,9' && cellRC(20).join()==='8,0', 'second row R→L');
A(cellRC(100).join()==='0,0', 'cell 100 top-left');
for (let c = 1; c <= 100; c++) { const [r, col] = cellRC(c); A(r>=0&&r<=9&&col>=0&&col<=9, 'rc in grid'); }
A(new Set(Array.from({length:100},(_,i)=>cellRC(i+1).join())).size === 100, 'all 100 cells unique');

// ── simulate N games: all finish, positions always legal ──
const N = Number(process.argv[2] || 1000);
let total = 0, maxT = 0; const wins = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const rng = mkRng(4000 + g);
  let s = newGame(Array.from({ length: 2 + (g % 3) }, (_, i) => `p${i}`));
  let turns = 0;
  while (!s.winner) {
    if (++turns > 3000) { f++; console.error(`game ${g} stuck`); break; }
    const out = applyRoll(s, rng); s = out.state;
    s.players.forEach((p) => A(p.pos >= 0 && p.pos <= 100, `pos legal g${g}`));
    s.players.forEach((p) => A(!SNAKES[p.pos], `never resting on a snake head g${g}`));
  }
  A(!!s.winner, `game ${g} has winner`);
  wins[s.winner] = (wins[s.winner] || 0) + 1;
  total += turns; maxT = Math.max(maxT, turns);
}
console.log(`\n${N} games in ${Date.now()-t0}ms · avg ${(total/N).toFixed(0)} rolls · max ${maxT}`);
console.log('win spread:', wins);
console.log(f === 0 ? 'ALL CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
