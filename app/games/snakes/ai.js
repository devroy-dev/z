// snakes has no choices — personality is the MOUTH. This picks banter-worthy
// moments and describes them for /banter. Big drama only; the UI throttles.
import { SNAKES } from './rules.js';
export function banterMoment(events, seatName, youSeat) {
  for (const e of events) {
    if (e.type === 'win') return { event: 'win', line: `${seatName(e.seat)} just won the race to 100` };
    if (e.type === 'snake') {
      const drop = e.from - e.to;
      if (e.from === 99) return { event: 'snake99', line: `${seatName(e.seat)} was on 99, ONE step from winning, and the giant snake sent them all the way down to 54 — the cruelest moment in the game` };
      if (drop >= 30) return { event: 'bigsnake', line: `${seatName(e.seat)} got bitten hard — fell from ${e.from} to ${e.to}` };
      return { event: 'snake', line: `${seatName(e.seat)} slid down a snake from ${e.from} to ${e.to}`, minor: true };
    }
    if (e.type === 'ladder' && (e.to - e.from) >= 40) return { event: 'bigladder', line: `${seatName(e.seat)} hit the big ladder — shot from ${e.from} to ${e.to}` };
    if (e.type === 'stay' && e.pos >= 97) return { event: 'agony', line: `${seatName(e.seat)} is stuck on ${e.pos}, needs the exact roll, and just overshot AGAIN` };
    if (e.type === 'forfeit') return { event: 'forfeit', line: `${seatName(e.seat)} rolled three sixes and lost the whole turn`, minor: true };
  }
  return null;
}
