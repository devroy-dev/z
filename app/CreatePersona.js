// ════════════════════════════════════════════════════════════════════════
//  yourZ — CREATE SOMEONE. Six beats in the chat register: who they are ·
//  how they talk · a line they'd say · what they care about · name + how
//  they address you · boundaries. The engine composes the codex (house
//  format, judged before you ever see it), you meet them on a preview
//  card, keep or reshape. Their character is yours; the house rules ride
//  underneath and always win.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import { FONTS } from './theme';
import { composeCustomPersona, saveCustomPersona } from './api';

const MOON = {
  ground: '#090C12', porcelain: '#E4EAF2', mist: 'rgba(228,234,242,0.55)',
  faint: 'rgba(228,234,242,0.32)', moon: '#9FC2E8', hair: 'rgba(159,194,232,0.12)',
};
const TONES = ['#9FC2E8', '#E7B07A', '#C99BE8', '#8FD98F', '#F0708C', '#6FC9E0', '#E0C088', '#F0A765'];

const BEATS = [
  { id: 'role', q: 'who are they to you?', hint: 'a rival who keeps you sharp · a grumpy uncle · a hype-woman · a philosophical cat…', multiline: true },
  { id: 'voice', q: 'how do they talk?', hint: 'two or three words — dry and precise · loud and warm · slow, poetic…' },
  { id: 'sample', q: 'write one line they\'d actually say', hint: 'this tunes their whole voice — make it sound like them', multiline: true },
  { id: 'pursuit', q: 'what do they care about?', hint: 'their thing — the obsession, the craft, the cause', multiline: true },
  { id: 'name', q: 'their name — and what do they call you?', hint: 'name on the first line', double: true },
  { id: 'boundaries', q: 'anything they should never do?', hint: 'optional — topics to avoid, lines not to cross', multiline: true, optional: true },
];

export default function CreatePersona({ onDone = () => {}, onBack = () => {} }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ role: '', voice: '', sample: '', pursuit: '', name: '', address: '', boundaries: '' });
  const [tone, setTone] = useState(TONES[0]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);      // { name, codex }
  const [err, setErr] = useState('');
  const scroll = useRef(null);

  const beat = BEATS[step];
  const val = beat ? answers[beat.id] : '';
  const canNext = beat ? (beat.optional || (beat.double ? (answers.name.trim() && answers.address.trim()) : String(val).trim().length > 1)) : false;

  const next = async () => {
    setErr('');
    if (step < BEATS.length - 1) { setStep(step + 1); return; }
    // compose
    setBusy(true);
    try {
      const r = await composeCustomPersona(answers);
      if (r?.rejected) { setErr(r.reason || 'the house said no to that design — reshape it.'); }
      else if (r?.codex) setDraft({ name: r.name, codex: r.codex });
      else setErr(r?.error || "composition didn't come back — try again.");
    } catch (e) { setErr(String(e?.message || e).slice(0, 160)); }
    setBusy(false);
  };

  const keep = async () => {
    setBusy(true); setErr('');
    try {
      const r = await saveCustomPersona(draft.name, draft.codex, tone);
      if (r?.rejected) setErr(r.reason || 'the house said no — reshape it.');
      else if (r?.key) { onDone(r.key, r.name); return; }
      else setErr(r?.error || "save didn't land — try again.");
    } catch (e) { setErr(String(e?.message || e).slice(0, 160)); }
    setBusy(false);
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0E1219', '#090C12', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={st.header}>
            <Pressable onPress={draft ? () => setDraft(null) : onBack} hitSlop={12}>
              <Text style={st.back}>‹ {draft ? 'reshape' : 'the gathering'}</Text>
            </Pressable>
            <Text style={st.kicker}>create someone</Text>
            <Text style={st.title}>{draft ? `meet ${draft.name}` : 'your person'}</Text>
          </View>

          {!draft ? (
            <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={st.dots}>
                {BEATS.map((b, i) => (
                  <View key={b.id} style={[st.dot, i === step && st.dotOn, i < step && st.dotDone]} />
                ))}
              </View>
              <Text style={st.q}>{beat.q}</Text>
              <Text style={st.hint}>{beat.hint}</Text>
              {beat.double ? (
                <>
                  <TextInput style={st.input} value={answers.name} placeholder="their name"
                    placeholderTextColor={MOON.faint} maxLength={40}
                    onChangeText={(t) => setAnswers((a) => ({ ...a, name: t }))} />
                  <TextInput style={st.input} value={answers.address} placeholder="what they call you — boss · beta · your name…"
                    placeholderTextColor={MOON.faint} maxLength={80}
                    onChangeText={(t) => setAnswers((a) => ({ ...a, address: t }))} />
                </>
              ) : (
                <TextInput style={[st.input, beat.multiline && { minHeight: 88, textAlignVertical: 'top' }]}
                  value={val} multiline={!!beat.multiline} placeholder="…"
                  placeholderTextColor={MOON.faint} maxLength={beat.id === 'voice' ? 200 : 300}
                  onChangeText={(t) => setAnswers((a) => ({ ...a, [beat.id]: t }))} />
              )}
              {step === BEATS.length - 1 ? (
                <>
                  <Text style={st.toneLbl}>their light</Text>
                  <View style={st.toneRow}>
                    {TONES.map((t) => (
                      <Pressable key={t} onPress={() => setTone(t)}
                        style={[st.toneDot, { backgroundColor: t }, tone === t && st.toneDotOn]} />
                    ))}
                  </View>
                </>
              ) : null}
              {err ? <Text style={st.err}>{err}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                {step > 0 ? (
                  <Pressable style={st.ghostBtn} onPress={() => { setErr(''); setStep(step - 1); }}>
                    <Text style={st.ghostTxt}>back</Text>
                  </Pressable>
                ) : null}
                <Pressable disabled={!canNext || busy} onPress={next}
                  style={[st.nextBtn, { opacity: !canNext || busy ? 0.4 : 1 }]}>
                  {busy ? <ActivityIndicator color={MOON.porcelain} /> :
                    <Text style={st.nextTxt}>{step === BEATS.length - 1 ? 'compose them' : 'next'}</Text>}
                </Pressable>
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
              <View style={[st.card, { borderColor: tone }]}>
                <View style={[st.mono, { borderColor: tone }]}>
                  <Text style={[st.monoTxt, { color: tone }]}>{(draft.name[0] || '✦').toUpperCase()}</Text>
                </View>
                <Text style={st.cardName}>{draft.name}</Text>
                <Text style={st.cardRole} numberOfLines={2}>{answers.role}</Text>
                <View style={st.cardMeta}>
                  <Text style={st.cardMetaTxt}>speaks: {answers.voice}</Text>
                  <Text style={st.cardMetaTxt}>calls you: {answers.address}</Text>
                  <Text style={st.cardMetaTxt} numberOfLines={2}>lives for: {answers.pursuit}</Text>
                </View>
                <Text style={st.cardLine}>“{answers.sample}”</Text>
              </View>
              <Text style={st.previewNote}>talk to them for two minutes before you decide — you can always come back and reshape.</Text>
              {err ? <Text style={st.err}>{err}</Text> : null}
              <Pressable disabled={busy} onPress={keep} style={[st.nextBtn, { marginTop: 16, opacity: busy ? 0.5 : 1 }]}>
                {busy ? <ActivityIndicator color={MOON.porcelain} /> : <Text style={st.nextTxt}>keep them — open the chat</Text>}
              </Pressable>
              <Pressable disabled={busy} onPress={() => setDraft(null)} style={[st.ghostBtn, { marginTop: 10, alignSelf: 'stretch', alignItems: 'center' }]}>
                <Text style={st.ghostTxt}>reshape</Text>
              </Pressable>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: MOON.ground },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  back: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 13, marginBottom: 10 },
  kicker: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 30, marginTop: 2 },

  dots: { flexDirection: 'row', gap: 7, marginTop: 6, marginBottom: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: MOON.hair },
  dotOn: { backgroundColor: MOON.moon },
  dotDone: { backgroundColor: 'rgba(159,194,232,0.45)' },

  q: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 21, lineHeight: 28 },
  hint: { fontFamily: FONTS.light, color: MOON.mist, fontSize: 13, lineHeight: 19, marginTop: 6 },
  input: { fontFamily: FONTS.body, color: MOON.porcelain, fontSize: 16, borderBottomWidth: 1, borderColor: 'rgba(228,234,242,0.16)', paddingVertical: 10, marginTop: 14 },

  toneLbl: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 22 },
  toneRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  toneDot: { width: 28, height: 28, borderRadius: 14, opacity: 0.85 },
  toneDotOn: { borderWidth: 2, borderColor: '#fff', opacity: 1 },

  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, lineHeight: 19, marginTop: 14 },
  nextBtn: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: MOON.moon, backgroundColor: 'rgba(159,194,232,0.1)', paddingVertical: 14, alignItems: 'center' },
  nextTxt: { fontFamily: FONTS.semibold, color: MOON.porcelain, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
  ghostBtn: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(228,234,242,0.14)', paddingVertical: 14, paddingHorizontal: 22 },
  ghostTxt: { fontFamily: FONTS.medium, color: MOON.mist, fontSize: 13 },

  card: { borderRadius: 24, borderWidth: 1.5, padding: 22, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.02)' },
  mono: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  monoTxt: { fontFamily: FONTS.display, fontSize: 27 },
  cardName: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 25 },
  cardRole: { fontFamily: FONTS.light, color: MOON.mist, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  cardMeta: { marginTop: 14, gap: 4 },
  cardMetaTxt: { fontFamily: FONTS.light, color: MOON.faint, fontSize: 12.5, lineHeight: 18 },
  cardLine: { fontFamily: FONTS.displayItalic, color: MOON.porcelain, fontSize: 15.5, lineHeight: 22, marginTop: 16 },
  previewNote: { fontFamily: FONTS.light, color: MOON.faint, fontSize: 12.5, lineHeight: 18, marginTop: 14 },
});
