// ════════════════════════════════════════════════════════════════════════
//  yourZ — FANTASY FOOTBALL, two leagues (EPL · UCL), full XI with real
//  formations: 1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD, max 3 per club, captain
//  doubled, per-league budget. Server enforces every rule; this screen
//  renders and asks. Between seasons the header stays honest.
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
const POS_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
const LEAGUE_LABEL = { epl: 'EPL', ucl: 'UCL' };

const untilStr = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'locked';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h to deadline`;
  if (h > 0) return `${h}h ${m}m to deadline`;
  return `${m}m to deadline`;
};

// ── player picker (per league, per position) ───────────────────────────────
function Picker({ league, startPos, picked, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(startPos || '');
  const [list, setList] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async (qq, pp) => {
    const r = await ffPlayers(league, qq, pp);
    if (alive.current && r?.players) setList(r.players);
  }, [league]);
  useEffect(() => { alive.current = true; load(q, pos); return () => { alive.current = false; }; }, []);
  useEffect(() => { const t = setTimeout(() => load(q, pos), 300); return () => clearTimeout(t); }, [q, pos, load]);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.pickWrap}>
        <View style={st.pickSheet}>
          <View style={st.sheetHandle} />
          <TextInput style={st.search} value={q} onChangeText={setQ}
            placeholder={`search the ${LEAGUE_LABEL[league]} pool`} placeholderTextColor={C.faint} />
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
                      <Text style={st.pTeam} numberOfLines={1}>{p.team}{p.news ? ` · ${p.news}` : ''}</Text>
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
  const [league, setLeague] = useState('epl');
  const [tab, setTab] = useState('squad'); // squad | points | board
  const [status, setStatus] = useState(null);
  const [draft, setDraft] = useState([]);        // [{id,name,team,pos,cost}]
  const [captain, setCaptain] = useState(null);
  const [savedInfo, setSavedInfo] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [live, setLive] = useState(null);
  const [board, setBoard] = useState(null);
  const [picking, setPicking] = useState(null);  // null | { pos } | { pos: '' }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const alive = useRef(true);

  const loadLeague = useCallback(async (lg) => {
    setStatus(null); setDraft([]); setCaptain(null); setSavedInfo(null); setDirty(false); setMsg('');
    setLive(null); setBoard(null);
    const [s, sq] = await Promise.all([ffStatus(lg), ffSquad(lg)]);
    if (!alive.current) return;
    if (s) setStatus(s);
    if (sq?.squad) {
      setDraft(sq.squad.players.map((p) => ({ id: p.id, name: p.name, team: p.team, pos: p.pos, cost: p.cost })));
      setCaptain(sq.squad.captain);
      setSavedInfo({ gw: sq.saved_for_gw, rolled_forward: sq.rolled_forward });
    }
  }, []);

  useEffect(() => { alive.current = true; loadLeague(league); return () => { alive.current = false; }; }, [league, loadLeague]);

  useEffect(() => {
    if (tab === 'points') ffLive(league).then((l) => { if (alive.current && l) setLive(l); });
    if (tab === 'board') ffLeaderboard(league).then((b) => { if (alive.current && b?.board) setBoard(b.board); });
  }, [tab, league]);

  const rules = status?.rules || { size: 11, budget: 83, formation: { GK: [1, 1], DEF: [3, 5], MID: [2, 5], FWD: [1, 3] } };
  const cost = draft.reduce((s, p) => s + Number(p.cost || 0), 0);
  const over = cost > rules.budget + 1e-9;
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  draft.forEach((p) => { counts[p.pos] = (counts[p.pos] || 0) + 1; });

  const drop = (id) => {
    setDraft((d) => d.filter((p) => p.id !== id));
    if (captain === id) setCaptain(null);
    setDirty(true); setMsg('');
  };

  const save = async () => {
    setMsg('');
    if (draft.length !== rules.size) { setMsg(`pick exactly ${rules.size} — you have ${draft.length}`); return; }
    if (!captain) { setMsg('tap © on one of your eleven'); return; }
    setBusy(true);
    try {
      const r = await ffSaveSquad(league, draft.map((p) => p.id), captain);
      setSavedInfo({ gw: r.gw, rolled_forward: false });
      setDirty(false);
      setMsg(`saved · ${r.formation} · ${Number(r.cost).toFixed(1)} of ${rules.budget.toFixed(1)} · round ${r.gw}`);
    } catch (e) {
      setMsg(String(e?.message || e).slice(0, 140));
    }
    setBusy(false);
  };

  const deadlineLine = status?.next_deadline ? untilStr(status.next_deadline) : null;
  const formationStr = `${counts.DEF}-${counts.MID}-${counts.FWD}`;
  const rangeStr = (pos) => {
    const [lo, hi] = rules.formation[pos] || [0, 0];
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0B140D', '#0A0F0B', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.header}>
          <Pressable onPress={onExit} hitSlop={12}><Text style={st.back}>‹ the sims</Text></Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={st.title}>fantasy football</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['epl', 'ucl'].map((lg) => (
                <Pressable key={lg} onPress={() => setLeague(lg)}
                  style={[st.lgChip, league === lg && st.lgChipOn]}>
                  <Text style={[st.lgTxt, league === lg && { color: C.cream }]}>{LEAGUE_LABEL[lg]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {!status ? <Text style={st.sub}> </Text> : status.season_live ? (
            <Text style={st.sub}>round {status.current_gw} live{deadlineLine ? ` · next: ${deadlineLine}` : ''}</Text>
          ) : status.next_deadline ? (
            <Text style={st.sub}>round {status.next_gw} — {deadlineLine}</Text>
          ) : (
            <Text style={st.sub}>pre-season. entries open when the {LEAGUE_LABEL[league]} calendar does — build your XI and be ready.</Text>
          )}
          <Text style={st.disclaimer}>house league · real points · zero real value</Text>
        </View>

        <View style={st.tabs}>
          {[['squad', 'your XI'], ['points', 'points'], ['board', 'the board']].map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
              <Text style={[st.tabTxt, tab === k && { color: C.cream }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {tab === 'squad' && (
            <>
              <View style={st.budgetRow}>
                <Text style={st.budgetLbl}>{draft.length}/{rules.size} · {formationStr}</Text>
                <Text style={[st.budgetVal, over && { color: DOWN }]}>{cost.toFixed(1)} <Text style={st.budgetOf}>/ {rules.budget.toFixed(1)}</Text></Text>
              </View>
              <View style={st.budgetBar}>
                <View style={[st.budgetFill, { width: `${Math.min(100, (cost / rules.budget) * 100)}%`, backgroundColor: over ? DOWN : GREEN }]} />
              </View>
              {savedInfo?.rolled_forward && !dirty ? (
                <Text style={st.rolled}>this XI rolled forward from round {savedInfo.gw} — it still counts. touch it to update.</Text>
              ) : null}

              {POS_ORDER.map((pos) => {
                const [lo, hi] = rules.formation[pos] || [0, 0];
                const have = counts[pos];
                const canAdd = have < hi && draft.length < rules.size;
                return (
                  <View key={pos} style={{ marginBottom: 8 }}>
                    <View style={st.secRow}>
                      <Text style={[st.secTitle, { color: POS_TONE[pos] }]}>{pos}</Text>
                      <Text style={[st.secCount, have < lo && { color: DOWN }]}>{have} of {rangeStr(pos)}</Text>
                    </View>
                    {draft.filter((p) => p.pos === pos).map((p) => (
                      <View key={p.id} style={st.sqRow}>
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
                    {canAdd ? (
                      <Pressable style={st.addBtn} onPress={() => setPicking({ pos })}>
                        <Text style={st.addTxt}>+ {pos.toLowerCase()}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}

              {msg ? <Text style={[st.msg, /^saved/.test(msg) ? { color: GREEN } : { color: DOWN }]}>{msg}</Text> : null}
              <Pressable disabled={busy} onPress={save}
                style={[st.saveBtn, { opacity: busy ? 0.5 : 1 }]}>
                {busy ? <ActivityIndicator color={C.cream} /> : <Text style={st.saveTxt}>save XI</Text>}
              </Pressable>
            </>
          )}

          {tab === 'points' && (!live ? <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} /> : (
            live.gw == null ? <Text style={st.empty}>no round running yet. points land here once the season kicks off.</Text> :
            !live.players.length ? <Text style={st.empty}>{live.note || `no XI counted for round ${live.gw} — set yours before the deadline.`}</Text> : (
              <>
                <View style={st.liveTop}>
                  <Text style={st.liveGw}>round {live.gw}{live.finished ? ' · final' : ' · live'}</Text>
                  <Text style={st.livePts}>{live.points}</Text>
                </View>
                {POS_ORDER.map((pos) => live.players.filter((p) => p.pos === pos).map((p) => (
                  <View key={p.id} style={st.sqRow}>
                    <Text style={[st.pPos, { color: POS_TONE[p.pos] || C.faint }]}>{p.pos}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.pName}>{p.name}{p.captain ? <Text style={{ color: GREEN }}>  ©</Text> : null}</Text>
                      <Text style={st.pTeam}>{p.team}</Text>
                    </View>
                    <Text style={st.pCounted}>{p.counted}</Text>
                  </View>
                )))}
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
                    {r.last_gw ? <Text style={st.pTeam}>round {r.last_gw}: {r.last_points} pts</Text> : null}
                  </View>
                  <Text style={st.pCounted}>{r.total}</Text>
                </View>
              ))}
              {board.length <= 1 ? <Text style={st.empty}>just you in the {LEAGUE_LABEL[league]} league. add friends from the You tab and make it hurt.</Text> : null}
            </>
          ))}
        </ScrollView>
      </SafeAreaView>

      {picking ? (
        <Picker league={league} startPos={picking.pos} picked={draft}
          onPick={(p) => { setDraft((d) => [...d, { id: p.id, name: p.name, team: p.team, pos: p.pos, cost: p.cost }]); setDirty(true); }}
          onClose={() => setPicking(null)} />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginBottom: 8 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 26 },
  sub: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 19 },
  disclaimer: { fontFamily: FONTS.body, color: C.faint, fontSize: 10.5, letterSpacing: 0.4, marginTop: 6 },
  lgChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,240,228,0.1)' },
  lgChipOn: { borderColor: 'rgba(143,217,143,0.45)', backgroundColor: 'rgba(143,217,143,0.08)' },
  lgTxt: { fontFamily: FONTS.semibold, color: C.faint, fontSize: 12, letterSpacing: 1 },

  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 10 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,240,228,0.08)' },
  tabOn: { borderColor: 'rgba(143,217,143,0.4)', backgroundColor: 'rgba(143,217,143,0.07)' },
  tabTxt: { fontFamily: FONTS.medium, color: C.faint, fontSize: 13 },

  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  budgetLbl: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13, letterSpacing: 0.5 },
  budgetVal: { fontFamily: FONTS.display, color: C.cream, fontSize: 18 },
  budgetOf: { fontFamily: FONTS.light, color: C.faint, fontSize: 13 },
  budgetBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,240,228,0.07)', marginBottom: 12, overflow: 'hidden' },
  budgetFill: { height: 4, borderRadius: 2 },
  rolled: { fontFamily: FONTS.light, color: '#E0C088', fontSize: 12, lineHeight: 17, marginBottom: 10 },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, marginTop: 4 },
  secTitle: { fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 1.5 },
  secCount: { fontFamily: FONTS.light, color: C.faint, fontSize: 11.5 },

  sqRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', paddingVertical: 10, paddingHorizontal: 13, marginBottom: 7, gap: 12 },
  pPos: { fontFamily: FONTS.semibold, fontSize: 11, width: 32, letterSpacing: 1 },
  pName: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14 },
  pTeam: { fontFamily: FONTS.light, color: C.faint, fontSize: 11.5, marginTop: 2 },
  pCost: { fontFamily: FONTS.display, color: C.cream, fontSize: 15 },
  pPts: { fontFamily: FONTS.light, color: C.faint, fontSize: 11.5, marginTop: 2 },
  pCounted: { fontFamily: FONTS.display, color: C.cream, fontSize: 16 },
  capBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,240,228,0.12)', alignItems: 'center', justifyContent: 'center' },
  capTxt: { fontFamily: FONTS.semibold, color: C.faint, fontSize: 12 },
  drop: { fontFamily: FONTS.body, color: C.faint, fontSize: 14, paddingHorizontal: 4 },

  addBtn: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(143,217,143,0.3)', paddingVertical: 9, alignItems: 'center', marginBottom: 4 },
  addTxt: { fontFamily: FONTS.medium, color: GREEN, fontSize: 12.5 },
  msg: { fontFamily: FONTS.body, fontSize: 12.5, marginTop: 8 },
  saveBtn: { borderRadius: 16, borderWidth: 1, borderColor: GREEN, backgroundColor: 'rgba(143,217,143,0.12)', paddingVertical: 14, alignItems: 'center', marginTop: 10 },
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
