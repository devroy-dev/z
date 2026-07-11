// ════════════════════════════════════════════════════════════════════════
//  yourZ — SessionsPane · the SESSIONS section of the rooms tab (R4 · V2 §1+§4.4)
//  Lists YOUR sittings — title · format · who · status. NEVER content (the
//  wall). Pending invitations render as consent cards with the language
//  plain: a third presence holds the room, either of you ends it any time,
//  nothing said leaves the room. The begin flow: pick a format, name a
//  handle, send the invitation.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, RefreshControl } from 'react-native';
import { getSessions, getSessionFormats, createSession, acceptSession, declineSession } from './api';

const MOON = { hi: '#E9E8F0', dim: 'rgba(233,232,240,0.56)', faint: 'rgba(233,232,240,0.30)' };
const LILAC = 'rgba(196,164,232,0.85)';

export default function SessionsPane({ onOpen = () => {} }) {
  const [rows, setRows] = useState(null);
  const [formats, setFormats] = useState([]);
  const [beginning, setBeginning] = useState(false);
  const [fmt, setFmt] = useState(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, f] = await Promise.all([getSessions(), getSessionFormats()]);
    setRows(Array.isArray(r) ? r : []);
    setFormats(Array.isArray(f) ? f : []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const pull = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const begin = async () => {
    if (busy || !fmt) return;
    const h = handle.trim().replace(/^@/, '');
    if (!h) { setErr('their @handle — who is this sitting with?'); return; }
    setBusy(true); setErr('');
    const r = await createSession(fmt, h);
    setBusy(false);
    if (r && r.id) {
      setBeginning(false); setFmt(null); setHandle('');
      load();
    } else setErr((r && r.error) || 'could not open the sitting.');
  };

  const act = async (id, yes) => {
    if (busy) return;
    setBusy(true);
    const r = yes ? await acceptSession(id) : await declineSession(id);
    setBusy(false);
    if (r && r.error) { setErr(r.error); return; }
    await load();
    if (yes && r && r.ok) {
      const mine = (await getSessions()).find((x) => x.id === id);
      if (mine) onOpen({ kind: 'session', session: mine });
    }
  };

  if (rows === null) return <View style={st.center}><Text style={st.dim}>opening the sittings…</Text></View>;

  const invites = rows.filter((r) => r.status === 'invited' && r.yourRole === 'invited');
  const mine = rows.filter((r) => !(r.status === 'invited' && r.yourRole === 'invited'));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={MOON.dim} />}>
      <Text style={st.head}>sessions</Text>
      <Text style={st.sub}>a structured sitting for two — a third presence holds the room. nothing said leaves it.</Text>

      {beginning ? (
        <View style={st.card}>
          <Text style={st.cardTitle}>what kind of sitting?</Text>
          {formats.map((f) => (
            <Pressable key={f.id} style={[st.fmtRow, fmt === f.id && st.fmtOn]} onPress={() => setFmt(f.id)}>
              <Text style={[st.fmtTitle, fmt === f.id && { color: LILAC }]}>{f.title}</Text>
              <Text style={st.fmtLine}>{f.line}</Text>
            </Pressable>
          ))}
          <Text style={st.fieldLabel}>with</Text>
          <TextInput value={handle} onChangeText={setHandle} placeholder="their @handle" placeholderTextColor={MOON.faint}
            style={st.input} autoCapitalize="none" autoCorrect={false} />
          <Text style={st.consent}>they'll be asked to accept before the room opens. either of you can end it any time, in one tap.</Text>
          {err ? <Text style={st.err}>{err}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <Pressable onPress={() => { setBeginning(false); setErr(''); }}><Text style={st.cancel}>not now</Text></Pressable>
            <Pressable style={[st.go, (!fmt || busy) && { opacity: 0.5 }]} onPress={begin}><Text style={st.goTxt}>{busy ? '…' : 'send the invitation'}</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={st.beginRow} onPress={() => setBeginning(true)}>
          <Text style={st.beginPlus}>＋</Text>
          <Text style={st.beginTxt}>begin a sitting</Text>
        </Pressable>
      )}

      {invites.map((r) => (
        <View key={r.id} style={[st.card, { borderColor: 'rgba(196,164,232,0.4)' }]}>
          <Text style={st.cardTitle}>{r.otherName} asks you to sit down</Text>
          <Text style={st.fmtLine}>{r.title} — a moderated sitting. a third presence holds the room; both of you can end it any time; nothing said leaves the room.</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <Pressable onPress={() => act(r.id, false)}><Text style={st.cancel}>{busy ? '…' : 'decline'}</Text></Pressable>
            <Pressable style={st.go} onPress={() => act(r.id, true)}><Text style={st.goTxt}>{busy ? '…' : 'I accept — step in'}</Text></Pressable>
          </View>
        </View>
      ))}

      {mine.map((r) => (
        <Pressable key={r.id} style={st.row} onPress={() => onOpen({ kind: 'session', session: r })}>
          <View style={{ flex: 1 }}>
            <Text style={st.rowTitle}>{r.title}</Text>
            <Text style={st.rowSub}>with {r.otherName}</Text>
          </View>
          <Text style={[st.status, r.status === 'live' && { color: LILAC }]}>{r.status === 'invited' ? 'waiting' : r.status}</Text>
        </Pressable>
      ))}
      {!mine.length && !invites.length ? (
        <Text style={st.empty}>no sittings yet — some conversations need a held room.</Text>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: MOON.dim, fontFamily: 'Figtree_400Regular', fontSize: 13 },
  head: { color: MOON.hi, fontSize: 18, fontFamily: 'Figtree_600SemiBold', paddingHorizontal: 18 },
  sub: { color: MOON.faint, fontSize: 12, lineHeight: 17, paddingHorizontal: 18, marginTop: 4, marginBottom: 12, fontFamily: 'Figtree_400Regular' },
  beginRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(196,164,232,0.35)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  beginPlus: { color: LILAC, fontSize: 17 },
  beginTxt: { color: 'rgba(233,232,240,0.8)', fontSize: 13.5, fontFamily: 'Figtree_500Medium' },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(233,232,240,0.12)', backgroundColor: 'rgba(233,232,240,0.03)', padding: 14 },
  cardTitle: { color: MOON.hi, fontSize: 14, fontFamily: 'Figtree_600SemiBold', marginBottom: 8 },
  fmtRow: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(233,232,240,0.1)', padding: 11, marginBottom: 8 },
  fmtOn: { borderColor: 'rgba(196,164,232,0.55)', backgroundColor: 'rgba(124,92,220,0.08)' },
  fmtTitle: { color: 'rgba(233,232,240,0.85)', fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  fmtLine: { color: MOON.dim, fontSize: 12, lineHeight: 17, marginTop: 3, fontFamily: 'Figtree_400Regular' },
  fieldLabel: { color: MOON.dim, fontSize: 12, marginTop: 8, marginBottom: 6, fontFamily: 'Figtree_500Medium' },
  input: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(233,232,240,0.16)', backgroundColor: 'rgba(233,232,240,0.05)', color: MOON.hi, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Figtree_400Regular' },
  consent: { color: MOON.faint, fontSize: 11.5, lineHeight: 16, marginTop: 8, fontFamily: 'Figtree_400Regular' },
  err: { color: '#E58C8C', fontSize: 12.5, marginTop: 8, fontFamily: 'Figtree_400Regular' },
  cancel: { color: MOON.dim, fontSize: 13, fontFamily: 'Figtree_500Medium', paddingVertical: 9 },
  go: { borderRadius: 12, backgroundColor: 'rgba(124,92,220,0.16)', borderWidth: 1, borderColor: 'rgba(196,164,232,0.55)', paddingHorizontal: 14, paddingVertical: 9 },
  goTxt: { color: LILAC, fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(233,232,240,0.07)', paddingVertical: 13, gap: 10 },
  rowTitle: { color: 'rgba(233,232,240,0.88)', fontSize: 14, fontFamily: 'Figtree_500Medium' },
  rowSub: { color: MOON.faint, fontSize: 11.5, marginTop: 2, fontFamily: 'Figtree_400Regular' },
  status: { color: MOON.faint, fontSize: 11.5, fontFamily: 'Figtree_500Medium', textTransform: 'lowercase' },
  empty: { color: MOON.faint, fontSize: 12.5, textAlign: 'center', marginTop: 28, paddingHorizontal: 30, lineHeight: 18, fontFamily: 'Figtree_400Regular' },
});
