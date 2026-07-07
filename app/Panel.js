// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE PANEL (the interviewer's surface; Phase 7's front door)
//  Every pinned institutional resident has a room: the anchor's newsroom, the
//  GM's forge, the coach's study. This is his — the waiting room before the
//  chair. STRUCTURED intake (company · position · level · round · optional JD),
//  because these fields are the rails the graded-rounds engine rides later:
//  records, not prose. Steel-blue: the glass-walled meeting room.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from './theme';

const STEEL = '#8AA0C4';
const P = {
  ground: '#080B10',
  raise: 'rgba(138,160,196,0.06)',
  hair: 'rgba(138,160,196,0.16)',
  ink: '#E9EEF6',
  mist: 'rgba(233,238,246,0.55)',
  faint: 'rgba(233,238,246,0.30)',
};

const LEVELS = [
  { id: 'fresher', label: 'fresher / campus' },
  { id: 'mid', label: '3–5 years' },
  { id: 'lead', label: 'leadership' },
];
const ROUNDS = [
  { id: 'screening', label: 'the screening', sub: 'the CV walk, the why-us, the gap on page two.' },
  { id: 'behavioral', label: 'behavioral', sub: 'your stories, pressed to the third follow-up.' },
  { id: 'case', label: 'the case', sub: 'structure first, real arithmetic, one mid-case twist.' },
  { id: 'technical', label: 'technical', sub: 'concept → application → where it fails → what it cost.' },
  { id: 'hr', label: 'HR / closing', sub: 'the salary conversation, practiced before it counts.' },
  { id: 'campus', label: 'campus GD / PI', sub: 'the circuit — group discussion, then the panel.' },
];

export default function Panel({ onBack = () => {}, onStart = () => {}, onChat = () => {} }) {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [level, setLevel] = useState(null);
  const [round, setRound] = useState(null);
  const [jd, setJd] = useState('');
  const [jdOpen, setJdOpen] = useState(false);

  const ready = position.trim().length > 0;

  const start = () => {
    if (!ready) return;
    const lv = LEVELS.find((l) => l.id === level)?.label || 'unstated — read it from my answers';
    const rd = ROUNDS.find((r) => r.id === round)?.label || 'your call — run what this role would face first';
    const co = company.trim() || 'none — general practice';
    let opener = `Run an interview. Company: ${co}. Position: ${position.trim()}. Level: ${lv}. Round: ${rd}.`;
    if (jd.trim()) opener += `\n\nThe job description, as posted:\n${jd.trim()}`;
    onStart(opener);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['rgba(138,160,196,0.10)', 'rgba(138,160,196,0.03)', P.ground]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 }}>
          <Pressable onPress={onBack} hitSlop={14}><Text style={st.backTxt}>‹  back</Text></Pressable>
          <Pressable onPress={onChat} hitSlop={12}><Text style={st.chatLink}>just talk to him ›</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={st.kicker}>the panel</Text>
          <Text style={st.lead}>Name the company{'\n'}and the chair.</Text>
          <Text style={st.leadSub}>He runs the room the way they will — then tells you the truth.</Text>

          {/* the intake — fields, not prose: these become records later */}
          <View style={st.fieldWrap}>
            <Text style={st.fieldLabel}>company</Text>
            <TextInput value={company} onChangeText={setCompany} placeholder="or leave blank — general practice" placeholderTextColor={P.faint} style={st.field} />
          </View>
          <View style={st.fieldWrap}>
            <Text style={st.fieldLabel}>position</Text>
            <TextInput value={position} onChangeText={setPosition} placeholder="the chair you're sitting for" placeholderTextColor={P.faint} style={st.field} />
          </View>

          <Text style={st.sectionLabel}>your level</Text>
          <View style={st.chipRow}>
            {LEVELS.map((l) => (
              <Pressable key={l.id} onPress={() => setLevel((c) => c === l.id ? null : l.id)} style={[st.chip, level === l.id && st.chipOn]}>
                <Text style={[st.chipTxt, level === l.id && st.chipTxtOn]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={st.sectionLabel}>the round</Text>
          {ROUNDS.map((r) => (
            <Pressable key={r.id} onPress={() => setRound((c) => c === r.id ? null : r.id)} style={[st.round, round === r.id && st.roundOn]}>
              <Text style={[st.roundT, round === r.id && { color: P.ink }]}>{r.label}</Text>
              <Text style={st.roundSub}>{r.sub}</Text>
            </Pressable>
          ))}
          <Text style={st.roundHint}>none picked = he chooses what this role would face first.</Text>

          {/* the JD, if they have it */}
          <Pressable onPress={() => setJdOpen((v) => !v)} hitSlop={6} style={{ marginTop: 18, marginHorizontal: 20 }}>
            <Text style={st.jdToggle}>{jdOpen ? 'the job description ▾' : 'paste the job description ›'}</Text>
          </Pressable>
          {jdOpen ? (
            <View style={[st.fieldWrap, { marginTop: 8 }]}>
              <TextInput value={jd} onChangeText={setJd} placeholder="paste it whole — he reads it like a panelist does." placeholderTextColor={P.faint} style={[st.field, { minHeight: 110, textAlignVertical: 'top' }]} multiline />
            </View>
          ) : null}

          {/* the chair */}
          <Pressable onPress={start} disabled={!ready} style={[st.cta, !ready && { opacity: 0.35 }]}>
            <Text style={st.ctaTxt}>take the chair</Text>
          </Pressable>
          {!ready ? <Text style={st.ctaHint}>name the position and the chair is yours.</Text> : null}
        </ScrollView>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ground },
  backTxt: { fontFamily: FONTS.body, color: P.faint, fontSize: 14, letterSpacing: 0.3 },
  chatLink: { fontFamily: FONTS.displayItalic, color: P.mist, fontSize: 13.5 },

  kicker: { fontFamily: FONTS.body, color: STEEL, fontSize: 12, letterSpacing: 3.5, textTransform: 'uppercase', textAlign: 'center', marginTop: 24, opacity: 0.85 },
  lead: { fontFamily: FONTS.display, color: P.ink, fontSize: 25, lineHeight: 34, textAlign: 'center', marginTop: 10 },
  leadSub: { fontFamily: FONTS.displayItalic, color: P.mist, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 22, paddingHorizontal: 40 },

  fieldWrap: { marginHorizontal: 20, marginBottom: 14 },
  fieldLabel: { fontFamily: FONTS.body, color: STEEL, fontSize: 10.5, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 },
  field: { fontFamily: FONTS.body, color: P.ink, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: P.hair, backgroundColor: P.raise },

  sectionLabel: { fontFamily: FONTS.body, color: STEEL, fontSize: 10.5, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.75, marginHorizontal: 20, marginTop: 10, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginBottom: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: P.hair },
  chipOn: { backgroundColor: 'rgba(138,160,196,0.14)', borderColor: 'rgba(138,160,196,0.5)' },
  chipTxt: { fontFamily: FONTS.body, color: P.faint, fontSize: 13 },
  chipTxtOn: { color: P.ink },

  round: { marginHorizontal: 20, marginBottom: 9, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 13, backgroundColor: P.raise, borderWidth: 1, borderColor: P.hair },
  roundOn: { borderColor: 'rgba(138,160,196,0.55)', backgroundColor: 'rgba(138,160,196,0.12)' },
  roundT: { fontFamily: FONTS.medium, color: P.mist, fontSize: 14.5 },
  roundSub: { fontFamily: FONTS.body, color: P.faint, fontSize: 12, marginTop: 2 },
  roundHint: { fontFamily: FONTS.displayItalic, color: P.faint, fontSize: 12.5, marginHorizontal: 22, marginTop: 2 },

  jdToggle: { fontFamily: FONTS.displayItalic, color: P.mist, fontSize: 13.5 },

  cta: { marginTop: 26, marginHorizontal: 20, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(138,160,196,0.16)', borderWidth: 1, borderColor: 'rgba(138,160,196,0.5)' },
  ctaTxt: { fontFamily: FONTS.semibold, color: P.ink, fontSize: 15.5, letterSpacing: 0.4 },
  ctaHint: { fontFamily: FONTS.body, color: P.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
