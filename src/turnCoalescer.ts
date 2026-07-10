// turnCoalescer.ts — THE PACING GATE for shared-room AI turns.
//
// The law (CE ruling, H1-aftermath sitting): a person's keyboard never waits on
// a machine — human messages persist + broadcast INSTANTLY, always. What is
// gated is the AI TURN: per thread, at most one turn runs at a time; messages
// that arrive while a turn runs (or during the idle debounce) simply land in
// history, and when the running turn finishes, exactly ONE follow-up turn fires
// seeing everything that accumulated. Four fragments -> one coherent reply.
//
// RECURSIVE BY DESIGN — DO NOT "FIX" THIS INTO A ONE-SHOT: every finishing turn
// re-checks accumulation and, if messages landed behind it, schedules exactly
// one more turn, which on finishing re-checks again. That recursion IS the
// mechanism; a one-shot follow-up would strand the third burst.
//
// Failure discipline: a wedged guard is a permanently silent room, and
// silence-by-bug is indistinguishable from silence-by-law — the worst failure
// class in the house. So: the guard CLEARS on turn error, and a hard TTL (90s)
// lets any stuck guard self-expire; the next message revives the room.
//
// The DIRECTOR's silence law is untouched: this module gates turn SPAWNING,
// never forces a reply. One accumulated turn may still choose silence.
//
// In-process state (like the schedulers): a redeploy mid-turn drops one pending
// follow-up; acceptable — the next message revives it.

const DEBOUNCE_MS = 2_000;   // idle debounce: let a burst-typer finish the thought
const TTL_MS = 90_000;       // hard TTL: a guard older than this is presumed wedged

type Guard = {
  running: boolean;
  pending: boolean;             // messages landed while a turn was running
  startedAt: number;            // for the TTL
  timer: NodeJS.Timeout | null; // the debounce
  latestRun: (() => Promise<void>) | null;  // newest closure wins (freshest sender/addressed)
};

const guards = new Map<string, Guard>();

export function scheduleGroupTurn(threadId: string, run: () => Promise<void>): void {
  let g = guards.get(threadId);
  if (!g) { g = { running: false, pending: false, startedAt: 0, timer: null, latestRun: null }; guards.set(threadId, g); }
  g.latestRun = run;   // the follow-up turn uses the NEWEST message's params; history carries the rest

  // hard TTL: a "running" guard past 90s is wedged — clear it and proceed.
  if (g.running && Date.now() - g.startedAt > TTL_MS) {
    console.error('[coalescer] guard TTL expired, clearing', threadId);
    g.running = false; g.pending = false;
  }

  if (g.running) { g.pending = true; return; }   // a turn is live; ride the accumulation
  if (g.timer) return;                            // debounce window open; this message rides the same upcoming turn
  g.timer = setTimeout(() => { g!.timer = null; void fire(threadId, g!); }, DEBOUNCE_MS);
}

async function fire(threadId: string, g: Guard): Promise<void> {
  const run = g.latestRun;
  if (!run) return;
  g.running = true; g.pending = false; g.startedAt = Date.now();
  try {
    await run();
  } catch (e: any) {
    console.error('[coalescer] turn failed', threadId, e?.message || e);
    // error-clear: fall through — the guard MUST release (silence-by-bug law)
  }
  g.running = false;
  // RECURSIVE RE-CHECK (see header — do not one-shot this):
  if (g.pending) {
    g.pending = false;
    g.timer = setTimeout(() => { g.timer = null; void fire(threadId, g); }, DEBOUNCE_MS);
  }
}
