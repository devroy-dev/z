// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE DEBATE DUEL, LIVE. Two humans, one motion, the moderator
//  in the chair. Momentum swings on merit; the verdict lands when the
//  chair says so — never on turn counts. Both ledgers remember.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz } from '../common';
import { useLiveSession, seatLabelFn, shareTableInvite } from '../liveCommon';

export default function DebateDuelLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const g = view?.state;
  const me = view?.mySeat ?? -1;
  const mySide = me === 0 ? 'A' : 'B';
  const myTurn = g && g.phase === 'debate' && g.toAct === me;
  const oppSeat = 1 - me;
  const oppOpen = view?.seats?.[oppSeat]?.kind === 'open';
  const myShare = me === 0 ? (g?.momentum ?? 50) : 100 - (g?.momentum ?? 50);

  const speak = async () => {
    const text = draft.trim();
    if (text.length < 10 || sending) return;
    setSending(true); setDraft('');
    buzz('knock');
    await move({ type: 'speech', text });   // the moderator judges inside this call
    setSending(false);
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#120E16', '#0C0A10', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={st.bar}>
            <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
            <Text style={st.kicker}>debate duel · the moderator presides</Text>
            <Pressable hitSlop={10} onPress={() => shareTableInvite(view, 'a debate duel')}>
              <Text style={{ fontSize: 16 }}>🔗</Text>
            </Pressable>
          </View>

          {/* the motion */}
          <Text style={st.motion}>“{g?.motion || '…'}”</Text>

          {/* momentum */}
          <View style={st.momWrap}>
            <View style={st.momBar}>
              <View style={[st.momFill, { width: `${myShare}%` }]} />
            </View>
            <View style={st.momRow}>
              <Text style={[st.momLabel, { color: '#B98CF0' }]}>you · {Math.round(myShare)}</Text>
              <Text style={st.momLabel}>{oppOpen ? 'waiting for your friend…' : label(oppSeat)} · {Math.round(100 - myShare)}</Text>
            </View>
          </View>

          {/* transcript */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10, gap: 12 }}>
            {(g?.speeches || []).map((sp, i) => (
              <View key={i} style={[st.speech, sp.seat === me ? st.mine : st.theirs]}>
                <Text style={st.speechWho}>side {sp.seat === 0 ? 'A' : 'B'}{sp.seat === me ? ' · you' : ''}</Text>
                <Text style={st.speechTxt}>{sp.text}</Text>
              </View>
            ))}
            {g?.lastRemark ? (
              <View style={st.chair}>
                <Text style={st.chairTxt}>the chair: “{g.lastRemark}”{typeof g.lastSwing === 'number' && g.lastSwing !== 0 ? `  (${g.lastSwing > 0 ? '+' : ''}${g.lastSwing} to side A)` : ''}</Text>
              </View>
            ) : null}
            {g?.phase === 'verdict' && (
              <View style={st.verdictCard}>
                <Text style={st.verdictHead}>
                  {g.winner === 'draw' ? 'THE CHAIR CALLS A DRAW' : g.winner === me ? 'THE MOTION IS YOURS' : `${label(g.winner).toUpperCase()} CARRIES THE HOUSE`}
                </Text>
                <Text style={st.verdictTxt}>{g.verdict}</Text>
                <Pressable style={st.btn} onPress={onExit}><Text style={st.btnTxt}>leave the chamber</Text></Pressable>
              </View>
            )}
          </ScrollView>

          {/* the floor */}
          {g?.phase === 'debate' && (
            <View style={st.composerWrap}>
              {myTurn ? (
                <>
                  <TextInput
                    value={draft} onChangeText={setDraft} multiline editable={!sending}
                    placeholder={g.speeches.length === 0 ? 'you open — make it count…' : 'the floor is yours…'}
                    placeholderTextColor="rgba(233,232,240,0.3)"
                    style={st.input}
                  />
                  <Pressable style={[st.speakBtn, (draft.trim().length < 10 || sending) && { opacity: 0.4 }]} onPress={speak}>
                    <Text style={st.speakTxt}>{sending ? 'the chair is weighing…' : 'take the floor ›'}</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={st.waiting}>
                  {sending ? 'the chair is weighing the exchange…'
                    : oppOpen ? 'share the invite — the duel starts when they claim the other side.'
                    : `${label(g.toAct)} has the floor…`}
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0A10' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#B98CF0', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  motion: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 17, lineHeight: 24, textAlign: 'center', paddingHorizontal: 24, paddingTop: 10 },
  momWrap: { paddingHorizontal: 20, paddingTop: 12 },
  momBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  momFill: { height: 8, backgroundColor: '#B98CF0' },
  momRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  momLabel: { fontFamily: FONTS.medium, color: 'rgba(233,232,240,0.6)', fontSize: 11 },
  speech: { padding: 12, borderRadius: 14, maxWidth: '92%' },
  mine: { alignSelf: 'flex-end', backgroundColor: 'rgba(185,140,240,0.1)', borderWidth: 1, borderColor: 'rgba(185,140,240,0.28)' },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  speechWho: { fontFamily: FONTS.body, color: C.faint, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  speechTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.92)', fontSize: 14, lineHeight: 20 },
  chair: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.35)', backgroundColor: 'rgba(240,167,101,0.05)' },
  chairTxt: { fontFamily: FONTS.displayItalic, color: '#F0A765', fontSize: 12.5, textAlign: 'center' },
  verdictCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(185,140,240,0.4)', backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', gap: 8 },
  verdictHead: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, textAlign: 'center' },
  verdictTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.85)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  btn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(185,140,240,0.5)', backgroundColor: 'rgba(185,140,240,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: '#B98CF0', fontSize: 13.5 },
  composerWrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  input: { minHeight: 64, maxHeight: 140, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', color: C.cream, fontFamily: FONTS.body, fontSize: 14, padding: 12, textAlignVertical: 'top' },
  speakBtn: { paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(185,140,240,0.5)', backgroundColor: 'rgba(185,140,240,0.1)', alignItems: 'center' },
  speakTxt: { fontFamily: FONTS.semibold, color: '#B98CF0', fontSize: 14 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, textAlign: 'center', paddingVertical: 14 },
});
