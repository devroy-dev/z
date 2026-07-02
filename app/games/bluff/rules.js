// ════════════════════════════════════════════════════════════════════════
//  yourZ — BLUFF rules engine (the Indian table game; aka Cheat/BS).
//  Pure JS, seedable, node-testable. Hidden information done honestly:
//  the state holds everything; the UI decides what each seat may SEE.
//
//  Rules (desi home variant, 3-4 players):
//   • full deck dealt out (some hands one card bigger — fine)
//   • the leader plays 1-4 cards FACE DOWN and declares a rank
//   • everyone after must claim the SAME rank (play face down) or PASS
//   • any opponent may CALL BLUFF on the latest play:
//       lie  → the liar picks up the ENTIRE pile
//       true → the challenger picks up the pile
//     the picker-upper's victim… the one who WON the challenge leads next
//   • if every other player passes in a row, the pile BURNS (out of the
//     game) and the last player to have played leads a fresh rank
//   • empty your hand and survive the challenge window on your final play
//     to WIN
//
//  API:
//   newGame(ids, rng?)                       → state (phase 'play')
//   legalPlays(state)                        → { canPass, mustClaim(rank|null), maxCards }
//   play(state, seat, cardIdxs, claimRank)   → { state, events }   (phase → 'window')
//   pass(state, seat)                        → { state, events }
//   challenge(state, challengerSeat)         → { state, events }   (resolves reveal)
//   noChallenge(state)                       → { state, events }   (window closes quietly)
//   winnerOf(state)                          → id | null
// ════════════════════════════════════════════════════════════════════════
import { freshDeck, shuffle } from '../cards/deck.js';

const clone = (s) => JSON.parse(JSON.stringify(s));

export function newGame(ids, rng = Math.random) {
  if (!ids || ids.length < 3 || ids.length > 4) throw new Error('bluff needs 3-4 players');
  const deck = shuffle(freshDeck(1), rng);
  const hands = ids.map(() => []);
  deck.forEach((c, i) => hands[i % ids.length].push(c));
  return {
    ids, hands,
    pile: [],                    // face-down history: [{seat, cards, claimRank, claimCount}]
    claimRank: null,             // rank in force (null = leader picks)
    turn: 0,
    lastPlay: null,              // { seat, count } — the challengeable play
    passStreak: 0,
    pendingWin: null,            // seat that just emptied its hand (must survive the window)
    phase: 'play',               // 'play' | 'window' | 'over'
    winner: null,
    history: 0,
  };
}

export function legalPlays(state) {
  return {
    canPass: state.claimRank !== null,          // the leader must play
    mustClaim: state.claimRank,                 // null → leader declares any rank
    maxCards: 4,
  };
}

export function play(state, seat, cardIdxs, claimRank) {
  if (state.phase !== 'play') throw new Error('not play phase');
  if (seat !== state.turn) throw new Error('not your turn');
  if (!cardIdxs?.length || cardIdxs.length > 4) throw new Error('play 1-4 cards');
  if (state.claimRank !== null && claimRank !== state.claimRank) throw new Error('must claim the rank in force');
  if (claimRank < 2 || claimRank > 14) throw new Error('bad rank');
  const uniq = new Set(cardIdxs);
  if (uniq.size !== cardIdxs.length) throw new Error('duplicate card');
  const s = clone(state);
  const hand = s.hands[seat];
  cardIdxs.forEach((i) => { if (i < 0 || i >= hand.length) throw new Error('bad card index'); });

  const played = cardIdxs.slice().sort((a, b) => b - a).map((i) => hand.splice(i, 1)[0]);
  s.pile.push({ seat, cards: played, claimRank, claimCount: played.length });
  s.claimRank = claimRank;
  s.lastPlay = { seat, count: played.length };
  s.passStreak = 0;
  s.history += 1;
  const events = [{ type: 'play', seat, count: played.length, claimRank }];
  if (hand.length === 0) { s.pendingWin = seat; events.push({ type: 'lastCard', seat }); }
  s.phase = 'window';                            // others may challenge
  return { state: s, events };
}

export function pass(state, seat) {
  if (state.phase !== 'play') throw new Error('not play phase');
  if (seat !== state.turn) throw new Error('not your turn');
  if (state.claimRank === null) throw new Error('leader cannot pass');
  const s = clone(state);
  s.passStreak += 1;
  s.history += 1;
  const events = [{ type: 'pass', seat }];
  const others = s.ids.length - 1;
  if (s.passStreak >= others && s.lastPlay) {
    // everyone else passed → pile burns, last player leads fresh
    events.push({ type: 'burn', count: s.pile.reduce((a, p) => a + p.cards.length, 0) });
    s.pile = []; s.claimRank = null;
    s.turn = s.lastPlay.seat;
    s.lastPlay = null; s.passStreak = 0;
  } else {
    s.turn = nextSeat(s);
  }
  return { state: s, events };
}

function nextSeat(s) {
  let t = s.turn;
  do { t = (t + 1) % s.ids.length; } while (s.hands[t].length === 0 && t !== s.turn);
  return t;
}

export function challenge(state, challengerSeat) {
  if (state.phase !== 'window') throw new Error('nothing to challenge');
  if (!state.lastPlay) throw new Error('no play on the table');
  if (challengerSeat === state.lastPlay.seat) throw new Error('cannot challenge yourself');
  if (state.hands[challengerSeat].length === 0) throw new Error('finished players cannot challenge');
  const s = clone(state);
  const lp = s.pile[s.pile.length - 1];
  const lied = lp.cards.some((c) => c.r !== lp.claimRank);
  const pileCards = s.pile.flatMap((p) => p.cards);
  const events = [{ type: 'challenge', by: challengerSeat, against: lp.seat, revealed: lp.cards.slice(), lied }];
  if (lied) {
    s.hands[lp.seat].push(...pileCards);
    events.push({ type: 'pickup', seat: lp.seat, count: pileCards.length });
    if (s.pendingWin === lp.seat) { s.pendingWin = null; events.push({ type: 'winDenied', seat: lp.seat }); }
    s.turn = challengerSeat;                     // truth-caller leads
  } else {
    s.hands[challengerSeat].push(...pileCards);
    events.push({ type: 'pickup', seat: challengerSeat, count: pileCards.length });
    if (s.pendingWin === lp.seat) {              // honest final play survives → WIN
      s.winner = s.ids[lp.seat]; s.phase = 'over';
      s.pile = []; s.claimRank = null; s.lastPlay = null;   // pile was picked up — clear it (conservation)
      events.push({ type: 'win', seat: lp.seat });
      return { state: s, events };
    }
    s.turn = lp.seat;                            // honest player leads again
  }
  s.pile = []; s.claimRank = null; s.lastPlay = null; s.passStreak = 0;
  s.phase = 'play';
  s.history += 1;
  return { state: s, events };
}

export function noChallenge(state) {
  if (state.phase !== 'window') throw new Error('no window open');
  const s = clone(state);
  const events = [];
  if (s.pendingWin !== null) {                   // final play unchallenged → WIN
    s.winner = s.ids[s.pendingWin]; s.phase = 'over';
    events.push({ type: 'win', seat: s.pendingWin });
    return { state: s, events };
  }
  s.phase = 'play';
  s.turn = nextSeat(s);
  return { state: s, events };
}

export function winnerOf(state) { return state.winner; }
export const _internals = { nextSeat };
