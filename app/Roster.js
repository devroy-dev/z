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
import { nameOf, lineOf, groupsList, rgbOf } from './roster';
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
import { getPins, togglePin as togglePinApi, listThreads, getPersonaStates, listCustomPersonas } from './api';

const C = {
  void: '#090C12', ground: '#08070B',            // Moonlight — cold ink, matches the chat
  cream: '#E8ECF4', muted: '#9E9DB0', faint: '#6A6675',
  moonBlue: '#9FC2E8', hair: 'rgba(233,232,240,0.10)',
  ember: '#E7B07A', emberHot: '#F3CFA3', emberDeep: '#C88A4F',  // candle kept only for the pin star
};

// ── constellations keep their identity by NAME, not by room-lighting the screen.
// Moonlight register: every group tone is moon-blue; the persona's own aura survives
// only as a faint ring accent per row (set below), never as a full-screen wash. ──
// [manifest] the local GROUPS/PERSONAS registries are dead — one roster,
// served (./roster). Constellations render from groupsList(); every group
// keeps the moonlight tone (the register law above).
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=6`;   // [zip54r]
const toneFor = (k) => (groupsList().some(g => g.keys.includes(k)) ? C.moonBlue : C.ember);

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
  const p = { name: nameOf(pkey), desc: lineOf(pkey) };
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

// ── [§8.4] TONIGHT — three spotlit presences. Freshest daily states, biased
// hard toward the ones not talked to in 7 days (or never): the cold-start
// answer to a shelf of two dozen faces. Pinned faces already glow on the
// shelf, so they sit this row out.
function pickTonight(states, recency, pins) {
  const WEEK = 7 * 864e5;
  const shelf = groupsList().flatMap((g) => g.keys);
  const cands = shelf.filter((k) => states[k] && states[k].status_line && !pins.includes(k));
  const quiet = (k) => { const la = recency[k]; return !la || (Date.now() - new Date(la).getTime()) > WEEK; };
  const ranked = [...cands].sort((a, b) => {
    const q = (quiet(b) ? 1 : 0) - (quiet(a) ? 1 : 0);
    if (q) return q;   // the not-talked-to rise first
    const ra = recency[a] ? new Date(recency[a]).getTime() : 0;
    const rb = recency[b] ? new Date(recency[b]).getTime() : 0;
    return ra - rb;    // then the longest-quiet among the rest
  });
  return ranked.slice(0, 3);
}

function TonightRow({ states, recency, pins, onOpen, names = {} }) {
  const picks = pickTonight(states, recency, pins);
  if (!picks.length) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.shelfLabel}>tonight</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}>
        {picks.map((k) => (
          <Pressable key={k} onPress={() => onOpen(k)} style={{ width: 210, borderRadius: 16, borderWidth: 1, borderColor: `rgba(${rgbOf(k)},0.30)`, backgroundColor: `rgba(${rgbOf(k)},0.07)`, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Presence pkey={k} tone={C.moonBlue} size={46} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>{names[k] || nameOf(k)}</Text>
              <Text style={styles.rowStatus} numberOfLines={2}>“{states[k].status_line}”</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
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
            <Text style={styles.shelfName} numberOfLines={1}>{names[k] || nameOf(k)}</Text>
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
    return nameOf(k).toLowerCase().includes(q) || (lineOf(k) || '').toLowerCase().includes(q);
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

export default function Roster({ onOpen = () => {}, onCreate = () => {} }) {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  // favourites come from the DB, but seed from the session cache so the shelf
  // shows immediately on remount (no empty flash); the fetch reconciles quietly.
  const [pins, setPins] = useState(PINS_CACHE);
  const [query, setQuery] = useState('');
  const [states, setStates] = useState({});
  const [recency, setRecency] = useState({});   // [§8.4] persona_key → last_active
  useEffect(() => { getPersonaStates().then(setStates).catch(() => {}); }, []);
  const [refreshing, setRefreshing] = useState(false);
  const pullRefresh = async () => {
    setRefreshing(true);
    try { setStates(await getPersonaStates()); } catch (e) {}
    setRefreshing(false);
  };
  useEffect(() => { getPins().then((p) => { PINS_CACHE = p; setPins(p); }); }, []);
  const [customs, setCustoms] = useState([]);
  useEffect(() => { listCustomPersonas().then((r) => setCustoms((r && r.personas) || [])); }, []);
  // overlay your custom companion names on top of the persona defaults
  const [names, setNames] = useState(NAMES_CACHE);
  useEffect(() => {
    listThreads().then((ts) => {
      if (!Array.isArray(ts)) return;
      const m = {};
      ts.forEach((t) => { if (t?.persona_key && t?.companion_name) m[t.persona_key] = t.companion_name; });
      NAMES_CACHE = m; setNames(m);
      const rec = {};
      ts.forEach((t) => { if (t?.persona_key && t?.last_active) rec[t.persona_key] = t.last_active; });   // [§8.4] recency for the tonight bias
      setRecency(rec);
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
        <LinearGradient colors={['#0D1119', '#090C12', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullRefresh} tintColor="#9FC2E8" colors={["#9FC2E8"]} progressBackgroundColor="#100E15" />}>
            {query.trim().length === 0 && (<>
              <TonightRow states={states} recency={recency} pins={pins} onOpen={onOpen} names={names} />
              <PinnedShelf pins={pins} onOpen={onOpen} onPin={togglePin} names={names} />
            </>)}
            {query.trim().length === 0 && (
              <View style={styles.constellation}>
                <View style={styles.groupHead}>
                  <View style={[styles.groupDot, { backgroundColor: '#E7B07A', shadowColor: '#E7B07A' }]} />
                  <Text style={styles.groupName}>Your People</Text>
                  <Text style={styles.groupSub}>the ones you made</Text>
                </View>
                {customs.map((c) => (
                  <Pressable key={c.key} style={styles.row} onPress={() => onOpen(c.key)}>
                    <View style={[styles.faceRing, { width: 46, height: 46, borderRadius: 23, borderColor: c.tone || '#E7B07A', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontFamily: 'Fraunces_400Regular', color: c.tone || '#E7B07A', fontSize: 20 }}>{(c.name && c.name[0] ? c.name[0] : '✦').toUpperCase()}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{c.name}</Text>
                      <Text style={styles.rowDesc}>made by you · private</Text>
                    </View>
                  </Pressable>
                ))}
                <Pressable style={styles.row} onPress={onCreate}>
                  <View style={[styles.faceRing, { width: 46, height: 46, borderRadius: 23, borderColor: 'rgba(233,232,240,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: C.muted, fontSize: 22, lineHeight: 24 }}>+</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>create someone</Text>
                    <Text style={styles.rowDesc}>{customs.length >= 3 ? 'the house holds three — retire one to make room' : 'six questions and they exist'}</Text>
                  </View>
                </Pressable>
              </View>
            )}
            {groupsList().map((g) => (
              <Constellation key={g.id} group={{ ...g, name: g.label, tone: C.moonBlue }} pins={pins} onPin={togglePin} onOpen={onOpen} query={query} names={names} states={states} />
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
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, backgroundColor: 'rgba(233,232,240,0.04)', borderWidth: 1, borderColor: C.hair },
  searchInput: { flex: 1, fontFamily: 'Figtree_400Regular', color: C.cream, fontSize: 15, padding: 0 },
  searchClear: { color: C.muted, fontSize: 22, paddingHorizontal: 4 },
  kicker: { fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 34, marginTop: 2, letterSpacing: 0.3 },

  // pinned shelf
  shelf: { marginTop: 6, marginBottom: 18 },
  shelfLabel: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 13, paddingHorizontal: 24, marginBottom: 12 },
  shelfItem: { alignItems: 'center', width: 86 },
  shelfStar: { position: 'absolute', top: -2, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,9,18,0.85)' },
  shelfStarTxt: { color: C.moonBlue, fontSize: 13, lineHeight: 15 },
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
  rowStatus: { fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(232,236,244,0.60)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  rowDesc: { fontFamily: 'Figtree_300Light', color: C.muted, fontSize: 12.5, marginTop: 2 },
  pinHit: { paddingHorizontal: 8, paddingVertical: 6 },
  pin: { fontSize: 18, color: C.faint, opacity: 0.6 },

  // presence
  faceRing: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#0D1119' },
  faceWash: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(159,194,232,0.16)' },
});
