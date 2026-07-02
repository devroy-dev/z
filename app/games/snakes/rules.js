// ════════════════════════════════════════════════════════════════════════
//  yourZ — SNAKES & LADDERS rules engine. Pure JS, no RN imports.
//  Classic 10×10 board, cells 1..100, boustrophedon path.
//   • roll 1-6, move forward; EXACT roll needed to land on 100 (overshoot
//     = stay put — the classic Indian rule)
//   • land on a snake's head → slide to its tail; ladder's foot → climb
//   • rolling a 6 grants another roll; three 6s forfeit the turn (desi rule)
//   • 2-4 players; first to 100 wins
//  Board layout is data — the CLASSIC set below is the traditional Indian
//  board (snakes 99→ ladders 1→) and is validated by the harness.
//  API mirrors ludo: newGame / roll / applyMove(auto) / winnerOf. Since a
//  turn has no choices, applyRoll() resolves the whole move; the UI animates
//  from the events (step → slide/climb → extra roll or pass).
// ════════════════════════════════════════════════════════════════════════

// classic board: head→tail (snakes), foot→top (ladders)
export const SNAKES = { 99: 54, 95: 75, 92: 88, 89: 68, 74: 53, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6 };
export const LADDERS = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98 };

export function newGame(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > 4) {
    throw new Error('snakes needs 2-4 players');
  }
  return {
    players: playerIds.map((id) => ({ id, pos: 0 })),   // 0 = not yet on board (enters on first move)
    turn: 0,
    phase: 'roll',           // 'roll' | 'over'
    sixStreak: 0,
    winner: null,
    history: 0,
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));

// One complete turn-beat: roll and resolve. Returns { state, die, events }.
// events: [{type:'roll'},{type:'step',from,to},{type:'snake',from,to}|{type:'ladder',from,to},
//          {type:'stay'}(overshoot),{type:'forfeit'},{type:'win'}]
export function applyRoll(state, rng = Math.random) {
  if (state.phase !== 'roll') throw new Error('game over');
  const s = clone(state);
  const seat = s.turn;
  const die = 1 + Math.floor(rng() * 6);
  const events = [{ type: 'roll', seat, die }];

  if (die === 6) {
    s.sixStreak += 1;
    if (s.sixStreak >= 3) {
      events.push({ type: 'forfeit', seat });
      s.sixStreak = 0; s.turn = (s.turn + 1) % s.players.length;
      s.history += 1;
      return { state: s, die, events };
    }
  } else s.sixStreak = 0;

  const p = s.players[seat];
  const target = p.pos + die;
  if (target > 100) {
    events.push({ type: 'stay', seat, pos: p.pos });          // overshoot: exact roll needed
  } else {
    events.push({ type: 'step', seat, from: p.pos, to: target });
    p.pos = target;
    if (SNAKES[p.pos]) { events.push({ type: 'snake', seat, from: p.pos, to: SNAKES[p.pos] }); p.pos = SNAKES[p.pos]; }
    else if (LADDERS[p.pos]) { events.push({ type: 'ladder', seat, from: p.pos, to: LADDERS[p.pos] }); p.pos = LADDERS[p.pos]; }
    if (p.pos === 100) {
      s.winner = p.id; s.phase = 'over';
      events.push({ type: 'win', seat });
      s.history += 1;
      return { state: s, die, events };
    }
  }

  s.history += 1;
  if (die === 6) { /* extra roll: same seat, phase stays 'roll' */ }
  else s.turn = (s.turn + 1) % s.players.length;
  return { state: s, die, events };
}

export function winnerOf(state) { return state.winner; }

// grid position for the UI: cell 1..100 → [row, col] on a 10×10, row 9 = bottom.
// boustrophedon: bottom row left→right, next row right→left, …
export function cellRC(cell) {
  const idx = cell - 1;
  const rowFromBottom = Math.floor(idx / 10);
  const inRow = idx % 10;
  const col = rowFromBottom % 2 === 0 ? inRow : 9 - inRow;
  return [9 - rowFromBottom, col];
}
