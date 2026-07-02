// Ludo rules harness — the protocol's proof. Run: node rules.test.mjs
// 1) unit assertions on every rule  2) 1000 full simulated games:
//    all terminate with a winner, no illegal states, invariants hold every ply.
import { newGame, roll, legalMoves, applyMove, passTurn, _internals } from './rules.js';
const { MAX_STEPS, STEPS_TO_LANE, SAFE, START_OFFSET } = _internals;

let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.error('FAIL:', msg); } };

// seeded rng for reproducibility
function mkRng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ── unit: yard needs a 6 ──
{
  let s = newGame(['a','b']);
  s.phase = 'move'; s.die = 5;
  assert(legalMoves(s).length === 0, 'no moves from yard without a 6');
  s.die = 6;
  const mv = legalMoves(s);
  assert(mv.length === 4 && mv.every(m => m.to.zone === 'track' && m.to.pos === START_OFFSET[0]), 'a 6 releases any token to the start cell');
}
// ── unit: exact roll for home; overshoot barred ──
{
  let s = newGame(['a','b']);
  s.players[0].tokens[0].steps = MAX_STEPS - 2;   // needs exactly 2
  s.phase = 'move'; s.die = 3;
  assert(!legalMoves(s).some(m => m.token === 0), 'overshoot cannot move');
  s.die = 2;
  const m = legalMoves(s).find(m => m.token === 0);
  assert(m && m.home, 'exact roll goes home');
}
// ── unit: capture on plain cell, not on safe cell ──
{
  let s = newGame(['a','b']);
  // seat1 token sits 3 steps ahead of seat0's start-adjacent path on a plain cell
  // put seat0 token at steps 1 (cell 0=safe start). seat1 token on absolute cell 3 (plain).
  s.players[0].tokens[0].steps = 1;
  // seat1 start offset 13 → steps such that absCell(1,steps)===3 → (13+steps-1)%52===3 → steps=43
  s.players[1].tokens[0].steps = 43;
  s.phase = 'move'; s.die = 3; s.turn = 0;
  const m = legalMoves(s).find(m => m.token === 0);
  assert(m && m.capture && m.capture.seat === 1, 'landing on lone opponent on plain cell captures');
  const { state: s2, events } = applyMove(s, 0);
  assert(events.some(e => e.type === 'capture'), 'capture event emitted');
  assert(s2.players[1].tokens[0].steps === 0, 'victim returned to yard');
  assert(s2.phase === 'roll' && s2.turn === 0, 'capture grants another roll');
}
{
  let s = newGame(['a','b']);
  s.players[0].tokens[0].steps = 5;               // cell 5
  s.players[1].tokens[0].steps = 48;              // absCell(1,48) = (13+47)%52 = 8 → star cell (safe)
  s.phase = 'move'; s.die = 3; s.turn = 0;        // 5+3 = steps 8 → cell 8
  const m = legalMoves(s).find(m => m.token === 0);
  assert(m && !m.capture, 'no capture on a safe star cell');
}
// ── unit: block bars landing and pass-through ──
{
  let s = newGame(['a','b']);
  s.players[1].tokens[0].steps = 43;              // cell 3
  s.players[1].tokens[1].steps = 43;              // block on cell 3
  s.players[0].tokens[0].steps = 1;               // cell 0
  s.phase = 'move'; s.turn = 0;
  s.die = 3;                                       // land exactly on block
  assert(!legalMoves(s).some(m => m.token === 0), 'cannot land on opposing block');
  s.die = 5;                                       // pass through cell 3
  assert(!legalMoves(s).some(m => m.token === 0), 'cannot pass through opposing block');
}
// ── unit: three sixes forfeits ──
{
  let s = newGame(['a','b']);
  const six = () => 5.9 / 6;                       // rng returning 6 every time
  let r = roll(s, six); r = roll(r.state.phase==='move'?passAfter(r.state):r.state, six);
  function passAfter(st){ const s2 = JSON.parse(JSON.stringify(st)); s2.phase='roll'; return s2; }
  // simpler: drive directly
  s = newGame(['a','b']); s.sixStreak = 2;
  const out = roll(s, six);
  assert(out.forfeited === true && out.state.turn === 1, 'third six forfeits the turn');
}
// ── unit: no legal moves → passTurn advances ──
{
  let s = newGame(['a','b']);
  s.phase = 'move'; s.die = 4;                     // all in yard, not a 6
  assert(legalMoves(s).length === 0, 'no moves');
  const s2 = passTurn(s);
  assert(s2.turn === 1 && s2.phase === 'roll', 'pass advances turn');
}

// ── simulation: N full games, random legal play, invariants every ply ──
function invariants(s, tag) {
  s.players.forEach((p, seat) => p.tokens.forEach((t, i) => {
    assert(t.steps >= 0 && t.steps <= MAX_STEPS, `${tag}: steps in range`);
  }));
  // no two DIFFERENT-seat stacks with a lone capturable overlap missed — skip (covered by capture unit)
  // no cell holds >4 tokens of one colour
  const count = {};
  s.players.forEach((p, seat) => p.tokens.forEach((t) => {
    if (t.steps >= 1 && t.steps <= STEPS_TO_LANE) {
      const c = _internals.absCell(seat, t.steps);
      count[`${seat}:${c}`] = (count[`${seat}:${c}`] || 0) + 1;
      assert(count[`${seat}:${c}`] <= 4, `${tag}: max 4 own tokens per cell`);
    }
  }));
}

const N = Number(process.argv[2] || 1000);
let totalPlies = 0, maxPlies = 0, wins = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const rng = mkRng(1000 + g);
  const nPlayers = 2 + (g % 3);                    // mix of 2,3,4-player games
  let s = newGame(Array.from({ length: nPlayers }, (_, i) => `p${i}`));
  let plies = 0;
  while (!s.winner) {
    plies++;
    if (plies > 5000) { assert(false, `game ${g}: exceeded 5000 plies (stuck)`); break; }
    if (s.phase === 'roll') {
      const out = roll(s, rng); s = out.state;
      if (out.forfeited) continue;
    }
    const moves = legalMoves(s);
    if (!moves.length) { s = passTurn(s); continue; }
    const pick = moves[Math.floor(rng() * moves.length)];
    const out = applyMove(s, pick.token);
    s = out.state;
    invariants(s, `game ${g} ply ${plies}`);
  }
  assert(!!s.winner, `game ${g}: has a winner`);
  wins[s.winner] = (wins[s.winner] || 0) + 1;
  totalPlies += plies; maxPlies = Math.max(maxPlies, plies);
  // winner really has all 4 home
  const wp = s.players.find(p => p.id === s.winner);
  assert(wp.tokens.every(t => t.steps === MAX_STEPS), `game ${g}: winner has all tokens home`);
}
const ms = Date.now() - t0;
console.log(`\n${N} games simulated in ${ms}ms · avg ${(totalPlies/N).toFixed(0)} plies · max ${maxPlies}`);
console.log('win spread:', wins);
console.log(failures === 0 ? '\nALL CHECKS PASSED ✔' : `\n${failures} FAILURES ✘`);
process.exit(failures === 0 ? 0 : 1);
