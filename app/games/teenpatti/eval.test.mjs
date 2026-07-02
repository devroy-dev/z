import { score, evalHand, handName } from './eval.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const H = (a, b, c, s = [0, 1, 2]) => [{ r: a, s: s[0] }, { r: b, s: s[1] }, { r: c, s: s[2] }];
const suited = (a, b, c) => H(a, b, c, [0, 0, 0]);
const gt = (x, y, m) => A(score(x) > score(y), m);

// category ladder
gt(H(2,2,2), suited(14,13,12), 'lowest trail beats highest pure sequence');
gt(suited(4,3,2), H(14,13,12), 'lowest pure seq beats highest plain seq');
gt(H(4,3,2), suited(14,13,11), 'lowest seq beats highest color');
gt(suited(5,3,2), H(14,14,13), 'lowest color beats highest pair');
gt(H(2,2,3), H(14,13,11), 'lowest pair beats highest high-card');
// within trail
gt(H(14,14,14), H(13,13,13), 'AAA > KKK');
// sequence order: AKQ > A23 > KQJ > … > 432
gt(suited(14,13,12), suited(14,3,2), 'A-K-Q > A-2-3');
gt(suited(14,3,2), suited(13,12,11), 'A-2-3 > K-Q-J');
gt(suited(13,12,11), suited(12,11,10), 'K-Q-J > Q-J-10');
gt(H(14,13,12), H(14,3,2), 'plain: A-K-Q > A-2-3');
gt(H(14,3,2), H(13,12,11), 'plain: A-2-3 > K-Q-J');
// A-2-3 recognized as sequence at all
A(evalHand(H(14,3,2)).cat === 3, 'A-2-3 is a sequence');
A(evalHand(suited(14,3,2)).cat === 4, 'suited A-2-3 is pure');
// K-A-2 is NOT a sequence (no wraparound)
A(evalHand(H(14,13,2)).cat === 0, 'K-A-2 does not wrap');
// color compares ranks descending
gt(suited(14,9,5), suited(13,12,10), 'color: ace-high flush wins');
gt(suited(14,9,5), suited(14,9,4), 'color: third card breaks');
// pair: pair rank then kicker; middle-card trick
A(evalHand(H(9,9,4)).key.join() === '9,4', 'pair 9 kicker 4');
A(evalHand(H(14,9,9)).key.join() === '9,14', 'pair 9 kicker A (sorted desc input)');
gt(H(10,10,2), H(9,9,14), 'pair rank before kicker');
gt(H(9,9,14), H(9,9,13), 'kicker breaks equal pairs');
// high card chains
gt(H(14,12,3), H(14,11,10), 'second card breaks');
gt(H(14,12,4), H(14,12,3), 'third card breaks');
// true ties tie
A(score(H(14,12,3,[0,1,2])) === score(H(14,12,3,[1,2,3])), 'suits never break ties');
// exhaustive sanity: every category appears with correct ordering over random sample
import { freshDeck, shuffle, mkRng } from '../cards/deck.js';
const rng = mkRng(42);
let seen = new Set();
for (let i = 0; i < 3000; i++) {
  const d = shuffle(freshDeck(), rng);
  const hand = [d[0], d[1], d[2]];
  seen.add(evalHand(hand).cat);
}
A(seen.size === 6, `all 6 categories occur in sample (got ${[...seen].sort()})`);
console.log(f === 0 ? 'EVALUATOR PASSED ✔ (category ladder, AKQ/A23 order, kickers, ties)' : `${f} FAILURES ✘`);
process.exit(f === 0 ? 0 : 1);
