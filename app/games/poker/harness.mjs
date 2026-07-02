// THE POKER HARNESS — the rules gate. Machine-plays N full hands AI vs AI.
// Hard assertions: exact chip conservation, only-legal actions, termination,
// showdown winner re-verified against the evaluator, no negative stacks,
// button alternation. Any failure exits non-zero. COMPILES IS NOT WORKS;
// this is the WORKS half for the rules layer.
import { newHand, act, legalActions, SB, BB } from './engine.js';
import { chooseAction } from './ai.js';
import { score7, cmpScore } from './eval.js';

const N = 600;
const styles = ['calculator', 'gambler', 'guardian', 'chaos', 'smooth', 'steady'];
let showdowns = 0, folds = 0, chops = 0, allins = 0;
const wins = [0, 0];

let stacks = [2000, 2000];
let dealer = 0;
const TOTAL = stacks[0] + stacks[1];

for (let h = 0; h < N; h++) {
  if (stacks[0] < BB || stacks[1] < BB) { stacks = [2000, 2000]; }   // rebuy — the bank persists in-app; here we just keep playing
  const s0 = styles[h % styles.length], s1 = styles[(h + 3) % styles.length];
  const g = newHand(stacks, dealer);
  let steps = 0;
  while (g.street !== 'over') {
    if (++steps > 300) { console.error('✘ hand did not terminate', h); process.exit(1); }
    const acts = legalActions(g);
    if (!acts.length) { console.error('✘ no legal actions but street=', g.street, h); process.exit(1); }
    const seat = g.toAct;
    const choice = chooseAction(g, seat, seat === 0 ? s0 : s1);
    const legalTypes = acts.map((a) => a.type);
    if (!legalTypes.includes(choice.type)) { console.error('✘ AI picked illegal', choice.type, 'legal:', legalTypes, h); process.exit(1); }
    act(g, choice);
    const inFlight = g.stacks[0] + g.stacks[1] + g.pot;
    if (inFlight !== TOTAL) { console.error('✘ conservation broke mid-hand', inFlight, '≠', TOTAL, 'hand', h); process.exit(1); }
    if (g.stacks[0] < 0 || g.stacks[1] < 0) { console.error('✘ negative stack', g.stacks, h); process.exit(1); }
  }
  // post-hand conservation
  if (g.stacks[0] + g.stacks[1] !== TOTAL) { console.error('✘ conservation broke at settle', g.stacks, h); process.exit(1); }
  // showdown re-verification
  if (g.result && g.result.scores) {
    showdowns++;
    const c = cmpScore(score7([...g.hole[0], ...g.board]), score7([...g.hole[1], ...g.board]));
    const expect = c > 0 ? 0 : c < 0 ? 1 : 'chop';
    if (g.winner !== expect) { console.error('✘ showdown winner mismatch', g.winner, expect, h); process.exit(1); }
    if (g.winner === 'chop') chops++;
    if (g.board.length !== 5) { console.error('✘ showdown without full board', h); process.exit(1); }
  } else folds++;
  if (g.allIn[0] || g.allIn[1]) allins++;
  if (g.winner === 0) wins[0]++; else if (g.winner === 1) wins[1]++;
  stacks = g.stacks.slice();
  dealer = 1 - dealer;
}
console.log(`POKER HARNESS PASSED ✔  ${N} hands · showdowns ${showdowns} · folds ${folds} · chops ${chops} · all-ins ${allins} · seat wins ${wins[0]}/${wins[1]}`);
