// ════════════════════════════════════════════════════════════════════════
//  yourZ — LUDO rules engine. Pure JS, no RN imports, fully deterministic.
//  UI and personas consume this; they never own rules. (Roadmap §3 protocol.)
//
//  Standard Indian Ludo, 2-4 players:
//   • 4 tokens each, start in the yard. A 6 releases a token to the start cell.
//   • Main track: 52 cells, each player enters at their own start offset.
//   • After 51 track cells a token turns into its 6-cell home column ("lane");
//     lane entry requires exact rolls (overshoot = can't move that token).
//   • Landing on an opponent's single token on a NON-SAFE cell captures it
//     (back to their yard). Safe cells: the 4 start cells + 4 star cells.
//   • Two+ tokens of one colour on a cell form a BLOCK: opponents can't land
//     there and can't pass through it. (Classic rule; toggleable.)
//   • Rolling a 6 grants another roll; three 6s in a row forfeits the turn.
//   • A capture grants another roll. Bringing a token home grants another roll.
//   • First player to bring all 4 tokens home wins; play can continue for
//     placings, but the engine reports a winner as soon as one exists.
//
//  API (all pure; state in, state out — never mutated):
//    newGame(playerIds, opts?)        → state
//    roll(state, rng?)                → { state, die }         (phase 'roll'→'move')
//    legalMoves(state)                → [{ token, from, to, capture, entersLane, home }]
//    applyMove(state, tokenIdx)       → { state, events }      (phase 'move'→'roll' or next player)
//    passTurn(state)                  → state                  (no legal moves)
//    winnerOf(state)                  → playerId | null
//  Positions per token: { zone: 'yard'|'track'|'lane'|'home', pos: number }
//    track pos = ABSOLUTE cell 0..51. lane pos = 0..5. steps = cells travelled 0..56.
// ════════════════════════════════════════════════════════════════════════

const TRACK = 52;            // main ring
const LANE = 6;              // home column length
const STEPS_TO_LANE = 51;    // track steps before turning in
const MAX_STEPS = STEPS_TO_LANE + LANE; // 57 → 'home' (steps===57 means home)
const START_OFFSET = [0, 13, 26, 39];   // absolute start cell per seat
const STAR_CELLS = [8, 21, 34, 47];     // safe stars (classic board)
const SAFE = new Set([...START_OFFSET, ...STAR_CELLS]);

function absCell(seat, steps) {
  // steps 1..51 are on the ring (step 1 = the start cell itself)
  return (START_OFFSET[seat] + (steps - 1)) % TRACK;
}

export function newGame(playerIds, opts = {}) {
  if (!Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > 4) {
    throw new Error('ludo needs 2-4 players');
  }
  return {
    players: playerIds.map((id, seat) => ({
      id, seat,
      tokens: [0, 0, 0, 0].map(() => ({ steps: 0 })), // steps 0 = yard, 57 = home
    })),
    turn: 0,             // seat index
    die: null,           // last roll (null until rolled)
    phase: 'roll',       // 'roll' | 'move' | 'over'
    sixStreak: 0,
    winner: null,
    blocks: opts.blocks !== false,   // two-token blocks rule (default on)
    history: 0,          // move counter (loop guard for sims)
  };
}

const clone = (s) => JSON.parse(JSON.stringify(s));

export function roll(state, rng = Math.random) {
  if (state.phase !== 'roll') throw new Error('not roll phase');
  const s = clone(state);
  s.die = 1 + Math.floor(rng() * 6);
  if (s.die === 6) {
    s.sixStreak += 1;
    if (s.sixStreak >= 3) {          // three sixes → forfeit turn
      s.die = null; s.sixStreak = 0;
      s.turn = nextSeat(s);
      s.phase = 'roll';
      return { state: s, die: 6, forfeited: true };
    }
  } else {
    s.sixStreak = 0;
  }
  s.phase = 'move';
  return { state: s, die: s.die, forfeited: false };
}

function nextSeat(s) {
  let t = s.turn;
  do { t = (t + 1) % s.players.length; } while (s.players[t].done && !allDone(s));
  return t;
}
function allDone(s) { return s.players.every((p) => p.tokens.every((t) => t.steps === MAX_STEPS)); }

function tokensOnCell(s, cell) {
  const out = [];
  s.players.forEach((p, seat) => p.tokens.forEach((t, i) => {
    if (t.steps >= 1 && t.steps <= STEPS_TO_LANE && absCell(seat, t.steps) === cell) {
      out.push({ seat, i });
    }
  }));
  return out;
}

function isBlockedPath(s, seat, fromSteps, toSteps) {
  if (!s.blocks) return false;
  // check every intermediate + landing ring cell for an opposing 2+ block
  for (let st = fromSteps + 1; st <= Math.min(toSteps, STEPS_TO_LANE); st++) {
    const cell = absCell(seat, st);
    const occ = tokensOnCell(s, cell);
    const bySeat = {};
    occ.forEach((o) => { bySeat[o.seat] = (bySeat[o.seat] || 0) + 1; });
    for (const [oSeat, n] of Object.entries(bySeat)) {
      if (Number(oSeat) !== seat && n >= 2) {
        // block stops pass-through; landing exactly on it also barred
        if (st < toSteps || st === toSteps) return true;
      }
    }
  }
  return false;
}

export function legalMoves(state) {
  if (state.phase !== 'move' || state.die == null) return [];
  const s = state, seat = s.turn, die = s.die;
  const moves = [];
  s.players[seat].tokens.forEach((t, i) => {
    if (t.steps === MAX_STEPS) return;               // already home
    if (t.steps === 0) {                              // in yard: needs a 6
      if (die !== 6) return;
      const cell = START_OFFSET[seat];
      // own block never bars entry; opposing 2+ block on the start cell does
      const occ = tokensOnCell(s, cell).filter((o) => o.seat !== seat);
      if (s.blocks && occ.length >= 2) return;
      moves.push({ token: i, from: { zone: 'yard' }, to: { zone: 'track', pos: cell }, capture: captureAt(s, seat, cell), entersLane: false, home: false });
      return;
    }
    const target = t.steps + die;
    if (target > MAX_STEPS) return;                   // overshoot: exact roll needed
    if (isBlockedPath(s, seat, t.steps, target)) return;
    if (target === MAX_STEPS) {
      moves.push({ token: i, from: posOf(seat, t.steps), to: { zone: 'home' }, capture: null, entersLane: false, home: true });
    } else if (target > STEPS_TO_LANE) {
      moves.push({ token: i, from: posOf(seat, t.steps), to: { zone: 'lane', pos: target - STEPS_TO_LANE - 1 }, capture: null, entersLane: t.steps <= STEPS_TO_LANE, home: false });
    } else {
      const cell = absCell(seat, target);
      moves.push({ token: i, from: posOf(seat, t.steps), to: { zone: 'track', pos: cell }, capture: captureAt(s, seat, cell), entersLane: false, home: false });
    }
  });
  return moves;
}

function posOf(seat, steps) {
  if (steps === 0) return { zone: 'yard' };
  if (steps <= STEPS_TO_LANE) return { zone: 'track', pos: absCell(seat, steps) };
  if (steps < MAX_STEPS) return { zone: 'lane', pos: steps - STEPS_TO_LANE - 1 };
  return { zone: 'home' };
}

function captureAt(s, seat, cell) {
  if (SAFE.has(cell)) return null;
  const occ = tokensOnCell(s, cell).filter((o) => o.seat !== seat);
  if (occ.length === 1) return occ[0];               // single opponent token → capture
  return null;                                        // empty, own, or block
}

export function applyMove(state, tokenIdx) {
  const mv = legalMoves(state).find((m) => m.token === tokenIdx);
  if (!mv) throw new Error('illegal move');
  const s = clone(state);
  const seat = s.turn;
  const tok = s.players[seat].tokens[tokenIdx];
  const die = s.die;
  const events = [];

  tok.steps = tok.steps === 0 ? 1 : tok.steps + die;
  events.push({ type: 'move', seat, token: tokenIdx, to: posOf(seat, tok.steps) });

  if (mv.capture) {
    const victim = s.players[mv.capture.seat].tokens[mv.capture.i];
    victim.steps = 0;
    events.push({ type: 'capture', by: seat, victimSeat: mv.capture.seat, victimToken: mv.capture.i });
  }
  if (tok.steps === MAX_STEPS) {
    events.push({ type: 'home', seat, token: tokenIdx });
    if (s.players[seat].tokens.every((t) => t.steps === MAX_STEPS)) {
      s.players[seat].done = true;
      if (!s.winner) { s.winner = s.players[seat].id; s.phase = 'over'; events.push({ type: 'win', seat }); }
    }
  }

  s.history += 1;
  if (s.phase !== 'over') {
    const again = die === 6 || !!mv.capture || tok.steps === MAX_STEPS;
    s.die = null;
    if (again) { s.phase = 'roll'; }                  // same player rolls again
    else { s.turn = nextSeat(s); s.sixStreak = 0; s.phase = 'roll'; }
  }
  return { state: s, events };
}

export function passTurn(state) {
  // no legal moves for this die → turn passes (a 6 with no moves still passes)
  const s = clone(state);
  s.die = null; s.sixStreak = 0;
  s.turn = nextSeat(s); s.phase = 'roll';
  return s;
}

export function winnerOf(state) { return state.winner; }
export const _internals = { absCell, SAFE, START_OFFSET, TRACK, LANE, MAX_STEPS, STEPS_TO_LANE };
