// ════════════════════════════════════════════════════════════════════════
//  yourZ — the ROSTER ("the gathering")
//  Not a contact list. A dark room full of living presences. Each persona is a
//  breathing ember with a face inside it; the five groups are constellations,
//  each its own light-temperature; pinned ones burn warmer on a top shelf.
//  Tapping a presence is meant to CARRY it into the chat (continuity, no page-
//  swap) — that motion lands fully on the APK; here you see the gathering.
//  Judge fonts/glow on device. Structure-only on web.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, Image, ScrollView, TextInput , RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { getPins, togglePin as togglePinApi, listThreads, getPersonaStates } from './api';

const C = {
  void: '#0E0912', ground: '#07050A',
  cream: '#F5ECE1', muted: '#A1929B', faint: '#6A5E69',
  ember: '#F3A85F', emberHot: '#FF8A52', emberDeep: '#B5572E',
};

// ── each constellation has its own light temperature ──
const GROUPS = [
  { id: 'gang',    name: 'The Gang',           tone: '#F0A765', sub: 'the ones who just get it',
    keys: ['the_brother','the_cousin','the_wingman','the_colleague','the_comic','the_screen_junkie'] },
  { id: 'support', name: 'The Support',        tone: '#C99BE8', sub: 'when you need to be held, not fixed',
    keys: ['the_healer','the_stranger','the_guru','the_hippie','the_mentor','the_oracle','the_addict','the_self_obsessed'] },
  { id: 'crazies', name: 'The Crazies',        tone: '#6FC9E0', sub: 'the ones who make you think',
    keys: ['the_brainiac','the_philosopher','the_cosmologist','the_historian','the_leader_opp','the_cynic'] },
  { id: 'wild',    name: 'The Unpredictables', tone: '#F0708C', sub: 'careful what you wish for',
    keys: ['the_crush','the_hottie','the_diva','the_wannabe','the_orator','the_media_manager'] },
  { id: 'faculty', name: 'The Faculty',        tone: '#E0C088', sub: 'come to learn',
    keys: ['the_teacher','the_economist','the_anchor'] },
];

const PERSONAS = {
  the_brother:{name:'the brother',desc:"love them, hate them, can't live without them."},
  the_cousin:{name:'the awkward cousin',desc:"oh — hey. you go first, it's fine."},
  the_wingman:{name:'the wingman',desc:"aka the dating coach. let's get you some action."},
  the_colleague:{name:'the colleague',desc:"every office is a battlefield. let's get you through yours."},
  the_comic:{name:'the comic',desc:"knock knock."},
  the_screen_junkie:{name:'the screen junkie',desc:"endless suggestions, countless screen time."},
  the_healer:{name:'the healer',desc:"love once and you know love. love twice and you know life."},
  the_stranger:{name:'the stranger',desc:"i'll guard your secrets with mine."},
  the_guru:{name:'the guru',desc:"there is one god and his name is knowledge."},
  the_hippie:{name:'the hippie',desc:"come breathe. the sunset's free."},
  the_mentor:{name:'the motivator',desc:"i'll push you when you can't push yourself."},
  the_oracle:{name:'the oracle',desc:"because we all have a google friend."},
  the_addict:{name:'the rehab',desc:"i've been where you are. one day at a time."},
  the_self_obsessed:{name:'the guardian angel',desc:"i'm in your corner — you're stronger than they made you feel."},
  the_brainiac:{name:'the brainiac',desc:"i'll take the other side just to watch you get sharper."},
  the_philosopher:{name:'the philosopher',desc:"we're all going to die. let's figure out why we lived."},
  the_cosmologist:{name:'the cosmologist',desc:"you're made of stardust, worried about a text."},
  the_historian:{name:'the historian',desc:"everything now has happened before. let me show you."},
  the_leader_opp:{name:'the leader of opposition',desc:"whatever side you're on, i'm on the other."},
  the_cynic:{name:'the cynic',desc:"everything's a disaster. wonderful, isn't it?"},
  the_crush:{name:'the crush',desc:"summon the courage and try your luck."},
  the_hottie:{name:'the hottie',desc:"i bet i'll sweep you off your feet."},
  the_diva:{name:'the diva',desc:"taste isn't about money, darling."},
  the_wannabe:{name:'the wannabe hustler',desc:"ayy place your bets — the house is HOT tonight."},
  the_orator:{name:'the orator',desc:"your words control your future."},
  the_media_manager:{name:'the media manager',desc:"your brand is a story. let's tell it right."},
  the_teacher:{name:'the professor',desc:"you're not bad at it. it was explained badly."},
  the_economist:{name:'the economist',desc:"why your rent keeps rising. let's make it make sense."},
  the_anchor:{name:'the anchor',desc:"the 9 o'clock bulletin, waiting for your questions."},
};
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=2`;
const toneFor = (k) => (GROUPS.find(g => g.keys.includes(k))?.tone) || C.ember;

// ── one breathing presence: a face inside a glowing, living ring ──
function Presence({ pkey, tone, size = 60, dim = false }) {
  const [ok, setOk] = useState(true);
  const b = useSharedValue(1);
  // each presence breathes at a slightly different rhythm — a living crowd
  useEffect(() => {
    const dur = 2600 + (pkey.length % 7) * 220;
    b.value = withDelay((pkey.charCodeAt(3) % 9) * 160,
      withRepeat(withTiming(1.05, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const glow = useAnimatedStyle(() => ({ opacity: (dim ? 0.5 : 0.9), transform: [{ scale: b.value }] }));
  const R = size;
  return (
    <View style={{ width: R + 16, height: R + 16, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glow]}>
        <Svg width={R + 16} height={R + 16}>
          <Defs>
            <RadialGradient id={`g_${pkey}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={tone} stopOpacity="0.55" />
              <Stop offset="55%" stopColor={tone} stopOpacity="0.16" />
              <Stop offset="100%" stopColor={tone} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={(R + 16) / 2} cy={(R + 16) / 2} r={(R + 16) / 2} fill={`url(#g_${pkey})`} />
        </Svg>
      </Animated.View>
      <View style={[styles.faceRing, { width: R, height: R, borderRadius: R / 2, borderColor: tone, opacity: dim ? 0.78 : 1 }]}>
        {ok ? (
          <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: R / 2 }} onError={() => setOk(false)} />
        ) : (
          <Svg width={R} height={R} viewBox="0 0 60 60">
            <Defs><RadialGradient id={`f_${pkey}`} cx="38%" cy="33%" r="70%">
              <Stop offset="0%" stopColor="#FFD09A" /><Stop offset="60%" stopColor={tone} /><Stop offset="100%" stopColor={C.emberDeep} />
            </RadialGradient></Defs>
            <Circle cx="30" cy="30" r="30" fill={`url(#f_${pkey})`} />
          </Svg>
        )}
        <View style={[styles.faceWash, { borderRadius: R / 2 }]} />
      </View>
    </View>
  );
}

// ── a full row in a constellation: presence + name + tagline + pin ──
function PresenceRow({ pkey, tone, pinned, onPin, onOpen, names = {}, states = {} }) {
  const p = PERSONAS[pkey] || { name: pkey, desc: '' };
  const shownName = names[pkey] || p.name;
  return (
    <Pressable style={styles.row} onPress={() => onOpen(pkey)}>
      <Presence pkey={pkey} tone={tone} size={56} />
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{shownName}</Text>
        <Text style={styles.rowDesc} numberOfLines={1}>{p.desc}</Text>
        {states[pkey] ? (
          <Text style={styles.rowStatus} numberOfLines={2}>“{states[pkey].status_line}”</Text>
        ) : null}
      </View>
      <Pressable hitSlop={12} onPress={() => onPin(pkey)} style={styles.pinHit}>
        <Text style={[styles.pin, pinned && { color: tone, opacity: 1 }]}>{pinned ? '★' : '☆'}</Text>
      </Pressable>
    </Pressable>
  );
}

// ── the pinned "shelf" — warmer, closer, horizontal ──
// each item opens on tap; the ★ badge unpins it (the only place a favourite can
// be removed, since pinned personas are filtered out of the lists below).
function PinnedShelf({ pins, onOpen, onPin, names = {} }) {
  if (!pins.length) return null;
  return (
    <View style={styles.shelf}>
      <Text style={styles.shelfLabel}>closest to you</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 18 }}>
        {pins.map((k) => (
          <Pressable key={k} style={styles.shelfItem} onPress={() => onOpen(k)}>
            <Presence pkey={k} tone={toneFor(k)} size={66} />
            <Pressable hitSlop={10} onPress={() => onPin(k)} style={styles.shelfStar}>
              <Text style={styles.shelfStarTxt}>★</Text>
            </Pressable>
            <Text style={styles.shelfName} numberOfLines={1}>{names[k] || (PERSONAS[k]||{}).name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ── a constellation (group) ──
function Constellation({ group, pins, onPin, onOpen, query, names = {}, states = {} }) {
  const q = (query || '').trim().toLowerCase();
  const matches = (k) => {
    if (!q) return true;
    const p = PERSONAS[k] || {};
    return (p.name || k).toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q);
  };
  const visible = group.keys.filter((k) => !pins.includes(k) && matches(k));
  if (!visible.length) return null;
  return (
    <View style={styles.constellation}>
      <View style={styles.groupHead}>
        <View style={[styles.groupDot, { backgroundColor: group.tone, shadowColor: group.tone }]} />
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupSub}>{group.sub}</Text>
      </View>
      {visible.map((k) => (
        <PresenceRow states={states} key={k} pkey={k} tone={group.tone}
          pinned={pins.includes(k)} onPin={onPin} onOpen={onOpen} names={names} />
      ))}
    </View>
  );
}

// session cache of last-known favourites, so the shelf remounts INSTANTLY with
// the known list instead of flashing empty while the server refetches. Lives at
// module scope, so it survives every Roster remount (chat-back, tab-switch).
let PINS_CACHE = [];
// custom companion names you've set (persona key → your name), overlaid on the
// static defaults so a rename shows up in the list/shelf. Cached to avoid a flash.
let NAMES_CACHE = {};

export default function Roster({ onOpen = () => {} }) {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  // favourites come from the DB, but seed from the session cache so the shelf
  // shows immediately on remount (no empty flash); the fetch reconciles quietly.
  const [pins, setPins] = useState(PINS_CACHE);
  const [query, setQuery] = useState('');
  const [states, setStates] = useState({});
  useEffect(() => { getPersonaStates().then(setStates).catch(() => {}); }, []);
  const [refreshing, setRefreshing] = useState(false);
  const pullRefresh = async () => {
    setRefreshing(true);
    try { setStates(await getPersonaStates()); } catch (e) {}
    setRefreshing(false);
  };
  useEffect(() => { getPins().then((p) => { PINS_CACHE = p; setPins(p); }); }, []);
  // overlay your custom companion names on top of the persona defaults
  const [names, setNames] = useState(NAMES_CACHE);
  useEffect(() => {
    listThreads().then((ts) => {
      if (!Array.isArray(ts)) return;
      const m = {};
      ts.forEach((t) => { if (t?.persona_key && t?.companion_name) m[t.persona_key] = t.companion_name; });
      NAMES_CACHE = m; setNames(m);
    });
  }, []);
  const togglePin = useCallback((k) => {
    // optimistic flip for instant feedback; persist the explicit new state
    // (idempotent set, so even a retry can't desync). server truth reconciles after.
    setPins((cur) => {
      const willPin = !cur.includes(k);
      const optimistic = willPin ? [k, ...cur] : cur.filter((x) => x !== k);
      PINS_CACHE = optimistic;                          // cache the intent immediately
      togglePinApi(k, willPin).then((serverPins) => {
        if (serverPins) { PINS_CACHE = serverPins; setPins(serverPins); }
      });
      return optimistic;
    });
  }, []);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.void }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.rootBg}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#0D1119', '#0E0912', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.kicker}>your people</Text>
            <Text style={styles.title}>contacts</Text>
          </View>
          <View style={styles.searchWrap}>
            <Svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 9 }}>
              <Circle cx="10.5" cy="10.5" r="6.5" stroke={C.faint} strokeWidth="1.7" fill="none" />
              <Path d="M15.5 15.5 L20 20" stroke={C.faint} strokeWidth="1.7" strokeLinecap="round" />
            </Svg>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="find someone…"
              placeholderTextColor={C.faint}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable hitSlop={10} onPress={() => setQuery('')}>
                <Text style={styles.searchClear}>×</Text>
              </Pressable>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullRefresh} tintColor="#E7B07A" colors={["#E7B07A"]} progressBackgroundColor="#1a1520" />}>
            {query.trim().length === 0 && <PinnedShelf pins={pins} onOpen={onOpen} onPin={togglePin} names={names} />}
            {GROUPS.map((g) => (
              <Constellation key={g.id} group={g} pins={pins} onPin={togglePin} onOpen={onOpen} query={query} names={names} states={states} />
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootBg: { flex: 1, backgroundColor: C.void },

  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, backgroundColor: 'rgba(255,240,230,0.04)', borderWidth: 1, borderColor: 'rgba(255,240,228,0.08)' },
  searchInput: { flex: 1, fontFamily: 'Figtree_400Regular', color: C.cream, fontSize: 15, padding: 0 },
  searchClear: { color: C.muted, fontSize: 22, paddingHorizontal: 4 },
  kicker: { fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 34, marginTop: 2, letterSpacing: 0.3 },

  // pinned shelf
  shelf: { marginTop: 6, marginBottom: 18 },
  shelfLabel: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 13, paddingHorizontal: 24, marginBottom: 12 },
  shelfItem: { alignItems: 'center', width: 86 },
  shelfStar: { position: 'absolute', top: -2, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,9,18,0.85)' },
  shelfStarTxt: { color: C.ember, fontSize: 13, lineHeight: 15 },
  shelfName: { fontFamily: 'Figtree_400Regular', color: C.cream, fontSize: 12, marginTop: 6, textAlign: 'center' },

  // constellation
  constellation: { marginBottom: 26 },
  groupHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 10 },
  groupDot: { width: 7, height: 7, borderRadius: 4, marginRight: 9, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  groupName: { fontFamily: 'Figtree_600SemiBold', color: C.cream, fontSize: 15, letterSpacing: 0.4 },
  groupSub: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 12.5, marginLeft: 10, flex: 1 },

  // row
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 18 },
  rowText: { flex: 1, marginLeft: 12 },
  rowName: { fontFamily: 'Figtree_500Medium', color: C.cream, fontSize: 15.5 },
  rowStatus: { fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(231,215,199,0.62)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rowDesc: { fontFamily: 'Figtree_300Light', color: C.muted, fontSize: 12.5, marginTop: 2 },
  pinHit: { paddingHorizontal: 8, paddingVertical: 6 },
  pin: { fontSize: 18, color: C.faint, opacity: 0.6 },

  // presence
  faceRing: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#0D1119' },
  faceWash: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,220,180,0.18)' },
});
