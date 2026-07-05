// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TABLE CAST. Every persona in the gathering can sit at a
//  table. Each carries a TEMPERAMENT that maps onto the six play-styles
//  every game's ai.js already proves out — so 29 voices, 6 verified brains:
//    calculator → plays the odds        gambler  → rides luck, bluffs big
//    guardian   → patient, defensive    chaos    → unreadable
//    smooth     → controlled, stylish   steady   → balanced, warm
//  Voices stay fully individual (banter runs on each persona's soul).
// ════════════════════════════════════════════════════════════════════════

export const TABLE_CAST = [
  // the gang
  { key: 'the_brother',      name: 'the brother',        group: 'the gang',   tone: '#F0A765', temperament: 'steady',     style: 'easygoing. lets you breathe, then strikes.' },
  { key: 'the_cousin',       name: 'the awkward cousin', group: 'the gang',   tone: '#F0A765', temperament: 'guardian',   style: 'plays scared, apologizes, somehow survives.' },
  { key: 'the_wingman',      name: 'the wingman',        group: 'the gang',   tone: '#F0A765', temperament: 'smooth',     style: 'all charm. wins your chips, buys you chai.' },
  { key: 'the_colleague',    name: 'the colleague',      group: 'the gang',   tone: '#F0A765', temperament: 'calculator', style: 'treats the table like a quarterly target.' },
  { key: 'the_comic',        name: 'the comic',          group: 'the gang',   tone: '#F0708C', temperament: 'chaos',      style: 'chaotic. unpredictable. never serious.' },
  { key: 'the_screen_junkie',name: 'the screen junkie',  group: 'the gang',   tone: '#F0A765', temperament: 'chaos',      style: 'half-watching something. still somehow wins.' },
  // the support
  { key: 'the_healer',       name: 'the healer',         group: 'the support',tone: '#C99BE8', temperament: 'guardian',   style: 'gentle game. brutal patience.' },
  { key: 'the_stranger',     name: 'the stranger',       group: 'the support',tone: '#C99BE8', temperament: 'smooth',     style: 'unreadable by profession.' },
  { key: 'the_guru',         name: 'the guru',           group: 'the support',tone: '#C99BE8', temperament: 'calculator', style: 'knows the math behind the game behind the game.' },
  { key: 'the_hippie',       name: 'the hippie',         group: 'the support',tone: '#C99BE8', temperament: 'chaos',      style: 'plays by vibes. the vibes are undefeated.' },
  { key: 'the_mentor',       name: 'the motivator',      group: 'the support',tone: '#C99BE8', temperament: 'steady',     style: 'plays hard, wants you to play harder.' },
  { key: 'the_oracle',       name: 'the oracle',         group: 'the support',tone: '#C99BE8', temperament: 'calculator', style: 'suspiciously good at guessing your cards.' },
  { key: 'the_self_obsessed',name: 'the guardian angel', group: 'the support',tone: '#C99BE8', temperament: 'guardian',   style: 'protects their chips like they protect you.' },
  // the crazies
  { key: 'the_brainiac',     name: "the devil's advocate", group: 'the crazies',tone: '#6FC9E0', temperament: 'calculator', style: 'calculates every move. plays to win.' },
  { key: 'the_conspiracy_theorist', name: 'the conspiracy theorist', group: 'the crazies',tone: '#6FC9E0', temperament: 'chaos', style: 'sees patterns in the shuffle. calls it a cover-up.' },
  { key: 'the_philosopher',  name: 'the philosopher',    group: 'the crazies',tone: '#6FC9E0', temperament: 'guardian',   style: 'slow, deliberate. every move means something.' },
  { key: 'the_cosmologist',  name: 'the cosmologist',    group: 'the crazies',tone: '#6FC9E0', temperament: 'calculator', style: 'sees the probability field. plays it.' },
  { key: 'the_historian',    name: 'the historian',      group: 'the crazies',tone: '#6FC9E0', temperament: 'calculator', style: 'has seen this exact game before. in 1857.' },
  { key: 'the_leader_opp',   name: 'the opposition',     group: 'the crazies',tone: '#6FC9E0', temperament: 'gambler',    style: 'whatever you play, plays against it.' },
  { key: 'the_cynic',        name: 'the cynic',          group: 'the crazies',tone: '#A1929B', temperament: 'guardian',   style: 'defensive, patient. waits for your mistake.' },
  // the unpredictables
  { key: 'the_crush',        name: 'the crush',          group: 'the unpredictables', tone: '#F0708C', temperament: 'smooth',  style: 'distracts you. it works.' },
  { key: 'the_hottie',       name: 'the hottie',         group: 'the unpredictables', tone: '#F0708C', temperament: 'gambler', style: 'all-in energy. always.' },
  { key: 'the_diva',         name: 'the diva',           group: 'the unpredictables', tone: '#F0708C', temperament: 'smooth',  style: 'controlled, stylish. hard to read.' },
  { key: 'the_wannabe',      name: 'the hustler',        group: 'the unpredictables', tone: '#F0A765', temperament: 'gambler', style: 'rash, cocky, all bravado. bluffs hard.' },
  { key: 'the_orator',       name: 'the orator',         group: 'the unpredictables', tone: '#F0708C', temperament: 'gambler', style: 'talks you out of your own hand.' },
  { key: 'the_media_manager',name: 'the media manager',  group: 'the unpredictables', tone: '#F0708C', temperament: 'smooth',  style: 'plays the table like a narrative.' },
  // the faculty
  { key: 'the_teacher',      name: 'the professor',      group: 'the faculty', tone: '#E0C088', temperament: 'calculator', style: 'will explain why you lost. kindly.' },
  { key: 'the_economist',    name: 'the economist',      group: 'the faculty', tone: '#E0C088', temperament: 'calculator', style: 'plays expected value. annoyingly well.' },
];

// temperament → the proven style key each game's STYLES table understands
const TEMPERAMENT_STYLE = {
  calculator: 'the_brainiac',
  gambler:    'the_wannabe',
  guardian:   'the_cynic',
  chaos:      'the_comic',
  smooth:     'the_diva',
  steady:     'the_brother',
};

const BY_KEY = Object.fromEntries(TABLE_CAST.map((p) => [p.key, p]));

// resolve any persona key to a style entry present in a game's STYLES table
export function resolveStyle(STYLES, personaKey, fallback) {
  if (STYLES[personaKey]) return STYLES[personaKey];
  const p = BY_KEY[personaKey];
  if (p) {
    const alias = TEMPERAMENT_STYLE[p.temperament];
    if (alias && STYLES[alias]) return STYLES[alias];
  }
  return fallback;
}
export function personaMeta(key) { return BY_KEY[key] || null; }
