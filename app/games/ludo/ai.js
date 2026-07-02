// ════════════════════════════════════════════════════════════════════════
//  yourZ — LUDO ai. Personality expressed as PARAMETERS over legal moves.
//  The engine owns legality; this owns taste. Personas own the voice (banter).
//  chooseMove(state, styleKey) → tokenIdx | null   (null = no legal moves)
// ════════════════════════════════════════════════════════════════════════
import { legalMoves, _internals } from './rules.js';
const { STEPS_TO_LANE, SAFE, MAX_STEPS } = _internals;

// Each style weighs the same features differently. Weights are the character.
export const STYLES = {
  // calculates every move. plays to win.
  the_brainiac:    { capture: 9, home: 10, progress: 3, release: 5, safety: 6, spread: 2, risk: 0.0, noise: 0.02 },
  // rash, cocky, all bravado
  the_wannabe:     { capture: 12, home: 7, progress: 5, release: 8, safety: 0, spread: 0, risk: 0.6, noise: 0.20 },
  // easygoing; lets you breathe, then strikes
  the_brother:     { capture: 6, home: 9, progress: 4, release: 4, safety: 4, spread: 3, risk: 0.2, noise: 0.10 },
  // defensive, patient; waits for your mistake
  the_cynic:       { capture: 5, home: 10, progress: 2, release: 2, safety: 9, spread: 4, risk: -0.3, noise: 0.05 },
  // chaotic, unpredictable
  the_comic:       { capture: 7, home: 6, progress: 3, release: 6, safety: 2, spread: 2, risk: 0.4, noise: 0.55 },
  // slow, deliberate; every move means something
  the_philosopher: { capture: 4, home: 10, progress: 3, release: 3, safety: 7, spread: 5, risk: -0.1, noise: 0.05 },
};
const DEFAULT = STYLES.the_brother;

// crude danger estimate: opponents within 6 steps behind the landing ring cell
function danger(state, seat, landingSteps) {
  if (landingSteps < 1 || landingSteps > STEPS_TO_LANE) return 0;
  const cell = _internals.absCell(seat, landingSteps);
  if (SAFE.has(cell)) return 0;
  let n = 0;
  state.players.forEach((p, oSeat) => { if (oSeat === seat) return;
    p.tokens.forEach((t) => {
      if (t.steps < 1 || t.steps > STEPS_TO_LANE) return;
      const oCell = _internals.absCell(oSeat, t.steps);
      const gap = (cell - oCell + 52) % 52;
      if (gap >= 1 && gap <= 6) n++;
    });
  });
  return n;
}

export function chooseMove(state, styleKey, rng = Math.random) {
  const W = STYLES[styleKey] || DEFAULT;
  const moves = legalMoves(state);
  if (!moves.length) return null;
  const seat = state.turn;
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const tok = state.players[seat].tokens[m.token];
    const landing = tok.steps === 0 ? 1 : tok.steps + state.die;
    let score = 0;
    if (m.capture) score += W.capture;
    if (m.home) score += W.home;
    if (m.from.zone === 'yard') score += W.release;
    score += W.progress * (landing / MAX_STEPS);           // favour advanced tokens…
    score += W.spread * (tok.steps === 0 ? 0 : (1 - landing / MAX_STEPS)); // …or spreading
    const d = danger(state, seat, landing);
    score -= W.safety * d * 0.5;                            // safety-minded avoid exposure
    score += W.risk * d;                                    // risk-lovers walk into it
    if (landing >= 1 && landing <= STEPS_TO_LANE && SAFE.has(_internals.absCell(seat, landing))) score += W.safety * 0.4;
    score += (rng() - 0.5) * 2 * (W.noise * 10);            // character noise
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best.token;
}

// Events worth a banter line — the UI throttles and phrases via /banter.
export function banterEvent(events) {
  for (const e of events) {
    if (e.type === 'win') return { event: 'win', detail: e };
    if (e.type === 'capture') return { event: 'capture', detail: e };
    if (e.type === 'home') return { event: 'home', detail: e };
  }
  return null;
}
