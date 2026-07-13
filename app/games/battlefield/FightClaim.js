// FightClaim.js — THE CHALLENGE LANDING, in-app (phase 4, item 3).
//
// The /fight/<id> link's native half (the PWA parity spec's P1 owns the browser
// side of the same link). Given a challengeId — from a deep link, a shared link
// pasted on the Battlefield home, or a notification — this shows the motion and
// the stance on offer, and one ACCEPT starts the duel at once (the claim IS the
// duel start; both seats fill at accept). Refusals render in register: expired,
// own-challenge, already-accepted. Register: crimson.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../theme';
import { getBattlefieldChallenge, claimBattlefieldChallenge } from '../../api';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

export default function FightClaim({ challengeId, onBack = () => {}, onClaimed = () => {}, onWatch = () => {} }) {
  const [ch, setCh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let on = true;
    (async () => {
      try { const j = await getBattlefieldChallenge(challengeId); if (on) setCh(j); }
      catch (e) { if (on) setErr(String(e?.message || 'no such challenge')); }
      if (on) setLoading(false);
    })();
    return () => { on = false; };
  }, [challengeId]);

  const accept = async () => {
    if (claiming) return;
    setClaiming(true); setErr('');
    try {
      const r = await claimBattlefieldChallenge(challengeId);
      if (r?.sessionId) { onClaimed(r); return; }
      setErr(r?.error || 'the claim did not land');
    } catch (e) { setErr(String(e?.message || 'the claim did not land')); }
    setClaiming(false);
  };

  const open = ch?.status === 'open';
  const accepted = ch?.status === 'accepted';
  const expired = ch?.status === 'expired';

  return (
    <View style={st.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 26, paddingBottom: 48 }}>
          <Text style={st.kicker}>SETTLE IT</Text>
          {loading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><ActivityIndicator color={CRIMSON} /></View>
          ) : !ch ? (
            <>
              <Text style={st.title}>No such challenge.</Text>
              {!!err && <Text style={st.err}>{err}</Text>}
            </>
          ) : (
            <>
              <Text style={st.title}>
                {open ? `${ch.challengerName} challenges you.` : accepted ? 'This challenge was accepted.' : expired ? 'This challenge expired.' : 'The challenge.'}
              </Text>
              <View style={st.motionCard}>
                <Text style={st.motionTxt}>"{ch.motion}"</Text>
                <View style={st.stanceRow}>
                  <View style={[st.sideTag, { borderColor: ch.challengerSide === 'PRO' ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
                    <Text style={[st.sideTagTxt, { color: ch.challengerSide === 'PRO' ? BLUE : CRIMSON }]}>{ch.challengerSide}</Text>
                  </View>
                  <Text style={st.stanceTxt}> {ch.challengerName} · </Text>
                  <View style={[st.sideTag, { borderColor: ch.yourSide === 'PRO' ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
                    <Text style={[st.sideTagTxt, { color: ch.yourSide === 'PRO' ? BLUE : CRIMSON }]}>{ch.yourSide}</Text>
                  </View>
                  <Text style={st.stanceTxt}> yours{ch.timed ? ' · timed floor' : ''}</Text>
                </View>
              </View>

              {open ? (
                <>
                  {!!err && <Text style={st.err}>{err}</Text>}
                  <Pressable style={[st.primaryBtn, claiming && { opacity: 0.5 }]} onPress={accept} disabled={claiming}>
                    {claiming ? <ActivityIndicator color={INK} /> : <Text style={st.primaryTxt}>take the floor — argue {ch.yourSide}</Text>}
                  </Pressable>
                  <Text style={st.sub}>The duel is live the moment you accept. An adjudicated ruling ends the argument — no stakes, no money, just the verdict.</Text>
                </>
              ) : accepted ? (
                <>
                  <Text style={st.sub}>The duel is on the floor.</Text>
                  {ch.sessionId ? (
                    <Pressable style={st.quietBtn} onPress={() => onWatch(ch.sessionId)}>
                      <Text style={st.quietTxt}>watch the floor</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <Text style={st.sub}>The floor waited seven days. Mint a fresh one from the Battlefield.</Text>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6 },
  chev: { color: CREAM, fontSize: 28, fontFamily: FONTS.light },
  kicker: { color: CRIMSON, fontSize: 11, letterSpacing: 3, fontFamily: FONTS.semibold, marginBottom: 8 },
  title: { color: CREAM, fontSize: 28, fontFamily: FONTS.display, marginBottom: 14 },
  motionCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.3)', borderRadius: 14, padding: 16, backgroundColor: 'rgba(224,87,111,0.05)' },
  motionTxt: { color: CREAM, fontSize: 17, lineHeight: 25, fontFamily: FONTS.displayItalic },
  stanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  sideTag: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagTxt: { fontSize: 11.5, letterSpacing: 1.5, fontFamily: FONTS.semibold },
  stanceTxt: { color: 'rgba(245,236,225,0.55)', fontSize: 13, fontFamily: FONTS.body },
  primaryBtn: { marginTop: 20, backgroundColor: CRIMSON, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryTxt: { color: INK, fontSize: 15.5, fontFamily: FONTS.semibold },
  quietBtn: { marginTop: 16, borderWidth: 1, borderColor: 'rgba(245,236,225,0.18)', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  quietTxt: { color: 'rgba(245,236,225,0.7)', fontSize: 14, fontFamily: FONTS.medium },
  sub: { color: 'rgba(245,236,225,0.5)', fontSize: 13, lineHeight: 19, fontFamily: FONTS.body, marginTop: 14 },
  err: { color: CRIMSON, fontSize: 13, fontFamily: FONTS.body, marginTop: 12 },
});
