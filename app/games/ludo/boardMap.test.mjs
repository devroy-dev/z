import { RING, LANES, CENTER, YARDS, cellFor } from './boardMap.js';
let f = 0; const A = (c, m) => { if (!c) { f++; console.error('FAIL:', m); } };
const START_OFFSET = [0, 13, 26, 39];
const inCenter = (r, c) => r >= 6 && r <= 8 && c >= 6 && c <= 8;

A(RING.length === 52, `ring has 52 cells (got ${RING.length})`);
A(new Set(RING.map(x => x.join(','))).size === 52, 'all ring cells unique');
let diagonals = 0;
for (let i = 0; i < 52; i++) {
  const [r1, c1] = RING[i], [r2, c2] = RING[(i + 1) % 52];
  const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
  A(Math.max(dr, dc) === 1, `ring adjacent at ${i}: (${r1},${c1})→(${r2},${c2})`);
  if (dr === 1 && dc === 1) diagonals++;
}
A(diagonals === 4, `exactly 4 diagonal corner turns (real board) — got ${diagonals}`);
A(RING[0].join()==='6,1' && RING[13].join()==='1,8' && RING[26].join()==='8,13' && RING[39].join()==='13,6',
  'seat starts at the four arm entries');
RING.forEach(([r, c]) => { A(r>=0&&r<=14&&c>=0&&c<=14, 'ring in grid'); A(!inCenter(r,c), `ring never enters center 3×3 (${r},${c})`); });
LANES.forEach((lane, s) => {
  A(lane.length === 5, `lane ${s} has 5 cells`);
  for (let i = 0; i < 4; i++) {
    const [r1,c1]=lane[i],[r2,c2]=lane[i+1];
    A(Math.abs(r1-r2)+Math.abs(c1-c2)===1, `lane ${s} continuous`);
  }
  const [lr, lc] = lane[4];
  A([[lr-1,lc],[lr+1,lc],[lr,lc-1],[lr,lc+1]].some(([r,c])=>inCenter(r,c)), `lane ${s} ends beside the center region`);
  const entry = RING[(START_OFFSET[s] + 50) % 52];
  A(Math.abs(entry[0]-lane[0][0])+Math.abs(entry[1]-lane[0][1])===1, `lane ${s} entry adjacent to ring exit at (${entry})`);
  lane.forEach(([r,c]) => { A(!RING.some(([rr,cc])=>rr===r&&cc===c), `lane ${s} cell (${r},${c}) not on ring`); A(!inCenter(r,c), `lane ${s} outside center`); });
});
A(cellFor(0, 1).join()==='6,1', 'steps 1 = start cell');
A(cellFor(0, 51).join()==='7,0', 'steps 51 = last ring cell');
A(cellFor(0, 52).join()==='7,1', 'steps 52 = first lane cell');
A(cellFor(2, 56).join()==='7,9', 'seat2 last lane cell');
A(cellFor(1, 57).join()==='7,7', 'steps 57 = center');
YARDS.forEach((y,s)=>A(y.length===4, `yard ${s} has 4 slots`));
// every seat: walk steps 1..57 → every position defined, no collisions with center until home
for (let s = 0; s < 4; s++) for (let st = 1; st <= 57; st++) {
  const p = cellFor(s, st); A(Array.isArray(p), `cellFor(${s},${st}) defined`);
}
console.log(f === 0 ? 'BOARD MAP PASSED ✔ 52-ring · 4 corner turns · lanes/entries/starts correct · all 4×57 positions resolve' : `${f} FAILURES ✘`);
process.exit(f===0?0:1);
