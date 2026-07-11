// ════════════════════════════════════════════════════════════════════════
//  yourZ — SessionScreen · THE SITTING'S ROOM (R4 · ROOMS_SPEC_V2 §4.4)
//  The FOURTH thin shell on the chat core: useRoomFeed + MessageList +
//  Composer — compose, don't fork; the header is a variant, never a fork.
//  The phase name sits quiet at the top; the floor is INDICATED, never
//  enforced (both composers stay warm — softness is the mechanism); the
//  moderator's lines are visually hers; the close renders as a kept card.
//  NEVER CAPTIVE: end is ONE tap — no confirm, no guilt line.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import useRoomFeed from './useRoomFeed';
import MessageList from './MessageList';
import Composer from './Composer';
import { getSessions, endSession } from './api';
import { N, rgbOf } from './roomTheme';

const HEALER = 'the_healer';

export default function SessionScreen({ session, onBack = () => {} }) {
  const [s, setS] = useState(session);
  const feed = useRoomFeed(session.threadId, { personas: [HEALER], isDM: false });

  // the sitting's state (phase · floor · status) rides a quiet poll — the
  // moderator's moves change it server-side between messages. [declared: v1
  // polls; a session-state broadcast can replace this later]
  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const all = await getSessions();
        const mine = (all || []).find((x) => x.id === session.id);
        if (on && mine) setS(mine);
      } catch (e) {}
    };
    tick();
    const t = setInterval(tick, 9000);
    return () => { on = false; clearInterval(t); };
  }, [session.id]);

  const live = s.status === 'live';
  const done = s.status === 'closed' || s.status === 'ended';
  const floorLine = !live ? null
    : s.floorHolder == null ? 'the floor is open'
    : s.floorHolder === feed.meId ? 'the floor is yours'
    : `${s.otherName || 'they'} ${s.otherName ? 'has' : 'have'} the floor`;

  const doEnd = async () => {   // ONE tap. Instant. No are-you-sure.
    await endSession(s.id);
    onBack();
  };

  const onSend = ({ text, image }) => feed.send({ text, image });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`rgba(${rgbOf(HEALER)},0.14)`, `rgba(${rgbOf(HEALER)},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{s.title || 'the sitting'}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {done ? (s.status === 'closed' ? 'closed' : 'ended') : (s.phaseTitle || 'arrival')}
              {s.otherName ? `  ·  with ${s.otherName}` : ''}
            </Text>
          </View>
          {live ? (
            <Pressable hitSlop={8} style={styles.endBtn} onPress={doEnd}>
              <Text style={styles.endTxt}>end</Text>
            </Pressable>
          ) : null}
        </View>

        {floorLine ? <Text style={styles.floorLine}>{floorLine}</Text> : null}

        <MessageList lines={feed.lines} booted={feed.booted}
          mentionables={[]} onRetry={feed.retrySend}
          emptyCopy={s.status === 'invited' ? 'the room opens when they accept.' : 'the room is set — the healer will open the sitting.'} />

        {done ? (
          <View style={styles.closeCard}>
            <Text style={styles.closeTitle}>{s.status === 'closed' ? 'the sitting closed' : 'the sitting ended'}</Text>
            <Text style={styles.closeBody}>{s.status === 'closed'
              ? 'the reflection above is yours to keep — it lives here and nowhere else.'
              : 'nothing said here leaves this room.'}</Text>
          </View>
        ) : (
          <Composer onSend={onSend} sending={feed.sending} mentionables={[]} addressed={[]} onAddressed={() => {}} />
        )}
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, gap: 10 },
  chev: { color: 'rgba(233,232,240,0.6)', fontSize: 28, lineHeight: 30, fontFamily: 'Figtree_400Regular' },
  title: { color: '#E9E8F0', fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  sub: { color: 'rgba(233,232,240,0.45)', fontSize: 11.5, marginTop: 1, fontFamily: 'Figtree_400Regular' },
  endBtn: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(229,140,140,0.4)', paddingHorizontal: 13, paddingVertical: 6 },
  endTxt: { color: '#E58C8C', fontSize: 11.5, fontFamily: 'Figtree_500Medium' },
  floorLine: { color: 'rgba(196,164,232,0.7)', fontSize: 11.5, textAlign: 'center', paddingBottom: 6, fontFamily: 'Figtree_500Medium', fontStyle: 'italic' },
  closeCard: { margin: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(196,164,232,0.35)', backgroundColor: 'rgba(124,92,220,0.08)', padding: 16 },
  closeTitle: { color: '#E9E8F0', fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  closeBody: { color: 'rgba(233,232,240,0.6)', fontSize: 12.5, lineHeight: 18, marginTop: 6, fontFamily: 'Figtree_400Regular' },
});
