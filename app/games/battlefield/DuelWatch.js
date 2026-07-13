// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE BATTLEFIELD, WATCHED. The spectator's view of a live duel.
//  Subscribes to the debater's live keystroke stream (the "watch them write it"
//  drama) AND polls the committed transcript + verdict. Works on a human-vs-AI
//  practice duel: you watch the human compose in real time, the house's turns
//  arrive as delivered speeches, the adjudicator's running notes appear, and the
//  final Matter/Manner verdict lands. Spectators can VOTE (people's choice).
//
//  Register: crimson — the arena, watched from the stands.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../../theme';
import { watchBattlefieldDuel, castBattlefieldVote, getMe } from '../../api';
import { openGreenRoom, sendGreenRoom, closeGreenRoom } from '../../realtime';
import { loadFormats, formatFor, seatSide, speakerTag, roleRail } from './formats';
import { subscribeDuelKeys, unsubscribeDuel } from '../../realtime';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

function Swords({ size = 18, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PhaseRail({ current, rail }) {
  const PHASES = rail && rail.length ? rail : ['Opening', 'Rebuttal', 'Closing'];
  const idx = PHASES.indexOf(current);
  return (
    <View style={st.rail}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p}>
          <View style={st.railItem}>
            <View style={[st.railDot, i <= idx && st.railDotOn, i === idx && st.railDotNow]} />
            <Text style={[st.railTxt, i === idx && st.railTxtNow]}>{p}</Text>
          </View>
          {i < PHASES.length - 1 ? <View style={[st.railLine, i < idx && st.railLineOn]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

// the spectator's clock — same truth as the debaters': slotStartedAt + slotSeconds
// from the watch payload; the client renders, the server owns the bell.
function SpectatorClock({ startedAt, seconds }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!startedAt || !seconds) return null;
  const left = Math.max(0, Math.round(seconds - (now - Date.parse(startedAt)) / 1000));
  const mm = Math.floor(left / 60); const ss = String(left % 60).padStart(2, '0');
  const urgent = left <= 15 && left > 0;
  return (
    <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, letterSpacing: 1, color: left === 0 ? 'rgba(245,236,225,0.4)' : urgent ? CRIMSON : 'rgba(245,236,225,0.7)', fontVariant: ['tabular-nums'] }}>
      {left === 0 ? 'the bell' : mm + ':' + ss}
    </Text>
  );
}

function TurnBubble({ turn, debaters }) {
  const d = (debaters || []).find((x) => x.seat === turn.seat);
  const side = d ? d.side : (turn.seat === 0 ? 'PRO' : 'CON');
  const tag = d?.tag || side;
  const who = d?.name || (turn.seat === 0 ? 'the challenger' : 'the house');
  const isPro = side === 'PRO';
  // a LAPSED slot is the on-record time note — a rule line, never a speech bubble
  if (turn.lapsed) {
    return (
      <View style={st.lapsedRow}>
        <View style={st.lapsedLine} />
        <Text style={st.lapsedTxt}>time — {tag}'s {turn.role} lapsed unspoken</Text>
        <View style={st.lapsedLine} />
      </View>
    );
  }
  return (
    <View style={[st.bubbleWrap, isPro ? st.bubbleLeft : st.bubbleRight]}>
      <View style={st.bubbleHead}>
        <View style={[st.sideTag, { borderColor: isPro ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
          <Text style={[st.sideTagTxt, { color: isPro ? BLUE : CRIMSON }]}>{tag}</Text>
        </View>
        <Text style={st.bubbleWho}>{who} · {turn.role}</Text>
      </View>
      <View style={[st.bubble, { borderColor: isPro ? 'rgba(120,200,255,0.18)' : 'rgba(224,87,111,0.2)' }]}>
        <Text style={st.bubbleTxt}>{turn.text}</Text>
      </View>
    </View>
  );
}

export default function BattlefieldDuelWatch({ sessionId, onBack = () => {} }) {
  const [duel, setDuel] = useState(null);
  const [liveKeys, setLiveKeys] = useState(null);   // { seat, phase, text, done } — the debater composing now
  const [vote, setVote] = useState(null);
  const [voteErr, setVoteErr] = useState('');
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  // [watch polish] the format module drives the surface (rail, tags, teams)
  const [fmtReady, setFmtReady] = useState(false);
  useEffect(() => { let on = true; loadFormats().then(() => { if (on) setFmtReady(true); }); return () => { on = false; }; }, []);
  // THE GREEN ROOM — ephemeral, per-session, registered users react live
  const [green, setGreen] = useState([]);          // last 60 messages
  const [greenDraft, setGreenDraft] = useState('');
  const [greenOpen, setGreenOpen] = useState(false);
  const meRef = useRef(null);
  useEffect(() => { getMe().then((m) => { meRef.current = m; }).catch(() => {}); }, []);
  useEffect(() => {
    let un = () => {};
    (async () => { un = await openGreenRoom(sessionId, (m) => setGreen((cur) => [...cur.slice(-59), m])); })();
    return () => { try { un(); } catch (e) {} closeGreenRoom(); };
  }, [sessionId]);
  const sayGreen = () => {
    const text = greenDraft.trim().slice(0, 240);
    if (!text) return;
    const name = meRef.current?.display_name || meRef.current?.displayName || 'a spectator';
    sendGreenRoom(sessionId, { name, text, ts: Date.now() });
    setGreenDraft('');
  };

  // poll the committed transcript + verdict
  useEffect(() => {
    let on = true;
    const pull = async () => {
      try { const d = await watchBattlefieldDuel(sessionId); if (on && d) setDuel(d); } catch (e) {}
    };
    pull();
    pollRef.current = setInterval(pull, 1500);
    return () => { on = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId]);

  // subscribe to the live keystroke stream once we know the thread
  useEffect(() => {
    if (!duel?.threadId) return;
    let unsub = () => {};
    (async () => {
      unsub = await subscribeDuelKeys(duel.threadId, (k) => {
        // a 'done' frame clears the live-typing surface (the turn was committed)
        setLiveKeys(k?.done ? null : k);
      });
    })();
    return () => { try { unsub(); } catch (e) {} unsubscribeDuel(); };
  }, [duel?.threadId]);

  useEffect(() => { scrollRef.current?.scrollToEnd?.({ animated: true }); }, [duel?.turns?.length, liveKeys?.text, duel?.phase]);

  // [watch polish — DEFECT FIX] the vote now CASTS: the old surface set local state
  // and never called the server, so the crowd tally never moved. One verified
  // viewer, one vote, changeable until the gavel; the tally lands from the response.
  const castVote = async (side) => {
    setVote(side); setVoteErr('');
    try {
      const r = await castBattlefieldVote(sessionId, side);
      if (r?.tally) setDuel((cur) => cur ? { ...cur, tally: r.tally } : cur);
    } catch (e) {
      setVoteErr(String(e?.message || 'the vote did not land'));
      setVote(null);
    }
  };

  const phase = duel?.phase || 'Opening';
  const isVerdict = phase === 'verdict';
  const turns = duel?.turns || [];
  const notes = duel?.notes || [];
  const v = duel?.verdict;
  const fmt = fmtReady ? formatFor(duel?.formatKey) : null;
  const rail = fmt ? roleRail(fmt) : null;
  const tally = duel?.tally;

  // the live typing bubble — only show while a debater is mid-composition and the
  // text isn't already committed as a turn
  const showLive = liveKeys && liveKeys.text && !isVerdict;

  return (
    <View style={st.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={st.liveTag}>
            <View style={st.liveDot} />
            <Text style={st.liveTxt}>{isVerdict ? 'ENDED' : 'LIVE'} · WATCHING</Text>
          </View>
          <View style={{ width: 20 }} />
        </View>

        <View style={st.motionBar}>
          <Swords size={16} />
          <Text style={st.motionBarTxt}>{duel?.motion ? `"${duel.motion}"` : 'finding the duel…'}</Text>
        </View>

        <PhaseRail current={isVerdict ? (rail ? rail[rail.length - 1] : 'Closing') : phase} rail={rail} />
        {duel?.timed && !isVerdict ? (
          <View style={{ alignItems: 'center', marginTop: 2 }}>
            <SpectatorClock startedAt={duel.slotStartedAt} seconds={duel.slotSeconds} />
          </View>
        ) : null}

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
          {turns.map((t, i) => <TurnBubble key={i} turn={t} debaters={duel?.debaters} />)}

          {/* the live-typing surface — the human composing, streamed keystroke-by-keystroke */}
          {showLive ? (
            <View style={[st.bubbleWrap, liveKeys.seat === 0 ? st.bubbleLeft : st.bubbleRight]}>
              <View style={st.bubbleHead}>
                <View style={[st.sideTag, { borderColor: liveKeys.seat === 0 ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
                  <Text style={[st.sideTagTxt, { color: liveKeys.seat === 0 ? BLUE : CRIMSON }]}>{(duel?.debaters || []).find((x) => x.seat === liveKeys.seat)?.tag || (liveKeys.seat === 0 ? 'PRO' : 'CON')}</Text>
                </View>
                <Text style={st.bubbleWho}>composing live · {liveKeys.phase}</Text>
              </View>
              <View style={[st.bubble, st.bubbleLive, { borderColor: liveKeys.seat === 0 ? 'rgba(120,200,255,0.35)' : 'rgba(224,87,111,0.35)' }]}>
                <Text style={st.bubbleTxt}>{liveKeys.text}<Text style={st.caret}>▊</Text></Text>
              </View>
            </View>
          ) : null}

          {notes.map((n, i) => (
            <View key={`note-${i}`} style={st.noteCard}>
              <Text style={st.noteLabel}>THE ADJUDICATOR · after {n.phase}</Text>
              <Text style={st.noteTxt}>{n.note}</Text>
            </View>
          ))}

          {/* verdict */}
          {isVerdict && v ? (
            <View style={st.verdictWrap}>
              <Text style={st.vKicker}>THE ADJUDICATOR RULES</Text>
              <Text style={st.vWinner}><Text style={{ color: duel.winner === 'PRO' ? BLUE : CRIMSON }}>{duel.winner}</Text> takes the floor</Text>
              {!!v.adjVerdict && <Text style={st.vLine}>{v.adjVerdict}</Text>}
              <Text style={st.vSummary}>{v.summary}</Text>
              {!!v.matter && (<View style={st.vMetric}><Text style={st.vMetricLabel}>MATTER</Text><Text style={st.vMetricBody}>{v.matter}</Text></View>)}
              {!!v.manner && (<View style={st.vMetric}><Text style={st.vMetricLabel}>MANNER</Text><Text style={st.vMetricBody}>{v.manner}</Text></View>)}
              {Array.isArray(v.speakers) && v.speakers.length ? (
                <View style={st.tabCard}>
                  <Text style={st.vMetricLabel}>THE TAB — SPEAKER SCORES</Text>
                  {v.speakers.map((sp) => (
                    <View key={sp.seat} style={st.tabRow}>
                      <Text style={[st.tabTag, { color: String(sp.role || '').startsWith('PRO') ? BLUE : CRIMSON }]}>{sp.role}{v.bestSpeaker === sp.seat ? ' ★' : ''}</Text>
                      <Text style={st.tabScore}>{sp.score}</Text>
                      <Text style={st.tabLine} numberOfLines={3}>{sp.line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {!!v.closing && (<View style={st.closingCard}><Text style={st.closingTxt}>{v.closing}</Text></View>)}
              {tally && tally.total > 0 ? (
                <View style={st.crowdCard}>
                  <Text style={st.crowdLabel}>THE ROOM VOTED</Text>
                  <Text style={st.crowdVote}><Text style={{ color: BLUE }}>{tally.pro} PRO</Text> · <Text style={{ color: CRIMSON }}>{tally.con} CON</Text>{duel.winner ? ((tally.pro > tally.con ? 'PRO' : tally.con > tally.pro ? 'CON' : null) === duel.winner ? ' — the room and the bench agree.' : (tally.pro !== tally.con ? ' — the room saw it differently. That gap is the whole point.' : '')) : ''}</Text>
                </View>
              ) : null}
              {vote ? (
                <View style={st.crowdCard}>
                  <Text style={st.crowdLabel}>YOUR VOTE</Text>
                  <Text style={st.crowdVote}>You called it for <Text style={{ color: vote === 'PRO' ? BLUE : CRIMSON }}>{vote}</Text>.
                    {vote === duel.winner ? ' You and the adjudicator agree.' : ' The adjudicator saw it differently — that gap is the debate.'}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* THE GREEN ROOM — the crowd reacting live (ephemeral; the transcript is the record) */}
        {!isVerdict ? (
          <View style={st.greenDock}>
            <Pressable style={st.greenHead} onPress={() => setGreenOpen((o) => !o)}>
              <Text style={st.greenLabel}>THE GREEN ROOM{green.length ? ` · ${green.length}` : ''}</Text>
              <Text style={st.greenChev}>{greenOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {greenOpen ? (
              <>
                <ScrollView style={st.greenScroll} contentContainerStyle={{ paddingVertical: 4 }}>
                  {green.length === 0 ? <Text style={st.greenEmpty}>the room is quiet — say something</Text> : null}
                  {green.map((m, i) => (
                    <Text key={i} style={st.greenMsg}><Text style={st.greenName}>{m.name}</Text>  {m.text}</Text>
                  ))}
                </ScrollView>
                <View style={st.greenRow}>
                  <TextInput style={st.greenInput} value={greenDraft} onChangeText={setGreenDraft} placeholder="react…" placeholderTextColor="rgba(245,236,225,0.3)" maxLength={240} onSubmitEditing={sayGreen} returnKeyType="send" />
                  <Pressable style={st.greenSend} onPress={sayGreen}><Text style={st.greenSendTxt}>say</Text></Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* the vote dock — spectators vote (people's choice); the split shows LIVE */}
        {!isVerdict ? (
          <View style={st.voteDock}>
            <Text style={st.voteLabel}>{voteErr ? voteErr : vote ? 'your vote is in — change it any time' : 'who is winning? cast your vote'}{tally && tally.total > 0 ? `   ·   the room: ${tally.pro}–${tally.con}` : ''}</Text>
            <View style={st.voteRow}>
              <Pressable style={[st.voteBtn, vote === 'PRO' && st.voteBtnProOn]} onPress={() => castVote('PRO')}>
                <Text style={[st.voteBtnTxt, vote === 'PRO' && { color: INK }]} numberOfLines={1}>PRO · {(duel?.debaters || []).filter((d) => d.side === 'PRO').map((d) => d.name).join(' · ') || 'PRO'}</Text>
              </Pressable>
              <Pressable style={[st.voteBtn, vote === 'CON' && st.voteBtnConOn]} onPress={() => castVote('CON')}>
                <Text style={[st.voteBtnTxt, vote === 'CON' && { color: INK }]} numberOfLines={1}>CON · {(duel?.debaters || []).filter((d) => d.side === 'CON').map((d) => d.name).join(' · ') || 'CON'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  // ── [watch polish] lapse · clock · tab · green room ──
  lapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10, paddingHorizontal: 4 },
  lapsedLine: { flex: 1, height: 1, backgroundColor: 'rgba(245,236,225,0.12)' },
  lapsedTxt: { color: 'rgba(245,236,225,0.45)', fontSize: 12, fontFamily: FONTS.displayItalic },
  vLine: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.85)', fontSize: 14.5, lineHeight: 21, marginBottom: 12, textAlign: 'center' },
  tabCard: { marginTop: 18, borderWidth: 1, borderColor: 'rgba(245,236,225,0.12)', borderRadius: 12, padding: 13, alignSelf: 'stretch' },
  tabRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 9 },
  tabTag: { fontSize: 12, letterSpacing: 1, fontFamily: FONTS.semibold, width: 86 },
  tabScore: { color: '#C9A86A', fontSize: 15, fontFamily: FONTS.display, width: 28, textAlign: 'right' },
  tabLine: { flex: 1, color: 'rgba(245,236,225,0.6)', fontSize: 11.5, lineHeight: 16, fontFamily: FONTS.body },
  closingCard: { marginTop: 16, borderWidth: 1, borderColor: 'rgba(201,168,106,0.3)', borderRadius: 12, padding: 14, backgroundColor: 'rgba(201,168,106,0.04)', alignSelf: 'stretch' },
  closingTxt: { color: '#C9A86A', fontSize: 14, lineHeight: 20, fontFamily: FONTS.displayItalic },
  greenDock: { borderTopWidth: 1, borderTopColor: 'rgba(245,236,225,0.1)', backgroundColor: 'rgba(12,6,9,0.7)', paddingHorizontal: 16 },
  greenHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
  greenLabel: { color: 'rgba(245,236,225,0.5)', fontSize: 10.5, letterSpacing: 2, fontFamily: FONTS.semibold },
  greenChev: { color: 'rgba(245,236,225,0.45)', fontSize: 13 },
  greenScroll: { maxHeight: 130 },
  greenEmpty: { color: 'rgba(245,236,225,0.3)', fontSize: 12, fontFamily: FONTS.body, paddingVertical: 6 },
  greenMsg: { color: 'rgba(245,236,225,0.75)', fontSize: 12.5, lineHeight: 18, fontFamily: FONTS.body, marginBottom: 4 },
  greenName: { color: '#F0A765', fontFamily: FONTS.semibold, fontSize: 12 },
  greenRow: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  greenInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(245,236,225,0.15)', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, color: '#F5ECE1', fontSize: 13, fontFamily: FONTS.body },
  greenSend: { borderRadius: 10, backgroundColor: 'rgba(240,167,101,0.85)', paddingHorizontal: 14, justifyContent: 'center' },
  greenSendTxt: { color: '#08060A', fontSize: 13, fontFamily: FONTS.semibold },
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },
  liveTag: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CRIMSON },
  liveTxt: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 10.5, letterSpacing: 2 },

  motionBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 12 },
  motionBarTxt: { flex: 1, fontFamily: FONTS.displayItalic, color: CREAM, fontSize: 15.5, lineHeight: 21 },

  rail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 24 },
  railItem: { alignItems: 'center', gap: 5 },
  railDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(245,236,225,0.3)' },
  railDotOn: { backgroundColor: 'rgba(224,87,111,0.5)', borderColor: 'rgba(224,87,111,0.6)' },
  railDotNow: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  railTxt: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.35)', fontSize: 9.5, letterSpacing: 1.5 },
  railTxtNow: { color: CREAM },
  railLine: { width: 40, height: 1, backgroundColor: 'rgba(245,236,225,0.15)', marginHorizontal: 6, marginBottom: 14 },
  railLineOn: { backgroundColor: 'rgba(224,87,111,0.5)' },

  bubbleWrap: { marginVertical: 8, maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingHorizontal: 2 },
  bubbleWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11 },
  bubble: { borderWidth: 1, borderRadius: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.025)' },
  bubbleLive: { backgroundColor: 'rgba(224,87,111,0.06)' },
  bubbleTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.9)', fontSize: 14.5, lineHeight: 21 },
  caret: { color: CRIMSON, fontFamily: FONTS.body },

  noteCard: { alignSelf: 'center', maxWidth: '94%', marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.3)', backgroundColor: 'rgba(240,167,101,0.05)' },
  noteLabel: { fontFamily: FONTS.semibold, color: '#F0A765', fontSize: 9.5, letterSpacing: 1.5, marginBottom: 5 },
  noteTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.75)', fontSize: 13, lineHeight: 19 },

  verdictWrap: { marginTop: 18, alignItems: 'center', paddingHorizontal: 8 },
  vKicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  vWinner: { fontFamily: FONTS.display, color: CREAM, fontSize: 26, marginTop: 10, marginBottom: 12 },
  vSummary: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.85)', fontSize: 15, lineHeight: 23 },
  vMetric: { marginTop: 18, borderLeftWidth: 2, borderLeftColor: 'rgba(224,87,111,0.4)', paddingLeft: 14, alignSelf: 'stretch' },
  vMetricLabel: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 10.5, letterSpacing: 1.5 },
  vMetricBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  crowdCard: { marginTop: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, alignSelf: 'stretch' },
  crowdLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 10.5, letterSpacing: 2 },
  crowdVote: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.8)', fontSize: 14, lineHeight: 21, marginTop: 8 },

  voteDock: { borderTopWidth: 1, borderTopColor: 'rgba(224,87,111,0.2)', backgroundColor: 'rgba(20,7,12,0.7)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  voteLabel: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  voteBtnProOn: { backgroundColor: BLUE, borderColor: BLUE },
  voteBtnConOn: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  voteBtnTxt: { fontFamily: FONTS.semibold, color: CREAM, fontSize: 13 },
});
