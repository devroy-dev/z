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
  | 'hippie' | 'diva' | 'cousin' | 'front-desk'
  | 'screen_junkie' | 'oracle' | 'brainiac' | 'brother' | 'healer' | 'colleague' | 'anchor' | 'grandmaster' | 'conspiracy' | 'coach' | 'interviewer';   // [zip26]

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
  the_screen_junkie:{ key: 'the_screen_junkie',defaultName: 'the screen junkie',codex: 'screen_junkie', webEnabled: true  },
  the_guru:         { key: 'the_guru',         defaultName: 'the guru',         codex: 'guru',      webEnabled: true  },
  the_oracle:       { key: 'the_oracle',       defaultName: 'the oracle',       codex: 'oracle', webEnabled: true  },
  the_philosopher:  { key: 'the_philosopher',  defaultName: 'the philosopher',  codex: 'philosopher',  webEnabled: true  },
  the_moderator:    { key: 'the_moderator',    defaultName: 'the moderator',    codex: 'moderator',    webEnabled: true  },
  the_front_desk:   { key: 'the_front_desk',   defaultName: 'the front desk',  codex: 'front-desk',   webEnabled: false },
  the_historian:    { key: 'the_historian',    defaultName: 'the historian',    codex: 'historian',    webEnabled: true  },
  the_cosmologist:  { key: 'the_cosmologist',  defaultName: 'the cosmologist',  codex: 'cosmologist',  webEnabled: true  },
  the_media_manager:{ key: 'the_media_manager',defaultName: 'the media manager',codex: 'media_manager',webEnabled: true  },
  the_teacher:      { key: 'the_teacher',      defaultName: 'the professor',    codex: 'teacher',    webEnabled: true  },
  the_economist:    { key: 'the_economist',    defaultName: 'the money man',     codex: 'economist',  webEnabled: true  },
  the_anchor:       { key: 'the_anchor',       defaultName: 'the anchor',       codex: 'anchor',     webEnabled: true  },
  the_grandmaster:  { key: 'the_grandmaster',  defaultName: 'the Grand Master',  codex: 'grandmaster', webEnabled: true  },
  the_coach:        { key: 'the_coach',        defaultName: 'the coach',        codex: 'coach',      webEnabled: true  },
  the_interviewer:  { key: 'the_interviewer',  defaultName: 'the interviewer',  codex: 'interviewer', webEnabled: true  },   // [zip26]
  z_serious:        { key: 'z_serious',        defaultName: 'Z',                codex: 'serious',    webEnabled: true  },
  the_wannabe:      { key: 'the_wannabe',      defaultName: 'the wannabe hustler', codex: 'wannabe', webEnabled: true },
  the_orator:       { key: 'the_orator',       defaultName: 'the orator',       codex: 'orator',    webEnabled: true  },
  the_brother:      { key: 'the_brother',      defaultName: 'the brother',      codex: 'brother',    webEnabled: false },
  the_healer:       { key: 'the_healer',       defaultName: 'the healer',       codex: 'healer',    webEnabled: false },
  the_colleague:    { key: 'the_colleague',    defaultName: 'the colleague',    codex: 'colleague',    webEnabled: false },
  the_mentor:       { key: 'the_mentor',       defaultName: 'the mentor',       codex: 'forward',   webEnabled: true  },
  the_brainiac:     { key: 'the_brainiac',     defaultName: "the devil's advocate", codex: 'brainiac', webEnabled: true  },
  the_conspiracy_theorist: { key: 'the_conspiracy_theorist', defaultName: 'the conspiracy theorist', codex: 'conspiracy', webEnabled: true },
  the_addict:       { key: 'the_addict',       defaultName: 'the rehab',       codex: 'shadow',    webEnabled: false },
  the_hippie:       { key: 'the_hippie',       defaultName: 'the hippie',       codex: 'hippie',    webEnabled: false },
  the_diva:         { key: 'the_diva',         defaultName: 'the diva',         codex: 'diva',      webEnabled: true  },
  the_cousin:       { key: 'the_cousin',       defaultName: 'the awkward cousin', codex: 'cousin',  webEnabled: false },
};

// retired keys forward to a successor so existing threads never 404.
const RETIRED: Record<string, string> = {
  the_cynic: 'the_comic', the_leader_opp: 'the_brainiac',
  the_stranger: 'the_healer', the_self_obsessed: 'the_mentor',
};
export function personaByKey(k: string): Persona | null {
  return PERSONAS[k] ?? PERSONAS[RETIRED[k]] ?? null;
}
