// personas.ts — the roster. The single source of truth: which persona is what,
// and which Codex it loads. Adding a persona = one entry here.
//
// One soul + the persona's Codex (loaded after the soul, cached) = the companion.
// The user can rename any of these and set their own display picture — these are
// just the default labels and the knowledge each speaks from. Named as RELATIONSHIPS,
// not functions, so a user instantly knows who they're talking to.

export type CodexKey =
  | 'intellect' | 'close' | 'people' | 'shadow' | 'inner' | 'forward' | 'vanity';

export interface Persona {
  key: string;            // stable id stored on the thread
  defaultName: string;    // the default label (user renames freely)
  codex: CodexKey;        // which Codex this persona speaks from
  webEnabled: boolean;    // only the brainiac may reach a live fact
}

export const PERSONAS: Record<string, Persona> = {
  the_wingman:      { key: 'the_wingman',      defaultName: 'the wingman',      codex: 'close',     webEnabled: false },
  the_hottie:       { key: 'the_hottie',       defaultName: 'the hottie',       codex: 'close',     webEnabled: false },
  the_brother:      { key: 'the_brother',      defaultName: 'the brother',      codex: 'people',    webEnabled: false },
  the_ex:           { key: 'the_ex',           defaultName: 'the ex',           codex: 'people',    webEnabled: false },
  the_mentor:       { key: 'the_mentor',       defaultName: 'the mentor',       codex: 'forward',   webEnabled: false },
  the_stranger:     { key: 'the_stranger',     defaultName: 'the stranger',     codex: 'inner',     webEnabled: false },
  the_brainiac:     { key: 'the_brainiac',     defaultName: 'the brainiac',     codex: 'intellect', webEnabled: true  },
  the_addict:       { key: 'the_addict',       defaultName: 'the addict',       codex: 'shadow',    webEnabled: false },
  the_self_obsessed:{ key: 'the_self_obsessed',defaultName: 'the self-obsessed',codex: 'vanity',    webEnabled: false },
};

export function personaByKey(k: string): Persona | null {
  return PERSONAS[k] ?? null;
}
