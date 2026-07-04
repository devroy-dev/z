// Consult.js — "Expert Consultation", callmeZ's fourth pillar. Victor Hart lives on
// thedreamai's engine; this screen is the room you step into to sit with him. His
// register is deliberately NOT callmeZ's warm texting UI — serif, spare, still, a
// clock running. The surface IS part of his character.
//
// Powered by thedreamai (shown, on purpose): every consultation is a live demo of
// the David that deserves to be seen.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { consultFields, consultMint, consultChat, consultClose } from './consultApi';
import { myPhone } from './api';

const SERIF = 'CormorantGaramond_500Medium';
const SERIF_IT = 'CormorantGaramond_400Regular_Italic';
const SERIF_L = 'CormorantGaramond_300Light';
const SANS = 'Figtree_400Regular';
const SANS_SB = 'Figtree_600SemiBold';

// Victor's timer — carried from thedreamai. 7:00, first visible value 6:56 (never a
// clean number — the clock feels live and already yours). One-time first-ever reset.
const TIMER_SECONDS = 7 * 60;
const PRE_SPENT = 4;
const RESET_AT_ELAPSED = 4 * 60;
const MSG_CAP = 24;

const OPENER = "We have limited time and you're obviously here for a reason. Let's get straight to it.";
const RESET_LINE = "We see your time is running out, but your conversation isn't. We've reset the timer.";

const WARNING = "We're sure you know Victor is not a licensed lawyer, CA, or a doctor. But here's what you don't know — Victor is not your regular 'ask me and I tell' guy. He is a well-reasoned, straight-talking consultant. He will ask you tough questions. He will push back. If you want software that just takes search commands, you are in the wrong place. But if you're ready for an honest consultation without judgment, and the sharpest partner in your corner — you've found exactly what you came for.";
const ADVICE = "Go straight to the why.";

function mmss(total) {
  const m = Math.max(0, Math.floor(total / 60));
  const s = Math.max(0, total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// render Victor's reply with the beat spacing + *emphasis* he uses
function VictorText({ text }) {
  const paras = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <View>
      {paras.map((p, i) => {
        const parts = p.split(/(\*[^*\n]+\*)/g);
        return (
          <Text key={i} style={styles.vText}>
            {parts.map((part, j) =>
              /^\*[^*\n]+\*$/.test(part)
                ? <Text key={j} style={styles.vEm}>{part.slice(1, -1)}</Text>
                : <Text key={j}>{part}</Text>
            )}
          </Text>
        );
      })}
    </View>
  );
}

export default function Consult({ onBack = () => {} }) {
  const [step, setStep] = useState('pick');   // pick | intro | chat | capped
  const [fields, setFields] = useState([]);
  const [q, setQ] = useState('');
  const [field, setField] = useState(null);
  const [introCard, setIntroCard] = useState(0);   // 0 = warning, 1 = advice

  const [agentId, setAgentId] = useState(null);
  const [convId, setConvId] = useState(undefined);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const [remaining, setRemaining] = useState(TIMER_SECONDS - PRE_SPENT);
  const remainingRef = useRef(TIMER_SECONDS - PRE_SPENT);
  const firstEverRef = useRef(false);
  const didResetRef = useRef(false);
  const [expired, setExpired] = useState(false);
  const [resetMoment, setResetMoment] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { consultFields().then(setFields); }, []);

  // the clock — runs only in chat
  useEffect(() => {
    if (step !== 'chat' || expired) return;
    const t = setInterval(() => {
      remainingRef.current -= 1;
      // one-time first-ever generosity: at the reset mark, jump back once
      const RESET_WHEN = TIMER_SECONDS - RESET_AT_ELAPSED;
      if (firstEverRef.current && !didResetRef.current && remainingRef.current <= RESET_WHEN) {
        didResetRef.current = true;
        remainingRef.current = TIMER_SECONDS - PRE_SPENT;
        setResetMoment(true);
      }
      if (remainingRef.current <= 0) { remainingRef.current = 0; setExpired(true); clearInterval(t); }
      setRemaining(remainingRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [step, expired]);

  const pickField = (f) => { setField(f); setIntroCard(0); setStep('intro'); };

  const beginConsult = async () => {
    setBusy(true);
    try {
      const phone = (await myPhone()) || '';
      const r = await consultMint(field.key, phone);
      if (r.blocked) { setBlocked(true); setBusy(false); return; }
      setAgentId(r.agent_id);
      firstEverRef.current = !!r.first_ever;
      remainingRef.current = TIMER_SECONDS - PRE_SPENT;
      setRemaining(TIMER_SECONDS - PRE_SPENT);
      setMsgs(r.first_of_day ? [{ who: 'them', text: OPENER }] : [{ who: 'them', text: OPENER }]);
      setStep('chat');
    } catch (e) {
      setMsgs([{ who: 'them', text: 'Could not reach Victor right now. Try again in a moment.' }]);
      setStep('chat');
    } finally { setBusy(false); }
  };

  const send = async () => {
    const t = draft.trim();
    if (!t || !agentId || expired || busy) return;
    setDraft('');
    setMsgs((m) => [...m, { who: 'you', text: t }]);
    setSent((n) => n + 1);
    setBusy(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const d = await consultChat(agentId, t, convId);
      if (d.conversation_id) setConvId(d.conversation_id);
      setMsgs((m) => [...m, { who: 'them', text: d.reply || '…' }]);
    } catch {
      setMsgs((m) => [...m, { who: 'them', text: 'Lost the line for a second. Say that again.' }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  const closeAndBack = useCallback(async () => {
    if (agentId) { const phone = (await myPhone()) || ''; consultClose(phone, agentId, sent); }
    onBack();
  }, [agentId, sent, onBack]);

  const capped = sent >= MSG_CAP || expired;
  const shown = q.trim()
    ? fields.filter((f) => f.label.toLowerCase().includes(q.trim().toLowerCase()))
    : fields;

  // ── FIELD PICKER ──
  if (step === 'pick') return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E18', '#0C1018', '#08060C']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandTxt}>the<Text style={styles.brandTxtBold}>dreamai</Text></Text>
          </View>
          <Text style={styles.brandKicker}>CONSULTATION</Text>

          <Text style={styles.pickTitle}>Who do you need to <Text style={styles.pickTitleAccent}>consult</Text>?</Text>
          <Text style={styles.pickSub}>Pick a field. You'll sit with Victor — the expert in it. He won't tell you what you want to hear; he'll tell you what's true.</Text>

          <TextInput
            value={q} onChangeText={setQ}
            placeholder="Search a field…" placeholderTextColor="rgba(232,236,244,0.3)"
            style={styles.search}
          />
          <View style={styles.searchLine} />

          {shown.length === 0 ? (
            <Text style={styles.muted}>{fields.length === 0 ? 'loading fields…' : 'no field by that name.'}</Text>
          ) : shown.map((f) => (
            <Pressable key={f.key} style={styles.fieldRow} onPress={() => pickField(f)}>
              <Text style={styles.fieldTxt}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  // ── INTRO CARDS (warning → advice) ──
  if (step === 'intro') return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E18', '#0C1018', '#08060C']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={() => setStep('pick')}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.introWrap}>
          <View style={styles.introCard}>
            {introCard === 0 ? (
              <>
                <Text style={styles.introLabel}>WARNING</Text>
                <Text style={styles.introBody}>{WARNING}</Text>
              </>
            ) : (
              <>
                <Text style={styles.introLabel}>WORD OF ADVICE</Text>
                <Text style={styles.introAdvice}>{ADVICE}</Text>
              </>
            )}
            <View style={styles.introFoot}>
              <View style={styles.dots}>
                <View style={[styles.dot, introCard === 0 && styles.dotOn]} />
                <View style={[styles.dot, introCard === 1 && styles.dotOn]} />
              </View>
              {introCard === 0 ? (
                <Pressable style={styles.introBtn} onPress={() => setIntroCard(1)}><Text style={styles.introBtnTxt}>NEXT</Text></Pressable>
              ) : (
                <Pressable style={styles.introBtn} onPress={beginConsult} disabled={busy}>
                  <Text style={styles.introBtnTxt}>{busy ? '…' : 'BEGIN'}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.poweredBy}>powered by <Text style={styles.poweredByBold}>thedreamai</Text></Text>
        </View>
      </SafeAreaView>
    </View>
  );

  // ── BLOCKED (daily cap) ──
  if (blocked) return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E18', '#0C1018', '#08060C']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topRow}><Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable></View>
        <View style={styles.centerWrap}>
          <Text style={styles.introLabel}>VICTOR'S TIME IS LIMITED</Text>
          <Text style={styles.blockedTxt}>You've used your consultations for today. Come back tomorrow — Victor will be here.</Text>
          <Text style={styles.poweredBy}>powered by <Text style={styles.poweredByBold}>thedreamai</Text></Text>
        </View>
      </SafeAreaView>
    </View>
  );

  // ── CHAT ──
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E18', '#0C1018', '#08060C']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.chatTop}>
          <Pressable hitSlop={12} onPress={closeAndBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandTxtSm}>the<Text style={styles.brandTxtBold}>dreamai</Text></Text>
            </View>
            <Text style={styles.chatField}>CONSULTING · {(field?.label || '').toUpperCase()}</Text>
          </View>
          <Text style={[styles.timer, remaining <= 60 && styles.timerLow]}>{mmss(remaining)}</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 12, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {msgs.map((m, i) => (
              m.who === 'you' ? (
                <View key={i} style={styles.youBubble}><Text style={styles.youTxt}>{m.text}</Text></View>
              ) : (
                <View key={i} style={styles.vWrap}><VictorText text={m.text} /></View>
              )
            ))}
            {busy ? <View style={styles.vWrap}><View style={styles.thinkDot} /></View> : null}
            {resetMoment ? (
              <View style={styles.resetCard}>
                <Text style={styles.resetLine}>{RESET_LINE}</Text>
                <Pressable style={styles.introBtn} onPress={() => setResetMoment(false)}><Text style={styles.introBtnTxt}>GO ON</Text></Pressable>
              </View>
            ) : null}
          </ScrollView>

          {capped ? (
            <View style={styles.cappedBar}>
              <Text style={styles.cappedTxt}>{expired ? 'Your time with Victor is up. Start a new consultation when you need him again.' : 'This consultation has reached its limit.'}</Text>
              <Pressable onPress={() => { setStep('pick'); setMsgs([]); setSent(0); setAgentId(null); setExpired(false); setBlocked(false); remainingRef.current = TIMER_SECONDS - PRE_SPENT; setRemaining(TIMER_SECONDS - PRE_SPENT); didResetRef.current = false; }}>
                <Text style={styles.cappedLink}>new consultation ›</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.composer}>
              <TextInput
                value={draft} onChangeText={setDraft}
                placeholder="Tell Victor what's on the table…" placeholderTextColor="rgba(232,236,244,0.32)"
                style={styles.input} multiline onSubmitEditing={send} returnKeyType="send" blurOnSubmit
              />
              <Pressable style={styles.sendBtn} onPress={send} disabled={busy || !draft.trim()}>
                <Text style={styles.sendTxt}>›</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08060C' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, height: 44 },
  chev: { fontFamily: SERIF, color: 'rgba(232,236,244,0.7)', fontSize: 34, marginTop: -4 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  brandDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E8A24A', marginRight: 8, shadowColor: '#E8A24A', shadowOpacity: 0.8, shadowRadius: 6 },
  brandTxt: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.92)', fontSize: 21 },
  brandTxtSm: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.9)', fontSize: 16 },
  brandTxtBold: { fontFamily: 'CormorantGaramond_400Regular_Italic', color: '#F5F0E8' },
  brandKicker: { fontFamily: SANS_SB, color: 'rgba(232,236,244,0.4)', fontSize: 10, letterSpacing: 3, marginTop: 6, marginLeft: 17 },

  pickTitle: { fontFamily: SERIF, color: '#F5F0E8', fontSize: 34, marginTop: 34, lineHeight: 40 },
  pickTitleAccent: { fontFamily: SERIF_IT, color: '#E8A24A' },
  pickSub: { fontFamily: SERIF_L, color: 'rgba(232,236,244,0.6)', fontSize: 18, lineHeight: 25, marginTop: 16 },
  search: { fontFamily: SERIF_L, color: '#F5F0E8', fontSize: 21, marginTop: 34, paddingVertical: 6 },
  searchLine: { height: 1, backgroundColor: 'rgba(232,164,74,0.5)', marginBottom: 8 },
  fieldRow: { paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  fieldTxt: { fontFamily: SERIF_IT, color: 'rgba(232,236,244,0.78)', fontSize: 21 },
  muted: { fontFamily: SERIF_L, color: 'rgba(232,236,244,0.4)', fontSize: 17, marginTop: 20 },

  introWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  introCard: { borderWidth: 1, borderColor: 'rgba(232,164,74,0.25)', borderRadius: 20, padding: 26, backgroundColor: 'rgba(20,18,26,0.5)' },
  introLabel: { fontFamily: SANS_SB, color: '#E8A24A', fontSize: 11, letterSpacing: 2.5, marginBottom: 18 },
  introBody: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.9)', fontSize: 19, lineHeight: 28 },
  introAdvice: { fontFamily: SERIF, color: '#F5F0E8', fontSize: 30, lineHeight: 38 },
  introFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26 },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(232,236,244,0.2)' },
  dotOn: { width: 20, backgroundColor: 'rgba(245,240,232,0.85)' },
  introBtn: { paddingHorizontal: 26, paddingVertical: 13, borderRadius: 12, backgroundColor: 'rgba(245,240,232,0.92)' },
  introBtnTxt: { fontFamily: SANS_SB, color: '#0A0E18', fontSize: 13, letterSpacing: 1.5 },
  poweredBy: { fontFamily: SERIF_L, color: 'rgba(232,236,244,0.35)', fontSize: 14, textAlign: 'center', marginTop: 24 },
  poweredByBold: { fontFamily: SERIF_IT, color: 'rgba(232,236,244,0.55)' },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  blockedTxt: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.85)', fontSize: 21, lineHeight: 30, textAlign: 'center', marginTop: 16 },

  chatTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  chatField: { fontFamily: SANS_SB, color: 'rgba(232,236,244,0.35)', fontSize: 9.5, letterSpacing: 2, marginTop: 4, marginLeft: 17 },
  timer: { fontFamily: SERIF, color: 'rgba(245,240,232,0.75)', fontSize: 26 },
  timerLow: { color: '#E88A6A' },

  youBubble: { alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: 'rgba(232,236,244,0.06)', borderWidth: 1, borderColor: 'rgba(232,236,244,0.08)', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 11, marginTop: 16, marginBottom: 4 },
  youTxt: { fontFamily: SANS, color: 'rgba(232,236,244,0.82)', fontSize: 14.5, lineHeight: 20 },
  vWrap: { marginTop: 18, marginBottom: 4, paddingRight: 20 },
  vText: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.92)', fontSize: 20, lineHeight: 29, marginBottom: 14 },
  vEm: { fontFamily: SERIF_IT, color: '#E8A24A' },
  thinkDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(232,164,74,0.7)' },

  resetCard: { borderWidth: 1, borderColor: 'rgba(232,164,74,0.25)', borderRadius: 16, padding: 20, marginTop: 22, backgroundColor: 'rgba(20,18,26,0.5)' },
  resetLine: { fontFamily: SERIF_L, color: 'rgba(245,240,232,0.85)', fontSize: 17, lineHeight: 24, marginBottom: 16 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 22, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, fontFamily: SERIF_L, color: '#F5F0E8', fontSize: 18, maxHeight: 120, paddingVertical: 6 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(232,164,74,0.4)', alignItems: 'center', justifyContent: 'center', marginLeft: 10, backgroundColor: 'rgba(232,164,74,0.1)' },
  sendTxt: { fontFamily: SERIF, color: '#E8A24A', fontSize: 24, marginTop: -3 },

  cappedBar: { paddingHorizontal: 26, paddingVertical: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  cappedTxt: { fontFamily: SERIF_L, color: 'rgba(232,236,244,0.6)', fontSize: 16, lineHeight: 23 },
  cappedLink: { fontFamily: SANS_SB, color: '#E8A24A', fontSize: 13, letterSpacing: 0.5, marginTop: 12 },
});
