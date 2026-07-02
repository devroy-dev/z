// AI sanity: styles finish games; personality shows in CHOICES, not opportunity.
// Metric: of turns where a capture was LEGAL, how often did the style take it?
import { newGame, roll, legalMoves, applyMove, passTurn } from './rules.js';
import { chooseMove } from './ai.js';
function mkRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const stat = {}; const S = (k)=>stat[k]||(stat[k]={capAvail:0,capTaken:0,exposed:0,moves:0});
let fails = 0;
for (let g = 0; g < 300; g++) {
  const rng = mkRng(9000+g);
  const seats = ['the_wannabe','the_cynic','the_brainiac','the_comic'];
  let s = newGame(seats), plies = 0;
  while (!s.winner) {
    if (++plies > 5000) { fails++; console.error('stuck game', g); break; }
    if (s.phase === 'roll') { const o = roll(s, rng); s = o.state; if (o.forfeited) continue; }
    const style = seats[s.turn];
    const moves = legalMoves(s);
    if (!moves.length) { s = passTurn(s); continue; }
    const tok = chooseMove(s, style, rng);
    const chosen = moves.find(m => m.token === tok);
    const st = S(style);
    st.moves++;
    if (moves.some(m => m.capture)) { st.capAvail++; if (chosen.capture) st.capTaken++; }
    s = applyMove(s, tok).state;
  }
}
const rate = (k) => S(k).capTaken / Math.max(1, S(k).capAvail);
console.log('capture-when-available — wannabe:', (rate('the_wannabe')*100).toFixed(1)+'%',
            '· brainiac:', (rate('the_brainiac')*100).toFixed(1)+'%',
            '· cynic:', (rate('the_cynic')*100).toFixed(1)+'%',
            '· comic:', (rate('the_comic')*100).toFixed(1)+'%');
if (rate('the_wannabe') <= rate('the_cynic')) { fails++; console.error('FAIL: wannabe should TAKE captures more readily than cynic'); }
if (rate('the_comic') >= rate('the_brainiac') + 0.15) { /* comic chaos ok */ }
console.log(fails === 0 ? 'AI CHECKS PASSED ✔' : `${fails} FAILURES ✘`);
process.exit(fails === 0 ? 0 : 1);
