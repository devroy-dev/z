// yourZ — Composer · draft, mic, photo, send + THE MENTION SYSTEM (zip50).
// Type '@' → a popover of the room's mentionables (personas with aura dots,
// humans in blue); tap → the name inserts AND the persona joins the addressed
// set — mechanism, not regex luck. Addressed chips above the field show who'll
// be summoned; tap a chip to release them. DMs pass no mentionables and see none
// of this. Owns its voice hook + pending image; hands the send upward.
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { transcribeVoice } from './api';
import { useVoiceNote } from './voice';
import { N } from './roomTheme';

export default function Composer({
  onSend, sending = false, placeholder = 'say something to the room…',
  mentionables = [],            // [{ key, label, color, type: 'persona'|'human' }]
  addressed = [], onAddressed,  // controlled addressed set (persona keys)
}) {
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const voice = useVoiceNote();
  const [transcribing, setTranscribing] = useState(false);

  // ── the mention popover: open while the draft's tail is an unfinished @word ──
  const mention = useMemo(() => {
    if (!mentionables.length) return null;
    const m = /@([a-z ]*)$/i.exec(draft);
    if (!m) return null;
    const q = m[1].trim().toLowerCase();
    const hits = mentionables.filter((p) => !q || p.label.toLowerCase().includes(q));
    return hits.length ? { start: m.index, hits: hits.slice(0, 6) } : null;
  }, [draft, mentionables]);

  const pickMention = (p) => {
    setDraft((d) => d.slice(0, mention.start) + '@' + p.label + ' ');
    if (p.type === 'persona' && onAddressed && !addressed.includes(p.key)) onAddressed([...addressed, p.key]);
  };

  const labelOf = (key) => (mentionables.find((p) => p.key === key)?.label) || key;
  const colorOf = (key) => (mentionables.find((p) => p.key === key)?.color) || '231,176,122';

  const onMic = async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const r = await transcribeVoice(clip.uri, clip.mime);
        if (r.ok && r.transcript) setDraft((d) => (d ? d + ' ' : '') + r.transcript);
        else Alert.alert('couldn’t catch that', r.diag || 'no transcript came back — try again.');
      } catch (e) { Alert.alert('voice error', String(e?.message || e)); }
      setTranscribing(false);
    } else {
      await voice.start();
    }
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const b64 = res.assets[0].base64;
      setPendingImage({ data: b64, uri: `data:image/jpeg;base64,${b64}` });
    } catch (e) {}
  };

  const doSend = () => {
    const ok = onSend({ text: draft, image: pendingImage });
    if (ok !== false) { setDraft(''); setPendingImage(null); }
  };

  return (
    <>
      {mention ? (
        <View style={styles.mentionPop}>
          {mention.hits.map((p) => (
            <Pressable key={p.key} style={styles.mentionRow} onPress={() => pickMention(p)}>
              <View style={[styles.mentionDot, { backgroundColor: p.type === 'human' ? N.human : `rgb(${p.color})` }]} />
              <Text style={styles.mentionName}>{p.label}</Text>
              {p.type === 'human' ? <Text style={styles.mentionKind}>member</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {addressed.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {addressed.map((k) => (
            <Pressable key={k} style={[styles.chip, { borderColor: `rgba(${colorOf(k)},0.55)` }]} onPress={() => onAddressed && onAddressed(addressed.filter((x) => x !== k))}>
              <Text style={[styles.chipTxt, { color: `rgb(${colorOf(k)})` }]}>@{labelOf(k)}</Text>
              <Text style={styles.chipX}>✕</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {pendingImage ? (
        <View style={styles.pendingStrip}>
          <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} />
          <Pressable onPress={() => setPendingImage(null)} style={styles.pendingX} hitSlop={8}><Text style={styles.pendingXTxt}>✕</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <View style={[styles.field, { flexDirection: 'row', alignItems: 'flex-end' }]}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={voice.recording ? 'listening…' : placeholder} placeholderTextColor={N.moonFaint} style={[styles.input, { flex: 1 }]} multiline />{/* [H1] never locked mid-send */}
          <Pressable style={styles.inlineBtn} onPress={pickPhoto} hitSlop={6}>
            <Text style={styles.inlineBtnTxt}>＋</Text>
          </Pressable>
          <Pressable style={styles.inlineBtn} onPress={onMic} disabled={transcribing} hitSlop={6}>
            <Text style={[styles.inlineMicTxt, voice.recording && styles.micBtnLive]}>{transcribing ? '…' : voice.recording ? '■' : '🎤'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.send} onPress={doSend}>
          <Svg width="46" height="46" viewBox="0 0 46 46">
            <Defs><RadialGradient id="rsend" cx="42%" cy="36%" r="66%"><Stop offset="0%" stopColor={N.candleHot} /><Stop offset="52%" stopColor={N.candle} /><Stop offset="100%" stopColor="#c88a4f" /></RadialGradient></Defs>
            <Circle cx="23" cy="23" r="17" fill="url(#rsend)" />
            <Path d="M16 23 L30 17 L25.5 30 L22 24.5 Z" fill="#2a1c10" />
          </Svg>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  mentionPop: { marginHorizontal: 16, marginBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: N.hair, backgroundColor: 'rgba(16,14,21,0.98)', overflow: 'hidden' },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(233,232,240,0.06)' },
  mentionDot: { width: 8, height: 8, borderRadius: 4 },
  mentionName: { fontFamily: 'Figtree_500Medium', color: N.moon, fontSize: 14, flex: 1 },
  mentionKind: { fontFamily: 'Figtree_300Light', color: N.moonFaint, fontSize: 11 },
  chipRow: { maxHeight: 34, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1, backgroundColor: 'rgba(233,232,240,0.04)' },
  chipTxt: { fontFamily: 'Figtree_500Medium', fontSize: 12.5 },
  chipX: { color: N.moonFaint, fontSize: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 },
  inlineBtn: { paddingHorizontal: 8, paddingBottom: 10, alignItems: 'center', justifyContent: 'flex-end' },
  inlineBtnTxt: { fontSize: 23, color: '#F0A765', lineHeight: 25 },
  inlineMicTxt: { fontSize: 16, color: '#F0A765', lineHeight: 22 },
  micBtnLive: { color: '#FF6B5A', fontSize: 18 },
  pendingStrip: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row' },
  pendingThumb: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover' },
  pendingX: { position: 'absolute', left: 62, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  pendingXTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  field: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 110 },
  send: { width: 46, height: 46 },
});
