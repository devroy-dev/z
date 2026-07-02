// ════════════════════════════════════════════════════════════════════════
//  yourZ — STAGE-AS-EXAM (#19). Learning arcs: days of practice with a
//  persona, then a Stage scenario as the FINAL — the verdict is the grade,
//  recorded in the ledger. This file: arc definitions + progress logic.
//  V1 ships ONE arc end-to-end (Speak Up → The Pitch); the shape scales.
// ════════════════════════════════════════════════════════════════════════
import { supabase } from './db.js';

export type ArcDef = {
  id: string; title: string; personaKey: string; days: number;
  focus: string[];               // one line per day — what the persona coaches
  finalScenario: string;         // stage library key the exam uses
  finalTitle: string;
  finalBrief: string;            // sent as the mission brief when they take it
};

export const ARCS: Record<string, ArcDef> = {
  speak_up: {
    id: 'speak_up',
    title: 'speak up',
    personaKey: 'the_orator',
    days: 3,
    focus: [
      'Day 1 — the spine: get them to say, out loud in one breath, WHAT they are pitching and WHY it matters. Make them compress it until it stands on its own. Give one concrete exercise in conversation.',
      'Day 2 — the delivery: pace, pauses, the opening line. Have them write and refine their first 30 seconds with you; make them try it twice, coach the difference.',
      'Day 3 — the pressure: play the hostile listener. Interrupt, challenge, get bored on purpose. Coach them to hold the room and land the close anyway.',
    ],
    finalScenario: 'pitch',   // MUST match app/stage/library.js id exactly
    finalTitle: 'The Pitch',
    finalBrief: 'You have ten minutes with an investor who has heard a thousand pitches this month. Win real interest — survive the hard questions, hold the room, and land a next step.',
  },
};

export type ArcProgress = {
  id: string; user_id: string; arc_id: string; day: number;
  status: 'active' | 'final_ready' | 'done';
  last_advanced: string | null; started_at: string; final_outcome: string | null;
};

export async function myArcs(userId: string) {
  const { data } = await supabase.from('arc_progress')
    .select('*').eq('user_id', userId).neq('status', 'done')
    .order('started_at', { ascending: false });
  return (data ?? []).map((p: any) => ({ ...p, def: ARCS[p.arc_id] ?? null })).filter((p: any) => p.def);
}

export async function startArc(userId: string, arcId: string) {
  const def = ARCS[arcId];
  if (!def) return { error: 'unknown arc' };
  const { data: existing } = await supabase.from('arc_progress')
    .select('id').eq('user_id', userId).eq('arc_id', arcId).neq('status', 'done').maybeSingle();
  if (existing) return { error: 'arc already underway' };
  const { data, error } = await supabase.from('arc_progress')
    .insert({ user_id: userId, arc_id: arcId, day: 1, status: 'active', last_advanced: new Date().toISOString() })
    .select('*').single();
  return error ? { error: error.message } : { progress: data, def };
}

// Called from the chat loop when the user talks to the arc's persona.
// A new calendar day of real conversation advances the arc; past the last
// day it flips to final_ready. Returns the block for the dynamic tail.
export async function arcBlockFor(userId: string, personaKey: string): Promise<string> {
  const { data: rows } = await supabase.from('arc_progress')
    .select('*').eq('user_id', userId).neq('status', 'done').limit(5);
  const p = (rows ?? []).find((r: any) => ARCS[r.arc_id]?.personaKey === personaKey);
  if (!p) return '';
  const def = ARCS[p.arc_id]!;

  // day advancement: first message of a new calendar day moves the arc
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = p.last_advanced ? String(p.last_advanced).slice(0, 10) : null;
  let day = p.day, status = p.status;
  if (status === 'active' && lastDay && lastDay < today) {
    day = p.day + 1;
    if (day > def.days) { status = 'final_ready'; day = def.days; }
    void supabase.from('arc_progress').update({ day, status, last_advanced: new Date().toISOString() }).eq('id', p.id).then(() => {});
  }

  if (status === 'final_ready') {
    return `\n\n[THE ARC — "${def.title}": the training is DONE. Their final is waiting on the stage: "${def.finalTitle}". Tell them plainly and with belief — they are ready, the exam is live, go take it (Play → the stage → ${def.finalTitle}). Offer one last sharpening only if they ask. The verdict there is their grade.]`;
  }
  return `\n\n[THE ARC — you are coaching them through "${def.title}", day ${day} of ${def.days}. Today's focus: ${def.focus[day - 1] ?? def.focus[def.focus.length - 1]} Weave the coaching into natural conversation — exercises in the chat, honest feedback, never a lecture. If they drift to other topics, be a person first, then bring one thread back to the work. Their FINAL will be a stage scene ("${def.finalTitle}"); build toward it.]`;
}

// Called when a stage verdict lands: if it matches a final_ready arc, grade it.
export async function completeArcIfFinal(userId: string, scenario: string, outcome: string) {
  const { data: rows } = await supabase.from('arc_progress')
    .select('id, arc_id').eq('user_id', userId).eq('status', 'final_ready').limit(5);
  const hit = (rows ?? []).find((r: any) => ARCS[r.arc_id]?.finalScenario === scenario);
  if (!hit) return;
  await supabase.from('arc_progress')
    .update({ status: 'done', final_outcome: outcome }).eq('id', hit.id);
}
