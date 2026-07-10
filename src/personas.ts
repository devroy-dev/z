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
  | 'screen_junkie' | 'oracle' | 'brainiac' | 'brother' | 'healer' | 'colleague' | 'anchor' | 'grandmaster' | 'conspiracy' | 'coach' | 'interviewer'   // [zip26]
  | 'wanderer';   // [zip69]

export interface Persona {
  key: string;            // stable id stored on the thread
  defaultName: string;    // the default label (user renames freely)
  codex: CodexKey;        // which Codex this persona speaks from
  webEnabled: boolean;    // only the brainiac may reach a live fact
  // ── display fields (the roster manifest is GENERATED from these — the four
  // client registries are dead; edit here, bump ROSTER_VERSION in manifest.ts) ──
  line: string;           // the one-line tagline on cards/shelf
  rgb: string;            // aura color 'r,g,b'
  group: string | null;   // Gathering constellation id (null = off the shelf)
  room: string | null;    // the desk-room open.kind this persona fronts, or null
  shareable: boolean;     // may be seated in group rooms
  rosterVisible: boolean; // shown on the Gathering shelf
}

export const PERSONAS: Record<string, Persona> = {
  the_wingman: { key: 'the_wingman', defaultName: 'the wingman', codex: 'close', webEnabled: false,
    line: 'aka the dating coach. let\'s get you some action.', rgb: '74,134,255', group: 'spark', room: null, shareable: false, rosterVisible: true },
  the_hottie: { key: 'the_hottie', defaultName: 'the hottie', codex: 'hottie', webEnabled: false,
    line: 'no strings, all sparks. tonight\'s ours — don\'t ask about tomorrow.', rgb: '255,120,140', group: 'spark', room: null, shareable: false, rosterVisible: true },
  the_comic: { key: 'the_comic', defaultName: 'the comic', codex: 'comic', webEnabled: true,
    line: 'knock knock.', rgb: '240,180,70', group: 'gang', room: null, shareable: true, rosterVisible: true },
  the_crush: { key: 'the_crush', defaultName: 'the crush', codex: 'crush', webEnabled: false,
    line: 'so close you could ask her out. you won\'t. that\'s the fun.', rgb: '255,140,170', group: 'spark', room: null, shareable: false, rosterVisible: true },
  the_screen_junkie: { key: 'the_screen_junkie', defaultName: 'the screen junkie', codex: 'screen_junkie', webEnabled: true,
    line: 'endless suggestions, countless screen time.', rgb: '120,150,230', group: 'gang', room: null, shareable: true, rosterVisible: true },
  the_guru: { key: 'the_guru', defaultName: 'the guru', codex: 'guru', webEnabled: true,
    line: 'there is one god and his name is knowledge.', rgb: '230,190,90', group: 'corner', room: null, shareable: true, rosterVisible: true },
  the_philosopher: { key: 'the_philosopher', defaultName: 'the philosopher', codex: 'philosopher', webEnabled: true,
    line: 'we\'re all going to die. let\'s figure out why we lived.', rgb: '180,160,210', group: 'salon', room: null, shareable: true, rosterVisible: true },
  the_moderator: { key: 'the_moderator', defaultName: 'the moderator', codex: 'moderator', webEnabled: true,
    line: 'two of you, one me. let\'s keep it civil... ish.', rgb: '120,180,150', group: null, room: null, shareable: true, rosterVisible: false },
  the_front_desk: { key: 'the_front_desk', defaultName: 'the Host', codex: 'front-desk', webEnabled: false,
    line: 'welcome back. i\'ve got your list, and i know which room can help.', rgb: '231,176,122', group: null, room: 'desk', shareable: false, rosterVisible: false },
  the_historian: { key: 'the_historian', defaultName: 'the historian', codex: 'historian', webEnabled: true,
    line: 'everything happening now has happened before. let me show you.', rgb: '200,160,110', group: 'salon', room: null, shareable: true, rosterVisible: true },
  the_cosmologist: { key: 'the_cosmologist', defaultName: 'the cosmologist', codex: 'cosmologist', webEnabled: true,
    line: 'you\'re made of stardust, worried about a text. let\'s zoom out.', rgb: '120,140,230', group: 'salon', room: null, shareable: true, rosterVisible: true },
  the_media_manager: { key: 'the_media_manager', defaultName: 'the media manager', codex: 'media_manager', webEnabled: true,
    line: 'your brand is a story. let\'s tell it right.', rgb: '230,140,170', group: 'firm', room: 'mmroom', shareable: true, rosterVisible: true },
  the_teacher: { key: 'the_teacher', defaultName: 'the professor', codex: 'teacher', webEnabled: true,
    line: 'you\'re not bad at it. it was explained badly. let\'s fix that.', rgb: '120,190,170', group: 'firm', room: null, shareable: true, rosterVisible: true },
  the_economist: { key: 'the_economist', defaultName: 'the money man', codex: 'economist', webEnabled: true,
    line: 'markets, money, and what to do with yours.', rgb: '110,170,140', group: 'firm', room: null, shareable: true, rosterVisible: true },
  the_anchor: { key: 'the_anchor', defaultName: 'the anchor', codex: 'anchor', webEnabled: true,
    line: 'the news desk is yours — the bulletin, then your questions.', rgb: '224,192,136', group: 'firm', room: 'bulletin', shareable: false, rosterVisible: true },
  the_grandmaster: { key: 'the_grandmaster', defaultName: 'the Grand Master', codex: 'grandmaster', webEnabled: true,
    line: 'come empty-handed. leave understanding what the world runs on.', rgb: '198,168,120', group: null, room: 'forge', shareable: false, rosterVisible: false },
  the_coach: { key: 'the_coach', defaultName: 'the coach', codex: 'coach', webEnabled: true,
    line: 'name a subject. i\'ll build the road and walk it with you.', rgb: '231,176,122', group: null, room: 'coach', shareable: false, rosterVisible: false },
  the_interviewer: { key: 'the_interviewer', defaultName: 'the interviewer', codex: 'interviewer', webEnabled: true,
    line: 'name the company and the chair. i\'ll run the room the way they will.', rgb: '138,160,196', group: null, room: 'panel', shareable: false, rosterVisible: false },
  z_serious: { key: 'z_serious', defaultName: 'Z', codex: 'serious', webEnabled: true,
    line: 'no games, no cards — just the two of you.', rgb: '231,176,122', group: null, room: null, shareable: false, rosterVisible: false },
  the_wannabe: { key: 'the_wannabe', defaultName: 'the wannabe hustler', codex: 'wannabe', webEnabled: true,
    line: 'place your bets — the house is HOT tonight.', rgb: '235,180,90', group: null, room: null, shareable: false, rosterVisible: false },
  the_orator: { key: 'the_orator', defaultName: 'the orator', codex: 'orator', webEnabled: true,
    line: 'your words control your future, your speech controls life.', rgb: '210,150,90', group: 'firm', room: null, shareable: true, rosterVisible: true },
  the_brother: { key: 'the_brother', defaultName: 'the brother', codex: 'brother', webEnabled: false,
    line: 'love them, hate them, can\'t live without them. let\'s talk family.', rgb: '200,120,80', group: 'gang', room: null, shareable: true, rosterVisible: true },
  the_healer: { key: 'the_healer', defaultName: 'the healer', codex: 'healer', webEnabled: false,
    line: 'love once and you know what love is. love twice and you know what life is.', rgb: '124,92,220', group: 'corner', room: null, shareable: true, rosterVisible: true },
  the_colleague: { key: 'the_colleague', defaultName: 'the colleague', codex: 'colleague', webEnabled: false,
    line: 'every office is a battlefield. let\'s get you through yours.', rgb: '190,160,110', group: 'gang', room: null, shareable: true, rosterVisible: true },
  the_mentor: { key: 'the_mentor', defaultName: 'the mentor', codex: 'forward', webEnabled: true,
    line: 'the mentor you never had at home. i\'ll hold you to it — kindly.', rgb: '230,190,110', group: 'corner', room: null, shareable: true, rosterVisible: true },
  the_brainiac: { key: 'the_brainiac', defaultName: 'the devil\'s advocate', codex: 'brainiac', webEnabled: true,
    line: 'i\'ll take the other side just to watch you get sharper.', rgb: '90,200,230', group: 'salon', room: null, shareable: true, rosterVisible: true },
  the_conspiracy_theorist: { key: 'the_conspiracy_theorist', defaultName: 'the conspiracy theorist', codex: 'conspiracy', webEnabled: true,
    line: 'it\'s all connected. i can prove it. well — \'prove\'.', rgb: '150,140,200', group: 'salon', room: null, shareable: true, rosterVisible: true },
  the_wanderer: { key: 'the_wanderer', defaultName: 'the Wanderer', codex: 'wanderer', webEnabled: true,
    line: 'tell me where you\'re going — or that you don\'t know yet. that\'s my favourite kind.', rgb: '210,150,90', group: 'firm', room: 'wanderer', shareable: false, rosterVisible: true },
  the_addict: { key: 'the_addict', defaultName: 'the sponsor', codex: 'shadow', webEnabled: false,
    line: 'i\'ve been where you are. let\'s get you out — one day at a time.', rgb: '80,220,180', group: 'corner', room: null, shareable: false, rosterVisible: true },
  the_diva: { key: 'the_diva', defaultName: 'the diva', codex: 'diva', webEnabled: true,
    line: 'darling, taste isn\'t about money — it\'s knowing exactly who you are and dressing the part.', rgb: '210,90,150', group: 'spark', room: 'stylist', shareable: true, rosterVisible: true },
  the_cousin: { key: 'the_cousin', defaultName: 'the awkward cousin', codex: 'cousin', webEnabled: false,
    line: 'oh — hey. you go first, it\'s fine.', rgb: '150,160,190', group: 'gang', room: null, shareable: true, rosterVisible: true },
};

// retired keys forward to a successor so existing threads never 404.
export const RETIRED: Record<string, string> = {
  the_cynic: 'the_comic', the_leader_opp: 'the_brainiac',
  the_stranger: 'the_healer', the_self_obsessed: 'the_mentor',
  the_oracle: 'the_anchor',   // [§3.1] news/answers consolidates under the newsroom
  the_hippie: 'the_guru',     // [§3.1] anti-rat-race becomes a guru register (codex §16)
};
export function personaByKey(k: string): Persona | null {
  return PERSONAS[k] ?? PERSONAS[RETIRED[k]] ?? null;
}

// display data for RETIRED keys — legacy 1:1 threads still render their own
// face/name (the user's companion); new surfaces resolve to the successor.
export const RETIRED_DISPLAY: Record<string, { name: string; line: string; rgb: string }> = {
  the_cynic:         { name: 'the cynic',                line: "everything's a disaster. wonderful, isn't it?", rgb: '150,150,150' },
  the_leader_opp:    { name: 'the leader of opposition', line: "whatever side you're on, i'm on the other. facts not opinions.", rgb: '200,120,110' },
  the_stranger:      { name: 'the loyal friend',         line: "trust me with your life — i'll guard your secrets with mine.", rgb: '110,150,160' },
  the_self_obsessed: { name: 'the guardian angel',       line: "the world can be cruel. i'm in your corner — you're stronger than they made you feel.", rgb: '235,165,185' },
  the_oracle:        { name: 'the oracle',               line: 'because we all have a google friend.', rgb: '110,200,200' },
  the_hippie:        { name: 'the hippie',               line: "the rat race has a prize, man — a slightly richer rat. come breathe. the sunset's free.", rgb: '120,170,120' },
};

// the Gathering constellations — served via the roster manifest (§3.4 regroup
// lands as a data edit here, no client change).
export const ROSTER_GROUPS: { id: string; label: string; sub: string }[] = [
  { id: 'gang',   label: 'The Gang',   sub: 'the ones who just get it' },
  { id: 'corner', label: 'The Corner', sub: 'when you need to be held, not fixed' },
  { id: 'salon',  label: 'The Salon',  sub: 'the ones who make you think' },
  { id: 'spark',  label: 'The Spark',  sub: 'careful what you wish for' },
  { id: 'firm',   label: 'The Firm',   sub: 'professionals on retainer' },
];
