// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE BULLETIN. The anchor's morning broadcast: your city first,
//  then the nation and the world. Tap any story and walk into his studio
//  to ask what it actually means.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import { C, FONTS } from './theme';
import { getBulletinFeed, setBulletinCity } from './api';
import { API_BASE } from './api';

const GOLD = '#E0C088';
const KICK_TONE = { INDIA: '#F0A765', WORLD: '#8FB8E0', BUSINESS: '#8FD98F', TECH: '#B98CF0', SPORT: '#F0708C', CITY: GOLD };

export default function Bulletin({ onBack = () => {}, onAskAnchor = () => {} }) {
  const [feed, setFeed] = useState(null);
  const [cityDraft, setCityDraft] = useState('');
  const [ask, setAsk] = useState('');
  const [savingCity, setSavingCity] = useState(false);

  const load = async () => { const f = await getBulletinFeed(); setFeed(f || { local: [], national: [], city: null }); };
  useEffect(() => { load(); }, []);

  const saveCity = async () => {
    const c = cityDraft.trim();
    if (c.length < 2 || savingCity) return;
    setSavingCity(true);
    try { await setBulletinCity(c); setFeed(null); await load(); } catch (e) {}
    setSavingCity(false);
  };

  const hour = new Date().getHours();
  const edition = hour < 12 ? 'the morning desk' : hour < 18 ? 'the afternoon desk' : "the 9 o'clock";

  const Story = ({ s }) => (
    <Pressable style={st.story} onPress={() => onAskAnchor(`about "${s.headline}" — `)}>
      <Text style={[st.kick, { color: KICK_TONE[s.kicker] || GOLD }]}>{s.kicker}</Text>
      <Text style={st.head}>{s.headline}</Text>
      <Text style={st.brief}>{s.brief}</Text>
      <Text style={st.ask}>ask the anchor ›</Text>
    </Pressable>
  );

  return (
    <View style={st.root}>
      <LinearGradient colors={['#14100A', '#0D0B08', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={st.masthead}>THE BULLETIN</Text>
            <Text style={st.edition}>{edition} · with the anchor</Text>
          </View>
          <Image source={{ uri: `${API_BASE}/faces/the_anchor.jpg?v=4` }} style={st.face} />
        </View>

        {!feed ? (
          <View style={st.center}><ActivityIndicator color={GOLD} /><Text style={st.loading}>the anchor is at the desk…</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            {/* ask the desk — any story in the world, researched live */}
            <View style={st.askBar}>
              <TextInput
                value={ask} onChangeText={setAsk}
                placeholder="ask about anything — a summit, a verdict, a match…"
                placeholderTextColor={C.faint} style={st.askInput}
                onSubmitEditing={() => { const q = ask.trim(); if (q.length > 3) { setAsk(''); onAskAnchor(q, true); } }}
                returnKeyType="send"
              />
              <Pressable hitSlop={8} onPress={() => { const q = ask.trim(); if (q.length > 3) { setAsk(''); onAskAnchor(q, true); } }}>
                <Text style={st.askGo}>›</Text>
              </Pressable>
            </View>

            {/* the local desk */}
            <Text style={st.section}>your city</Text>
            {feed.city ? (
              feed.local.length ? feed.local.map((s, i) => <Story key={'l' + i} s={s} />)
                : <Text style={st.quietLine}>the local desk found nothing worth your morning in {feed.city} today — a rare mercy.</Text>
            ) : (
              <View style={st.cityAsk}>
                <Text style={st.cityPrompt}>which city should the local desk cover?</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    value={cityDraft} onChangeText={setCityDraft} placeholder="your city…"
                    placeholderTextColor={C.faint} style={st.cityInput} onSubmitEditing={saveCity} returnKeyType="done"
                  />
                  <Pressable style={st.cityBtn} onPress={saveCity}>
                    {savingCity ? <ActivityIndicator color={GOLD} size="small" /> : <Text style={st.cityBtnTxt}>set ›</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {/* the nation & the world */}
            <Text style={[st.section, { marginTop: 22 }]}>the nation & the world</Text>
            {feed.national.length
              ? feed.national.map((s, i) => <Story key={'n' + i} s={s} />)
              : <Text style={st.quietLine}>today's edition is still being compiled — the anchor clocks in at six. try again shortly.</Text>}

            <Text style={st.foot}>tap any story to walk into the studio and ask what it means.</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B08' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  askBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(224,192,136,0.32)', borderRadius: 16, paddingHorizontal: 15, marginBottom: 20, backgroundColor: 'rgba(224,192,136,0.04)' },
  askInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 14, paddingVertical: 12 },
  askGo: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 24, paddingLeft: 10 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  masthead: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, letterSpacing: 3 },
  edition: { fontFamily: FONTS.body, color: GOLD, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginTop: 2 },
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(224,192,136,0.5)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  section: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  story: { borderWidth: 1, borderColor: 'rgba(224,192,136,0.18)', backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: 15, marginBottom: 11 },
  kick: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 2.5 },
  head: { fontFamily: FONTS.display, color: C.cream, fontSize: 17.5, lineHeight: 23, marginTop: 5 },
  brief: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.75)', fontSize: 13.5, lineHeight: 19.5, marginTop: 6 },
  ask: { fontFamily: FONTS.medium, color: GOLD, fontSize: 11.5, marginTop: 9, opacity: 0.85 },
  quietLine: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, lineHeight: 20, paddingHorizontal: 4 },
  cityAsk: { borderWidth: 1, borderColor: 'rgba(224,192,136,0.3)', borderStyle: 'dashed', borderRadius: 16, padding: 15 },
  cityPrompt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.85)', fontSize: 14, marginBottom: 12 },
  cityInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(224,192,136,0.35)', paddingVertical: 8, paddingHorizontal: 4 },
  cityBtn: { justifyContent: 'center', paddingHorizontal: 14 },
  cityBtnTxt: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 14 },
  foot: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
