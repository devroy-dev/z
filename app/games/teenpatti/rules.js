// ════════════════════════════════════════════════════════════════════════
//  yourZ — TEEN PATTI betting engine. Pure JS, seedable. Play-money only.
//  Classic desi table:
//   • everyone posts the BOOT; all start BLIND; 3 cards each, face down
//   • blind player: bets the current stake, or raises to 2× (stake becomes 2×)
//   • seen player (chaal): bets 2× stake, or raises to 4× (stake becomes 2×)
//   • SEE any time on your turn (blind → seen), then act as seen
//   • PACK any time on your turn
//   • blind cap: after 4 blind bets a player is auto-seen (keeps games finite)
//   • SIDESHOW: a seen player who just matched the chaal may ask the PREVIOUS
//     seen player to compare privately — lower hand packs; tie → asker packs;
//     the asked may decline
//   • SHOW: when exactly 2 remain — blind asker pays 1× stake, seen asker
//     pays 2× — hands compared openly; better hand takes the pot; TIE → the
//     asker loses
//   • last player standing takes the pot unshown
//
//  API:
//   newHand(players[{id, stack}], { boot }, rng) → state
//   available(state) → array of legal moves for state.turn:
//     [{t:'see'},{t:'bet',amt,raise:false},{t:'bet',amt,raise:true},{t:'pack'},
//      {t:'show',amt},{t:'sideshow',amt,with:seat}]
//   act(state, move) → { state, events }        (sideshow → phase 'sideshow')
//   sideshowReply(state, accept) → { state, events }
//  Money law: every rupee leaving a stack enters the pot; the pot leaves whole.
// ════════════════════════════════════════════════════════════════════════
import { freshDeck, shuffle } from '../cards/deck.js';
import { score } from './eval.js';

const clone = (s) => JSON.parse(JSON.stringify(s));
const BLIND_CAP = 4;

export function newHand(players, { boot = 10 } = {}, rng = Math.random) {
  if (!players || players.length < 2 || players.length > 4) throw new Error('2-4 players');
  players.forEach((p) => { if (p.stack < boot) throw new Error(`${p.id} cannot post boot`); });
  const deck = shuffle(freshDeck(), rng);
  return {
    players: players.map((p, i) => ({
      id: p.id, seat: i, stack: p.stack - boot,
      cards: [deck.pop(), deck.pop(), deck.pop()],
      blind: true, packed: false, blindBets: 0, contributed: boot,
    })),
    pot: boot * players.length,
    stake: boot,
    turn: 0,
    phase: 'act',                 // 'act' | 'sideshow' | 'over'
    pendingSideshow: null,        // { from, to, amt }
    winner: null, winners: null, showdown: null,
    history: 0,
  };
}

const alive = (s) => s.players.filter((p) => !p.packed);
const nextTurn = (s, from) => {
  let t = from;
  do { t = (t + 1) % s.players.length; } while (s.players[t].packed);
  return t;
};
const prevAlive = (s, from) => {
  let t = from;
  do { t = (t - 1 + s.players.length) % s.players.length; } while (s.players[t].packed);
  return t;
};

export function available(state) {
  if (state.phase !== 'act') return [];
  const s = state, p = s.players[s.turn];
  const live = alive(s);
  const mv = [{ t: 'pack' }];
  if (p.blind) mv.push({ t: 'see' });
  const base = p.blind ? s.stake : s.stake * 2;
  if (p.stack >= base) mv.push({ t: 'bet', amt: base, raise: false });
  const raiseAmt = base * 2;
  if (p.stack >= raiseAmt) mv.push({ t: 'bet', amt: raiseAmt, raise: true });
  if (live.length === 2) {
    const showAmt = p.blind ? s.stake : s.stake * 2;
    if (p.stack >= showAmt) mv.push({ t: 'show', amt: showAmt });
  }
  if (!p.blind && live.length > 2) {
    const prev = prevAlive(s, s.turn);
    if (!s.players[prev].blind) {
      const amt = s.stake * 2;
      if (p.stack >= amt) mv.push({ t: 'sideshow', amt, with: prev });
    }
  }
  return mv;
}

function settleToLast(s, events) {
  const rest = alive(s);
  const w = rest[0];
  const amount = s.pot;
  w.stack += amount; s.pot = 0;
  events.push({ type: 'win', seat: w.seat, amount, unshown: true });
  s.winner = w.id; s.phase = 'over';
}

function pack(s, seat, events) {
  s.players[seat].packed = true;
  events.push({ type: 'pack', seat });
  if (alive(s).length === 1) { settleToLast(s, events); return true; }
  return false;
}

export function act(state, move) {
  if (state.phase !== 'act') throw new Error('not act phase');
  const legal = available(state);
  const ok = legal.some((m) => m.t === move.t && (m.amt === undefined || m.amt === move.amt) && (m.with === undefined || m.with === move.with) && (m.raise === undefined || m.raise === move.raise));
  if (!ok) throw new Error(`illegal move ${JSON.stringify(move)}`);
  const s = clone(state);
  const p = s.players[s.turn];
  const events = [];
  s.history += 1;

  if (move.t === 'see') {
    p.blind = false;
    events.push({ type: 'see', seat: p.seat });
    return { state: s, events };                       // seeing doesn't spend the turn
  }
  if (move.t === 'pack') {
    if (pack(s, p.seat, events)) return { state: s, events };
    s.turn = nextTurn(s, s.turn);
    return { state: s, events };
  }
  if (move.t === 'bet') {
    p.stack -= move.amt; p.contributed += move.amt; s.pot += move.amt;
    if (move.raise) s.stake = p.blind ? move.amt : move.amt / 2;   // raise doubles the stake
    if (p.blind) {
      p.blindBets += 1;
      if (p.blindBets >= BLIND_CAP) { p.blind = false; events.push({ type: 'autoSee', seat: p.seat }); }
    }
    events.push({ type: 'bet', seat: p.seat, amt: move.amt, blind: p.blind, raise: !!move.raise, stake: s.stake, pot: s.pot });
    s.turn = nextTurn(s, s.turn);
    return { state: s, events };
  }
  if (move.t === 'show') {
    p.stack -= move.amt; p.contributed += move.amt; s.pot += move.amt;
    const other = alive(s).find((q) => q.seat !== p.seat);
    const a = score(p.cards), b = score(other.cards);
    const winner = a > b ? p : b > a ? other : other;  // tie → asker loses
    events.push({ type: 'show', by: p.seat, against: other.seat, cost: move.amt,
      hands: { [p.seat]: p.cards, [other.seat]: other.cards }, tie: a === b });
    const amount = s.pot;
    winner.stack += amount; s.pot = 0;
    events.push({ type: 'win', seat: winner.seat, amount, unshown: false });
    s.winner = winner.id; s.showdown = true; s.phase = 'over';
    return { state: s, events };
  }
  if (move.t === 'sideshow') {
    p.stack -= move.amt; p.contributed += move.amt; s.pot += move.amt;   // sideshow rides on a chaal
    events.push({ type: 'bet', seat: p.seat, amt: move.amt, blind: false, raise: false, stake: s.stake, pot: s.pot });
    s.pendingSideshow = { from: p.seat, to: move.with };
    s.phase = 'sideshow';
    events.push({ type: 'sideshowAsk', from: p.seat, to: move.with });
    return { state: s, events };
  }
  throw new Error('unreachable');
}

export function sideshowReply(state, accept) {
  if (state.phase !== 'sideshow') throw new Error('no sideshow pending');
  const s = clone(state);
  const { from, to } = s.pendingSideshow;
  const events = [];
  s.pendingSideshow = null; s.phase = 'act';
  if (!accept) {
    events.push({ type: 'sideshowDecline', from, to });
    s.turn = nextTurn(s, from);
    return { state: s, events };
  }
  const a = score(s.players[from].cards), b = score(s.players[to].cards);
  const loserSeat = a > b ? to : from;                 // tie → asker packs
  events.push({ type: 'sideshowResult', from, to, loser: loserSeat, tie: a === b });
  if (pack(s, loserSeat, events)) return { state: s, events };
  s.turn = nextTurn(s, from);
  return { state: s, events };
}

export function winnerOf(state) { return state.winner; }
export const _internals = { alive, nextTurn, prevAlive, BLIND_CAP };
