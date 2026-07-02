// ════════════════════════════════════════════════════════════════════════
//  yourZ — GAME ADAPTERS for the multiplayer sessions layer. Each adapter
//  wraps a harness-proven engine (imported VERBATIM from the same files
//  the native tables use) behind one interface:
//    create(seats) · move(state, seat, mv) · ai(state, seat, styleOf)
//    view(state, seat)  — per-viewer hidden-info filtering; THE DECK IS
//    HIDDEN INFO TOO (undealt cards never leave the server)
//    isOver(state) · toActSeat(state)
// ════════════════════════════════════════════════════════════════════════
import * as CB from './callbreak/engine.js';
import * as CBai from './callbreak/ai.js';
import * as PD from './pusoy/engine.js';
import * as PDai from './pusoy/ai.js';
import * as PK from './poker/engine.js';
import * as PKai from './poker/ai.js';
import * as LUDO from './ludo/rules.js';
import * as LUDOai from './ludo/ai.js';

const styleFor = (seats: any[], seat: number) => {
  // temperament-lite mapping by persona key hash; humans never route here
  const id = seats[seat]?.id || '';
  const styles = ['calculator', 'gambler', 'guardian', 'chaos', 'smooth', 'steady'];
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return styles[h % styles.length];
};

// ── CALLBREAK: a full 5-round match per session ──
export const callbreakAdapter = {
  minSeats: 4, maxSeats: 4,
  create(seats: any[]) {
    const hands = CB.dealRound();
    return { kind: 'callbreak', round: 0, totals: [0, 0, 0, 0], seats: seats.length, g: CB.newRound(hands, 0), between: false };
  },
  move(state: any, seat: number, mv: any) {
    if (mv.type === 'next') {
      if (!state.between) throw new Error('round not over');
      state.round++;
      if (state.round >= 5) throw new Error('match over');
      state.g = CB.newRound(CB.dealRound(), state.round % 4);
      state.between = false;
      return state;
    }
    if (mv.type === 'bid') CB.placeBid(state.g, seat, mv.n | 0);
    else if (mv.type === 'card') CB.playCard(state.g, seat, { r: mv.card.r | 0, s: mv.card.s | 0 });
    else throw new Error('unknown move');
    if (state.g.phase === 'over') {
      const scores = CB.roundScores(state.g);
      state.totals = state.totals.map((t: number, i: number) => t + scores[i]);
      state.lastScores = scores;
      if (state.round >= 4) state.done = true; else state.between = true;
    }
    return state;
  },
  ai(state: any, seat: number, seats: any[]) {
    const style = styleFor(seats, seat);
    if (state.g.phase === 'bidding') return this.move(state, seat, { type: 'bid', n: CBai.suggestBid(state.g.hands[seat], style) });
    const card = CBai.chooseCard(state.g, seat, style);
    return this.move(state, seat, { type: 'card', card });
  },
  view(state: any, seat: number) {
    const g = state.g;
    return {
      ...state,
      g: {
        ...g,
        hands: g.hands.map((h: any[], i: number) => (i === seat ? h : h.length)),   // others → counts
      },
    };
  },
  isOver: (s: any) => !!s.done,
  toActSeat(s: any) {
    if (s.done || s.between) return -1;
    if (s.g.phase === 'bidding') return s.g.toBid;
    if (s.g.phase === 'play') return s.g.toPlay;
    return -1;
  },
};

// ── PUSOY DOS: one game per session ──
export const pusoyAdapter = {
  minSeats: 4, maxSeats: 4,
  create() { return PD.newGame(); },
  move(state: any, seat: number, mv: any) {
    if (mv.type === 'play') return PD.play(state, seat, (mv.cards || []).map((c: any) => ({ r: c.r | 0, s: c.s | 0 })));
    if (mv.type === 'pass') return PD.pass(state, seat);
    throw new Error('unknown move');
  },
  ai(state: any, seat: number, seats: any[]) {
    const d = PDai.choose(state, seat, styleFor(seats, seat));
    return d.type === 'pass' ? PD.pass(state, seat) : PD.play(state, seat, d.cards);
  },
  view(state: any, seat: number) {
    return { ...state, hands: state.hands.map((h: any[], i: number) => (i === seat ? h : h.length)) };
  },
  isOver: (s: any) => s.phase === 'over',
  toActSeat: (s: any) => (s.phase === 'play' ? s.toAct : -1),
};

// ── HOLD'EM: a continuous table; hands roll on via {type:'deal'} ──
export const pokerAdapter = {
  minSeats: 2, maxSeats: 6,
  create(seats: any[]) {
    const stacks = seats.map(() => 2000);
    const g = PK.newHand(stacks, 0);
    return { kind: 'poker', dealer: 0, stacks, g };
  },
  move(state: any, seat: number, mv: any) {
    if (mv.type === 'deal') {
      if (state.g.street !== 'over') throw new Error('hand in play');
      state.stacks = state.g.stacks.map((s: number) => (s < 40 ? 2000 : s));   // house fronts the broke
      state.dealer = (state.dealer + 1) % state.stacks.length;
      state.g = PK.newHand(state.stacks, state.dealer);
      return state;
    }
    if (state.g.street === 'over') throw new Error('hand over — deal');
    const map: any = { fold: { type: 'fold' }, check: { type: 'check' }, call: { type: 'call' } };
    const action = map[mv.type] || (mv.type === 'bet' || mv.type === 'raise' ? { type: mv.type, to: mv.to | 0 } : null);
    if (!action) throw new Error('unknown move');
    PK.act(state.g, action);
    return state;
  },
  ai(state: any, seat: number, seats: any[]) {
    const choice = PKai.chooseAction(state.g, seat, styleFor(seats, seat));
    PK.act(state.g, choice);
    return state;
  },
  view(state: any, seat: number) {
    const g = state.g;
    const showdown = g.street === 'over' && g.results?.scores;
    return {
      ...state,
      g: {
        ...g,
        deck: undefined,                                        // THE DECK NEVER LEAVES
        hole: g.hole.map((h: any, i: number) => (i === seat || (showdown && !g.folded[i]) ? h : null)),
      },
    };
  },
  isOver: () => false,                                          // the table lives until abandoned
  toActSeat: (s: any) => (s.g.street !== 'over' && s.g.toAct >= 0 && !s.g.folded[s.g.toAct] && !s.g.allIn[s.g.toAct] ? s.g.toAct : -1),
};

// ── LUDO: perfect information; the server just owns the dice ──
export const ludoAdapter = {
  minSeats: 2, maxSeats: 4,
  create(seats: any[]) {
    return LUDO.newGame(seats.map((_: any, i: number) => i));
  },
  move(state: any, seat: number, mv: any) {
    if (state.turn !== seat) throw new Error('not your turn');
    if (mv.type === 'roll') {
      const { state: ns } = LUDO.roll(state);
      // no legal moves after the roll → auto-pass so play never stalls
      if (ns.phase === 'move' && LUDO.legalMoves(ns).length === 0) return LUDO.passTurn(ns);
      return ns;
    }
    if (mv.type === 'move') {
      const { state: ns } = LUDO.applyMove(state, mv.token | 0);
      return ns;
    }
    throw new Error('unknown move');
  },
  ai(state: any, seat: number, seats: any[]) {
    if (state.phase === 'roll') {
      const { state: ns } = LUDO.roll(state);
      if (ns.phase === 'move' && LUDO.legalMoves(ns).length === 0) return LUDO.passTurn(ns);
      return ns;
    }
    const token = LUDOai.chooseMove(state, styleFor(seats, seat));
    if (token == null) return LUDO.passTurn(state);
    const { state: ns } = LUDO.applyMove(state, token);
    return ns;
  },
  view(state: any) { return state; },                           // nothing hidden in ludo
  isOver: (s: any) => LUDO.winnerOf(s) != null,
  toActSeat: (s: any) => (LUDO.winnerOf(s) != null ? -1 : s.turn),
};
