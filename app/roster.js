// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE ROSTER (client). One roster, served — the four hand-copied
//  registries (Desk PERSONA_META · Chat PERSONAS · Roster PERSONAS+GROUPS ·
//  Rooms P+SHAREABLE) are dead; every surface reads THIS module.
//
//  Boot law (z_home_cache pattern): render instantly from the bundled
//  snapshot, overlay the AsyncStorage cache if newer, refresh from
//  GET /roster-manifest in the background and persist when the server's
//  version is newer. Roster edits are rare — stale-until-next-boot is fine.
//
//  Legacy law: retired keys carry their own display data (a legacy cynic
//  thread still shows the cynic's face and name — the user's companion),
//  but shareable/rosterVisible are false forever: the §1 bug class is
//  structurally impossible. resolveRetired() maps old → successor for NEW
//  surfaces only.
// ════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './api';

const CACHE_KEY = 'z_roster_cache';

// ── the bundled snapshot — first boot / offline never renders blank.
//    Mirrors the server manifest v1 exactly; the fetch overwrites when newer.
const FALLBACK = {
  version: 1,
  personas: [
    { key: 'the_wingman', name: 'the wingman', line: "aka the dating coach. let's get you some action.", rgb: '74,134,255', group: 'gang', room: null, webEnabled: false, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_hottie', name: 'the hottie', line: "i bet i'll sweep you off your feet.", rgb: '255,120,140', group: 'wild', room: null, webEnabled: false, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_comic', name: 'the comic', line: 'knock knock.', rgb: '240,180,70', group: 'gang', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_crush', name: 'the crush', line: 'summon the courage and try your luck.', rgb: '255,140,170', group: 'wild', room: null, webEnabled: false, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_screen_junkie', name: 'the screen junkie', line: 'endless suggestions, countless screen time.', rgb: '120,150,230', group: 'gang', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_guru', name: 'the guru', line: 'there is one god and his name is knowledge.', rgb: '230,190,90', group: 'support', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_oracle', name: 'the oracle', line: 'because we all have a google friend.', rgb: '110,200,200', group: 'support', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_philosopher', name: 'the philosopher', line: "we're all going to die. let's figure out why we lived.", rgb: '180,160,210', group: 'crazies', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_moderator', name: 'the moderator', line: "two of you, one me. let's keep it civil... ish.", rgb: '120,180,150', group: null, room: null, webEnabled: true, shareable: true, rosterVisible: false, retired: false },
    { key: 'the_front_desk', name: 'the Host', line: "welcome back. i've got your list, and i know which room can help.", rgb: '231,176,122', group: null, room: 'desk', webEnabled: false, shareable: false, rosterVisible: false, retired: false },
    { key: 'the_historian', name: 'the historian', line: 'everything happening now has happened before. let me show you.', rgb: '200,160,110', group: 'crazies', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_cosmologist', name: 'the cosmologist', line: "you're made of stardust, worried about a text. let's zoom out.", rgb: '120,140,230', group: 'crazies', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_media_manager', name: 'the media manager', line: "your brand is a story. let's tell it right.", rgb: '230,140,170', group: 'wild', room: 'mmroom', webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_teacher', name: 'the professor', line: "you're not bad at it. it was explained badly. let's fix that.", rgb: '120,190,170', group: 'faculty', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_economist', name: 'the money man', line: 'markets, money, and what to do with yours.', rgb: '110,170,140', group: 'faculty', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_anchor', name: 'the anchor', line: 'the news desk is yours — the bulletin, then your questions.', rgb: '224,192,136', group: 'faculty', room: 'bulletin', webEnabled: true, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_grandmaster', name: 'the Grand Master', line: 'come empty-handed. leave understanding what the world runs on.', rgb: '198,168,120', group: null, room: 'forge', webEnabled: true, shareable: false, rosterVisible: false, retired: false },
    { key: 'the_coach', name: 'the coach', line: "name a subject. i'll build the road and walk it with you.", rgb: '231,176,122', group: null, room: 'coach', webEnabled: true, shareable: false, rosterVisible: false, retired: false },
    { key: 'the_interviewer', name: 'the interviewer', line: "name the company and the chair. i'll run the room the way they will.", rgb: '138,160,196', group: null, room: 'panel', webEnabled: true, shareable: false, rosterVisible: false, retired: false },
    { key: 'z_serious', name: 'Z', line: 'no games, no cards — just the two of you.', rgb: '231,176,122', group: null, room: null, webEnabled: true, shareable: false, rosterVisible: false, retired: false },
    { key: 'the_wannabe', name: 'the wannabe hustler', line: 'place your bets — the house is HOT tonight.', rgb: '235,180,90', group: 'wild', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_orator', name: 'the orator', line: 'your words control your future, your speech controls life.', rgb: '210,150,90', group: 'wild', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_brother', name: 'the brother', line: "love them, hate them, can't live without them. let's talk family.", rgb: '200,120,80', group: 'gang', room: null, webEnabled: false, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_healer', name: 'the healer', line: 'love once and you know what love is. love twice and you know what life is.', rgb: '124,92,220', group: 'support', room: null, webEnabled: false, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_colleague', name: 'the colleague', line: "every office is a battlefield. let's get you through yours.", rgb: '190,160,110', group: 'gang', room: null, webEnabled: false, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_mentor', name: 'the mentor', line: "i'll push you when you can't push yourself. you've got more in you than you think.", rgb: '230,190,110', group: 'support', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_brainiac', name: "the devil's advocate", line: "i'll take the other side just to watch you get sharper.", rgb: '90,200,230', group: 'crazies', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_conspiracy_theorist', name: 'the conspiracy theorist', line: "it's all connected. i can prove it. well — 'prove'.", rgb: '150,140,200', group: 'crazies', room: null, webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_wanderer', name: 'the Wanderer', line: "tell me where you're going — or that you don't know yet. that's my favourite kind.", rgb: '210,150,90', group: 'faculty', room: 'wanderer', webEnabled: true, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_addict', name: 'the rehab', line: "i've been where you are. let's get you out — one day at a time.", rgb: '80,220,180', group: 'support', room: null, webEnabled: false, shareable: false, rosterVisible: true, retired: false },
    { key: 'the_hippie', name: 'the hippie', line: 'the rat race has a prize, man — a slightly richer rat. come breathe. the sunset\'s free.', rgb: '120,170,120', group: 'support', room: null, webEnabled: false, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_diva', name: 'the diva', line: "darling, taste isn't about money — it's knowing exactly who you are and dressing the part.", rgb: '210,90,150', group: 'wild', room: 'stylist', webEnabled: true, shareable: true, rosterVisible: true, retired: false },
    { key: 'the_cousin', name: 'the awkward cousin', line: "oh — hey. you go first, it's fine.", rgb: '150,160,190', group: 'gang', room: null, webEnabled: false, shareable: true, rosterVisible: true, retired: false },
    // ── retired: display-only for legacy threads, never seatable, never shelved ──
    { key: 'the_cynic', name: 'the cynic', line: "everything's a disaster. wonderful, isn't it?", rgb: '150,150,150', group: null, room: null, webEnabled: false, shareable: false, rosterVisible: false, retired: true },
    { key: 'the_leader_opp', name: 'the leader of opposition', line: "whatever side you're on, i'm on the other. facts not opinions.", rgb: '200,120,110', group: null, room: null, webEnabled: false, shareable: false, rosterVisible: false, retired: true },
    { key: 'the_stranger', name: 'the loyal friend', line: "trust me with your life — i'll guard your secrets with mine.", rgb: '110,150,160', group: null, room: null, webEnabled: false, shareable: false, rosterVisible: false, retired: true },
    { key: 'the_self_obsessed', name: 'the guardian angel', line: "the world can be cruel. i'm in your corner — you're stronger than they made you feel.", rgb: '235,165,185', group: null, room: null, webEnabled: false, shareable: false, rosterVisible: false, retired: true },
  ],
  groups: [
    { id: 'gang', label: 'The Gang', sub: 'the ones who just get it' },
    { id: 'support', label: 'The Support', sub: 'when you need to be held, not fixed' },
    { id: 'crazies', label: 'The Crazies', sub: 'the ones who make you think' },
    { id: 'wild', label: 'The Unpredictables', sub: 'careful what you wish for' },
    { id: 'faculty', label: 'The Faculty', sub: 'come to learn' },
  ],
  retired: { the_cynic: 'the_comic', the_leader_opp: 'the_brainiac', the_stranger: 'the_healer', the_self_obsessed: 'the_mentor' },
};

// ── in-memory state: always usable synchronously from first render ──
let DATA = FALLBACK;
let byKey = {};
const index = (d) => { byKey = {}; for (const p of d.personas) byKey[p.key] = p; };
index(DATA);

const apply = (d) => {
  if (!d || !Array.isArray(d.personas) || !d.personas.length) return false;
  if (Number(d.version || 0) < Number(DATA.version || 0)) return false;
  DATA = d; index(DATA); return true;
};

// boot: cache overlay instantly, server refresh in background. fire-and-forget.
let booted = false;
export async function initRoster() {
  if (booted) return; booted = true;
  try {
    const c = await AsyncStorage.getItem(CACHE_KEY);
    if (c) apply(JSON.parse(c));
  } catch (e) {}
  try {
    const r = await fetch(`${API_BASE}/roster-manifest`);
    if (r.ok) {
      const j = await r.json();
      if (apply(j)) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(j)).catch(() => {});
    }
  } catch (e) {}
}

// ── the reads — every surface speaks through these ──
export const personaOf = (k) => byKey[k] || null;
export const isKnown = (k) => !!byKey[k];
export const nameOf = (k) => (byKey[k] ? byKey[k].name : (k || '').replace(/^the_/, 'the ').replace(/_/g, ' '));
export const lineOf = (k) => (byKey[k] ? byKey[k].line : '');
export const rgbOf = (k) => (byKey[k] && byKey[k].rgb) || '231,176,122';
export const roomOf = (k) => (byKey[k] ? byKey[k].room : null);
export const isShareable = (k) => !!(byKey[k] && byKey[k].shareable);
export const shareableKeys = () => DATA.personas.filter((p) => p.shareable).map((p) => p.key);
export const resolveRetired = (k) => (DATA.retired && DATA.retired[k]) || k;
export const groupsList = () => DATA.groups.map((g) => ({ ...g, keys: DATA.personas.filter((p) => p.rosterVisible && p.group === g.id).map((p) => p.key) }));
export const faceFor = (key) => `https://callmez.app/faces/${key}.jpg?v=6`;
