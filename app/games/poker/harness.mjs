// THE MULTIWAY POKER HARNESS. 5-handed, 500 hands, forced short stacks to
// storm side-pot scenarios. Hard assertions: EXACT conservation through
// layered awards, only-legal actions, termination, main-pot winner
// re-verified, no negative stacks, awards sum = pot. Exit non-zero on any.
import { newHand, act, legalActions, potTotal } from './engine.js';
import { chooseAction } from './ai.js';
import { score7, cmpScore } from './eval.js';

const N = 500, SEATS = 5;
const styles = ['calculator', 'gambler', 'guardian', 'chaos', 'smooth', 'steady'];
let showdowns = 0, foldouts = 0, sidepotHands = 0, maxPots = 0;

let stacks = [2000, 2000, 2000, 2000, 2000];
let dealer = 0;

for (let h = 0; h < N; h++) {
  // storm mode every 3rd hand: randomize short stacks to force multi-all-ins
  if (h % 3 === 0) stacks = stacks.map(() => 40 + Math.floor(Math.random() * 400));
  for (let i = 0; i < SEATS; i++) if (stacks[i] < 20) stacks[i] = 2000;
  const TOTAL = stacks.reduce((a, b) => a + b, 0);
  const g = newHand(stacks, dealer);
  let steps = 0;
  while (g.street !== 'over') {
    if (++steps > 500) { console.error('✘ no termination', h); process.exit(1); }
    const acts = legalActions(g);
    if (!acts.length) { console.error('✘ toAct has no legal actions', g.toAct, g.street, h); process.exit(1); }
    const seat = g.toAct;
    const choice = chooseAction(g, seat, styles[(seat + h) % styles.length]);
    if (!acts.map((a) => a.type).includes(choice.type)) { console.error('✘ illegal pick', choice.type, h); process.exit(1); }
    act(g, choice);
    const inFlight = g.stacks.reduce((a, b) => a + b, 0) + potTotal(g);
    if (inFlight !== TOTAL) { console.error('✘ conservation mid-hand', inFlight, TOTAL, h); process.exit(1); }
    if (g.stacks.some((s) => s < 0)) { console.error('✘ negative stack', g.stacks, h); process.exit(1); }
  }
  const settled = g.stacks.reduce((a, b) => a + b, 0);
  if (settled !== TOTAL) { console.error('✘ conservation at settle', settled, TOTAL, 'hand', h); process.exit(1); }
  if (g.results) {
    const awardSum = g.results.awards.reduce((a, b) => a + b, 0);
    const committed = g.totalCommit.reduce((a, b) => a + b, 0);
    if (awardSum !== committed) { console.error('✘ awards ≠ pot', awardSum, committed, h); process.exit(1); }
    if (g.results.scores) {
      showdowns++;
      if (g.results.pots.length > 1) sidepotHands++;
      maxPots = Math.max(maxPots, g.results.pots.length);
      // main-pot winner re-verify: best eval among that pot's eligibles
      const main = g.results.pots[g.results.pots.length - 1];
      for (const w of main.winners) {
        for (let i = 0; i < SEATS; i++) {
          if (g.folded[i] || g.results.scores[i] == null) continue;
          if (g.totalCommit[i] >= g.totalCommit[w] && cmpScore(g.results.scores[i], g.results.scores[w]) > 0) {
            console.error('✘ main pot winner beaten by eligible seat', i, h); process.exit(1);
          }
        }
      }
    } else foldouts++;
  }
  stacks = g.stacks.slice();
  dealer = (dealer + 1) % SEATS;
}
console.log(`MULTIWAY HARNESS PASSED ✔  ${N} hands · 5-handed · showdowns ${showdowns} · foldouts ${foldouts} · side-pot hands ${sidepotHands} · max pots in one hand ${maxPots}`);
