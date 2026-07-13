// formats.js — THE FORMAT MODULES, client side (phase 4).
//
// Fork #1's single-source law: formats are authored JSON living on the SERVER
// (content/battlefield/formats/*.json), boot-loaded there, served whole by
// GET /battlefield/formats. The client FETCHES — it never bundles a copy that
// could drift. One built-in DUEL fallback exists so a dead network still
// renders the classic three-phase rail; it mirrors duel.json and is used only
// when the fetch fails.
//
// Helpers mirror the engine's floor law exactly (battlefieldDuel.ts):
//   slotIndex = turns.length · toAct = order[slotIndex].seat · over = array spent.
import { getBattlefieldFormats } from '../../api';

// the fallback — duel.json's shape, minimum fields the UI reads
const DUEL_FALLBACK = {
  key: 'duel', label: 'The Duel (1v1)', perSide: 1,
  order: [
    { side: 'pro', seat: 0, role: 'Opening', label: 'PRO Opening', seconds: 120 },
    { side: 'con', seat: 1, role: 'Opening', label: 'CON Opening', seconds: 120 },
    { side: 'con', seat: 1, role: 'Rebuttal', label: 'CON Rebuttal', seconds: 120 },
    { side: 'pro', seat: 0, role: 'Rebuttal', label: 'PRO Rebuttal', seconds: 120 },
    { side: 'pro', seat: 0, role: 'Closing', label: 'PRO Closing', seconds: 90 },
    { side: 'con', seat: 1, role: 'Closing', label: 'CON Closing', seconds: 90 },
  ],
};

let cache = null;        // { duel: {...}, pf: {...}, ap: {...} }
let inflight = null;

export async function loadFormats() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const j = await getBattlefieldFormats();
      cache = (j && j.formats && j.formats.duel) ? j.formats : { duel: DUEL_FALLBACK };
    } catch (e) {
      cache = { duel: DUEL_FALLBACK };
    }
    inflight = null;
    return cache;
  })();
  return inflight;
}

// sync read once loaded (screens call loadFormats() in an effect first)
export function formatFor(key) {
  const c = cache || { duel: DUEL_FALLBACK };
  return c[key || 'duel'] || c.duel || DUEL_FALLBACK;
}

export function seatSide(fmt, seat) {
  const slot = (fmt.order || []).find((o) => o.seat === seat);
  return slot && slot.side === 'con' ? 'CON' : 'PRO';
}

// "PRO" in a 1v1; "PRO 2" in teams — mirrors the engine's speakerTag
export function speakerTag(fmt, seat) {
  const side = seatSide(fmt, seat);
  if ((fmt.perSide || 1) <= 1) return side;
  const same = [...new Set((fmt.order || []).filter((o) => (o.side === 'con' ? 'CON' : 'PRO') === side).map((o) => o.seat))].sort((a, b) => a - b);
  return side + ' ' + (same.indexOf(seat) + 1);
}

// the rail: the module's role sequence with consecutive duplicates collapsed
// (duel: Opening·Rebuttal·Closing — identical to the old hardcoded rail;
//  pf: Constructive·Rebuttal·Summary·Final Focus; ap: PM·LO·DPM·DLO·GW·OW·Opp Reply·Gov Reply)
export function roleRail(fmt) {
  const out = [];
  for (const o of (fmt.order || [])) { if (!out.length || out[out.length - 1] !== o.role) out.push(o.role); }
  return out;
}

// the slot the floor is on (null at/after verdict) — slotIndex = turns.length
export function currentSlot(fmt, state) {
  if (!state || state.phase === 'verdict') return null;
  return (fmt.order || [])[(state.turns || []).length] || null;
}
