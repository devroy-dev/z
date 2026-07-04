// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE ROOMS WORLD · NIGHTFALL
//  A together-space: several presences share one pool of light (vs. the single
//  presences in the Gathering). Order: a full-width "gather a room" bar, then
//  SUGGESTED rooms (daily, web-informed, refreshable — tap to spin one up),
//  then YOUR rooms (live), then PUBLIC (coming soon).
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { getRoomSuggestions, listRooms, createRoom, leaveRoom, deleteRoomThread } from './api';
import Grain from './Grain';

const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)', moonFaint: 'rgba(233,232,240,0.30)',
  silver: '#9E9DB0', hair: 'rgba(233,232,240,0.10)',
  candle: '#E7B07A', candleHot: '#F3CFA3', candleGlow: 'rgba(231,176,122,0.45)',
};

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=4`;

// persona display names + aura rgb (the room's light comes from who's in it)
const P = {
  the_guru:['the guru','230,190,90'], the_oracle:['the oracle','110,200,200'], the_brainiac:['the brainiac','90,200,230'],
  the_brother:['the brother','200,120,80'], the_healer:['the healer','124,92,220'], the_comic:['the comic','240,180,70'],
  the_mentor:['the motivator','230,190,110'], the_colleague:['the colleague','190,160,110'], the_philosopher:['the philosopher','180,160,210'],
  the_historian:['the historian','200,160,110'], the_cosmologist:['the cosmologist','120,140,230'], the_moderator:['the moderator','120,180,150'],
  the_cynic:['the cynic','150,150,150'], the_media_manager:['the media manager','230,140,170'], the_teacher:['the professor','120,190,170'],
  the_economist:['the economist','110,170,140'], the_leader_opp:['the leader of opposition','200,120,110'], the_wannabe:['the wannabe hustler','235,180,90'],
  the_screen_junkie:['the screen junkie','120,150,230'], the_orator:['the orator','210,150,90'], the_hippie:['the hippie','120,170,120'],
  the_diva:['the diva','210,90,150'], the_cousin:['the awkward cousin','150,160,190'],
};
const SHAREABLE = Object.keys(P);
const nameOf = (k) => (P[k] ? P[k][0] : k);
const rgbOf = (k) => (P[k] ? P[k][1] : '231,176,122');
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ── a face in a cluster ──
function FaceImg({ pkey, size }) {
  const [ok, setOk] = useState(true);
  if (ok) return <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: size / 2 }} onError={() => setOk(false)} />;
  return <View style={{ width: '100%', height: '100%', borderRadius: size / 2, backgroundColor: N.night2 }} />;
}

// ── a pool: several presences clustered in one shared glow ──
function Pool({ keys, size = 50 }) {
  const b = useSharedValue(0.7);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + b.value * 0.4 }));
  const show = (keys || []).slice(0, 3);
  const tone = rgbOf(show[0]);
  const overlap = size * 0.42;
  return (
    <View style={{ width: size + overlap * (show.length - 1) + 20, height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glow]}>
        <Svg width="100%" height="100%">
          <Defs><RadialGradient id={`pool_${show.join('')}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={`rgb(${tone})`} stopOpacity="0.42" />
            <Stop offset="60%" stopColor={`rgb(${tone})`} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={`rgb(${tone})`} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="50%" cy="50%" r="50%" fill={`url(#pool_${show.join('')})`} />
        </Svg>
      </Animated.View>
      <View style={{ flexDirection: 'row' }}>
        {show.map((k, i) => (
          <View key={k + i} style={[styles.poolFace, { width: size, height: size, borderRadius: size / 2, borderColor: `rgba(${rgbOf(k)},0.65)`, marginLeft: i === 0 ? 0 : -overlap, zIndex: show.length - i }]}>
            <FaceImg pkey={k} size={size} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── a suggested room card (topic + why + faces) ──
function SuggestedCard({ room, onPick, busy }) {
  const tone = rgbOf((room.personas || [])[0]);
  return (
    <Pressable style={styles.suggCard} disabled={busy} onPress={() => onPick(room)}>
      <View style={styles.suggInner}>
        <Pool keys={room.personas} size={46} />
        <Text style={styles.suggTitle} numberOfLines={2}>{room.topic}</Text>
        <Text style={styles.suggWhy} numberOfLines={3}>{room.why}</Text>
        <Text style={styles.suggWho} numberOfLines={1}>{(room.personas || []).map(nameOf).join(' · ')}</Text>
      </View>
    </Pressable>
  );
}

// ── a room you're in ──
function YourRoomRow({ room, onOpen, onDelete }) {
  return (
    <Pressable style={styles.yourRow} onPress={() => onOpen(room)}>
      <Pool keys={room.personas} size={42} />
      <View style={{ flex: 1, marginLeft: 6 }}>
        <Text style={styles.yourName} numberOfLines={1}>{room.name || 'a room'}</Text>
        <Text style={styles.yourWho} numberOfLines={1}>{(room.personas || []).map(nameOf).join(', ')}</Text>
      </View>
      <Pressable hitSlop={12} onPress={() => onDelete(room)} style={styles.roomX}>
        <Svg width="16" height="16" viewBox="0 0 24 24"><Path d="M6 6l12 12M18 6L6 18" stroke={N.moonFaint} strokeWidth="1.8" strokeLinecap="round" /></Svg>
      </Pressable>
    </Pressable>
  );
}

export default function Rooms({ onOpen = () => {} }) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggShown, setSuggShown] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    getRoomSuggestions().then((items) => { setSuggestions(items); setSuggShown(shuffle(items)); setLoadingSugg(false); });
    listRooms().then((r) => setRooms(Array.isArray(r) ? r.filter((x) => (x.personas || []).filter(Boolean).length > 0) : []));
  }, []);

  const reroll = useCallback(() => { setSuggShown((cur) => shuffle(cur.length ? cur : suggestions)); }, [suggestions]);

  // remove a room: delete it if you own it, otherwise just leave. optimistic + confirm.
  const removeRoom = useCallback((room) => {
    const owned = !!room.is_owner;
    Alert.alert(
      owned ? 'delete this room?' : 'leave this room?',
      owned ? 'this removes the room and its history for everyone. can’t be undone.'
            : 'you’ll leave this room. you can be re-invited later.',
      [
        { text: 'cancel', style: 'cancel' },
        { text: owned ? 'delete' : 'leave', style: 'destructive', onPress: async () => {
          setRooms((cur) => cur.filter((r) => r.id !== room.id));   // optimistic
          // always leave — removes your membership (works regardless of ownership);
          // the server also soft-deletes the thread if you own it.
          await leaveRoom(room.id);
          const fresh = await listRooms();                          // reconcile with server truth
          if (Array.isArray(fresh)) setRooms(fresh.filter((x) => (x.personas || []).filter(Boolean).length > 0));
        } },
      ],
    );
  }, []);

  // spin up (or reuse) a room and open it
  const spinUp = useCallback(async (name, personas) => {
    if (busy || !personas || !personas.length) return;
    setBusy(true);
    const created = await createRoom(name, personas);
    setBusy(false);
    if (created && created.id) { setPicker(false); setPicked([]); onOpen(created); }
  }, [busy, onOpen]);

  const togglePick = (k) => setPicked((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : (cur.length < 5 ? [...cur, k] : cur));

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`rgba(231,176,122,0.10)`, `rgba(231,176,122,0.03)`, N.night]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.kicker}>together</Text>
          <Text style={styles.title}>rooms</Text>
        </View>

        {/* full-width GATHER A ROOM bar */}
        <Pressable style={styles.gather} onPress={() => setPicker(true)}>
          <Text style={styles.gatherPlus}>+</Text>
          <Text style={styles.gatherText}>gather a room</Text>
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* SUGGESTED */}
          <View style={styles.sectHead}>
            <Text style={styles.sectionLabel}>suggested tonight</Text>
            <Pressable hitSlop={10} onPress={reroll} style={styles.refresh}>
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <Path d="M4 12a8 8 0 018-8 8 8 0 016.9 4M20 12a8 8 0 01-8 8 8 8 0 01-6.9-4" stroke={N.candle} strokeWidth="1.7" strokeLinecap="round" />
                <Path d="M18 3.5V8h-4.5M6 20.5V16h4.5" stroke={N.candle} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
          {loadingSugg ? (
            <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={N.candle} /></View>
          ) : suggShown.length === 0 ? (
            <Text style={styles.empty}>settling in — pull back in a moment.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
              {suggShown.map((r, i) => <SuggestedCard key={r.topic + i} room={r} onPick={(room) => spinUp(room.topic, room.personas)} busy={busy} />)}
            </ScrollView>
          )}

          {/* YOUR ROOMS */}
          <Text style={[styles.sectionLabel, { marginTop: 28, paddingHorizontal: 24 }]}>your rooms</Text>
          {rooms.length === 0 ? (
            <Text style={styles.empty}>no rooms yet — gather one above, or tap a suggestion.</Text>
          ) : (
            rooms.map((r) => <YourRoomRow key={r.id} room={r} onOpen={onOpen} onDelete={removeRoom} />)
          )}

          {/* PUBLIC — last, not yet open */}
          <Text style={[styles.sectionLabel, { marginTop: 28, paddingHorizontal: 24 }]}>public rooms</Text>
          <Text style={styles.empty}>open rooms are coming — a place to step into with strangers.</Text>
        </ScrollView>

        {/* GATHER picker overlay */}
        {picker && (
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(false)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>who's in the room?</Text>
              <Text style={styles.sheetSub}>pick up to 5 — invite friends once you're inside</Text>
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {SHAREABLE.map((k) => {
                  const on = picked.includes(k);
                  return (
                    <Pressable key={k} style={styles.pickRow} onPress={() => togglePick(k)}>
                      <View style={[styles.pickFace, { borderColor: `rgba(${rgbOf(k)},0.6)` }]}><FaceImg pkey={k} size={40} /></View>
                      <Text style={styles.pickName}>{nameOf(k)}</Text>
                      <View style={[styles.pickDot, on && { backgroundColor: N.candle, borderColor: N.candle }]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                style={[styles.gatherGo, picked.length === 0 && { opacity: 0.4 }]}
                disabled={picked.length === 0 || busy}
                onPress={() => spinUp(picked.map(nameOf).map((n) => n.replace(/^the /, '')).slice(0, 3).join(', ') + "'s room", picked)}>
                <Text style={styles.gatherGoText}>{busy ? 'gathering…' : `gather (${picked.length})`}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  kicker: { fontFamily: 'Figtree_600SemiBold', color: 'rgba(159,194,232,0.7)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_400Regular', color: '#E8ECF4', fontSize: 34, marginTop: 2 },

  gather: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginHorizontal: 20, marginBottom: 22,
    paddingVertical: 15, borderRadius: 16, backgroundColor: 'rgba(231,176,122,0.12)', borderWidth: 1, borderColor: 'rgba(231,176,122,0.4)' },
  gatherPlus: { color: N.candle, fontSize: 19, marginTop: -2 },
  gatherText: { fontFamily: 'Figtree_600SemiBold', color: N.candleHot, fontSize: 15.5, letterSpacing: 0.2 },

  sectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 12 },
  sectionLabel: { fontFamily: 'Figtree_600SemiBold', color: N.moon, fontSize: 14, letterSpacing: 0.4 },
  refresh: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(231,176,122,0.08)' },

  suggCard: { width: 226, borderRadius: 20, overflow: 'hidden' },
  suggInner: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2, height: 210, justifyContent: 'flex-start' },
  suggTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 19, marginTop: 12, lineHeight: 24 },
  suggWhy: { fontFamily: 'Figtree_300Light', color: N.moonDim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  suggWho: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 11, marginTop: 'auto', letterSpacing: 0.2 },

  yourRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9 },
  yourName: { fontFamily: 'Figtree_500Medium', color: N.moon, fontSize: 15.5 },
  yourWho: { fontFamily: 'Figtree_300Light', color: N.moonDim, fontSize: 12.5, marginTop: 2 },
  roomX: { paddingHorizontal: 8, paddingVertical: 8 },

  empty: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moonFaint, fontSize: 14, paddingHorizontal: 24, marginTop: 4, lineHeight: 21 },

  poolFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: N.night },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,4,8,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: N.night2, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 34, borderWidth: 1, borderColor: N.hair },
  sheetTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 22 },
  sheetSub: { fontFamily: 'Figtree_300Light', color: N.moonDim, fontSize: 13, marginTop: 4, marginBottom: 14 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  pickFace: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, marginRight: 12 },
  pickName: { flex: 1, fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15 },
  pickDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: N.moonFaint },
  gatherGo: { marginTop: 16, paddingVertical: 15, borderRadius: 16, alignItems: 'center', backgroundColor: N.candle },
  gatherGoText: { fontFamily: 'Figtree_600SemiBold', color: '#2a1c10', fontSize: 15.5 },
});
