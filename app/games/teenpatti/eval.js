// ════════════════════════════════════════════════════════════════════════
//  yourZ — TEEN PATTI hand evaluator. Pure, total-ordered, node-testable.
//  Categories (high→low): 5 trail · 4 pure sequence · 3 sequence · 2 color
//  · 1 pair · 0 high card. Sequence order: A-K-Q highest, then A-2-3, then
//  K-Q-J … 4-3-2 (the classic Indian convention). Suits never break ties —
//  identical scores are true ties (split / requester-loses at show).
//  score(cards[3]) → integer; bigger wins. handName(cards) → label.
// ════════════════════════════════════════════════════════════════════════

const seqRank = (hi, ranks) => {
  // returns a comparable "height" for sequences: AKQ=14, A23=13.5→ encode *2
  const key = ranks.join(',');
  if (key === '14,13,12') return 29;              // A-K-Q
  if (key === '14,3,2') return 28;                // A-2-3 (second highest)
  return ranks[0] * 2;                            // K-Q-J → 26 … 4-3-2 → 8
};

export function evalHand(cards) {
  const r = cards.map((c) => c.r).sort((a, b) => b - a);
  const suited = cards[0].s === cards[1].s && cards[1].s === cards[2].s;
  const isTrail = r[0] === r[1] && r[1] === r[2];
  const straight =
    (r[0] - r[1] === 1 && r[1] - r[2] === 1) ||
    (r[0] === 14 && r[1] === 3 && r[2] === 2);    // A-2-3
  if (isTrail) return { cat: 5, key: [r[0]] };
  if (straight && suited) return { cat: 4, key: [seqRank(r[0], r)] };
  if (straight) return { cat: 3, key: [seqRank(r[0], r)] };
  if (suited) return { cat: 2, key: r };
  if (r[0] === r[1] || r[1] === r[2]) {
    const pr = r[1];                              // middle card is always the pair rank
    const kick = r[0] === pr ? r[2] : r[0];
    return { cat: 1, key: [pr, kick] };
  }
  return { cat: 0, key: r };
}

export function score(cards) {
  const { cat, key } = evalHand(cards);
  // pack into one integer: cat · then up to 3 key slots (base 32 is plenty)
  let s = cat;
  const k = [...key, 0, 0, 0].slice(0, 3);
  for (const x of k) s = s * 32 + x;
  return s;
}

export const CAT_NAME = ['high card', 'a pair', 'color', 'sequence', 'pure sequence', 'trail'];
export function handName(cards) { return CAT_NAME[evalHand(cards).cat]; }
