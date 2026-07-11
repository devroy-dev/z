// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE DOORWAY, wired (R1 · ROOMS_SPEC v1 §4). The mandatory
//  threshold for every public room, every time: the host's presence, the
//  room's real stats (never invented), the house rules (until consented,
//  server-recorded), dob once if absent (18+), and THE HANDLE LINE —
//  "you'll be quiet-tiger in here" — reroll ⟳ or edit, chosen before the
//  first message can exist. The server is the gate; this screen renders its
//  word. Design register kept from the original PublicRoom.js threshold.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Grain from './Grain';
import { getPublicDoorway, consentPublicRooms, joinPublicRoom, setDob } from './api';
import { suggestHandle, handleValid } from './handleGen';
import { nameOf } from './roster';

const MOON = { hi: '#E9E8F0', dim: 'rgba(233,232,240,0.56)', faint: 'rgba(233,232,240,0.32)' };
const CANDLE = '#E7B07A';

function ago(iso) {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// the ephemeral AI presence — the no-host fallback orb (register kept)
function RoomAI({ tone = '#C99BE8' }) {
  const b = useSharedValue(0.7);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 + b.value * 0.5, transform: [{ scale: 0.94 + b.value * 0.1 }] }));
  return (
    <Animated.View style={st}>
      <Svg width="54" height="54" viewBox="0 0 46 46">
        <Defs><RadialGradient id="rai" cx="42%" cy="36%" r="64%">
          <Stop offset="0%" stopColor="#F3E8FB" /><Stop offset="45%" stopColor={tone} /><Stop offset="100%" stopColor="#5A3A78" />
        </RadialGradient></Defs>
        <Circle cx="23" cy="23" r="15" fill="url(#rai)" />
      </Svg>
    </Animated.View>
  );
}

function HostFace({ pkey }) {
  const [ok, setOk] = useState(true);
  if (!pkey || !ok) return <RoomAI />;
  return (
    <Image source={{ uri: `https://callmez.app/faces/${pkey}.jpg?v=6` }}
      onError={() => setOk(false)}
      style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(201,155,232,0.5)' }} />
  );
}

export default function PublicDoorway({ room, onEnter, onBack }) {
  const [d, setD] = useState(null);          // the doorway read
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState('');
  const [dob, setDobField] = useState('');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let on = true;
    getPublicDoorway(room.id).then((r) => {
      if (!on) return;
      if (!r || r.error) { setErr(r?.error || 'the doorway is not answering — try again.'); return; }
      setD(r);
      setHandle(r.handle || suggestHandle());
      if (r.dobSet && !r.adult) setLocked(true);
    });
    return () => { on = false; };
  }, [room.id]);

  const stepIn = async () => {
    if (busy || !d) return;
    setErr('');
    const h = String(handle || '').trim().toLowerCase();
    if (!d.handle && !handleValid(h)) { setErr('handles are 3–24 characters: lowercase letters, digits, hyphens.'); return; }
    setBusy(true);
    try {
      // dob once, when absent — the server's /me route stores it
      if (!d.dobSet) {
        const v = dob.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime())) {
          setErr('date of birth as YYYY-MM-DD, once — open rooms are 18+.'); setBusy(false); return;
        }
        const r = await setDob(v);
        if (r && r.error) { setErr(r.error); setBusy(false); return; }
      }
      // consent, server-recorded, once
      if (!d.consented) {
        const c = await consentPublicRooms();
        if (c && c.error) { setErr(c.error); setBusy(false); return; }
      }
      // the join — the server is the gate; render its word
      const j = await joinPublicRoom(room.id, d.handle ? undefined : h);
      if (j && j.threadId) {
        onEnter({ id: j.threadId, name: d.name, personas: (room.personas || []), publicRoomId: room.id, youCreated: !!room.youCreated, handle: j.handle || d.handle || h });
      } else if (j && j.code === 'underage') {
        setLocked(true);
      } else if (j && j.code === 'handle_taken') {
        setErr(j.error); setHandle(suggestHandle());
      } else {
        setErr((j && j.error) || 'the door did not open — try again.');
      }
    } catch (e) { setErr('the door did not open — try again.'); }
    setBusy(false);
  };

  const host = d?.host || (room.personas || [])[0] || null;
  const canEditHandle = !d?.handle;   // server locks it after the first message; pre-join it's yours to shape

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#100E15', '#0B0A0F', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Pressable hitSlop={10} onPress={onBack} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Text style={styles.chev}>‹</Text>
        </Pressable>

        {!d && !err ? (
          <View style={styles.center}><ActivityIndicator color={CANDLE} /></View>
        ) : locked ? (
          <View style={styles.center}>
            <Text style={styles.lockedTitle}>open rooms are 18+</Text>
            <Text style={styles.lockedBody}>this part of the house opens when you're of age.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <HostFace pkey={host} />
            </View>
            <Text style={styles.kicker}>public room · open to anyone · 18+</Text>
            <Text style={styles.title}>{d?.name || room.name}</Text>
            {d?.theme ? <Text style={styles.theme}>{d.theme}</Text> : null}
            {host ? <Text style={styles.hostLine}>{nameOf(host)} hosting</Text> : null}
            <View style={styles.statsRow}>
              {typeof d?.memberCount === 'number' ? <Text style={styles.stat}>{d.memberCount} inside</Text> : null}
              {d?.lastActive ? <Text style={styles.stat}>· last active {ago(d.lastActive)}</Text> : null}
            </View>

            {!d?.consented ? (
              <View style={styles.rulesCard}>
                <Text style={styles.rulesTitle}>the house rules</Text>
                <Text style={styles.rulesBody}>Open rooms are public and 18+ — you'll be talking with strangers. Keep it civil: the doorman removes slurs, harassment, and doxxing. Don't share anything you wouldn't hand a stranger.</Text>
              </View>
            ) : null}

            {!d?.dobSet ? (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>date of birth — once, for the 18+ door</Text>
                <TextInput value={dob} onChangeText={setDobField} placeholder="YYYY-MM-DD" placeholderTextColor={MOON.faint}
                  style={styles.input} maxLength={10} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>in here, you'll be</Text>
              <View style={styles.handleRow}>
                <TextInput value={handle} onChangeText={(t) => canEditHandle && setHandle(t)} editable={canEditHandle}
                  style={[styles.input, { flex: 1 }, !canEditHandle && { opacity: 0.7 }]}
                  autoCapitalize="none" autoCorrect={false} maxLength={24} placeholder="quiet-tiger" placeholderTextColor={MOON.faint} />
                {canEditHandle ? (
                  <Pressable hitSlop={8} onPress={() => setHandle(suggestHandle())} style={styles.reroll}>
                    <Text style={styles.rerollTxt}>⟳</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fieldHint}>{canEditHandle ? 'strangers meet this name, never your profile. it locks with your first message.' : 'your handle in this room — it came back with you.'}</Text>
            </View>

            {err ? <Text style={styles.err}>{err}</Text> : null}

            <Pressable style={[styles.stepBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={stepIn}>
              <Text style={styles.stepTxt}>{busy ? '…' : (!d?.consented ? 'I understand — step in' : 'step in')}</Text>
            </Pressable>
          </ScrollView>
        )}
        {err && !d ? <View style={styles.center}><Text style={styles.err}>{err}</Text></View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0A0F' },
  chev: { color: MOON.dim, fontSize: 30, lineHeight: 32, fontFamily: 'Figtree_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  body: { paddingHorizontal: 26, paddingTop: 18, paddingBottom: 40 },
  kicker: { color: MOON.faint, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', textAlign: 'center', fontFamily: 'Figtree_500Medium' },
  title: { color: MOON.hi, fontSize: 26, textAlign: 'center', marginTop: 8, fontFamily: 'Fraunces_400Regular' },
  theme: { color: MOON.dim, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: 'Figtree_400Regular' },
  hostLine: { color: 'rgba(201,155,232,0.85)', fontSize: 13, textAlign: 'center', marginTop: 10, fontFamily: 'Figtree_500Medium' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  stat: { color: MOON.faint, fontSize: 12, fontFamily: 'Figtree_400Regular' },
  rulesCard: { marginTop: 22, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(233,232,240,0.12)', backgroundColor: 'rgba(233,232,240,0.04)', padding: 16 },
  rulesTitle: { color: MOON.hi, fontSize: 13, fontFamily: 'Figtree_600SemiBold', marginBottom: 6 },
  rulesBody: { color: MOON.dim, fontSize: 13, lineHeight: 19, fontFamily: 'Figtree_400Regular' },
  fieldWrap: { marginTop: 20 },
  fieldLabel: { color: MOON.dim, fontSize: 12, fontFamily: 'Figtree_500Medium', marginBottom: 8 },
  fieldHint: { color: MOON.faint, fontSize: 11, lineHeight: 16, marginTop: 7, fontFamily: 'Figtree_400Regular' },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(233,232,240,0.16)', backgroundColor: 'rgba(233,232,240,0.05)', color: MOON.hi, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Figtree_400Regular' },
  reroll: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(231,176,122,0.4)', alignItems: 'center', justifyContent: 'center' },
  rerollTxt: { color: CANDLE, fontSize: 19 },
  err: { color: '#E58C8C', fontSize: 13, marginTop: 16, textAlign: 'center', lineHeight: 18, fontFamily: 'Figtree_400Regular' },
  stepBtn: { marginTop: 24, borderRadius: 14, backgroundColor: 'rgba(231,176,122,0.16)', borderWidth: 1, borderColor: 'rgba(231,176,122,0.55)', paddingVertical: 14, alignItems: 'center' },
  stepTxt: { color: '#F3CFA3', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  lockedTitle: { color: MOON.hi, fontSize: 20, fontFamily: 'Fraunces_400Regular' },
  lockedBody: { color: MOON.dim, fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20, fontFamily: 'Figtree_400Regular' },
});
