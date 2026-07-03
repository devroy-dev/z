// ════════════════════════════════════════════════════════════════════════
//  yourZ — FANTASY FOOTBALL. The house league on real EPL data: pick 5 +
//  a captain under 40.0, watch real gameweek points land, climb the friends
//  board. Server enforces every rule; this screen only renders and asks.
//  Between seasons the header says pre-season honestly — no fake fixtures.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import { NIGHT as C, FONTS } from './theme';
import { ffStatus, ffPlayers, ffSquad, ffSaveSquad, ffLive, ffLeaderboard } from './api';

const GREEN = '#8FD98F';
const DOWN = '#F0708C';
const POS_TONE = { GK: '#E0C088', DEF: '#8FB8E0', MID: '#8FD98F', FWD: '#F0708C' };

const untilStr = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'locked';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h to deadline`;
  if (h > 0) return `${h}h ${m}m to deadline`;
  return `${m}m to deadline`;
};

// ── player picker ──────────────────────────────────────────────────────────
function Picker({ picked, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [list, setList] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async (qq, pp) => {
    const r = await ffPlayers(qq, pp);
    if (alive.current && r?.players) setList(r.players);
  }, []);
  useEffect(() => { alive.current = true; load('', ''); return () => { alive.current = false; }; }, [load]);
  useEffect(() => { const t = setTimeout(() => load(q, pos), 300); return () => clearTimeout(t); }, [q, pos, load]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.pickWrap}>
        <View style={st.pickSheet}>
          <View style={st.sheetHandle} />
          <TextInput style={st.search} value={q} onChangeText={setQ}
            placeholder="search the pool" placeholderTextColor={C.faint} />
          <View style={st.posRow}>
            {['', 'GK', 'DEF', 'MID', 'FWD'].map((p) => (
              <Pressable key={p || 'all'} onPress={() => setPos(p)}
                style={[st.posChip, pos === p && { borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.08)' }]}>
                <Text style={[st.posChipTxt, pos === p && { color: GREEN }]}>{p || 'all'}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
            {!list ? <ActivityIndicator color={GREEN} style={{ marginTop: 30 }} /> :
              list.map((p) => {
                const isPicked = picked.some((x) => x.id === p.id);
                return (
                  <Pressable key={p.id} style={[st.pRow, isPicked && { opacity: 0.35 }]}
                    onPress={() => { if (!isPicked) { onPick(p); onClose(); } }}>
                    <Text style={[st.pPos, { color: POS_TONE[p.pos] || C.faint }]}>{p.pos}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pName}>{p.name}</Text>
                      <Text style={st.pTeam}>{p.team}{p.news ? ` · ${p.news}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={st.pCost}>{Number(p.cost).toFixed(1)}</Text>
                      <Text style={st.pPts}>{p.total_points} pts</Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
          <Pressable style={st.pickClose} onPress={onClose}><Text style={st.pickCloseTxt}>close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── the league ────────────────────────────────────────────────────────────
export default function FantasyLeague({ onExit = () => {} }) {
  const [tab, setTab] = useState('squad'); // squad | points | board
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState([]);        // [{id,name,team,pos,cost}]
  const [captain, setCaptain] = useState(null);
  const [savedInfo, setSavedInfo] = useState(null); // { gw, rolled_forward }
  const [dirty, setDirty] = useState(false);
  const [live, setLive] = useState(null);
  const [board, setBoard] = useState(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      const [s, sq] = await Promise.all([ffStatus(), ffSquad()]);
      if (!alive.current) return;
      if (s) setStatus(s);
      if (sq?.squad) {
        setDraft(sq.squad.players.map((p) => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, cost: p.cost })));
        setCaptain(sq.squad.captain);
        setSavedInfo({ gw: sq.saved_for_gw, rolled_forward: sq.rolled_forward });
      }
    })();
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (tab === 'points') ffLive().then((l) => { if (alive.current && l) setLive(l); });
    if (tab === 'board') ffLeaderboard().then((b) => { if (alive.current && b?.board) setBoard(b.board); });
  }, [tab]);

  const budget = status?.rules?.budget ?? 40;
  const size = status?.rules?.size ?? 5;
  const cost = draft.reduce((s, p) => s + Number(p.cost || 0), 0);
  const over = cost > budget + 1e-9;

  const drop = (id) => {
    setDraft((d) => d.filter((p) => p.id !== id));
    if (captain === id) setCaptain(null);
    setDirty(true); setMsg('');
  };

  const save = async () => {
    setMsg('');
    if (draft.length !== size) { setMsg(`pick exactly ${size} players`); return; }
    if (!captain) { setMsg('tap ©ap on one of them'); return; }
    setBusy(true);
    try {
      const r = await ffSaveSquad(draft.map((p) => p.id), captain);
      setSavedInfo({ gw: r.gw, rolled_forward: false });
      setDirty(false);
      setMsg(`saved for gameweek ${r.gw} · ${Number(r.cost).toFixed(1)} of ${budget.toFixed(1)}`);
    } catch (e) {
      setMsg(String(e?.message || e).slice(0, 140));
    }
    setBusy(false);
  };

  const deadlineLine = status?.next_deadline ? untilStr(status.next_deadline) : null;

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0B140D', '#0A0F0B', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.header}>
          <Pressable onPress={onExit} hitSlop={12}><Text style={st.back}>‹ the sims</Text></Pressable>
          <Text style={st.title}>fantasy football</Text>
          {!status ? null : status.season_live ? (
            <Text style={st.sub}>gameweek {status.current_gw} live{deadlineLine ? ` · next: ${deadlineLine}` : ''}</Text>
          ) : status.next_deadline ? (
            <Text style={st.sub}>gameweek {status.next_gw} — {deadlineLine}</Text>
          ) : (
            <Text style={st.sub}>pre-season. the new season hasn't opened yet — build your squad and be ready.</Text>
          )}
          <Text style={st.disclaimer}>house league · real EPL points · zero real value</Text>
        </View>

        <View style={st.tabs}>
          {[['squad', 'your five'], ['points', 'points'], ['board', 'the board']].map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
              <Text style={[st.tabTxt, tab === k && { color: C.cream }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {tab === 'squad' && (
            <>
              <View style={st.budgetRow}>
                <Text style={st.budgetLbl}>budget</Text>
                <Text style={[st.budgetVal, over && { color: DOWN }]}>{cost.toFixed(1)} <Text style={st.budgetOf}>/ {budget.toFixed(1)}</Text></Text>
              </View>
              <View style={st.budgetBar}>
                <View style={[st.budgetFill, { width: `${Math.min(100, (cost / budget) * 100)}%`, backgroundColor: over ? DOWN : GREEN }]} />
              </View>
              {savedInfo?.rolled_forward && !dirty ? (
                <Text style={st.rolled}>this squad rolled forward from gameweek {savedInfo.gw} — it still counts. touch it to update.</Text>
              ) : null}

              {draft.map((p) => (
                <View key={p.id} style={st.sqRow}>
                  <Text style={[st.pPos, { color: POS_TONE[p.pos] || C.faint }]}>{p.pos}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.pName}>{p.name}</Text>
                    <Text style={st.pTeam}>{p.team} · {Number(p.cost).toFixed(1)}</Text>
                  </View>
                  <Pressable onPress={() => { setCaptain(p.id); setDirty(true); setMsg(''); }} hitSlop={8}
                    style={[st.capBtn, captain === p.id && { borderColor: GREEN, backgroundColor: 'rgba(143,217,143,0.1)' }]}>
                    <Text style={[st.capTxt, captain === p.id && { color: GREEN }]}>©</Text>
                  </Pressable>
                  <Pressable onPress={() => drop(p.id)} hitSlop={8}><Text style={st.drop}>✕</Text></Pressable>
                </View>
              ))}
              {draft.length < size ? (
                <Pressable style={st.addBtn} onPress={() => setPicking(true)}>
                  <Text style={st.addTxt}>+ add a player ({draft.length}/{size})</Text>
                </Pressable>
              ) : null}

              {msg ? <Text style={[st.msg, /saved/.test(msg) ? { color: GREEN } : { color: DOWN }]}>{msg}</Text> : null}
              <Pressable disabled={busy} onPress={save}
                style={[st.saveBtn, { opacity: busy ? 0.5 : 1 }]}>
                {busy ? <ActivityIndicator color={C.cream} /> : <Text style={st.saveTxt}>save squad</Text>}
              </Pressable>
            </>
          )}

          {tab === 'points' && (!live ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : (
            live.gw == null ? <Text style={st.empty}>no gameweek running yet. points land here once the season kicks off.</Text> :
            !live.players.length ? <Text style={st.empty}>no squad counted for gameweek {live.gw} — set your five before the deadline.</Text> : (
              <>
                <View style={st.liveTop}>
                  <Text style={st.liveGw}>gameweek {live.gw}{live.finished ? ' · final' : ' · live'}</Text>
                  <Text style={st.livePts}>{live.points}</Text>
                </View>
                {live.players.map((p) => (
                  <View key={p.id} style={st.sqRow}>
                    <Text style={[st.pPos, { color: POS_TONE[p.pos] || C.faint }]}>{p.pos}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pName}>{p.name}{p.captain ? <Text style={{ color: GREEN }}>  ©</Text> : null}</Text>
                      <Text style={st.pTeam}>{p.team}</Text>
                    </View>
                    <Text style={st.pCounted}>{p.counted}</Text>
                  </View>
                ))}
              </>
            )
          ))}

          {tab === 'board' && (!board ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : (
            <>
              {board.map((r) => (
                <View key={r.user_id} style={[st.sqRow, r.you && { borderColor: 'rgba(143,217,143,0.35)' }]}>
                  <Text style={st.rank}>{r.rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.pName}>{r.you ? 'you' : (r.display_name || (r.handle ? '@' + r.handle : 'a manager'))}</Text>
                    {r.last_gw ? <Text style={st.pTeam}>gw{r.last_gw}: {r.last_points} pts</Text> : null}
                  </View>
                  <Text style={st.pCounted}>{r.total}</Text>
                </View>
              ))}
              {board.length <= 1 ? <Text style={st.empty}>just you in the league. add friends from the You tab and make it hurt.</Text> : null}
            </>
          ))}
        </ScrollView>
      </SafeAreaView>

      {picking ? (
        <Picker picked={draft}
          onPick={(p) => { setDraft((d) => [...d, { id: p.id, name: p.name, team: p.team, pos: p.pos, cost: p.cost }]); setDirty(true); }}
          onClose={() => setPicking(false)} />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginBottom: 8 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 27 },
  sub: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 19 },
  disclaimer: { fontFamily: FONTS.body, color: C.faint, fontSize: 10.5, letterSpacing: 0.4, marginTop: 6 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,240,228,0.08)' },
  tabOn: { borderColor: 'rgba(143,217,143,0.4)', backgroundColor: 'rgba(143,217,143,0.07)' },
  tabTxt: { fontFamily: FONTS.medium, color: C.faint, fontSize: 13 },

  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  budgetLbl: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  budgetVal: { fontFamily: FONTS.display, color: C.cream, fontSize: 18 },
  budgetOf: { fontFamily: FONTS.light, color: C.faint, fontSize: 13 },
  budgetBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,228,0.07)', marginBottom: 14, overflow: 'hidden' },
  budgetFill: { height: 4, borderRadius: 2 },
  rolled: { fontFamily: FONTS.light, color: '#E0C088', fontSize: 12, lineHeight: 17, marginBottom: 10 },

  sqRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', padding: 14, marginBottom: 9, gap: 12 },
  pPos: { fontFamily: FONTS.semibold, fontSize: 11, width: 32, letterSpacing: 1 },
  pName: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14.5 },
  pTeam: { fontFamily: FONTS.light, color: C.faint, fontSize: 12, marginTop: 2 },
  pCost: { fontFamily: FONTS.display, color: C.cream, fontSize: 15 },
  pPts: { fontFamily: FONTS.light, color: C.faint, fontSize: 11.5, marginTop: 2 },
  pCounted: { fontFamily: FONTS.display, color: C.cream, fontSize: 17 },
  capBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,240,228,0.12)', alignItems: 'center', justifyContent: 'center' },
  capTxt: { fontFamily: FONTS.semibold, color: C.faint, fontSize: 13 },
  drop: { fontFamily: FONTS.body, color: C.faint, fontSize: 14, paddingHorizontal: 4 },

  addBtn: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(143,217,143,0.35)', padding: 16, alignItems: 'center', marginBottom: 10 },
  addTxt: { fontFamily: FONTS.medium, color: GREEN, fontSize: 13.5 },
  msg: { fontFamily: FONTS.body, fontSize: 12.5, marginTop: 4, marginBottom: 4 },
  saveBtn: { borderRadius: 16, borderWidth: 1, borderColor: GREEN, backgroundColor: 'rgba(143,217,143,0.12)', paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveTxt: { fontFamily: FONTS.semibold, color: GREEN, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5 },

  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  liveGw: { fontFamily: FONTS.body, color: C.muted, fontSize: 13 },
  livePts: { fontFamily: FONTS.display, color: GREEN, fontSize: 30 },
  rank: { fontFamily: FONTS.display, color: C.faint, fontSize: 17, width: 26 },
  empty: { fontFamily: FONTS.light, color: C.faint, fontSize: 13, lineHeight: 19, marginTop: 20, textAlign: 'center', paddingHorizontal: 20 },

  pickWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickSheet: { height: '82%', backgroundColor: '#0E1410', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: 'rgba(255,240,228,0.1)', padding: 18 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,228,0.15)', marginBottom: 12 },
  search: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, borderBottomWidth: 1, borderColor: 'rgba(255,240,228,0.12)', paddingVertical: 8 },
  posRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 10 },
  posChip: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,240,228,0.1)', paddingHorizontal: 13, paddingVertical: 6 },
  posChipTxt: { fontFamily: FONTS.medium, color: C.faint, fontSize: 12.5, textTransform: 'uppercase' },
  pRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 12, borderBottomWidth: 1, borderColor: 'rgba(255,240,228,0.05)' },
  pickClose: { alignItems: 'center', paddingVertical: 12 },
  pickCloseTxt: { fontFamily: FONTS.medium, color: C.muted, fontSize: 14 },
});
