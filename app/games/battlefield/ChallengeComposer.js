// ChallengeComposer.js — SETTLE IT (phase 4, item 2).
//
// The other growth loop: a motion becomes a /fight/<id> link that rides WhatsApp.
// The vet (evaluateMotion) fronts every motion; a refusal renders as a TEACHER,
// not a bouncer — the issues, the clerk's note in register, and the restructured
// motion as a one-tap "use this instead". Side pick · timed toggle · share sheet
// carrying fightPath. Register: crimson.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Share, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../theme';
import { createBattlefieldChallenge } from '../../api';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

const ISSUE_WORDS = {
  values_only: 'pure taste claim', vague: 'too vague', unfalsifiable: 'unfalsifiable',
  loaded: 'loaded phrasing', tautological: 'tautological', compound: 'two claims in one',
  not_a_proposition: 'not a proposition',
};

export default function ChallengeComposer({ onBack = () => {}, onMinted = () => {} }) {
  const [motion, setMotion] = useState('');
  const [side, setSide] = useState('pro');
  const [timed, setTimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState(null);   // the vet's teaching moment
  const [minted, setMinted] = useState(null);            // { challengeId, fightPath, motion }
  const [err, setErr] = useState('');

  const mint = async (m) => {
    const text = (m || motion).trim();
    if (text.length < 10 || busy) return;
    setBusy(true); setErr(''); setAssessment(null);
    try {
      const r = await createBattlefieldChallenge(text, side, timed);
      if (r.status === 422 && r.assessment) {
        setAssessment(r.assessment);            // the teacher speaks
      } else if (r.challengeId) {
        setMinted({ challengeId: r.challengeId, fightPath: r.fightPath, motion: text });
      } else {
        setErr(r.error || 'the challenge did not mint — try again');
      }
    } catch (e) { setErr('could not reach the floor'); }
    setBusy(false);
  };

  const adoptRewrite = () => {
    if (!assessment?.restructured) return;
    const m = assessment.restructured;
    setMotion(m);
    setAssessment(null);
    mint(m);                                     // one tap: adopt AND mint
  };

  const shareLink = async () => {
    if (!minted) return;
    const link = 'https://callmez.app' + minted.fightPath;
    try {
      await Share.share({ message: `settle it on the Battlefield — I argue ${side.toUpperCase()}, the ${side === 'pro' ? 'CON' : 'PRO'} seat is yours. An adjudicator rules. ${link}`, url: link });
    } catch (e) {}
  };

  // ── minted: the share state ──
  if (minted) {
    return (
      <View style={st.root}>
        <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={st.topRow}>
            <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
            <View style={{ flex: 1 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 26, paddingBottom: 48 }}>
            <Text style={st.kicker}>THE CHALLENGE STANDS</Text>
            <Text style={st.title}>Send it.</Text>
            <View style={st.motionCard}>
              <Text style={st.motionTxt}>"{minted.motion}"</Text>
              <Text style={st.motionSub}>you argue {side.toUpperCase()} · the {side === 'pro' ? 'CON' : 'PRO'} seat travels with the link{timed ? ' · timed floor' : ''}</Text>
            </View>
            <Pressable style={st.primaryBtn} onPress={shareLink}>
              <Text style={st.primaryTxt}>share the challenge link</Text>
            </Pressable>
            <Text style={st.linkTxt} selectable>callmez.app{minted.fightPath}</Text>
            <Text style={st.expiry}>The floor waits seven days. When they accept, the duel is live at once — you'll find it under LIVE on the Battlefield.</Text>
            <Pressable style={st.quietBtn} onPress={() => { setMinted(null); setMotion(''); }}>
              <Text style={st.quietTxt}>mint another</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── the composer ──
  return (
    <View style={st.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={st.topRow}>
            <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
            <View style={{ flex: 1 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 26, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
            <Text style={st.kicker}>SETTLE IT</Text>
            <Text style={st.title}>Challenge a friend.</Text>
            <Text style={st.lede}>State the claim you two keep arguing about. The clerk checks it's judgeable, the link carries the fight, an adjudicator ends it.</Text>

            <Text style={st.label}>THE MOTION</Text>
            <TextInput
              style={st.input}
              value={motion}
              onChangeText={(t) => { setMotion(t); if (assessment) setAssessment(null); }}
              placeholder={'"This house believes …"'}
              placeholderTextColor="rgba(245,236,225,0.25)"
              multiline
            />

            {/* the vet's refusal — a teacher, not a bouncer */}
            {assessment ? (
              <View style={st.vetCard}>
                <Text style={st.vetKicker}>THE CLERK RETURNS IT</Text>
                {Array.isArray(assessment.issues) && assessment.issues.filter((i) => i !== 'none').length ? (
                  <View style={st.issueRow}>
                    {assessment.issues.filter((i) => i !== 'none').map((i) => (
                      <View key={i} style={st.issueChip}><Text style={st.issueTxt}>{ISSUE_WORDS[i] || i}</Text></View>
                    ))}
                  </View>
                ) : null}
                {!!assessment.note && <Text style={st.vetNote}>{assessment.note}</Text>}
                {!!assessment.restructured && (
                  <>
                    <Text style={st.vetRewriteLabel}>THE NEAREST JUDGEABLE MOTION</Text>
                    <Text style={st.vetRewrite}>"{assessment.restructured}"</Text>
                    <Pressable style={st.adoptBtn} onPress={adoptRewrite} disabled={busy}>
                      <Text style={st.adoptTxt}>use this instead</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}

            <Text style={st.label}>YOUR SIDE</Text>
            <View style={st.sideRow}>
              {['pro', 'con'].map((sd) => (
                <Pressable key={sd} style={[st.sideBtn, side === sd && (sd === 'pro' ? st.sideOnPro : st.sideOnCon)]} onPress={() => setSide(sd)}>
                  <Text style={[st.sideBtnTxt, side === sd && { color: sd === 'pro' ? BLUE : CRIMSON }]}>{sd.toUpperCase()}</Text>
                  <Text style={st.sideBtnSub}>{sd === 'pro' ? 'for the motion' : 'against it'}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={st.timedRow} onPress={() => setTimed((t) => !t)}>
              <View style={[st.check, timed && st.checkOn]}>{timed ? <Text style={st.checkTick}>✓</Text> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={st.timedTitle}>Timed floor</Text>
                <Text style={st.timedSub}>Each speech runs against the clock. A slot that lapses is forfeited on the record.</Text>
              </View>
            </Pressable>

            {!!err && <Text style={st.err}>{err}</Text>}
            <Pressable style={[st.primaryBtn, (motion.trim().length < 10 || busy) && { opacity: 0.4 }]} onPress={() => mint()} disabled={motion.trim().length < 10 || busy}>
              {busy ? <ActivityIndicator color={INK} /> : <Text style={st.primaryTxt}>mint the challenge link</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6 },
  chev: { color: CREAM, fontSize: 28, fontFamily: FONTS.light },
  kicker: { color: CRIMSON, fontSize: 11, letterSpacing: 3, fontFamily: FONTS.semibold, marginBottom: 8 },
  title: { color: CREAM, fontSize: 30, fontFamily: FONTS.display, marginBottom: 10 },
  lede: { color: 'rgba(245,236,225,0.62)', fontSize: 14.5, lineHeight: 21, fontFamily: FONTS.body, marginBottom: 22 },
  label: { color: 'rgba(245,236,225,0.45)', fontSize: 10.5, letterSpacing: 2.4, fontFamily: FONTS.semibold, marginTop: 16, marginBottom: 8 },
  input: { minHeight: 88, borderWidth: 1, borderColor: 'rgba(224,87,111,0.28)', borderRadius: 14, padding: 14, color: CREAM, fontSize: 16, fontFamily: FONTS.displayItalic, textAlignVertical: 'top', backgroundColor: 'rgba(224,87,111,0.04)' },
  vetCard: { marginTop: 14, borderWidth: 1, borderColor: 'rgba(201,168,106,0.35)', borderRadius: 14, padding: 14, backgroundColor: 'rgba(201,168,106,0.05)' },
  vetKicker: { color: '#C9A86A', fontSize: 10.5, letterSpacing: 2.4, fontFamily: FONTS.semibold, marginBottom: 8 },
  issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  issueChip: { borderWidth: 1, borderColor: 'rgba(201,168,106,0.4)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  issueTxt: { color: '#C9A86A', fontSize: 11, fontFamily: FONTS.medium },
  vetNote: { color: 'rgba(245,236,225,0.72)', fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.body },
  vetRewriteLabel: { color: 'rgba(245,236,225,0.45)', fontSize: 10, letterSpacing: 2, fontFamily: FONTS.semibold, marginTop: 12, marginBottom: 6 },
  vetRewrite: { color: CREAM, fontSize: 15, lineHeight: 22, fontFamily: FONTS.displayItalic },
  adoptBtn: { marginTop: 12, backgroundColor: '#C9A86A', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  adoptTxt: { color: INK, fontSize: 14, fontFamily: FONTS.semibold },
  sideRow: { flexDirection: 'row', gap: 10 },
  sideBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(245,236,225,0.14)', borderRadius: 14, padding: 14, alignItems: 'center' },
  sideOnPro: { borderColor: 'rgba(120,200,255,0.55)', backgroundColor: 'rgba(120,200,255,0.06)' },
  sideOnCon: { borderColor: 'rgba(224,87,111,0.6)', backgroundColor: 'rgba(224,87,111,0.06)' },
  sideBtnTxt: { color: 'rgba(245,236,225,0.6)', fontSize: 15, letterSpacing: 1.5, fontFamily: FONTS.semibold },
  sideBtnSub: { color: 'rgba(245,236,225,0.4)', fontSize: 11.5, fontFamily: FONTS.body, marginTop: 3 },
  timedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, borderWidth: 1, borderColor: 'rgba(245,236,225,0.12)', borderRadius: 14, padding: 14 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(245,236,225,0.35)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: CRIMSON, backgroundColor: 'rgba(224,87,111,0.2)' },
  checkTick: { color: CRIMSON, fontSize: 13, fontFamily: FONTS.semibold },
  timedTitle: { color: CREAM, fontSize: 14.5, fontFamily: FONTS.medium },
  timedSub: { color: 'rgba(245,236,225,0.45)', fontSize: 12, lineHeight: 17, fontFamily: FONTS.body, marginTop: 2 },
  err: { color: CRIMSON, fontSize: 13, fontFamily: FONTS.body, marginTop: 12 },
  primaryBtn: { marginTop: 20, backgroundColor: CRIMSON, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryTxt: { color: INK, fontSize: 15.5, fontFamily: FONTS.semibold },
  motionCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.3)', borderRadius: 14, padding: 16, backgroundColor: 'rgba(224,87,111,0.05)', marginTop: 6 },
  motionTxt: { color: CREAM, fontSize: 17, lineHeight: 25, fontFamily: FONTS.displayItalic },
  motionSub: { color: 'rgba(245,236,225,0.5)', fontSize: 12.5, fontFamily: FONTS.body, marginTop: 10 },
  linkTxt: { color: 'rgba(120,200,255,0.85)', fontSize: 13, fontFamily: FONTS.medium, textAlign: 'center', marginTop: 14 },
  expiry: { color: 'rgba(245,236,225,0.45)', fontSize: 12.5, lineHeight: 18, fontFamily: FONTS.body, textAlign: 'center', marginTop: 14 },
  quietBtn: { marginTop: 22, borderWidth: 1, borderColor: 'rgba(245,236,225,0.18)', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  quietTxt: { color: 'rgba(245,236,225,0.7)', fontSize: 14, fontFamily: FONTS.medium },
});
