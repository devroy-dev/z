import { newHand, available, act, sideshowReply } from './rules.js';
import { chooseMove, acceptSideshow, strength } from './ai.js';
import { score } from './eval.js';
import { mkRng } from '../cards/deck.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const money = (s) => s.players.reduce((a, p) => a + p.stack, 0) + s.pot;

// ── boot + deal ──
{
  const s = newHand([{id:'a',stack:1000},{id:'b',stack:1000},{id:'c',stack:1000}], {boot:10}, mkRng(1));
  A(s.pot === 30 && s.players.every((p) => p.stack === 990), 'boot posted');
  A(s.players.every((p) => p.cards.length === 3 && p.blind), '3 cards, all blind');
  A(money(s) === 3000, 'money whole');
}
// ── blind pays 1×, seen pays 2×; raise doubles the stake ──
{
  let s = newHand([{id:'a',stack:1000},{id:'b',stack:1000}], {boot:10}, mkRng(2));
  const mv = available(s);
  A(mv.some((m) => m.t==='bet' && m.amt===10 && !m.raise), 'blind flat = stake');
  A(mv.some((m) => m.t==='bet' && m.amt===20 && m.raise), 'blind raise = 2×');
  s = act(s, {t:'bet',amt:20,raise:true}).state;
  A(s.stake === 20, 'blind raise doubles stake');
  s = act(s, {t:'see'}).state;                          // b sees
  const mv2 = available(s);
  A(mv2.some((m)=>m.t==='bet'&&m.amt===40&&!m.raise), 'seen flat = 2× stake');
  A(mv2.some((m)=>m.t==='bet'&&m.amt===80&&m.raise), 'seen raise = 4×');
  s = act(s, {t:'bet',amt:80,raise:true}).state;
  A(s.stake === 40, 'seen raise sets stake to 2×');
  A(money(s) === 2000, 'money whole through raises');
}
// ── see doesn't spend the turn ──
{
  let s = newHand([{id:'a',stack:1000},{id:'b',stack:1000},{id:'c',stack:1000}], {boot:10}, mkRng(3));
  const t0 = s.turn;
  s = act(s, {t:'see'}).state;
  A(s.turn === t0 && !s.players[t0].blind, 'see keeps the turn');
}
// ── pack; last man standing wins unshown ──
{
  let s = newHand([{id:'a',stack:100},{id:'b',stack:100},{id:'c',stack:100}], {boot:10}, mkRng(4));
  s = act(s, {t:'pack'}).state;
  const out = act(s, {t:'pack'});
  A(out.state.winner === 'c' && out.events.some(e=>e.type==='win'&&e.unshown), 'last standing wins');
  A(money(out.state) === 300, 'pot delivered whole');
}
// ── show: better hand wins; tie → asker loses; costs stake(blind)/2×(seen) ──
{
  let s = newHand([{id:'a',stack:1000},{id:'b',stack:1000}], {boot:10}, mkRng(5));
  // rig hands deterministically
  s.players[0].cards = [{r:14,s:0},{r:14,s:1},{r:14,s:2}];   // trail aces
  s.players[1].cards = [{r:2,s:0},{r:5,s:1},{r:9,s:2}];
  s = act(s, {t:'see'}).state;
  const showMv = available(s).find((m)=>m.t==='show');
  A(showMv && showMv.amt === s.stake * 2, 'seen show costs 2× stake');
  const out = act(s, showMv);
  A(out.state.winner === 'a' && out.events.some(e=>e.type==='show'), 'better hand wins the show');
  A(money(out.state) === 2000, 'money whole at show');
  // tie → asker loses
  let t = newHand([{id:'a',stack:1000},{id:'b',stack:1000}], {boot:10}, mkRng(6));
  t.players[0].cards = [{r:14,s:0},{r:12,s:1},{r:3,s:2}];
  t.players[1].cards = [{r:14,s:1},{r:12,s:2},{r:3,s:3}];
  A(score(t.players[0].cards) === score(t.players[1].cards), 'rigged tie');
  const bMove = available(t).find((m)=>m.t==='bet'&&!m.raise);
  t = act(t, bMove).state;                              // a bets blind, turn → b
  const showB = available(t).find((m)=>m.t==='show');
  A(showB.amt === t.stake, 'blind show costs 1× stake');
  const res = act(t, showB);
  A(res.state.winner === 'a', 'tie → asker loses');
}
// ── sideshow: loser packs; tie → asker packs; decline continues ──
{
  let s = newHand([{id:'a',stack:1000},{id:'b',stack:1000},{id:'c',stack:1000}], {boot:10}, mkRng(7));
  s.players[0].cards = [{r:14,s:0},{r:14,s:1},{r:13,s:2}];   // pair aces
  s.players[1].cards = [{r:2,s:0},{r:7,s:1},{r:9,s:2}];      // junk
  s = act(s, {t:'see'}).state; s = act(s, available(s).find(m=>m.t==='bet'&&!m.raise)).state;   // a seen-chaals
  s = act(s, {t:'see'}).state;                                // b sees
  const ss = available(s).find((m)=>m.t==='sideshow');
  A(ss && ss.with === 0, 'sideshow offered against previous seen player');
  let out = act(s, ss);
  A(out.state.phase === 'sideshow', 'sideshow pending');
  const res = sideshowReply(out.state, true);
  A(res.events.some(e=>e.type==='sideshowResult'&&e.loser===1), 'weaker asker packs');
  A(res.state.players[1].packed, 'loser is out');
  A(money(res.state) === 3000, 'money whole after sideshow');
  // decline path
  let d = act(s, ss).state;
  const dec = sideshowReply(d, false);
  A(dec.events.some(e=>e.type==='sideshowDecline') && !dec.state.players[1].packed, 'decline continues play');
}
// ── blind cap forces see ──
{
  let s = newHand([{id:'a',stack:100000},{id:'b',stack:100000}], {boot:10}, mkRng(8));
  let ev = [];
  for (let i = 0; i < 8 && !ev.some(e=>e.type==='autoSee'); i++) {
    const m = available(s).find((x)=>x.t==='bet'&&!x.raise);
    const out = act(s, m); s = out.state; ev = ev.concat(out.events);
  }
  A(ev.some(e=>e.type==='autoSee'), 'blind cap auto-sees');
}

// ── simulation: N hands with the persona AI — money law at every ply ──
const N = Number(process.argv[2] || 1500);
const cast = ['the_wannabe','the_cynic','the_brainiac','the_comic'];
const net = Object.fromEntries(cast.map((c)=>[c,0]));
const stats = Object.fromEntries(cast.map((c)=>[c,{blindBets:0,packs:0,bluffWins:0,hands:0}]));
let plies = 0, maxP = 0, shows = 0, sideshows = 0, unshown = 0;
let strongerWins = 0, showdownsTotal = 0;
for (let g = 0; g < N; g++) {
  const rng = mkRng(5200 + g);
  let s = newHand(cast.map((id)=>({id,stack:100000})), {boot:10}, rng);
  const startMoney = money(s) + 0;
  let p = 0;
  while (s.phase !== 'over') {
    if (++p > 500) { f++; console.error(`hand ${g} stuck`); break; }
    if (s.phase === 'sideshow') {
      const to = s.pendingSideshow.to;
      s = sideshowReply(s, acceptSideshow(s, to, cast[to], rng)).state;
      sideshows++;
      continue;
    }
    const styleKey = cast[s.turn];
    const mv = chooseMove(s, styleKey, rng);
    const out = act(s, mv);
    out.events.forEach((e) => {
      if (e.type==='bet' && e.blind) stats[cast[e.seat]].blindBets++;
      if (e.type==='pack') stats[cast[e.seat]].packs++;
      if (e.type==='show') { shows++; showdownsTotal++; const w=out.state.winner; const l=out.events.find(x=>x.type==='win');
        if (l) { const winSeat=l.seat; const loseSeat = e.by===winSeat?e.against:e.by;
          if (score(out.state.players[winSeat].cards) >= score(out.state.players[loseSeat].cards)) strongerWins++; } }
      if (e.type==='win' && e.unshown) unshown++;
    });
    s = out.state;
    A(money(s) === startMoney, `money law g${g} (${money(s)} vs ${startMoney})`);
    if (f > 8) { console.error('aborting'); process.exit(1); }
  }
  cast.forEach((id, i) => { net[id] += s.players[i].stack - 100000 + 0; stats[id].hands++; });
  plies += p; maxP = Math.max(maxP, p);
}
console.log(`\n${N} hands · avg ${(plies/N).toFixed(1)} plies · max ${maxP} · shows ${shows} · sideshows ${sideshows} · folded-out pots ${unshown}`);
console.log('net chips:', Object.fromEntries(Object.entries(net).map(([k,v])=>[k, v])));
console.log('blind bets:', Object.fromEntries(cast.map((c)=>[c, stats[c].blindBets])));
A(strongerWins === showdownsTotal, 'every showdown paid the better hand');
A(stats['the_wannabe'].blindBets > stats['the_cynic'].blindBets * 3, 'the wannabe rides blind far more than the cynic');
A(net['the_brainiac'] > net['the_comic'], 'odds-player beats vibes-player');
console.log(f === 0 ? 'ALL CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
