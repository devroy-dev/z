import { newRound, actions, act, settle } from './rules.js';
import { chooseAction } from './ai.js';
import { mkRng } from '../cards/deck.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const styles = ['the_brainiac', 'the_wannabe', 'the_cynic'];
const net = { the_brainiac: 0, the_wannabe: 0, the_cynic: 0 };
const N = 4000;
for (let g = 0; g < N; g++) {
  const rng = mkRng(3000 + g);
  let st = newRound(styles.map((s) => ({ id: s, bet: 100 })), rng);
  let guard = 0;
  while (st.phase === 'act') {
    if (++guard > 60) { f++; break; }
    const who = st.hands[st.active].id;
    const a = chooseAction(st, who, rng);
    st = act(st, a, rng).state;
  }
  const { results } = settle(st, rng);
  results.forEach((r) => { net[r.id] += r.delta; });
}
const edge = (k) => (net[k] / (N * 100)) * 100;
console.log(`edges over ${N} rounds — brainiac ${edge('the_brainiac').toFixed(1)}% · wannabe ${edge('the_wannabe').toFixed(1)}% · cynic ${edge('the_cynic').toFixed(1)}%`);
A(edge('the_brainiac') > edge('the_wannabe'), 'the calculator outplays the chaser');
A(edge('the_brainiac') > -4, 'brainiac near-basic strategy (better than -4%)');
A(edge('the_wannabe') < -3, 'the wannabe bleeds chips (in character)');
console.log(f === 0 ? 'AI CHECKS PASSED ✔' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
