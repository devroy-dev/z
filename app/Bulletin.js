// [zip24] identity: cold signal — slate control room, monitor-cyan; a newsroom is never amber
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE BULLETIN. The anchor's morning broadcast: your city first,
//  then the nation and the world. Tap any story and walk into his studio
//  to ask what it actually means.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, ActivityIndicator, Linking } from 'react-native';   // [zip67]
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import { C, FONTS } from './theme';
import { getBulletinFeed, setBulletinCity, refreshBulletinFeed, getWireFeed, getNewsFollows, addNewsFollow, removeNewsFollow, getYourDesk, factCheckClaim, getFactChecks } from './api';   // [zip54n] [zip67] [0057]
import { API_BASE } from './api';

const GOLD = '#7FD6EC';   // signal-cyan: the monitor glow
const KICK_TONE = { INDIA: '#F0A765', WORLD: '#8FB8E0', BUSINESS: '#8FD98F', TECH: '#B98CF0', SPORT: '#F0708C', CITY: GOLD };
const VERDICT_TONE = { true: '#8FD98F', false: '#E88F8F', misleading: '#E0C088', unverifiable: '#9FB4C0' };

export default function Bulletin({ onBack = () => {}, onAskAnchor = () => {} }) {
  const [feed, setFeed] = useState(null);
  const [cityDraft, setCityDraft] = useState('');
  const [wire, setWire] = useState('');   // [zip54p] the refresh speaks
  const [wireItems, setWireItems] = useState([]);   // [zip67] the shelf
  const [ask, setAsk] = useState('');
  const [savingCity, setSavingCity] = useState(false);
  // [0057] §6.1 your desk + §6.3 fact-check
  const [follows, setFollows] = useState([]);
  const [deskItems, setDeskItems] = useState([]);
  const [followDraft, setFollowDraft] = useState('');
  const [factClaim, setFactClaim] = useState('');
  const [factResult, setFactResult] = useState(null);
  const [factChecking, setFactChecking] = useState(false);
  const [factHistory, setFactHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    const f = await getBulletinFeed(); setFeed(f || { local: [], national: [], city: null });
    try { const w = await getWireFeed(null, true); if (w?.items?.length) setWireItems(w.items); } catch (e) {}   // [zip67] refresh ALWAYS moves the wire
    loadDesk();
  };
  const loadDesk = async () => {
    try { const [fl, dk, fc] = await Promise.all([getNewsFollows(), getYourDesk(), getFactChecks()]); setFollows(fl); setDeskItems(dk); setFactHistory(fc); } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const addFollowH = async () => {
    const t = followDraft.trim();
    if (t.length < 3) return;
    setFollowDraft('');
    try { await addNewsFollow('topic', t, null); await loadDesk(); } catch (e) {}
  };
  const removeFollowH = async (id) => {
    setFollows((cur) => cur.filter((f) => f.id !== id));
    try { await removeNewsFollow(id); await loadDesk(); } catch (e) {}
  };
  const runFactCheck = async () => {
    const c = factClaim.trim();
    if (c.length < 6 || factChecking) return;
    setFactChecking(true); setFactResult(null);
    try { const r = await factCheckClaim(c); setFactResult(r); setFactClaim(''); loadDesk(); } catch (e) {} finally { setFactChecking(false); }
  };

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
  const VerdictCard = ({ c, compact }) => {
    const tone = VERDICT_TONE[c.verdict] || '#9FB4C0';
    return (
      <View style={[st.verdict, { borderColor: tone + '55' }, compact && { marginTop: 8, padding: 11 }]}>
        <Text style={[st.verdictBadge, { color: tone }]}>{String(c.verdict || 'unverifiable').toUpperCase()}</Text>
        <Text style={st.verdictClaim} numberOfLines={compact ? 2 : undefined}>{c.claim}</Text>
        {!compact ? <Text style={st.verdictReason}>{c.reasoning}</Text> : null}
        {!compact && Array.isArray(c.sources) && c.sources.length ? (
          <View style={{ marginTop: 7, gap: 3 }}>
            {c.sources.slice(0, 4).map((s, i) => (
              <Pressable key={i} onPress={() => Linking.openURL(s.url).catch(() => {})}><Text style={st.verdictSrc} numberOfLines={1}>› {s.title || s.url}</Text></Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0A1218', '#080D12', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={st.masthead}>THE BULLETIN</Text>
            <Text style={st.edition}>{edition} · with the anchor</Text>
          </View>
          <Pressable hitSlop={10} onPress={async () => {
            setWire('checking the wire…');
            let r = null; try { r = await refreshBulletinFeed(); } catch (e) {}
            await load();
            setWire(!r ? 'the wire didn\u2019t answer — try again' : !r.refreshed ? 'checked minutes ago — give it a moment' : r.added ? `${r.added} new — the wire moved` : 'nothing genuinely new broke in the last hours');
          }}><Text style={{ color: '#C9A86A', fontSize: 20 }}>↻</Text></Pressable>{/* [zip54n] [zip54p] ask the wire, hear the answer */}
          <Image source={{ uri: `${API_BASE}/faces/the_anchor.jpg?v=6` }} style={st.face} />
        </View>

        {wire ? <Text style={{ color: '#C9A86A', fontSize: 11.5, textAlign: 'center', paddingBottom: 6, fontStyle: 'italic' }}>{wire}</Text> : null}
        {!feed ? (
          <View style={st.center}><ActivityIndicator color={GOLD} /><Text style={st.loading}>the anchor is at the desk…</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <Image source={{ uri: `${API_BASE}/faces/the_newsroom.jpg?v=4` }} style={{ width: '100%', height: 140, borderRadius: 14, marginBottom: 12 }} resizeMode="cover" />{/* [zip54n] the studio crowns the desk */}
            {wireItems.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 10 }}>{/* [zip67] the wire shelf */}
                {wireItems.slice(0, 14).map((w, wi) => (
                  <Pressable key={wi} onPress={() => Linking.openURL(w.link).catch(() => {})} style={{ width: 230, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,168,106,0.22)', backgroundColor: 'rgba(201,168,106,0.04)', padding: 11 }}>
                    <Text style={{ color: '#C9A86A', fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase', fontFamily: FONTS.body }}>{w.topic}{w.source ? ' · ' + w.source : ''}</Text>
                    <Text numberOfLines={3} style={{ color: C.cream, fontSize: 12.5, lineHeight: 17, marginTop: 4, fontFamily: FONTS.body }}>{w.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {/* [0057] §6.1 YOUR DESK — the wire, filtered to what you follow. no model billed. */}
            <View style={st.deskBox}>
              <Text style={st.deskLabel}>your desk</Text>
              {follows.length ? (
                <View style={st.chipRow}>
                  {follows.filter((f) => f.kind !== 'story').map((f) => (
                    <Pressable key={f.id} onPress={() => removeFollowH(f.id)} style={st.chip}>
                      <Text style={st.chipTxt}>{f.term} ✕</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={st.followRow}>
                <TextInput
                  value={followDraft} onChangeText={setFollowDraft}
                  placeholder="follow a topic or name — cricket, your city, a company…"
                  placeholderTextColor={C.faint} style={st.followInput}
                  onSubmitEditing={addFollowH} returnKeyType="done"
                />
                <Pressable hitSlop={8} onPress={addFollowH}><Text style={st.followGo}>follow ›</Text></Pressable>
              </View>
              {deskItems.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 10 }}>
                  {deskItems.slice(0, 12).map((w, wi) => (
                    <Pressable key={wi} onPress={() => Linking.openURL(w.link).catch(() => {})} style={st.deskCard}>
                      <Text style={st.deskCardTop}>{w.topic}{w.source ? ' · ' + w.source : ''}</Text>
                      <Text numberOfLines={3} style={st.deskCardTitle}>{w.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : follows.length ? (
                <Text style={st.deskEmpty}>nothing on the wire matches your follows right now — check back as the day moves.</Text>
              ) : (
                <Text style={st.deskEmpty}>follow a few topics or names and your desk fills from the live wire — free, no waiting.</Text>
              )}
            </View>
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

            {/* [0057] §6.3 the fact-check desk — paste a forward, get a verdict */}
            <View style={st.factBox}>
              <Text style={st.factLabel}>the fact-check desk</Text>
              <Text style={st.factHint}>paste a WhatsApp forward or a claim — the anchor checks it against the web.</Text>
              <View style={st.factInputRow}>
                <TextInput
                  value={factClaim} onChangeText={setFactClaim} multiline
                  placeholder="paste the claim or forward…"
                  placeholderTextColor={C.faint} style={st.factInput}
                />
                <Pressable hitSlop={8} onPress={runFactCheck} disabled={factChecking} style={[st.factBtn, factChecking && { opacity: 0.6 }]}>
                  {factChecking ? <ActivityIndicator color={GOLD} size="small" /> : <Text style={st.factBtnTxt}>check ›</Text>}
                </Pressable>
              </View>
              {factResult ? <VerdictCard c={factResult} /> : null}
              {factHistory.length ? (
                <View>
                  <Pressable onPress={() => setShowHistory((v) => !v)}><Text style={st.histToggle}>{showHistory ? 'hide' : 'past checks'} ({factHistory.length})</Text></Pressable>
                  {showHistory ? factHistory.map((c) => <VerdictCard key={c.id} c={c} compact />) : null}
                </View>
              ) : null}
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
  root: { flex: 1, backgroundColor: '#080D12' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  askBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(127,214,236,0.32)', borderRadius: 16, paddingHorizontal: 15, marginBottom: 20, backgroundColor: 'rgba(127,214,236,0.04)' },
  askInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 14, paddingVertical: 12 },
  askGo: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 24, paddingLeft: 10 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  masthead: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, letterSpacing: 3 },
  edition: { fontFamily: FONTS.body, color: GOLD, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginTop: 2 },
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(127,214,236,0.5)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  section: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  story: { borderWidth: 1, borderColor: 'rgba(127,214,236,0.18)', backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, padding: 15, marginBottom: 11 },
  kick: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 2.5 },
  head: { fontFamily: FONTS.display, color: C.cream, fontSize: 17.5, lineHeight: 23, marginTop: 5 },
  brief: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.75)', fontSize: 13.5, lineHeight: 19.5, marginTop: 6 },
  ask: { fontFamily: FONTS.medium, color: GOLD, fontSize: 11.5, marginTop: 9, opacity: 0.85 },
  quietLine: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, lineHeight: 20, paddingHorizontal: 4 },
  cityAsk: { borderWidth: 1, borderColor: 'rgba(127,214,236,0.3)', borderStyle: 'dashed', borderRadius: 16, padding: 15 },
  cityPrompt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.85)', fontSize: 14, marginBottom: 12 },
  cityInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(127,214,236,0.35)', paddingVertical: 8, paddingHorizontal: 4 },
  cityBtn: { justifyContent: 'center', paddingHorizontal: 14 },
  cityBtnTxt: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 14 },
  foot: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 16 },
  deskBox: { borderWidth: 1, borderColor: 'rgba(201,168,106,0.22)', borderRadius: 16, padding: 14, marginBottom: 16, backgroundColor: 'rgba(201,168,106,0.03)' },
  deskLabel: { fontFamily: FONTS.light, color: '#C9A86A', fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: 'rgba(201,168,106,0.4)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipTxt: { fontFamily: FONTS.body, color: '#C9A86A', fontSize: 12 },
  followRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,106,0.3)', paddingBottom: 4 },
  followInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 13.5, paddingVertical: 6 },
  followGo: { fontFamily: FONTS.semibold, color: '#C9A86A', fontSize: 13, paddingLeft: 8 },
  deskCard: { width: 230, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(201,168,106,0.3)', backgroundColor: 'rgba(201,168,106,0.06)', padding: 11 },
  deskCardTop: { color: '#C9A86A', fontSize: 9.5, letterSpacing: 1.1, textTransform: 'uppercase', fontFamily: FONTS.body },
  deskCardTitle: { color: C.cream, fontSize: 12.5, lineHeight: 17, marginTop: 4, fontFamily: FONTS.body },
  deskEmpty: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  factBox: { borderWidth: 1, borderColor: 'rgba(127,214,236,0.25)', borderRadius: 16, padding: 14, marginBottom: 20, backgroundColor: 'rgba(127,214,236,0.03)' },
  factLabel: { fontFamily: FONTS.light, color: GOLD, fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 },
  factHint: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  factInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  factInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 13.5, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: 'rgba(127,214,236,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 },
  factBtn: { borderWidth: 1.5, borderColor: GOLD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, justifyContent: 'center' },
  factBtnTxt: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 13 },
  verdict: { borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.02)' },
  verdictBadge: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 2 },
  verdictClaim: { fontFamily: FONTS.body, color: C.cream, fontSize: 13, lineHeight: 18, marginTop: 6, fontStyle: 'italic' },
  verdictReason: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.8)', fontSize: 13, lineHeight: 19, marginTop: 8 },
  verdictSrc: { fontFamily: FONTS.body, color: GOLD, fontSize: 11.5, opacity: 0.85 },
  histToggle: { fontFamily: FONTS.medium, color: GOLD, fontSize: 12, marginTop: 12, opacity: 0.85 },
});
