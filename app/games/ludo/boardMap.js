// ════════════════════════════════════════════════════════════════════════
//  yourZ — LUDO board geometry. Pure data: maps rules.js's abstract cells
//  onto the classic 15×15 grid. No RN imports — node-testable.
//  Orientation: seat 0 = LEFT arm (yard top-left), play runs clockwise.
//    seat 0 yard top-left    · start (6,1)  · lane row 7 cols 1..5
//    seat 1 yard top-right   · start (1,8)  · lane col 7 rows 1..5
//    seat 2 yard bottom-right· start (8,13) · lane row 7 cols 13..9
//    seat 3 yard bottom-left · start (13,6) · lane col 7 rows 13..9
// ════════════════════════════════════════════════════════════════════════

// The 52-cell ring, index 0 = seat 0's start cell, clockwise.
function buildRing() {
  const p = [];
  const push = (r, c) => p.push([r, c]);
  for (let c = 1; c <= 5; c++) push(6, c);        // 0-4   left arm top row →
  for (let r = 5; r >= 0; r--) push(r, 6);        // 5-10  up the left of top arm
  push(0, 7);                                      // 11    across the top
  for (let r = 0; r <= 5; r++) push(r, 8);        // 12-17 down the right of top arm  (13 = seat1 start (1,8))
  for (let c = 9; c <= 14; c++) push(6, c);       // 18-23 right arm top row →
  push(7, 14);                                     // 24    down the right edge
  for (let c = 14; c >= 9; c--) push(8, c);       // 25-30 right arm bottom row ←  (26 = seat2 start (8,13))
  for (let r = 9; r <= 14; r++) push(r, 8);       // 31-36 down the right of bottom arm
  push(14, 7);                                     // 37    across the bottom
  for (let r = 14; r >= 9; r--) push(r, 6);       // 38-43 up the left of bottom arm (39 = seat3 start (13,6))
  for (let c = 5; c >= 0; c--) push(8, c);        // 44-49 left arm bottom row ←
  push(7, 0);                                      // 50    up the left edge
  push(6, 0);                                      // 51    corner back to start
  return p;
}

export const RING = buildRing();                   // RING[absCell] = [row, col]

// Home lanes: 5 rendered cells (steps 52-56 → lane pos 0-4), pointing at center.
export const LANES = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],        // seat 0 →
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],        // seat 1 ↓
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],    // seat 2 ←
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],    // seat 3 ↑
];

export const CENTER = [7, 7];                      // home (steps 57)

// Yard token resting spots (2×2 inside each 6×6 yard).
export const YARDS = [
  [[2, 2], [2, 3], [3, 2], [3, 3]],                // seat 0 top-left
  [[2, 11], [2, 12], [3, 11], [3, 12]],            // seat 1 top-right
  [[11, 11], [11, 12], [12, 11], [12, 12]],        // seat 2 bottom-right
  [[11, 2], [11, 3], [12, 2], [12, 3]],            // seat 3 bottom-left
];

export const YARD_RECTS = [                         // [row, col, h, w] of the 6×6 yards
  [0, 0, 6, 6], [0, 9, 6, 6], [9, 9, 6, 6], [9, 0, 6, 6],
];

// grid position for a token given (seat, steps) — mirrors rules.js zones.
export function cellFor(seat, steps, STEPS_TO_LANE = 51, MAX = 57) {
  if (steps === 0) return null;                    // yard — UI uses YARDS slots
  if (steps <= STEPS_TO_LANE) return RING[(([0, 13, 26, 39][seat]) + steps - 1) % 52];
  if (steps < MAX) return LANES[seat][steps - STEPS_TO_LANE - 1];
  return CENTER;
}
