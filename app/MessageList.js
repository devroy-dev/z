// yourZ — MessageList · the spoken lines, lifted verbatim from RoomChat (R0).
// Renders you / human / persona lines; personas' *emphasis* markdown never
// renders raw (the WhatsApp-flat register). Auto-scrolls on growth.
import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { N, nameOf, rgbOf, fmtTime } from './roomTheme';

const flat = (t) => String(t || '').replace(/\*\*?/g, '');

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

export function RoomLine({ line, hideSpeaker, mentionables }) {
  if (line.who === 'you') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-end' }]}>
        <View style={{ alignItems: 'flex-end', maxWidth: '84%' }}>
          {line.imageUri ? <Image source={{ uri: line.imageUri }} style={styles.sharedPhoto} /> : null}
          {line.text ? <View style={[styles.bubble, styles.bubbleYou, line.imageUri && { marginTop: 4 }]}><MentionedText text={line.text} mentionables={mentionables} style={styles.bubbleText} />{line.at ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}</View> : null}
        </View>
      </View>
    );
  }
  if (line.who === 'human') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
        <View style={{ maxWidth: '84%' }}>
          {!hideSpeaker ? <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text> : null}
          <View style={[styles.bubble, styles.bubbleHuman]}><Text style={styles.bubbleText}>{line.text}</Text></View>
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
      </View>
    </View>
  );
}

export default function MessageList({ lines, booted, hideSpeaker = false, emptyCopy = 'a shared room — say something to get it going.', mentionables = [] }) {
  const ref = useRef(null);
  return (
    <ScrollView
      ref={ref} style={{ flex: 1 }} contentContainerStyle={styles.convo}
      showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
    >
      {lines.length === 0
        ? (booted ? <Text style={styles.empty}>{emptyCopy}</Text> : null)
        : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={hideSpeaker} mentionables={mentionables} />)}
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
  sharedPhoto: { width: 190, height: 190, borderRadius: 16, resizeMode: 'cover' },
});
