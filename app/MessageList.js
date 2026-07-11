// yourZ — MessageList · the spoken lines, lifted verbatim from RoomChat (R0).
// Renders you / human / persona lines; personas' *emphasis* markdown never
// renders raw (the WhatsApp-flat register). Auto-scrolls on growth.
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { N, nameOf, rgbOf, fmtTime } from './roomTheme';

const flat = (t) => String(t || '').replace(/\*\*?/g, '');

// [zip84] Tier-2 flat feed: handle in aura colour, keeper marked, no bubble.
const FLAT_HUES = ['#F0997B', '#85B7EB', '#EF9F27', '#ED93B1', '#97C459', '#5DCAA5', '#AFA9EC'];
const hashHue = (s) => FLAT_HUES[Math.abs([...String(s || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % FLAT_HUES.length];
function FlatLine({ line, onRetry }) {
  let handle, color;
  if (line.who === 'you') { handle = 'you'; color = '#E7B07A'; }
  else if (line.who === 'human') { handle = line.name || 'someone'; color = hashHue(line.name); }
  else { handle = nameOf(line.key); color = `rgb(${rgbOf(line.key)})`; }
  const keeper = line.key === 'the_moderator';
  const body = line.typing && !line.text ? '•••' : flat(line.text);
  return (
    <View style={styles.flatWrap}>
      <Text style={styles.flatText}>
        <Text style={[styles.flatHandle, { color }]}>{handle}</Text>{keeper ? <Text style={[styles.flatDiamond, { color }]}> ◆</Text> : null}<Text style={styles.flatBody}>{'  '}{body}</Text>
      </Text>
      {line.imageUri ? <Image source={{ uri: line.imageUri }} style={styles.flatPhoto} /> : null}
      {line.state === 'pending' ? <Text style={styles.flatPending}>…</Text> : null}
      {line.state === 'failed' ? (
        <Pressable onPress={() => onRetry && onRetry(line.id)} hitSlop={6}>
          <Text style={styles.failText}>didn't send — tap to retry</Text>
        </Pressable>
      ) : null}
      {line.state === 'blocked' ? (
        <Text style={styles.failText}>{line.blockNote || "that message wasn't sent — house rules."}</Text>
      ) : null}
    </View>
  );
}

// [zip50] sent bubbles paint @mentions: the mentioned persona's color when the
// name matches a mentionable, member-blue otherwise. Plain Text spans — no hacks.
function MentionedText({ text, mentionables = [], style }) {
  const parts = String(text || '').split(/(@[a-z]+(?:\s[a-z]+)?)/gi);
  if (parts.length === 1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (!p.startsWith('@')) return <Text key={i}>{p}</Text>;
        const q = p.slice(1).trim().toLowerCase();
        const hit = mentionables.find((m) => m.label.toLowerCase() === q || m.label.toLowerCase().startsWith(q));
        const color = hit ? (hit.type === 'human' ? N.human : `rgb(${hit.color})`) : N.human;
        return <Text key={i} style={{ color, fontFamily: 'Figtree_600SemiBold' }}>{p}</Text>;
      })}
    </Text>
  );
}

// [copy] a small square copy button under the AI's lines (Claude-style). The
// clipboard capability, made universal — not buried on draft cards. Draws the
// two-squares glyph with SVG (no font/emoji risk); flashes a check on copy.
function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await Clipboard.setStringAsync(String(text || '')); setDone(true); setTimeout(() => setDone(false), 1400); } catch (e) {}
  };
  return (
    <Pressable onPress={copy} hitSlop={10} style={styles.copyBtn}>
      {done ? (
        <Text style={styles.copyDone}>✓</Text>
      ) : (
        <Svg width={13} height={13} viewBox="0 0 24 24">
          <Rect x="9" y="9" width="12" height="12" rx="2.5" fill="none" stroke={N.moonFaint} strokeWidth="2.2" />
          <Rect x="4" y="4" width="12" height="12" rx="2.5" fill="none" stroke={N.moonFaint} strokeWidth="2.2" />
        </Svg>
      )}
    </Pressable>
  );
}

export function RoomLine({ line, hideSpeaker, mentionables, flatMode, onRetry }) {
  if (flatMode) return <FlatLine line={line} onRetry={onRetry} />;
  if (line.who === 'you') {
    // [H1] the sender always knows where their message stands: pending '…',
    // sent = stamp + faint tick, failed = an explicit retry line. Never silent.
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-end' }]}>
        <View style={{ alignItems: 'flex-end', maxWidth: '84%' }}>
          {line.imageUri ? <Image source={{ uri: line.imageUri }} style={styles.sharedPhoto} /> : null}
          {line.text ? <View style={[styles.bubble, styles.bubbleYou, line.imageUri && { marginTop: 4 }]}><MentionedText text={line.text} mentionables={mentionables} style={styles.bubbleText} />
            {line.state === 'pending'
              ? <Text style={styles.stamp}>…</Text>
              : (line.at ? <Text style={styles.stamp}>{fmtTime(line.at)}{line.state === 'sent' ? ' ✓' : ''}</Text> : null)}
          </View> : null}
          {line.state === 'failed' ? (
            <Pressable onPress={() => onRetry && onRetry(line.id)} hitSlop={6}>
              <Text style={styles.failText}>didn't send — tap to retry</Text>
            </Pressable>
          ) : null}
          {line.state === 'blocked' ? (
            <Text style={styles.failText}>{line.blockNote || "that message wasn't sent — house rules."}</Text>
          ) : null}
        </View>
      </View>
    );
  }
  if (line.who === 'human') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
        <View style={{ maxWidth: '84%' }}>
          {!hideSpeaker ? <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text> : null}
          <View style={[styles.bubble, styles.bubbleHuman]}><Text style={styles.bubbleText}>{line.text}</Text>{line.at ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}</View>{/* [zip54p/57b] humans get stamps too */}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '84%' }}>
        {line.key ? <Text style={[styles.speaker, { color: `rgb(${rgbOf(line.key)})` }]}>{nameOf(line.key)}</Text> : null}
        <View style={[styles.bubble, styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{line.typing && !line.text ? '•••' : flat(line.text)}</Text>{line.at && !line.typing ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}
        </View>
        {!line.typing && line.text ? <CopyBtn text={flat(line.text)} /> : null}
      </View>
    </View>
  );
}

export default function MessageList({ lines, booted, hideSpeaker = false, emptyCopy = 'a shared room — say something to get it going.', mentionables = [], flatFeed = false, onRetry }) {   // [H1]
  const ref = useRef(null);
  return (
    <ScrollView
      ref={ref} style={{ flex: 1 }} contentContainerStyle={styles.convo}
      showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
    >
      {lines.length === 0
        ? (booted ? <Text style={styles.empty}>{emptyCopy}</Text> : null)
        : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={hideSpeaker} mentionables={mentionables} flatMode={flatFeed} onRetry={onRetry} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  convo: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  empty: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moonFaint, fontSize: 14, textAlign: 'center', marginTop: 30 },
  lineRow: { flexDirection: 'row', marginBottom: 9 },
  speaker: { fontFamily: 'Figtree_500Medium', fontSize: 12, marginBottom: 4, marginLeft: 4, letterSpacing: 0.3 },
  bubble: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15 },
  bubbleThem: { backgroundColor: 'rgba(233,232,240,0.05)', borderWidth: 1, borderColor: N.hair, borderTopLeftRadius: 6 },
  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderTopRightRadius: 5 },
  bubbleHuman: { backgroundColor: 'rgba(159,176,206,0.10)', borderWidth: 1, borderColor: 'rgba(159,176,206,0.2)', borderTopLeftRadius: 6 },
  bubbleText: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 14.5, lineHeight: 19 },
  stamp: { fontFamily: 'Figtree_300Light', color: 'rgba(233,232,240,0.28)', fontSize: 9.5, marginTop: 2, alignSelf: 'flex-end' },
  copyBtn: { marginTop: 5, marginLeft: 3, width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: N.hair, alignItems: 'center', justifyContent: 'center' },
  copyDone: { color: '#97C459', fontFamily: 'Figtree_600SemiBold', fontSize: 13, lineHeight: 15 },
  sharedPhoto: { width: 190, height: 190, borderRadius: 16, resizeMode: 'cover' },
  flatWrap: { marginBottom: 9 },
  flatText: { fontSize: 14.5, lineHeight: 20 },
  flatHandle: { fontFamily: 'Figtree_600SemiBold' },
  flatDiamond: { fontSize: 10 },
  flatBody: { fontFamily: 'Figtree_400Regular', color: '#D6D4DE' },
  flatPhoto: { width: 180, height: 180, borderRadius: 14, resizeMode: 'cover', marginTop: 6 },
  flatPending: { color: 'rgba(233,232,240,0.3)', fontSize: 11, marginTop: 1 },
  failText: { fontFamily: 'Figtree_500Medium', color: '#E8836B', fontSize: 11.5, marginTop: 4, marginRight: 3 },
});
