// ════════════════════════════════════════════════════════════════════════
//  yourZ — the persona chat surface · NIGHTFALL
//  Each room lit by WHO's in it: a per-persona aura falls from the top and
//  fades to near-black. The persona speaks in floating serif (the presence);
//  you answer in a small candle-lit bubble. The soul-line is the epigraph that
//  greets an empty room. No more giant presence-block eating half the screen —
//  the conversation fills the space; the empty state centers in it.
//  Preserves: stream pacer, synchronous send-lock, token refresh, clear-chat,
//  video call, near-bottom-only auto-scroll.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import VideoCall from './VideoCall';
import Grain from './Grain';
import RichText from './RichText';
import * as ImagePicker from 'expo-image-picker';
import { loadSession, openThreadInfo, streamChat, clearThread, renameThread, setThreadAvatar, getRoomMessages, getPersonaDiary, transcribeVoice, markThreadRead } from './api';
import { useVoiceNote } from './voice';

// ── NIGHTFALL palette ──
const N = {
  ink: '#090C12', ink2: '#0D1119',            // Moonlight — the resident register
  moonBlue: '#9FC2E8', porcelain: '#E8ECF4',
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)', moonFaint: 'rgba(233,232,240,0.30)',
  silver: '#9E9DB0', hair: 'rgba(233,232,240,0.10)',
  candle: '#E7B07A', candleHot: '#F3CFA3',
};

// ── persona registry: name · soul-line · aura rgb (the room's light) ──
const PERSONAS = {
  the_brother:{name:'the brother',desc:"love them, hate them, can't live without them. let's talk family.",rgb:'200,120,80'},
  the_anchor:{name:'the anchor',desc:"the news desk is yours — the bulletin, then your questions.",rgb:'224,192,136'},
  the_healer:{name:'the healer',desc:"love once and you know what love is. love twice and you know what life is.",rgb:'124,92,220'},
  the_brainiac:{name:'the brainiac',desc:"i'll take the other side just to watch you get sharper.",rgb:'90,200,230'},
  the_screen_junkie:{name:'the screen junkie',desc:"endless suggestions, countless screen time.",rgb:'120,150,230'},
  the_hottie:{name:'the hottie',desc:"i bet i'll sweep you off your feet.",rgb:'255,120,140'},
  the_crush:{name:'the crush',desc:"summon the courage and try your luck.",rgb:'255,140,170'},
  the_wingman:{name:'the wingman',desc:"aka the dating coach. let's get you some action.",rgb:'74,134,255'},
  the_comic:{name:'the comic',desc:"knock knock.",rgb:'240,180,70'},
  the_cynic:{name:'the cynic',desc:"everything's a disaster. wonderful, isn't it?",rgb:'150,150,150'},
  the_oracle:{name:'the oracle',desc:"because we all have a google friend.",rgb:'110,200,200'},
  the_guru:{name:'the guru',desc:"there is one god and his name is knowledge.",rgb:'230,190,90'},
  the_philosopher:{name:'the philosopher',desc:"we're all going to die. let's figure out why we lived.",rgb:'180,160,210'},
  the_historian:{name:'the historian',desc:"everything happening now has happened before. let me show you.",rgb:'200,160,110'},
  the_cosmologist:{name:'the cosmologist',desc:"you're made of stardust, worried about a text. let's zoom out.",rgb:'120,140,230'},
  the_colleague:{name:'the colleague',desc:"every office is a battlefield. let's get you through yours.",rgb:'190,160,110'},
  the_media_manager:{name:'the media manager',desc:"your brand is a story. let's tell it right.",rgb:'230,140,170'},
  the_orator:{name:'the orator',desc:"your words control your future, your speech controls life.",rgb:'210,150,90'},
  the_economist:{name:'the economist',desc:"markets, money, and why your rent keeps rising.",rgb:'110,170,140'},
  the_teacher:{name:'the professor',desc:"you're not bad at it. it was explained badly. let's fix that.",rgb:'120,190,170'},
  the_grandmaster:{name:'the Grand Master',desc:"come empty-handed. leave understanding what the world runs on.",rgb:'198,168,120'},
  the_leader_opp:{name:'the leader of opposition',desc:"whatever side you're on, i'm on the other. facts not opinions.",rgb:'200,120,110'},
  the_hippie:{name:'the hippie',desc:"the rat race has a prize, man — a slightly richer rat. come breathe. the sunset's free.",rgb:'120,170,120'},
  the_diva:{name:'the diva',desc:"darling, taste isn't about money — it's knowing exactly who you are and dressing the part.",rgb:'210,90,150'},
  the_cousin:{name:'the awkward cousin',desc:"oh — hey. you go first, it's fine.",rgb:'150,160,190'},
  the_wannabe:{name:'the wannabe hustler',desc:"place your bets — the house is HOT tonight.",rgb:'235,180,90'},
  the_stranger:{name:'the loyal friend',desc:"trust me with your life — i'll guard your secrets with mine.",rgb:'110,150,160'},
  the_mentor:{name:'the motivator',desc:"i'll push you when you can't push yourself. you've got more in you than you think.",rgb:'230,190,110'},
  the_addict:{name:'the rehab',desc:"i've been where you are. let's get you out — one day at a time.",rgb:'80,220,180'},
  the_self_obsessed:{name:'the guardian angel',desc:"the world can be cruel. i'm in your corner — you're stronger than they made you feel.",rgb:'235,165,185'},
  the_moderator:{name:'the moderator',desc:"two of you, one me. let's keep it civil... ish.",rgb:'120,180,150'},
  the_front_desk:{name:'the front desk',desc:"welcome back. i've got your list, and i know which room can help.",rgb:'231,176,122'},
};
const DEFAULT_KEY = 'the_brother';
const CHIP_LABEL = (k) => k === 'the_stage' ? 'the stage' : k === 'the_arena' ? 'the arena' : k === 'z_serious' ? 'the quiet room' : (PERSONAS[k]?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));
const faceFor = (key) => `https://callmez.app/faces/${key}.jpg?v=4`;

// ── small circular DP (cover-fit, aura edge, orb fallback) ──
function MiniDP({ uri, size = 38, rgb, isDesk = false }) {
  const [ok, setOk] = useState(true);
  return (
    <View style={[styles.miniWrap, { width: size, height: size, borderRadius: size / 2, borderColor: `rgba(${rgb},0.5)` }]}>
      {uri && ok ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
      ) : isDesk ? (
        <DeskOrb size={size} />
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: N.night2 }} />
      )}
    </View>
  );
}

// session cache of custom companion names (persona key → your name), so reopening
// a renamed chat shows YOUR name instantly instead of flashing the default first.
const NAME_CACHE = {};
const AVATAR_CACHE = {};   // persona key → custom avatar data-uri (same purpose)


// the desk's presence — Z's warm orb, for wherever the front desk needs a face
function DeskOrb({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs><RadialGradient id="deskorb" cx="40%" cy="34%" r="70%">
        <Stop offset="0%" stopColor="#F5D9AE" /><Stop offset="50%" stopColor="#E7B07A" /><Stop offset="100%" stopColor="#8a5a2f" />
      </RadialGradient></Defs>
      <Circle cx="24" cy="24" r="22" fill="url(#deskorb)" />
    </Svg>
  );
}

// texting register: an assistant reply with blank lines becomes several bubbles.
// BUT a bullet/numbered list must never be split across bubbles — a blank line
// before or inside a list would otherwise orphan the markers from their text
// (the "empty bubble with a lone dot" bug). So after splitting on blank lines we
// re-merge any segment that is (or starts as) a list back onto the segment before
// it, and merge consecutive list chunks together.
const fmtTime = (at) => { const d = at ? new Date(at) : null; return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''; };
const _isListLine = (s) => /^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(s);
const _startsAsList = (seg) => _isListLine(String(seg).split('\n')[0] || '');
const _isListy = (seg) => String(seg).split('\n').some(_isListLine);
const splitBursts = (t) => {
  const raw = String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const seg of raw) {
    // a segment that begins as a list, OR a list-containing segment following a
    // list/lead-in, sticks to the previous bubble instead of starting a new one.
    if (out.length && (_startsAsList(seg) || (_isListy(seg) && _isListy(out[out.length - 1])))) {
      out[out.length - 1] += '\n' + seg;
    } else {
      out.push(seg);
    }
  }
  return out;
};

// ── the evening programme's cards: [[CARD: kind | title | line | goto]] lives
// in the PERSISTED message (cron-written, no stream), parsed at render so
// weeks of programmes stay tappable in the scroll. ──
export const CARD_RE = /\[\[CARD:\s*([a-z]+)\s*\|([^|\]]+)\|([^|\]]+)\|\s*([a-z_:]+)\s*\]\]/gi;
export const parseCards = (t) => {
  const cards = [];
  const text = String(t || '').replace(CARD_RE, (_, kind, title, line, goto) => {
    cards.push({ kind: kind.trim(), title: title.trim(), line: line.trim(), goto: goto.trim() });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { text, cards };
};
const CARD_TINT = { social: '159,194,232', growth: '231,176,122', play: '143,217,143' };
export function ProgrammeCard({ card, onPress }) {
  const tint = CARD_TINT[card.kind] || '231,176,122';
  return (
    <Pressable onPress={onPress} style={[pcStyles.card, { borderLeftColor: `rgba(${tint},0.8)` }]}>
      <View style={{ flex: 1 }}>
        <Text style={[pcStyles.kind, { color: `rgba(${tint},0.9)` }]}>{card.kind}</Text>
        <Text style={pcStyles.title}>{card.title}</Text>
        <Text style={pcStyles.line}>{card.line}</Text>
      </View>
      <Text style={pcStyles.chev}>›</Text>
    </Pressable>
  );
}
const pcStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 13, borderRadius: 12, borderWidth: 1, borderLeftWidth: 3, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)', maxWidth: '88%' },
  kind: { fontFamily: 'Figtree_600SemiBold', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontFamily: 'Figtree_500Medium', color: 'rgba(245,236,225,0.92)', fontSize: 14.5, marginTop: 2 },
  line: { fontFamily: 'Figtree_300Light', color: 'rgba(245,236,225,0.55)', fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  chev: { color: 'rgba(245,236,225,0.4)', fontSize: 22, paddingLeft: 10 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(231,176,122,0.4)', backgroundColor: 'rgba(231,176,122,0.07)' },
  chipTxt: { fontFamily: 'Figtree_500Medium', color: 'rgba(240,201,144,0.95)', fontSize: 12.5 },
  profHint: { fontFamily: 'Figtree_300Light', color: 'rgba(232,236,244,0.35)', fontSize: 10.5, textAlign: 'center', marginTop: 6 },
  profLine: { fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(232,236,244,0.55)', fontSize: 14.5, lineHeight: 21, textAlign: 'center', paddingHorizontal: 40, marginTop: 10 },
  profLabel: { fontFamily: 'Figtree_600SemiBold', color: 'rgba(159,194,232,0.8)', fontSize: 11.5, letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 26, marginTop: 26, marginBottom: 10 },
  profDate: { fontFamily: 'Figtree_600SemiBold', color: 'rgba(232,236,244,0.4)', fontSize: 10, letterSpacing: 0.8 },
  profEntry: { fontFamily: 'Figtree_400Regular', color: 'rgba(232,236,244,0.72)', fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  profBlurb: { fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(232,236,244,0.8)', fontSize: 15, lineHeight: 24 },
  stamp: { fontFamily: 'Figtree_300Light', color: 'rgba(233,232,240,0.30)', fontSize: 10, marginTop: 3, alignSelf: 'flex-start' },
});

export default function Chat({ personaKey = DEFAULT_KEY, onBack = () => {}, initialDraft = '', autoSend = false, onRoute = () => {}, diag = false, onCost }) {
  const KEY = PERSONAS[personaKey] ? personaKey : DEFAULT_KEY;
  // a tapped card walks them through a door — same mapping the desk lobby used
  const routeTo = (key) => {
    if (key === 'the_anchor') return onRoute({ tab: 'bulletin' });
    if (key === 'the_arena' || key.startsWith('the_arena:')) {
      const seg = key.split(':');
      return onRoute({ tab: 'play', open: 'arena', game: seg[1] || null, opp: seg[2] || null });
    }
    if (key === 'the_stage') return onRoute({ tab: 'stage' });
    if (key === 'the_journal') return onRoute({ tab: 'journal' });
    if (key === 'z_serious') return onRoute({ tab: 'quiet' });
    return onRoute({ tab: 'gathering', persona: key });
  };
  // the hero treatment: only the pinned trinity stream live. residents text
  // like people — typing indicator, then the whole message lands at once.
  const [showProfile, setShowProfile] = React.useState(false);
  const [profDiary, setProfDiary] = React.useState(null);
  const [profBlurb, setProfBlurb] = React.useState(null);
  const openProfile = () => { setShowProfile(true); if (profDiary === null) getPersonaDiary(KEY).then((r) => { setProfDiary((r && r.entries) ? r.entries : []); setProfBlurb((r && r.blurb) ? r.blurb : null); }); };
  const LIVE_STREAM = KEY === 'z' || KEY === 'z_serious' || KEY === 'the_anchor';   // Z + the anchor stream live; the desk delivers in blocks
  const WARM = KEY === 'the_anchor' || KEY === 'the_front_desk' || LIVE_STREAM; // trinity keeps the warm register
  const PLAIN = !LIVE_STREAM; // whatsapp-flat: no italics/bold for anyone but Z
  const flat = (t) => PLAIN ? String(t || '').replace(/\*\*?/g, '') : t;
  const P = PERSONAS[KEY];
  const rgb = P.rgb;
  const dp = faceFor(KEY);

  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);  // { data, uri } — a photo staged to send
  const voice = useVoiceNote();
  const [transcribing, setTranscribing] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  // the name YOU gave this companion (seed from cache so no default-name flash on reopen)
  const [cname, setCname] = useState(NAME_CACHE[KEY] || P.name);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(NAME_CACHE[KEY] || P.name);
  // custom avatar (data-uri) if the user set one; else null → falls back to the persona face
  const [avatar, setAvatar] = useState(AVATAR_CACHE[KEY] || null);

  const scrollRef = useRef(null);
  const sendingRef = useRef(false);
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialDraft) return;
    seededRef.current = true;
    if (autoSend) { setTimeout(() => doSend(initialDraft), 600); }
    else setDraft(initialDraft);
  }, []);
  const targetRef = useRef('');
  const shownRef = useRef('');
  const shownBurstsRef = useRef(0);       // resident delivery: bursts already popped
  const streamDoneRef = useRef(false);
  const pacingRef = useRef(false);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const seed = NAME_CACHE[KEY] || P.name;
    setCname(seed); setNameDraft(seed); setEditingName(false);
    setAvatar(AVATAR_CACHE[KEY] || null);
    loadSession().then(() => openThreadInfo(KEY, P.name)).then((info) => {
      if (!info) return;
      setThreadId(info.id);
      markThreadRead(info.id);   // opening the chat clears its unread badge
      if (info.name) { NAME_CACHE[KEY] = info.name; setCname(info.name); setNameDraft(info.name); }
      if (info.avatar) { AVATAR_CACHE[KEY] = info.avatar; setAvatar(info.avatar); }
      // the past belongs on the screen: load this thread's saved conversation
      getRoomMessages(info.id).then((j) => {
        const hist = (j.messages || [])
          .map((m, i) => ({ id: 'h' + (m.id || i), who: m.role === 'user' ? 'you' : 'them', text: m.content || '', at: m.created_at }))
          .filter((m) => m.text);
        if (hist.length) {
          setMessages((cur) => (cur.length ? cur : hist));
          // the thread opens where the conversation IS — at the end, like any chat app
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 350);
        }
      }).catch(() => {});
    });
  }, [KEY]);

  // commit a rename: persist to the thread, update what's shown. empty or unchanged = no-op.
  const commitName = async () => {
    const nn = nameDraft.trim();
    setEditingName(false);
    if (!nn || nn === cname) { setNameDraft(cname); return; }
    NAME_CACHE[KEY] = nn;
    setCname(nn);
    if (threadId) await renameThread(threadId, nn);
  };

  // pick + set a custom avatar: square crop, compressed, stored as a small data-uri.
  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      AVATAR_CACHE[KEY] = uri;
      setAvatar(uri);
      if (threadId) await setThreadAvatar(threadId, uri);
    } catch (e) {}
  };

  // pick a photo to SHARE into the chat (distinct from the avatar picker above).
  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.5, base64: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const b64 = res.assets[0].base64;
      setPendingImage({ data: b64, uri: `data:image/jpeg;base64,${b64}` });
    } catch (e) {}
  };

  // mic: tap to record, tap again to stop → Sarvam transcript FILLS the draft (you review, then send).
  const onMic = async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const r = await transcribeVoice(clip.uri, clip.mime);
        if (r.ok && r.transcript) {
          setDraft((d) => (d ? d + ' ' : '') + r.transcript);
        } else {
          Alert.alert('couldn’t catch that', r.diag || 'no transcript came back — try again.');
        }
      } catch (e) {
        Alert.alert('voice error', String(e?.message || e));
      }
      setTranscribing(false);
    } else {
      await voice.start();
    }
  };

  const scrollDown = () => { if (atBottomRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60); };

  const doClear = () => {
    Alert.alert(
      'clear this chat?',
      'this wipes the whole conversation and starts fresh. it can’t be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        { text: 'clear', style: 'destructive', onPress: async () => {
          pacingRef.current = false;
          if (threadId) await clearThread(threadId);
          setMessages([]); setDraft('');
          sendingRef.current = false; setSending(false);
        } },
      ],
    );
  };

  // resident delivery: bubbles pop ONE AT A TIME like a person texting.
  // a burst is complete once its \n\n boundary streams in (or the stream ends),
  // so the first bubble lands early; the rest follow with a human beat.
  const burstTick = (zId, finalize) => {
    if (!pacingRef.current) return;
    const done = streamDoneRef.current;
    const parts = splitBursts(targetRef.current);
    const complete = done ? parts.length : Math.max(0, parts.length - 1);
    if (shownBurstsRef.current < complete) {
      const n = shownBurstsRef.current + 1;
      shownBurstsRef.current = n;
      const isLast = done && n >= parts.length;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: parts.slice(0, n).join('\n\n'), typing: !isLast } : m)));
      scrollDown();
      if (isLast) { pacingRef.current = false; finalize && finalize(); return; }
      const justLanded = parts[n - 1] || '';
      setTimeout(() => burstTick(zId, finalize), Math.min(6000, Math.max(3000, 2600 + justLanded.length * 22)));
    } else if (done) {
      pacingRef.current = false;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: targetRef.current, typing: false } : m)));
      finalize && finalize();
    } else {
      setTimeout(() => burstTick(zId, finalize), 150);
    }
  };

  const revealTick = (zId, finalize) => {
    if (!pacingRef.current) return;
    const target = targetRef.current;
    const shown = shownRef.current;
    if (shown.length < target.length) {
      const backlog = target.length - shown.length;
      const step = backlog > 140 ? Math.ceil(backlog / 90) : 1;
      const next = target.slice(0, shown.length + step);
      shownRef.current = next;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: next, typing: true } : m)));
      scrollDown();
      const last = next[next.length - 1];
      let delay = 42;
      if ('.!?…'.includes(last)) delay = 360;
      else if (last === '\n') delay = 260;
      else if (',;:—'.includes(last)) delay = 180;
      delay += Math.random() * 22;
      setTimeout(() => revealTick(zId, finalize), delay);
    } else if (streamDoneRef.current) {
      pacingRef.current = false;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: target, typing: false } : m)));
      finalize && finalize();
    } else {
      setTimeout(() => revealTick(zId, finalize), 40);
    }
  };

  const doSend = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : draft).trim();
    const img = pendingImage;                     // capture before we clear it
    if ((!text && !img) || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    let tid = threadId;
    if (!tid) { const info = await openThreadInfo(KEY, P.name); tid = info?.id || null; if (tid) setThreadId(tid); }
    if (!tid) { sendingRef.current = false; setSending(false); return; }
    setDraft('');
    setPendingImage(null);
    const youMsg = { id: Date.now(), who: 'you', text, imageUri: img?.uri || null, at: Date.now() };
    const zId = Date.now() + 1;
    atBottomRef.current = true;
    setMessages((cur) => [...cur, youMsg, { id: zId, who: 'them', text: '', typing: true, at: Date.now() }]);
    scrollDown();

    targetRef.current = '';
    shownRef.current = '';
    shownBurstsRef.current = 0;
    streamDoneRef.current = false;
    pacingRef.current = true;
    const done = () => { sendingRef.current = false; setSending(false); };
    if (LIVE_STREAM) revealTick(zId, done); else burstTick(zId, done);

    streamChat({
      threadId: tid,
      message: text,
      image: img ? { media_type: 'image/jpeg', data: img.data } : undefined,
      persona: KEY,
      onToken: (acc) => { targetRef.current = acc; },
      onDone: (acc, cost) => {
        targetRef.current = acc || targetRef.current;
        streamDoneRef.current = true;
        if (cost) { setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, cost } : m))); if (onCost) onCost(cost.cost_inr || 0); }
      },
      onRoutes: (routes) => {
        const keys = (routes || []).filter((k) => typeof k === 'string').slice(0, 4);
        if (keys.length) setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, routes: keys } : m)));
      },
      onError: (msg) => {
        pacingRef.current = false;
        setMessages((cur) => cur.map((m) => m.id === zId ? { ...m, text: msg, typing: false } : m));
        sendingRef.current = false; setSending(false);
      },
    });
  };

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: WARM ? N.night : N.ink }} />;

  if (showProfile) return (
    <View style={{ flex: 1, backgroundColor: N.ink }}>
      <LinearGradient colors={[`rgba(${rgb},0.10)`, N.ink2, N.ink]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <Pressable hitSlop={12} onPress={() => setShowProfile(false)}><Text style={styles.chev}>‹</Text></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', paddingTop: 6 }}>
            <Pressable onPress={pickAvatar}>
              <Image source={{ uri: avatar || dp }} style={{ width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: `rgba(${rgb},0.55)` }} />
              <Text style={pcStyles.profHint}>tap to change photo</Text>
            </Pressable>
            {editingName ? (
              <TextInput value={nameDraft} onChangeText={setNameDraft} onSubmitEditing={commitName} onBlur={commitName} autoFocus returnKeyType="done" style={[styles.nameEdit, { fontSize: 24, marginTop: 14, textAlign: 'center' }]} maxLength={40} />
            ) : (
              <Pressable onPress={() => { setNameDraft(cname); setEditingName(true); }}>
                <Text style={{ fontFamily: 'Fraunces_400Regular', color: N.porcelain, fontSize: 26, marginTop: 14 }}>{cname}</Text>
                <Text style={pcStyles.profHint}>tap to rename</Text>
              </Pressable>
            )}
            <Text style={pcStyles.profLine}>{P.desc}</Text>
          </View>
          {profBlurb ? (
            <>
              <Text style={pcStyles.profLabel}>their story</Text>
              <View style={{ paddingHorizontal: 26 }}>
                <Text style={pcStyles.profBlurb}>{profBlurb}</Text>
              </View>
            </>
          ) : null}
          <Text style={pcStyles.profLabel}>their week</Text>
          <View style={{ paddingHorizontal: 26 }}>
            {profDiary === null && <Text style={pcStyles.profEntry}>fetching their days…</Text>}
            {Array.isArray(profDiary) && !profDiary.length && <Text style={pcStyles.profEntry}>their diary starts with tomorrow's morning.</Text>}
            {(profDiary || []).map((e) => (
              <View key={e.date} style={{ marginBottom: 12, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: `rgba(${rgb},0.35)` }}>
                <Text style={pcStyles.profDate}>{e.date}</Text>
                <Text style={pcStyles.profEntry}>{e.log_entry}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
  if (inCall) return <VideoCall persona={{ key: KEY, name: cname }} onEnd={() => setInCall(false)} />;

  const empty = messages.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* the room's own light — this persona's aura, falling from the top */}
      <LinearGradient colors={WARM ? [`rgba(${rgb},0.17)`, `rgba(${rgb},0.05)`, N.night] : [N.ink2, N.ink, N.ink]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* top bar */}
          <View style={styles.topbar}>
            <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
            <View style={styles.topWho}>
              <Pressable onPress={openProfile} hitSlop={6}><MiniDP uri={avatar || dp} rgb={rgb} isDesk={KEY === 'the_front_desk'} /></Pressable>
              <View style={{ marginLeft: 11, flex: 1 }}>
                <Pressable hitSlop={6} onPress={openProfile}>
                  <Text style={styles.topName} numberOfLines={1}>{cname}</Text>
                  <Text style={styles.topStatus}>tap for profile</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable hitSlop={10} onPress={doClear}>
                <Svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <Path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke={N.moonDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </Svg>
              </Pressable>
              <Pressable hitSlop={10} style={[styles.callBtn, { borderColor: `rgba(${rgb},0.3)` }]} onPress={() => setInCall(true)}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path d="M15 10l4.5-3v10L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke={`rgb(${rgb})`} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* conversation — fills the space; empty state centers instead of leaving a dead zone */}
          <ScrollView
            ref={scrollRef}
            style={styles.convo}
            contentContainerStyle={empty ? styles.convoEmpty : { paddingTop: 10, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
            }}>
            {empty ? (
              <View style={styles.epigraph}>
                <Pressable onPress={pickAvatar} style={[styles.epFace, { borderColor: `rgba(${rgb},0.5)`, shadowColor: `rgb(${rgb})` }]}>
                  {KEY === 'the_front_desk' && !avatar ? (
                    <DeskOrb size={120} />
                  ) : (
                    <Image source={{ uri: avatar || dp }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                  )}
                </Pressable>
                <Text style={styles.epName}>{cname}</Text>
                <Text style={styles.epLine}>{P.desc}</Text>
              </View>
            ) : (
              messages.map((m, mi) => (
                <View key={m.id} style={{ marginBottom: messages[mi + 1] && messages[mi + 1].who === m.who ? 4 : 14 }}>
                  {null}
                  {(m.text || '').trim() === '*buzz*' ? (
                    <Text style={[styles.buzzChip, m.who === 'you' && { alignSelf: 'flex-end' }]}>⚡ buzz</Text>
                  ) : m.who === 'you' ? (
                    <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '82%' }}>
                      {m.imageUri ? <Image source={{ uri: m.imageUri }} style={styles.sharedPhoto} /> : null}
                      {m.text ? <View style={[styles.youWrap, !WARM && styles.youWrapMoon, m.imageUri && { marginTop: 4 }]}><Text style={[styles.youText, !WARM && styles.youTextMoon]}>{m.text}</Text></View> : null}
                    </View>
                  ) : m.text ? (
                    (() => { const parsed = parseCards(m.text); return (
                      <>
                        {splitBursts(parsed.text).map((burst, bi) => (
                          <View key={bi} style={[styles.themWrap, !WARM && styles.themWrapMoon, bi > 0 && { marginTop: 4 }]}><RichText text={flat(burst)} style={(KEY === 'z' || KEY === 'z_serious') ? styles.themText : WARM ? styles.themTextWarm : styles.themTextMoon} /></View>
                        ))}
                        {parsed.cards.map((c, ci) => (
                          <ProgrammeCard key={ci} card={c} onPress={() => routeTo(c.goto)} />
                        ))}
                        {m.routes && m.routes.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 }}>
                            {m.routes.map((rk) => (
                              <Pressable key={rk} onPress={() => routeTo(rk)} style={pcStyles.chip}><Text style={pcStyles.chipTxt}>{CHIP_LABEL(rk)} ›</Text></Pressable>
                            ))}
                          </View>
                        )}
                        {m.typing ? <Text style={[styles.themText, { marginTop: 5 }]}>…</Text> : null}
                      </>
                    ); })()
                  ) : (
                    <Text style={styles.themText}>{m.typing ? '…' : ''}</Text>
                  )}
                  {m.at && !m.typing ? <Text style={[pcStyles.stamp, m.who === 'you' && { alignSelf: 'flex-end' }]}>{fmtTime(m.at)}</Text> : null}
                  {diag && m.who === 'them' && m.cost && !m.typing ? <Text style={styles.costWhisper}>₹{Number(m.cost.cost_inr).toFixed(4)} · {m.cost.fn}{m.cost.usage ? ' · ' + m.cost.usage.in + '→' + m.cost.usage.out : ''}</Text> : null}
                </View>
              ))
            )}
          </ScrollView>

          {/* composer */}
          {pendingImage ? (
            <View style={styles.pendingStrip}>
              <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} />
              <Pressable onPress={() => setPendingImage(null)} style={styles.pendingX} hitSlop={8}>
                <Text style={styles.pendingXTxt}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.composer}>
            <View style={[styles.field, { flexDirection: 'row', alignItems: 'flex-end' }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={voice.recording ? 'listening…' : `message ${cname}…`}
                placeholderTextColor={N.moonFaint}
                style={[styles.input, { maxHeight: 120, flex: 1 }]}
                multiline
                editable={!sending}
              />
              <Pressable style={styles.inlineBtn} onPress={pickPhoto} disabled={sending} hitSlop={6}>
                <Text style={styles.inlineBtnTxt}>＋</Text>
              </Pressable>
              <Pressable style={styles.inlineBtn} onPress={onMic} disabled={sending || transcribing} hitSlop={6}>
                <Text style={[styles.inlineMicTxt, voice.recording && styles.micBtnLive]}>{transcribing ? '…' : voice.recording ? '■' : '🎤'}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.send} onPress={() => doSend()}>
              <Svg width="48" height="48" viewBox="0 0 48 48">
                <Defs><RadialGradient id="csend" cx="42%" cy="36%" r="66%">
                  <Stop offset="0%" stopColor={N.candleHot} /><Stop offset="52%" stopColor={N.candle} /><Stop offset="100%" stopColor="#c88a4f" />
                </RadialGradient></Defs>
                <Circle cx="24" cy="24" r="18" fill="url(#csend)" />
                <Path d="M17 24 L31 18 L26.5 31 L23 25.5 Z" fill="#2a1c10" />
              </Svg>
            </Pressable>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  costWhisper: { fontFamily: 'Figtree_300Light', color: 'rgba(240,167,101,0.55)', fontSize: 10, letterSpacing: 0.3, marginTop: 2, alignSelf: 'flex-start' },
  themWrap: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  buzzChip: { fontFamily: 'Figtree_600SemiBold', color: '#F0A765', fontSize: 13, letterSpacing: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(240,167,101,0.45)', overflow: 'hidden', alignSelf: 'flex-start' },
  inlineBtn: { paddingHorizontal: 9, paddingBottom: 11, alignItems: 'center', justifyContent: 'flex-end' },
  inlineBtnTxt: { fontSize: 24, color: '#F0A765', lineHeight: 26 },
  inlineMicTxt: { fontSize: 17, color: '#F0A765', lineHeight: 24 },
  micBtnLive: { color: '#FF6B5A', fontSize: 19 },
  sharedPhoto: { width: 200, height: 200, borderRadius: 16, resizeMode: 'cover' },
  pendingStrip: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row' },
  pendingThumb: { width: 64, height: 64, borderRadius: 10, resizeMode: 'cover' },
  pendingX: { position: 'absolute', left: 68, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  pendingXTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  root: { flex: 1, backgroundColor: N.night },

  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },
  topWho: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  miniWrap: { overflow: 'hidden', borderWidth: 1.5 },
  topName: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 18, lineHeight: 21 },
  nameEdit: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 18, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: N.candle, minWidth: 120 },
  topStatus: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 1 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)' },

  convo: { flex: 1, paddingHorizontal: 22 },
  convoEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 40 },

  epigraph: { alignItems: 'center' },
  epFace: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', borderWidth: 1.5, marginBottom: 22,
    shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  epName: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 24, marginBottom: 16 },
  epLine: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moonDim, fontSize: 19, lineHeight: 29, textAlign: 'center', letterSpacing: 0.1 },

  themText: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moon, fontSize: 18, lineHeight: 28, letterSpacing: 0.1 },
  youWrap: { alignSelf: 'flex-end', maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, borderTopRightRadius: 6, backgroundColor: 'rgba(231,176,122,0.10)', borderWidth: 1, borderColor: 'rgba(231,176,122,0.16)' },
  youText: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, lineHeight: 22 },
  themTextWarm: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, lineHeight: 21, letterSpacing: 0.1 },
  themWrapMoon: { backgroundColor: 'rgba(232,236,244,0.05)', borderColor: 'rgba(232,236,244,0.08)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, borderTopLeftRadius: 5 },
  themTextMoon: { fontFamily: 'Figtree_400Regular', color: N.porcelain, fontSize: 14.5, lineHeight: 19, letterSpacing: 0 },
  youWrapMoon: { backgroundColor: 'rgba(159,194,232,0.10)', borderColor: 'rgba(159,194,232,0.18)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, borderTopRightRadius: 5 },
  youTextMoon: { fontFamily: 'Figtree_400Regular', color: N.porcelain, fontSize: 14.5, lineHeight: 19 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  field: { flex: 1, borderRadius: 24, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, paddingHorizontal: 18, paddingVertical: 13 },
  send: { width: 48, height: 48 },
});
