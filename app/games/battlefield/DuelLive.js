// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE BATTLEFIELD DUEL, LIVE. The real, engine-driven practice duel.
//  You are PRO (seat 0); the house is CON (seat 1). Three phases (Opening →
//  Rebuttal → Closing), turn-locked, the proven adjudicator ruling at the end.
//  Drives entirely off the live session (useLiveSession) + move({type:'speech'}).
//  The house generates its turns server-side inside the move call; the running
//  notes are the adjudicator's commentary track; the verdict is the real
//  Matter/Manner adjudication. No mocked script — this is the wired room.
//
//  Register: crimson — the arena of argument. Serious, electric, not warm.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../../theme';
import { useLiveSession } from '../liveCommon';
import { buzz } from '../common';
import { openDuelSender, broadcastDuelKeys, closeDuelSender } from '../../realtime';
import { loadFormats, formatFor, seatSide, speakerTag, roleRail, currentSlot } from './formats';
import { watchBattlefieldDuel } from '../../api';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

function Swords({ size = 22, color = CRIMSON }) {
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
    <View style={[styles.rail, PHASES.length > 4 && { flexWrap: 'wrap', rowGap: 6 }]}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p}>
          <View style={styles.railItem}>
            <View style={[styles.railDot, i <= idx && styles.railDotOn, i === idx && styles.railDotNow]} />
            <Text style={[styles.railTxt, i === idx && styles.railTxtNow]}>{p}</Text>
          </View>
          {i < PHASES.length - 1 ? <View style={[styles.railLine, i < idx && styles.railLineOn]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

// a delivered turn in the transcript. seat 0 = PRO (you), seat 1 = CON (the house).
function TurnBubble({ turn, mySeat, fmt }) {
  const side = fmt ? seatSide(fmt, turn.seat) : (turn.seat === 0 ? 'PRO' : 'CON');
  const isPro = side === 'PRO';
  const isYou = turn.seat === mySeat;
  const tag = fmt ? speakerTag(fmt, turn.seat) : side;
  // a LAPSED slot renders as the on-record time note — never as a speech bubble
  if (turn.lapsed) {
    return (
      <View style={styles.lapsedRow}>
        <View style={styles.lapsedLine} />
        <Text style={styles.lapsedTxt}>time — {tag}'s {turn.role} lapsed unspoken</Text>
        <View style={styles.lapsedLine} />
      </View>
    );
  }
  return (
    <View style={[styles.bubbleWrap, isPro ? styles.bubbleLeft : styles.bubbleRight]}>
      <View style={styles.bubbleHead}>
        <View style={[styles.sideTag, { borderColor: isPro ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
          <Text style={[styles.sideTagTxt, { color: isPro ? BLUE : CRIMSON }]}>{tag}</Text>
        </View>
        <Text style={styles.bubbleWho}>{isYou ? 'you' : 'the house'} · {turn.role}</Text>
      </View>
      <View style={[styles.bubble, { borderColor: isPro ? 'rgba(120,200,255,0.18)' : 'rgba(224,87,111,0.2)' }]}>
        <Text style={styles.bubbleTxt}>{turn.text}</Text>
      </View>
    </View>
  );
}

// ── THE SLOT CLOCK (§5): the client RENDERS; the server owns truth (a late
// submission is rejected at the bell + grace; the sweeper forfeits dead slots).
// Countdown = slotSeconds − elapsed since slotStartedAt, clamped at 0. ──
function SlotClock({ startedAt, seconds }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!startedAt || !seconds) return null;
  const left = Math.max(0, Math.round(seconds - (now - Date.parse(startedAt)) / 1000));
  const mm = Math.floor(left / 60); const ss = String(left % 60).padStart(2, '0');
  const urgent = left <= 15 && left > 0;
  const gone = left === 0;
  return (
    <View style={[styles.clock, urgent && styles.clockUrgent, gone && styles.clockGone]}>
      <Text style={[styles.clockTxt, urgent && { color: CRIMSON }, gone && { color: 'rgba(245,236,225,0.4)' }]}>
        {gone ? 'the bell' : `${mm}:${ss}`}
      </Text>
    </View>
  );
}

export default function BattlefieldDuelLive({ sessionId, onBack = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const lastSentRef = useRef(0);
  const throttleRef = useRef(null);

  const g = view?.state;
  const me = view?.mySeat ?? 0;
  const phase = g?.phase || 'Opening';
  const isVerdict = phase === 'verdict';
  const myTurn = g && !isVerdict && g.toAct === me;
  const turns = g?.turns || [];
  const notes = g?.notes || [];
  const threadId = view?.roomId;

  // ── [phase 4] the format module drives the surface (duel/PF/AP, one screen) ──
  const [fmtReady, setFmtReady] = useState(false);
  useEffect(() => { let on = true; loadFormats().then(() => { if (on) setFmtReady(true); }); return () => { on = false; }; }, []);
  const fmt = fmtReady ? formatFor(g?.formatKey) : null;
  const myTag = fmt ? speakerTag(fmt, me) : (me === 0 ? 'PRO' : 'CON');
  const mySide = fmt ? seatSide(fmt, me) : (me === 0 ? 'PRO' : 'CON');
  const isTeam = fmt ? (fmt.perSide || 1) > 1 : false;
  const slot = fmt && g ? currentSlot(fmt, g) : null;

  // the crowd tally, fetched once when the verdict lands (public watch endpoint)
  const [tally, setTally] = useState(null);
  useEffect(() => {
    if (!isVerdict) return;
    let on = true;
    watchBattlefieldDuel(sessionId).then((w) => { if (on && w?.tally) setTally(w.tally); }).catch(() => {});
    return () => { on = false; };
  }, [isVerdict, sessionId]);

  useEffect(() => { scrollRef.current?.scrollToEnd?.({ animated: true }); }, [turns.length, phase, sending]);

  // ── live keystroke streaming: while it's my turn, hold a send channel open and
  // broadcast my textbox state so the opponent + spectators watch me compose. ──
  useEffect(() => {
    if (myTurn && threadId) { openDuelSender(threadId); }
    return () => { if (throttleRef.current) { clearTimeout(throttleRef.current); throttleRef.current = null; } };
  }, [myTurn, threadId]);
  useEffect(() => () => { closeDuelSender(); }, []);

  // throttle the broadcast to ~1 every 180ms (pauses/deletes/bursts all show,
  // at ~5 events/sec — the drama without the flood).
  const streamKeys = (text) => {
    if (!myTurn || !threadId) return;
    const now = Date.now();
    const fire = () => { lastSentRef.current = Date.now(); broadcastDuelKeys(threadId, { seat: me, phase, text, done: false }); };
    if (now - lastSentRef.current >= 180) { fire(); }
    else {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      throttleRef.current = setTimeout(fire, 180 - (now - lastSentRef.current));
    }
  };
  const onDraftChange = (t) => { setDraft(t); streamKeys(t); };

  const speak = async () => {
    const text = draft.trim();
    if (text.length < 10 || sending) return;
    setSending(true); setDraft('');
    // final frame: clear the live-typing surface for watchers, close the sender.
    if (threadId) { broadcastDuelKeys(threadId, { seat: me, phase, text: '', done: true }); closeDuelSender(); }
    buzz('knock');
    await move({ type: 'speech', text });   // the house replies + adjudicator rules inside this call
    setSending(false);
  };

  // ── the verdict view (real adjudication) ──
  if (isVerdict) {
    const v = g.verdict;
    const winner = g.winner;
    const failed = !!g.error || !v;
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
            <Text style={styles.topMotionSm} numberOfLines={1}>the verdict</Text>
            <View style={{ width: 20 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {/* the full duel, replayed above the verdict — so the closing statements are
                never skipped (the house's final turn lands before the ruling). */}
            {turns.map((t, i) => <TurnBubble key={i} turn={t} mySeat={me} fmt={fmt} />)}
            {notes.map((n, i) => (
              <View key={`vn-${i}`} style={styles.noteCard}>
                <Text style={styles.noteLabel}>THE ADJUDICATOR · after {n.phase}</Text>
                <Text style={styles.noteTxt}>{n.note}</Text>
              </View>
            ))}
            <View style={styles.verdictDivider} />
            {failed ? (
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>The adjudicator stood down.</Text>
                <Text style={styles.introBody}>Something went wrong reaching a verdict on this duel. No winner was invented — the floor would rather stay silent than rule badly. Try another.</Text>
                <Pressable style={styles.beginBtn} onPress={onBack}><Text style={styles.beginTxt}>leave the floor</Text></Pressable>
              </View>
            ) : (
              <>
                <View style={styles.vHead}>
                  <Text style={styles.vKicker}>THE ADJUDICATOR RULES</Text>
                  <Text style={styles.vWinner}>
                    <Text style={{ color: winner === 'PRO' ? BLUE : CRIMSON }}>{winner}</Text> takes the floor
                  </Text>
                  <Text style={styles.vYou}>
                    {winner === mySide ? (isTeam ? 'Your team won.' : 'You won.') : `You argued ${mySide}. The floor went the other way.`}
                  </Text>
                </View>
                {!!v.adjVerdict && <Text style={styles.vLine}>{v.adjVerdict}</Text>}
                <Text style={styles.vSummary}>{v.summary}</Text>

                {!!v.matter && (
                  <View style={styles.vMetric}>
                    <Text style={styles.vMetricLabel}>MATTER — logic · evidence · fact</Text>
                    <Text style={styles.vMetricBody}>{v.matter}</Text>
                  </View>
                )}
                {!!v.manner && (
                  <View style={styles.vMetric}>
                    <Text style={styles.vMetricLabel}>MANNER — delivery · structure · control</Text>
                    <Text style={styles.vMetricBody}>{v.manner}</Text>
                  </View>
                )}
                {!!v.closing && (
                  <View style={styles.vFactNote}>
                    <Text style={styles.vFactTxt}>{v.closing}</Text>
                  </View>
                )}
                {/* [phase 4] the tab: per-speaker scores + best speaker (§3.3) */}
                {Array.isArray(v.speakers) && v.speakers.length ? (
                  <View style={styles.tabCard}>
                    <Text style={styles.vMetricLabel}>THE TAB — speaker scores</Text>
                    {v.speakers.map((sp) => (
                      <View key={sp.seat} style={styles.tabRow}>
                        <Text style={[styles.tabTag, { color: (fmt ? seatSide(fmt, sp.seat) : (sp.seat === 0 ? 'PRO' : 'CON')) === 'PRO' ? BLUE : CRIMSON }]}>
                          {sp.role}{sp.seat === me ? ' · you' : ''}{v.bestSpeaker === sp.seat ? ' ★' : ''}
                        </Text>
                        <Text style={styles.tabScore}>{sp.score}</Text>
                        <Text style={styles.tabLine} numberOfLines={3}>{sp.line}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {/* the crowd tally — the room's own verdict */}
                {tally && tally.total > 0 ? (
                  <View style={styles.tabCard}>
                    <Text style={styles.vMetricLabel}>THE ROOM VOTED</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                      <Text style={{ color: BLUE, fontSize: 20, fontFamily: FONTS.display }}>{tally.pro}</Text>
                      <Text style={{ color: 'rgba(245,236,225,0.4)', fontSize: 11, letterSpacing: 1.5, fontFamily: FONTS.medium }}>PRO · CON</Text>
                      <Text style={{ color: CRIMSON, fontSize: 20, fontFamily: FONTS.display }}>{tally.con}</Text>
                    </View>
                  </View>
                ) : null}
                <Pressable style={styles.againBtn} onPress={onBack}><Text style={styles.againTxt}>leave the floor</Text></Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── the live duel view ──
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
            <View style={styles.practiceTag}><Text style={styles.practiceTxt}>PRACTICE · VS THE HOUSE</Text></View>
            <Pressable hitSlop={10} onPress={() => Share.share({ message: `watch me take on the Battlefield's house live: https://callmez.app/watch/${sessionId}` })}>
              <Text style={{ fontSize: 16 }}>🔗</Text>
            </Pressable>
          </View>

          {/* the motion */}
          <View style={styles.motionBar}>
            <Swords size={18} />
            <Text style={styles.motionBarTxt}>{g?.motion ? `"${g.motion}"` : 'setting the motion…'}</Text>
          </View>

          <PhaseRail current={phase} rail={fmt ? roleRail(fmt) : null} />

          <View style={styles.assignRow}>
            <Text style={styles.assignTxt}>you are </Text>
            <View style={[styles.sideTag, { borderColor: mySide === 'PRO' ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
              <Text style={[styles.sideTagTxt, { color: mySide === 'PRO' ? BLUE : CRIMSON }]}>{myTag}</Text>
            </View>
            <Text style={styles.assignTxt}>{isTeam ? '  ·  the house fills the other seats' : '  ·  the house is ' + (mySide === 'PRO' ? 'CON' : 'PRO')}</Text>
            <View style={{ flex: 1 }} />
            {g?.timed ? <SlotClock startedAt={g.slotStartedAt} seconds={g.slotSeconds} /> : null}
          </View>

          {/* the transcript */}
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
            {turns.length === 0 && !sending ? (
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>The floor is yours.</Text>
                <Text style={styles.introBody}>
                  You've been assigned {myTag} — you {mySide === 'PRO' ? 'argue for the motion' : 'argue against the motion'}, whether or not you agree. That's the craft. Open your case below. The house plays every other seat — then the adjudicator rules on Matter and Manner, with a score for every speaker.
                </Text>
              </View>
            ) : null}

            {turns.map((t, i) => <TurnBubble key={i} turn={t} mySeat={me} fmt={fmt} />)}

            {/* the commentary track — the adjudicator's running read after each phase */}
            {notes.map((n, i) => (
              <View key={`note-${i}`} style={styles.noteCard}>
                <Text style={styles.noteLabel}>THE ADJUDICATOR · after {n.phase}</Text>
                <Text style={styles.noteTxt}>{n.note}</Text>
              </View>
            ))}

            {sending ? (
              <View style={styles.streamNote}>
                <Text style={styles.streamNoteTxt}>the house takes the floor…</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* the composer / waiting dock */}
          {myTurn ? (
            <View style={styles.dock}>
              <View style={styles.dockHead}>
                <Text style={styles.dockTurn}>YOUR TURN · {phase.toUpperCase()}</Text>
              </View>
              <TextInput
                value={draft} onChangeText={onDraftChange} multiline editable={!sending}
                placeholder={turns.length === 0 ? 'open your case — make it count…' : phase === 'Rebuttal' ? 'attack their case…' : 'land your closing — no new arguments…'}
                placeholderTextColor="rgba(245,236,225,0.3)"
                style={styles.input}
              />
              <View style={styles.dockRow}>
                <Text style={styles.streamNoteTxt}>{draft.trim().length < 10 ? 'a speech must carry some weight' : `${draft.trim().length} chars`}</Text>
                <Pressable style={[styles.sendBtn, (draft.trim().length < 10 || sending) && styles.sendBtnOff]} onPress={speak} disabled={draft.trim().length < 10 || sending}>
                  <Text style={styles.sendTxt}>{sending ? 'delivering…' : 'take the floor ›'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.watchDock}>
              <Text style={styles.watchTxt}>
                {sending ? 'the house is composing its reply…' : g ? 'the house has the floor…' : 'preparing the floor…'}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── [phase 4] the clock · the lapse · the tab ──
  clock: { borderWidth: 1, borderColor: 'rgba(245,236,225,0.25)', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 4 },
  clockUrgent: { borderColor: 'rgba(224,87,111,0.7)', backgroundColor: 'rgba(224,87,111,0.08)' },
  clockGone: { borderColor: 'rgba(245,236,225,0.15)' },
  clockTxt: { color: CREAM, fontSize: 14, fontFamily: FONTS.semibold, fontVariant: ['tabular-nums'] },
  lapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10, paddingHorizontal: 4 },
  lapsedLine: { flex: 1, height: 1, backgroundColor: 'rgba(245,236,225,0.12)' },
  lapsedTxt: { color: 'rgba(245,236,225,0.45)', fontSize: 12, fontFamily: FONTS.displayItalic },
  vLine: { color: 'rgba(245,236,225,0.85)', fontSize: 15.5, lineHeight: 23, fontFamily: FONTS.displayItalic, marginBottom: 12 },
  tabCard: { borderWidth: 1, borderColor: 'rgba(245,236,225,0.12)', borderRadius: 12, padding: 13, marginTop: 14 },
  tabRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 9 },
  tabTag: { fontSize: 12, letterSpacing: 1, fontFamily: FONTS.semibold, width: 86 },
  tabScore: { color: '#C9A86A', fontSize: 15, fontFamily: FONTS.display, width: 28, textAlign: 'right' },
  tabLine: { flex: 1, color: 'rgba(245,236,225,0.6)', fontSize: 11.5, lineHeight: 16, fontFamily: FONTS.body },
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },
  topMotionSm: { flex: 1, textAlign: 'center', fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 12, letterSpacing: 2 },
  practiceTag: { flex: 1, alignItems: 'center' },
  practiceTxt: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.8)', fontSize: 10, letterSpacing: 2 },

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

  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, flexWrap: 'wrap' },
  assignTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.45)', fontSize: 12.5 },
  sideTag: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 2 },
  sideTagTxt: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 1 },

  introCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.2)', borderRadius: 18, padding: 22, backgroundColor: 'rgba(224,87,111,0.04)', marginTop: 8 },
  introTitle: { fontFamily: FONTS.display, color: CREAM, fontSize: 22 },
  introBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.68)', fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  beginBtn: { marginTop: 20, backgroundColor: CRIMSON, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  beginTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 15, letterSpacing: 0.5 },

  bubbleWrap: { marginVertical: 8, maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingHorizontal: 2 },
  bubbleWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11 },
  bubble: { borderWidth: 1, borderRadius: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.025)' },
  bubbleTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.9)', fontSize: 14.5, lineHeight: 21 },

  noteCard: { alignSelf: 'center', maxWidth: '94%', marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.3)', backgroundColor: 'rgba(240,167,101,0.05)' },
  noteLabel: { fontFamily: FONTS.semibold, color: '#F0A765', fontSize: 9.5, letterSpacing: 1.5, marginBottom: 5 },
  noteTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.75)', fontSize: 13, lineHeight: 19 },

  dock: { borderTopWidth: 1, borderTopColor: 'rgba(224,87,111,0.2)', backgroundColor: 'rgba(20,7,12,0.7)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  dockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dockTurn: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 11, letterSpacing: 2 },
  streamNote: { marginBottom: 8, alignItems: 'center' },
  streamNoteTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11.5, fontStyle: 'italic' },
  input: { fontFamily: FONTS.light, color: CREAM, fontSize: 15, lineHeight: 22, minHeight: 70, maxHeight: 150, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sendBtn: { backgroundColor: CRIMSON, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 22 },
  sendBtnOff: { backgroundColor: 'rgba(224,87,111,0.3)' },
  sendTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 14 },

  watchDock: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 24, paddingVertical: 16 },
  watchTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.5)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },

  vHead: { alignItems: 'center', marginBottom: 20 },
  verdictDivider: { height: 1, backgroundColor: 'rgba(224,87,111,0.25)', marginVertical: 20 },
  vKicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  vWinner: { fontFamily: FONTS.display, color: CREAM, fontSize: 30, marginTop: 12 },
  vYou: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 14, marginTop: 8 },
  vSummary: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.85)', fontSize: 15.5, lineHeight: 24 },
  vMetric: { marginTop: 22, borderLeftWidth: 2, borderLeftColor: 'rgba(224,87,111,0.4)', paddingLeft: 14 },
  vMetricLabel: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 10.5, letterSpacing: 1.5 },
  vMetricBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  vFactNote: { marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 },
  vFactTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },

  againBtn: { marginTop: 28, borderWidth: 1, borderColor: 'rgba(224,87,111,0.5)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  againTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 14 },
});
