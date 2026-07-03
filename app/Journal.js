// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE JOURNAL. A private moonlit page off the quiet room: set the
//  day down in your own words, kept for you (z.journal_entries). Typed now;
//  the Sarvam mic takes its seat here with the batched native build — same
//  room, one more way in. Self-contained: nothing leaves the app.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getJournal, postJournalText } from './api';

const Q = { top: '#1b1f30', mid: '#101320', deep: '#07080e', moon: '#EAECF5', dim: 'rgba(234,236,245,0.5)', faint: 'rgba(234,236,245,0.28)', glow: '#9FB0E0' };
const fmtDay = (at) => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleDateString([], { day: 'numeric', month: 'short' }); };

export default function Journal({ onBack = () => {} }) {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { getJournal().then(setEntries); }, []);
  const save = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    const r = await postJournalText(text);
    if (r) { setEntries((cur) => [{ id: r.id || String(Date.now()), transcript: text, created_at: new Date().toISOString() }, ...cur]); setDraft(''); }
    setSaving(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: Q.deep }}>
      <LinearGradient colors={[Q.top, Q.mid, Q.deep]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.top}>
            <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹ the quiet room</Text></Pressable>
          </View>
          <Text style={st.title}>the journal</Text>
          <Text style={st.sub}>set the day down. it stays yours.</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {entries.length === 0 && <Text style={st.empty}>nothing here yet. the first line is the hardest — after that it's just talking.</Text>}
            {entries.map((e) => (
              <View key={e.id} style={st.entry}>
                <Text style={st.date}>{fmtDay(e.created_at)}</Text>
                <Text style={st.body}>{e.transcript}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={st.composer}>
            <TextInput
              value={draft} onChangeText={setDraft} multiline
              placeholder="today…" placeholderTextColor={Q.faint}
              style={st.input}
            />
            <Pressable onPress={save} style={[st.keep, !draft.trim() && { opacity: 0.35 }]}>
              <Text style={st.keepTxt}>{saving ? '…' : 'keep it'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 6 },
  back: { fontFamily: 'Figtree_400Regular', color: Q.faint, fontSize: 13 },
  title: { fontFamily: 'Fraunces_400Regular', color: Q.moon, fontSize: 30, paddingHorizontal: 24, marginTop: 14 },
  sub: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.dim, fontSize: 13.5, paddingHorizontal: 24, marginTop: 4 },
  empty: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.faint, fontSize: 14.5, lineHeight: 22, marginTop: 24, textAlign: 'center', paddingHorizontal: 12 },
  entry: { marginTop: 18, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(159,176,224,0.3)' },
  date: { fontFamily: 'Figtree_600SemiBold', color: 'rgba(159,176,224,0.75)', fontSize: 10.5, letterSpacing: 1 },
  body: { fontFamily: 'Figtree_400Regular', color: 'rgba(234,236,245,0.82)', fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  input: { flex: 1, minHeight: 44, maxHeight: 130, borderWidth: 1, borderColor: 'rgba(234,236,245,0.14)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: Q.moon, fontFamily: 'Figtree_400Regular', fontSize: 14.5 },
  keep: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 100, backgroundColor: 'rgba(159,176,224,0.16)', borderWidth: 1, borderColor: 'rgba(159,176,224,0.4)' },
  keepTxt: { fontFamily: 'Figtree_500Medium', color: Q.glow, fontSize: 13.5 },
});
