// personas.ts — the roster. The single source of truth: which persona is what,
// and which Codex it loads. Adding a persona = one entry here.
//
// One soul + the persona's Codex (loaded after the soul, cached) = the companion.
// The user can rename any of these and set their own display picture — these are
// just the default labels and the knowledge each speaks from. Named as RELATIONSHIPS,
// not functions, so a user instantly knows who they're talking to.

export type CodexKey =
  | 'intellect' | 'close' | 'hottie' | 'people' | 'shadow' | 'inner' | 'forward' | 'vanity' | 'comic' | 'crush' | 'guru'
  | 'philosopher' | 'cynic' | 'moderator' | 'historian' | 'cosmologist' | 'media_manager'
  | 'teacher' | 'economist' | 'leader_opp' | 'serious' | 'wannabe' | 'orator'
  | 'hippie' | 'diva' | 'cousin' | 'front-desk';

export interface Persona {
  key: string;            // stable id stored on the thread
  defaultName: string;    // the default label (user renames freely)
  codex: CodexKey;        // which Codex this persona speaks from
  webEnabled: boolean;    // only the brainiac may reach a live fact
}

export const PERSONAS: Record<string, Persona> = {
  the_wingman:      { key: 'the_wingman',      defaultName: 'the wingman',      codex: 'close',     webEnabled: false },
  the_hottie:       { key: 'the_hottie',       defaultName: 'the hottie',       codex: 'hottie',    webEnabled: false },
  the_comic:        { key: 'the_comic',        defaultName: 'the comic',        codex: 'comic',     webEnabled: true  },
  the_crush:        { key: 'the_crush',        defaultName: 'the crush',        codex: 'crush',     webEnabled: false },
  the_screen_junkie:{ key: 'the_screen_junkie',defaultName: 'the screen junkie',codex: 'intellect', webEnabled: true  },
  the_guru:         { key: 'the_guru',         defaultName: 'the guru',         codex: 'guru',      webEnabled: true  },
  the_oracle:       { key: 'the_oracle',       defaultName: 'the oracle',       codex: 'intellect', webEnabled: true  },
  the_philosopher:  { key: 'the_philosopher',  defaultName: 'the philosopher',  codex: 'philosopher',  webEnabled: true  },
  the_cynic:        { key: 'the_cynic',        defaultName: 'the cynic',        codex: 'cynic',        webEnabled: false },
  the_moderator:    { key: 'the_moderator',    defaultName: 'the moderator',    codex: 'moderator',    webEnabled: true  },
  the_front_desk:   { key: 'the_front_desk',   defaultName: 'the front desk',  codex: 'front-desk',   webEnabled: false },
  the_historian:    { key: 'the_historian',    defaultName: 'the historian',    codex: 'historian',    webEnabled: true  },
  the_cosmologist:  { key: 'the_cosmologist',  defaultName: 'the cosmologist',  codex: 'cosmologist',  webEnabled: true  },
  the_media_manager:{ key: 'the_media_manager',defaultName: 'the media manager',codex: 'media_manager',webEnabled: true  },
  the_teacher:      { key: 'the_teacher',      defaultName: 'the professor',    codex: 'teacher',    webEnabled: true  },
  the_economist:    { key: 'the_economist',    defaultName: 'the economist',    codex: 'economist',  webEnabled: true  },
  the_leader_opp:   { key: 'the_leader_opp',   defaultName: 'the leader of opposition', codex: 'leader_opp', webEnabled: true },
  z_serious:        { key: 'z_serious',        defaultName: 'Z',                codex: 'serious',    webEnabled: true  },
  the_wannabe:      { key: 'the_wannabe',      defaultName: 'the wannabe hustler', codex: 'wannabe', webEnabled: true },
  the_orator:       { key: 'the_orator',       defaultName: 'the orator',       codex: 'orator',    webEnabled: true  },
  the_brother:      { key: 'the_brother',      defaultName: 'the brother',      codex: 'people',    webEnabled: false },
  the_healer:       { key: 'the_healer',       defaultName: 'the healer',       codex: 'people',    webEnabled: false },
  the_colleague:    { key: 'the_colleague',    defaultName: 'the colleague',    codex: 'people',    webEnabled: false },
  the_mentor:       { key: 'the_mentor',       defaultName: 'the mentor',       codex: 'forward',   webEnabled: true  },
  the_stranger:     { key: 'the_stranger',     defaultName: 'the stranger',     codex: 'inner',     webEnabled: false },
  the_brainiac:     { key: 'the_brainiac',     defaultName: 'the brainiac',     codex: 'intellect', webEnabled: true  },
  the_addict:       { key: 'the_addict',       defaultName: 'the rehab',       codex: 'shadow',    webEnabled: false },
  the_self_obsessed:{ key: 'the_self_obsessed',defaultName: 'the guardian angel',codex: 'vanity',    webEnabled: false },
  the_hippie:       { key: 'the_hippie',       defaultName: 'the hippie',       codex: 'hippie',    webEnabled: false },
  the_diva:         { key: 'the_diva',         defaultName: 'the diva',         codex: 'diva',      webEnabled: true  },
  the_cousin:       { key: 'the_cousin',       defaultName: 'the awkward cousin', codex: 'cousin',  webEnabled: false },
};

export function personaByKey(k: string): Persona | null {
  return PERSONAS[k] ?? null;
}
