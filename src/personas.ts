// personas.ts — the roster. The single source of truth: which persona is what,
// and which Codex it loads. Adding a persona = one entry here.
//
// One soul + the persona's Codex (loaded after the soul, cached) = the companion.
// Up to 3 Codexes load at once when a user's roster spans clusters; the engine
// loads only the Codex(es) for the thread(s) in play.

export type CodexKey =
  | 'intellect' | 'close' | 'people' | 'shadow' | 'inner' | 'forward' | 'vanity';

export interface Persona {
  key: string;            // stable id stored on the thread
  defaultName: string;    // the default label (user renames freely)
  codex: CodexKey;        // which Codex this persona speaks from
  webEnabled: boolean;    // only INTELLECT may reach a live fact
}

export const PERSONAS: Record<string, Persona> = {
  devils_advocate: { key: 'devils_advocate', defaultName: "The Devil's Advocate", codex: 'intellect', webEnabled: true },
  wingman:         { key: 'wingman',         defaultName: 'The Wingman',          codex: 'close',     webEnabled: false },
  flame:           { key: 'flame',           defaultName: 'The Flame',            codex: 'close',     webEnabled: false },
  love_sucks:      { key: 'love_sucks',      defaultName: 'Love Sucks',           codex: 'people',    webEnabled: false },
  close_cousin:    { key: 'close_cousin',    defaultName: 'The Close Cousin',     codex: 'people',    webEnabled: false },
  workplace_shit:  { key: 'workplace_shit',  defaultName: 'Workplace Shit',       codex: 'people',    webEnabled: false },
  detox_doc:       { key: 'detox_doc',       defaultName: 'Detox Doc',            codex: 'shadow',    webEnabled: false },
  mr_anxiety:      { key: 'mr_anxiety',      defaultName: 'Mr. Anxiety',          codex: 'inner',     webEnabled: false },
  mr_confident:    { key: 'mr_confident',    defaultName: 'Mr. Confident',        codex: 'forward',   webEnabled: false },
  almost_hot:      { key: 'almost_hot',      defaultName: 'Almost Hot',           codex: 'vanity',    webEnabled: false },
};

export function personaByKey(k: string): Persona | null {
  return PERSONAS[k] ?? null;
}
