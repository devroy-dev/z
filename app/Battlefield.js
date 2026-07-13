// Battlefield.js — THE BATTLEFIELD (shell / v0).
//
// The place where debate happens: 1v1, judged by the adjudicator, watched by the
// room. This is the entry surface — it establishes the FORMAT (motion, PRO/CON,
// the three phases, the two-results verdict) so the shape is real and felt, before
// the live adjudicator + duel loop are wired. No engine, no external call yet.
//
// Register: crimson — this is the arena of argument. Serious, electric, not warm.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from './theme';
import { getBattlefieldMotions, getBattlefieldDirectory } from './api';
import { TextInput } from 'react-native';

const CRIMSON = '#E0576F';
const INK = '#08060A';

function Swords({ size = 30, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Phase({ n, name, who, note }) {
  return (
    <View style={styles.phaseRow}>
      <View style={styles.phaseNum}><Text style={styles.phaseNumTxt}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.phaseName}>{name}</Text>
        <Text style={styles.phaseWho}>{who}</Text>
        {note ? <Text style={styles.phaseNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

export default function Battlefield({ onBack = () => {}, onEnterDuel = () => {}, onWatch = () => {}, onChallenge = () => {}, onWatchLive = () => {}, onReadVerdict = () => {}, onOpenFight = () => {} }) {
  // ── [phase 4] the directory: LIVE NOW + recent verdicts (public read; best-effort) ──
  const [dir, setDir] = React.useState(null);
  React.useEffect(() => {
    let on = true;
    const load = async () => { try { const d = await getBattlefieldDirectory(); if (on) setDir(d); } catch (e) {} };
    load();
    const t = setInterval(load, 30000);   // the arena breathes — a light 30s refresh
    return () => { on = false; clearInterval(t); };
  }, []);
  // paste-a-challenge-link intake (the /fight/<id> link's in-app door)
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteVal, setPasteVal] = React.useState('');
  const tryOpenFight = () => {
    const m = pasteVal.match(/fight\/([0-9a-f-]{8,})/i);
    if (m) { setPasteOpen(false); setPasteVal(''); onOpenFight(m[1]); }
  };
  // ── the topic picker: choose the ground before the duel opens ──
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // [zip02] tier-aware topic picker: Normal browses the LIGHT bank, Pro the HEAVY.
  // Cached per tier; fetched on open and on toggle; empty tier falls back to all.
  const [banks, setBanks] = React.useState({ light: null, heavy: null });
  const [activeDomain, setActiveDomain] = React.useState(null);
  const [loadingTopics, setLoadingTopics] = React.useState(false);
  const [difficulty, setDifficulty] = React.useState('normal');
  const tierOf = (diff) => (diff === 'pro' ? 'heavy' : 'light');
  const domains = banks[tierOf(difficulty)];

  const loadBank = async (tier) => {
    setLoadingTopics(true);
    try {
      let d = await getBattlefieldMotions(tier);
      let list = (d && d.domains) || [];
      // a tier with an empty bank (e.g. light not yet seeded) falls back to all motions
      if (!list.some((x) => (x.motions || []).length)) { d = await getBattlefieldMotions(); list = (d && d.domains) || []; }
      setBanks((cur) => ({ ...cur, [tier]: list }));
    } catch (e) { setBanks((cur) => ({ ...cur, [tier]: [] })); }
    setLoadingTopics(false);
  };
  const openPicker = async () => {
    setActiveDomain(null);
    setPickerOpen(true);
    if (!banks[tierOf(difficulty)]) await loadBank(tierOf(difficulty));
  };
  const switchDifficulty = async (mk) => {
    setDifficulty(mk);
    setActiveDomain((cur) => cur ? null : cur);   // domain lists differ per tier — step back to areas
    if (!banks[tierOf(mk)]) await loadBank(tierOf(mk));
  };
  // motion optional (undefined => random within domain); domain optional (undefined => any)
  const pick = (motion, domain) => { setPickerOpen(false); onEnterDuel(motion, domain, difficulty); };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Swords size={34} />
            <Text style={styles.kicker}>ARGUE IT OUT</Text>
          </View>
          <Text style={styles.title}>The Battlefield</Text>
          <Text style={styles.lede}>
            Two people. One motion. Assigned sides. No shouting past each other — a structured duel of reason, judged by an adjudicator who rewards <Text style={styles.ledeEm}>truth over confidence</Text>, and watched by the room.
          </Text>

          {/* the motion example */}
          <Text style={styles.sectionLabel}>THE MOTION</Text>
          <View style={styles.motionCard}>
            <Text style={styles.motionText}>"This house believes economic sanctions do more to entrench regimes than to weaken them."</Text>
            <View style={styles.sidesRow}>
              <View style={[styles.sideChip, { borderColor: 'rgba(120,200,255,0.4)' }]}><Text style={[styles.sideTxt, { color: '#78C8FF' }]}>PRO</Text></View>
              <Text style={styles.vs}>vs</Text>
              <View style={[styles.sideChip, { borderColor: 'rgba(224,87,111,0.5)' }]}><Text style={[styles.sideTxt, { color: CRIMSON }]}>CON</Text></View>
            </View>
            <Text style={styles.motionSub}>Sides are assigned, not chosen. Arguing the position you're given is the skill.</Text>
          </View>

          {/* the phases */}
          <Text style={styles.sectionLabel}>HOW A DUEL RUNS</Text>
          <View style={styles.phasesCard}>
            <Phase n="1" name="Opening" who="PRO states the case, then CON." />
            <Phase n="2" name="Rebuttal" who="Each attacks the other's opening." note="Where it sharpens." />
            <Phase n="3" name="Closing" who="Final case, both sides. No new arguments." />
            <View style={styles.turnNote}>
              <Text style={styles.turnNoteTxt}>Turn-locked. Only one speaks at a time — the other watches, and so does the room.</Text>
            </View>
          </View>

          {/* the adjudicator */}
          <Text style={styles.sectionLabel}>THE ADJUDICATOR</Text>
          <View style={styles.adjCard}>
            <Text style={styles.adjLine}>An undefeated judge with an encyclopedic corpus. He fact-checks live, strikes fabricated data, and never rewards a confident lie over a nuanced truth.</Text>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricPct}>50%</Text>
                <Text style={styles.metricName}>MATTER</Text>
                <Text style={styles.metricSub}>logic · evidence · fact</Text>
              </View>
              <View style={styles.metricDivide} />
              <View style={styles.metric}>
                <Text style={styles.metricPct}>50%</Text>
                <Text style={styles.metricName}>MANNER</Text>
                <Text style={styles.metricSub}>delivery · structure · control</Text>
              </View>
            </View>
          </View>

          {/* the two results */}
          <Text style={styles.sectionLabel}>TWO VERDICTS</Text>
          <View style={styles.twoCard}>
            <View style={styles.twoRow}>
              <Text style={styles.twoTag}>THE ADJUDICATOR</Text>
              <Text style={styles.twoDesc}>decides the winner — on the merits.</Text>
            </View>
            <View style={styles.twoRow}>
              <Text style={styles.twoTag}>THE ROOM</Text>
              <Text style={styles.twoDesc}>votes too. Charisma often wins the crowd.</Text>
            </View>
            <Text style={styles.twoGap}>When they disagree — that's the whole point. Eloquence can mask a weak argument. It can't survive a factual audit.</Text>
          </View>

          {/* ── [phase 4] LIVE NOW — the directory's live public floors ── */}
          {dir?.live?.length ? (
            <>
              <Text style={styles.sectionLabel}>LIVE NOW</Text>
              {dir.live.slice(0, 5).map((d) => (
                <Pressable key={d.sessionId} style={styles.liveRow} onPress={() => onWatchLive(d.sessionId)}>
                  <View style={styles.liveDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveMotion} numberOfLines={2}>"{d.motion}"</Text>
                    <Text style={styles.liveMeta}>{d.formatKey !== 'duel' ? d.formatKey.toUpperCase() + ' · ' : ''}{d.votes ? `${d.votes} watching votes · ` : ''}tap to watch</Text>
                  </View>
                  <Text style={styles.liveChev}>›</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {/* ── the three doors ── */}
          <Pressable style={styles.enterBtn} onPress={openPicker}>
            <Swords size={20} color={INK} />
            <Text style={styles.enterTxt}>Practice against the house</Text>
          </Pressable>
          <Pressable style={styles.challengeBtn} onPress={onChallenge}>
            <Text style={styles.challengeTxt}>Challenge a friend — settle it</Text>
          </Pressable>
          <Pressable style={styles.watchBtn} onPress={() => (dir?.live?.length ? onWatchLive(dir.live[0].sessionId) : onWatch())}>
            <Text style={styles.watchTxt}>Watch a live duel</Text>
          </Pressable>
          <Pressable onPress={() => setPasteOpen((v) => !v)}>
            <Text style={styles.pasteLink}>have a challenge link? open it here</Text>
          </Pressable>
          {pasteOpen ? (
            <View style={styles.pasteRow}>
              <TextInput style={styles.pasteInput} value={pasteVal} onChangeText={setPasteVal} placeholder="callmez.app/fight/…" placeholderTextColor="rgba(245,236,225,0.3)" autoCapitalize="none" autoCorrect={false} />
              <Pressable style={styles.pasteBtn} onPress={tryOpenFight}><Text style={styles.pasteBtnTxt}>open</Text></Pressable>
            </View>
          ) : null}

          {/* ── RECENT VERDICTS — the record's public tail ── */}
          {dir?.recent?.length ? (
            <>
              <Text style={styles.sectionLabel}>RECENT VERDICTS</Text>
              {dir.recent.slice(0, 5).map((d) => (
                <Pressable key={d.sessionId} style={styles.verdictRow} onPress={() => onReadVerdict(d.sessionId)}>
                  <Text style={[styles.verdictWinner, { color: d.winner === 'PRO' ? '#78C8FF' : CRIMSON }]}>{d.winner}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveMotion} numberOfLines={1}>"{d.motion}"</Text>
                    {!!d.verdictLine && <Text style={styles.verdictLineTxt} numberOfLines={2}>{d.verdictLine}</Text>}
                  </View>
                  <Text style={styles.liveChev}>›</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* ── THE TOPIC PICKER ── */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.pickBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.pickSheet}>
            <View style={styles.pickGrab} />
            <View style={styles.pickHead}>
              <Text style={styles.pickTitle} numberOfLines={1}>{activeDomain ? activeDomain.label : 'Choose your ground'}</Text>
              <Pressable hitSlop={12} onPress={() => (activeDomain ? setActiveDomain(null) : setPickerOpen(false))}>
                <Text style={styles.pickClose}>{activeDomain ? '‹ areas' : '✕'}</Text>
              </Pressable>
            </View>

            <View style={styles.modeRow}>
              {['normal', 'pro'].map((mk) => (
                <Pressable key={mk} style={[styles.modeBtn, difficulty === mk && styles.modeBtnOn]} onPress={() => switchDifficulty(mk)}>
                  <Text style={[styles.modeTxt, difficulty === mk && styles.modeTxtOn]}>{mk === 'normal' ? 'Normal' : 'Pro'}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modeHint}>{difficulty === 'normal' ? 'A gentler house and a coaching judge — for finding your feet.' : 'The full forensic rig: a relentless house and an unsparing adjudicator.'}</Text>

            {!activeDomain ? (
              <Pressable style={styles.surpriseBtn} onPress={() => pick(undefined, undefined)}>
                <Swords size={16} color={CRIMSON} />
                <Text style={styles.surpriseTxt}>Surprise me — any topic</Text>
              </Pressable>
            ) : null}

            <ScrollView style={styles.pickScroll} showsVerticalScrollIndicator={false}>
              {loadingTopics ? (
                <View style={styles.pickLoadingWrap}>
                  <ActivityIndicator color={CRIMSON} />
                  <Text style={styles.pickLoading}>loading the topic bank…</Text>
                </View>
              ) : null}

              {!activeDomain && !loadingTopics ? (domains || []).map((d) => (
                <Pressable key={d.key} style={styles.domainRow} onPress={() => setActiveDomain(d)}>
                  <Text style={styles.domainLabel}>{d.label}</Text>
                  <Text style={styles.domainCount}>{(d.motions || []).length} ›</Text>
                </Pressable>
              )) : null}

              {activeDomain ? (
                <View>
                  <Pressable style={styles.randomRow} onPress={() => pick(undefined, activeDomain.key)}>
                    <Text style={styles.randomTxt}>⚄  Random motion in this area</Text>
                  </Pressable>
                  {(activeDomain.motions || []).map((m, i) => (
                    <Pressable key={i} style={styles.motionRow} onPress={() => pick(m, activeDomain.key)}>
                      <Text style={styles.motionRowTxt}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <Text style={styles.pickFoot}>You'll be assigned a side — PRO or CON — at random. That's the craft.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── [phase 4] the rebuilt home's sections ──
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(224,87,111,0.25)', borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: 'rgba(224,87,111,0.04)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0576F' },
  liveMotion: { color: '#F5ECE1', fontSize: 13.5, lineHeight: 18, fontFamily: FONTS.displayItalic },
  liveMeta: { color: 'rgba(245,236,225,0.45)', fontSize: 11, fontFamily: FONTS.body, marginTop: 3 },
  liveChev: { color: 'rgba(245,236,225,0.4)', fontSize: 18, fontFamily: FONTS.light },
  challengeBtn: { marginTop: 10, borderWidth: 1.5, borderColor: '#E0576F', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  challengeTxt: { color: '#E0576F', fontSize: 15, fontFamily: FONTS.semibold },
  pasteLink: { color: 'rgba(120,200,255,0.7)', fontSize: 12.5, fontFamily: FONTS.medium, textAlign: 'center', marginTop: 14 },
  pasteRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pasteInput: { flex: 1, borderWidth: 1, borderColor: 'rgba(120,200,255,0.3)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: '#F5ECE1', fontSize: 13, fontFamily: FONTS.body },
  pasteBtn: { borderRadius: 10, backgroundColor: 'rgba(120,200,255,0.85)', paddingHorizontal: 16, justifyContent: 'center' },
  pasteBtnTxt: { color: '#08060A', fontSize: 13.5, fontFamily: FONTS.semibold },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(245,236,225,0.1)', borderRadius: 12, padding: 12, marginBottom: 8 },
  verdictWinner: { fontSize: 13, letterSpacing: 1.5, fontFamily: FONTS.semibold, width: 42 },
  verdictLineTxt: { color: 'rgba(245,236,225,0.5)', fontSize: 11.5, lineHeight: 16, fontFamily: FONTS.body, marginTop: 3 },
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  kicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 38, marginTop: 10 },
  lede: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.72)', fontSize: 17, lineHeight: 26, marginTop: 14 },
  ledeEm: { fontFamily: FONTS.displayItalic, color: CRIMSON },

  sectionLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.4)', fontSize: 10.5, letterSpacing: 2.5, marginTop: 32, marginBottom: 12 },

  motionCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.2)', borderRadius: 18, padding: 20, backgroundColor: 'rgba(224,87,111,0.04)' },
  motionText: { fontFamily: FONTS.displayItalic, color: '#F5ECE1', fontSize: 20, lineHeight: 28 },
  sidesRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  sideChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  sideTxt: { fontFamily: FONTS.semibold, fontSize: 13, letterSpacing: 1.5 },
  vs: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.4)', fontSize: 16 },
  motionSub: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.45)', fontSize: 13, marginTop: 16, lineHeight: 19 },

  phasesCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 8, paddingVertical: 6 },
  phaseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  phaseNum: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(224,87,111,0.4)', alignItems: 'center', justifyContent: 'center' },
  phaseNumTxt: { fontFamily: FONTS.display, color: CRIMSON, fontSize: 15 },
  phaseName: { fontFamily: FONTS.medium, color: '#F5ECE1', fontSize: 16.5 },
  phaseWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 13.5, marginTop: 3, lineHeight: 19 },
  phaseNote: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 13.5, marginTop: 4 },
  turnNote: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', margin: 14, marginTop: 4, paddingTop: 14 },
  turnNoteTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 13, lineHeight: 19 },

  adjCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 },
  adjLine: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 16, lineHeight: 24 },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  metric: { flex: 1, alignItems: 'center' },
  metricPct: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 26 },
  metricName: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 11, letterSpacing: 2, marginTop: 4 },
  metricSub: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11.5, marginTop: 4 },
  metricDivide: { width: 1, height: 54, backgroundColor: 'rgba(255,255,255,0.08)' },

  twoCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 },
  twoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  twoTag: { fontFamily: FONTS.semibold, color: '#F5ECE1', fontSize: 11.5, letterSpacing: 1.5, width: 130 },
  twoDesc: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 14.5, flex: 1, lineHeight: 20 },
  twoGap: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 15, lineHeight: 23, marginTop: 8 },

  soonBar: { marginTop: 34, borderWidth: 1, borderColor: 'rgba(224,87,111,0.25)', borderRadius: 18, padding: 20, backgroundColor: 'rgba(224,87,111,0.05)' },
  soonTitle: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 19 },
  soonSub: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.62)', fontSize: 14.5, lineHeight: 22, marginTop: 8 },

  enterBtn: { marginTop: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: CRIMSON, borderRadius: 14, paddingVertical: 16 },
  enterTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 16, letterSpacing: 0.3 },
  watchBtn: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(224,87,111,0.5)', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  watchTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 15, letterSpacing: 0.3 },
  enterSub: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.55)', fontSize: 13.5, lineHeight: 20, marginTop: 14, textAlign: 'center', paddingHorizontal: 8 },

  // ── the topic picker ──
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(4,3,6,0.62)', justifyContent: 'flex-end' },
  pickSheet: { backgroundColor: '#140A0F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(224,87,111,0.25)', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, maxHeight: '82%' },
  pickGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,236,225,0.18)', marginBottom: 14 },
  pickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pickTitle: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 23, flex: 1, marginRight: 12 },
  pickClose: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 14, letterSpacing: 0.5 },

  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  modeBtnOn: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  modeTxt: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.6)', fontSize: 14, letterSpacing: 0.5 },
  modeTxtOn: { color: INK },
  modeHint: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.45)', fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 17 },
  surpriseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(224,87,111,0.4)', borderRadius: 13, paddingVertical: 14, marginBottom: 10, backgroundColor: 'rgba(224,87,111,0.06)' },
  surpriseTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 15 },

  pickScroll: { maxHeight: 440 },
  pickLoadingWrap: { alignItems: 'center', paddingVertical: 30, gap: 12 },
  pickLoading: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.5)', fontSize: 14 },

  domainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  domainLabel: { fontFamily: FONTS.medium, color: '#F5ECE1', fontSize: 16, flex: 1, marginRight: 10 },
  domainCount: { fontFamily: FONTS.body, color: 'rgba(224,87,111,0.75)', fontSize: 14 },

  randomRow: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(224,87,111,0.08)', marginBottom: 10 },
  randomTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 14.5 },
  motionRow: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 8 },
  motionRowTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.9)', fontSize: 15, lineHeight: 21 },

  pickFoot: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 12.5, textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
