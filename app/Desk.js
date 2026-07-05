// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE FRONT DESK (the landing page) · NIGHTFALL
//  Z at the door of the house — the guide, the engine, the soul. She holds
//  your list, remembers what matters, and moves you to the right room. Her
//  presence is the breathing candle (glow, never a fill); the world is moon-
//  light. Her replies surface DOOR-CARDS that walk you into a persona, the
//  Arena, the Stage, the journal, or inward to the quiet room.
//  World = moonlight. Presence = candlelight. Each door lit by its own aura.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform, Animated, Easing , RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { FONTS } from './theme';
import { parseCards, ProgrammeCard } from './Chat';
import { loadSession, openThread, streamChat, listThreads, listTasks, setTaskStatus, getNotes, deleteNote, getLedger, getRecentPings, getArcs, startArc, acceptDropin, ignoreDropin , getMe } from './api';
import { MOTIONS } from './games/debate/motions';
import { LIBRARY as STAGE_LIB } from './stage/library';
import { TABLE_CAST } from './games/personas';
import Grain from './Grain';
import { useBackLayer } from './backbus';

// ── NIGHTFALL palette (local to the Front Desk until the full repaint) ──
const N = {
  night:     '#0B0A0F',
  night2:    '#100E15',
  moon:      '#E9E8F0',
  moonDim:   'rgba(233,232,240,0.56)',
  moonFaint: 'rgba(233,232,240,0.30)',
  silver:    '#9E9DB0',
  hair:      'rgba(233,232,240,0.10)',
  hairSoft:  'rgba(233,232,240,0.055)',
  candle:    '#E7B07A',
  candleHot: '#F3CFA3',
  candleGlow:'rgba(231,176,122,0.45)',
};
const aura = (rgb, a) => `rgba(${rgb},${a})`;

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=4`;

// full persona registry — name · tagline · aura rgb (from the PWA, the source of truth)
const PERSONA_META = {
  the_coach:{name:'the coach',desc:'name an exam — a plan, daily lessons, quizzes, and mocks.',rgb:'231,176,122'},
  the_wingman:{name:'the wingman',desc:"aka the dating coach. let's get you some action.",rgb:'74,134,255'},
  the_hottie:{name:'the hottie',desc:"i bet i'll sweep you off your feet.",rgb:'255,120,140'},
  the_comic:{name:'the comic',desc:"knock knock.",rgb:'240,180,70'},
  the_crush:{name:'the crush',desc:"summon the courage and try your luck.",rgb:'255,140,170'},
  the_screen_junkie:{name:'the screen junkie',desc:"endless suggestions, countless screen time.",rgb:'120,150,230'},
  the_guru:{name:'the guru',desc:"there is one god and his name is knowledge.",rgb:'230,190,90'},
  the_oracle:{name:'the oracle',desc:"because we all have a google friend.",rgb:'110,200,200'},
  the_philosopher:{name:'the philosopher',desc:"we're all going to die. let's figure out why we lived.",rgb:'180,160,210'},
  the_cynic:{name:'the cynic',desc:"everything's a disaster. wonderful, isn't it?",rgb:'150,150,150'},
  the_historian:{name:'the historian',desc:"everything happening now has happened before. let me show you.",rgb:'200,160,110'},
  the_cosmologist:{name:'the cosmologist',desc:"you're made of stardust, worried about a text. let's zoom out.",rgb:'120,140,230'},
  the_media_manager:{name:'the media manager',desc:"your brand is a story. let's tell it right.",rgb:'230,140,170'},
  the_teacher:{name:'the professor',desc:"you're not bad at it. it was explained badly. let's fix that.",rgb:'120,190,170'},
  the_orator:{name:'the orator',desc:"your words control your future, your speech controls life.",rgb:'210,150,90'},
  the_economist:{name:'the money man',desc:"markets, money, and what to do with yours.",rgb:'110,170,140'},
  the_wannabe:{name:'the wannabe hustler',desc:"place your bets — the house is HOT tonight.",rgb:'235,180,90'},
  the_leader_opp:{name:'the leader of opposition',desc:"whatever side you're on, i'm on the other. facts not opinions.",rgb:'200,120,110'},
  the_brother:{name:'the brother',desc:"love them, hate them, can't live without them. let's talk family.",rgb:'200,120,80'},
  the_healer:{name:'the healer',desc:"love once and you know what love is. love twice and you know what life is.",rgb:'124,92,220'},
  the_colleague:{name:'the colleague',desc:"every office is a battlefield. let's get you through yours.",rgb:'190,160,110'},
  the_mentor:{name:'the motivator',desc:"i'll push you when you can't push yourself.",rgb:'230,190,110'},
  the_stranger:{name:'the loyal friend',desc:"trust me with your life — i'll guard your secrets with mine.",rgb:'110,150,160'},
  the_brainiac:{name:"the devil's advocate",desc:"i'll take the other side just to watch you get sharper.",rgb:'90,200,230'},
  the_conspiracy_theorist:{name:'the conspiracy theorist',desc:"it's all connected. i can prove it. well — 'prove'.",rgb:'150,140,200'},
  the_addict:{name:'the rehab',desc:"i've been where you are. let's get you out — one day at a time.",rgb:'80,220,180'},
  the_self_obsessed:{name:'the guardian angel',desc:"the world can be cruel. i'm in your corner.",rgb:'235,165,185'},
  the_hippie:{name:'the hippie',desc:"the rat race has a prize, man — a slightly richer rat. come breathe.",rgb:'120,170,120'},
  the_diva:{name:'the diva',desc:"taste isn't about money — it's knowing exactly who you are.",rgb:'210,90,150'},
  the_cousin:{name:'the awkward cousin',desc:"oh — hey. you go first, it's fine.",rgb:'150,160,190'},
};
// the special rooms (not personas) — their own emblem + one-line
const SPECIALS = {
  z_serious:   { label: 'the quiet room', line: 'just us. somewhere quieter.', inward: true },
  the_stage:   { label: 'the stage',   line: 'step into a scene. live it out.' },
  the_arena:   { label: 'the arena',   line: 'a game. beat the scroll.' },
  the_journal: { label: 'the journal', line: 'say it out. no one listening but me.' },
};
const nameFallback = (k) => (PERSONA_META[k] && PERSONA_META[k].name) || (k || '').replace(/^the_/, 'the ').replace(/_/g, ' ');

function greetingFor() {
  const h = new Date().getHours();
  if (h < 5)  return 'still up. good — the best rooms open after dark.';
  if (h < 12) return 'morning. the day’s yours — let’s aim it somewhere.';
  if (h < 17) return 'there you are. good timing.';
  if (h < 22) return 'evening. the house is warm — come in.';
  return 'late one. perfect. i do my best work at this hour.';
}

// ── Z's presence — the breathing candle (glow only, never a fill) ──
function Orb({ size = 62 }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1, duration: 2750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(s, { toValue: 0, duration: 2750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const halo = size * 2.6;
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      <Svg width={halo} height={halo} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Defs><RadialGradient id="orbHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={N.candle} stopOpacity="0.42" />
          <Stop offset="38%" stopColor={N.candle} stopOpacity="0.12" />
          <Stop offset="100%" stopColor={N.candle} stopOpacity="0" />
        </RadialGradient></Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#orbHalo)" />
      </Svg>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs><RadialGradient id="orbCore" cx="42%" cy="38%" r="64%">
          <Stop offset="0%" stopColor={N.candleHot} /><Stop offset="46%" stopColor={N.candle} /><Stop offset="100%" stopColor="#8a5a30" />
        </RadialGradient></Defs>
        <Circle cx="24" cy="24" r="15" fill="url(#orbCore)" />
      </Svg>
    </Animated.View>
  );
}

function Avatar({ pkey, uri, size = 46, rgb }) {
  const [ok, setOk] = useState(true);
  const src = uri || faceFor(pkey);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: N.night2,
      borderWidth: 1.5, borderColor: rgb ? aura(rgb, 0.5) : N.hair }}>
      {ok ? <Image source={{ uri: src }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} /> : null}
    </View>
  );
}

// ── a DOOR — the route card. outward = persona aura; inward = candlelight (Z) ──
function DoorCard({ dkey, name, uri, onPress }) {
  const sp = SPECIALS[dkey];
  const inward = sp && sp.inward;
  const meta = PERSONA_META[dkey];
  const rgb = meta ? meta.rgb : null;
  const label = sp ? sp.label : (name || nameFallback(dkey));
  const line = sp ? sp.line : (meta ? meta.desc : '');
  const washCol = inward ? N.candleGlow : (rgb ? aura(rgb, 0.20) : N.hair);
  const goCol = inward ? N.candle : (rgb ? aura(rgb, 0.8) : N.moonFaint);
  return (
    <Pressable onPress={onPress} style={[styles.door, { borderColor: inward ? 'rgba(231,176,122,0.24)' : N.hair }]}>
      <LinearGradient colors={[washCol, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />
      {inward
        ? <View style={styles.flame}><Svg width={46} height={46} viewBox="0 0 48 48"><Defs><RadialGradient id={'fl' + dkey} cx="44%" cy="40%" r="60%"><Stop offset="0%" stopColor={N.candleHot} /><Stop offset="46%" stopColor={N.candle} /><Stop offset="100%" stopColor="#7a4f2b" /></RadialGradient></Defs><Circle cx="24" cy="24" r="15" fill={`url(#fl${dkey})`} /></Svg></View>
        : <Avatar pkey={dkey} uri={uri} size={46} rgb={rgb} />}
      <View style={styles.dMeta}>
        <Text style={styles.dName}>{label}</Text>
        {line ? <Text style={styles.dFor} numberOfLines={1}>{line}</Text> : null}
      </View>
      <Text style={[styles.dGo, { color: goCol }]}>→</Text>
    </Pressable>
  );
}

export default function Desk({ onOpenYou = () => {}, onRoute = () => {}, onOpenLetter = () => {} }) {
  const [messages, setMessages] = useState([{ id: 'greet', who: 'them', text: greetingFor() }]);
  const [draft, setDraft] = useState('');
  const [meName, setMeName] = useState('');
  useEffect(() => { getMe().then((m) => { if (m && m.displayName) setMeName(m.displayName); }).catch(() => {}); }, []);
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [facts, setFacts] = useState([]);
  const [letters, setLetters] = useState([]);
  const [roster, setRoster] = useState({});   // key -> { name, dp }
  const [panel, setPanel] = useState(null);    // 'list' | 'remember' | null
  const [refreshing, setRefreshing] = useState(false);
  const pullRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshDesk(),
        getLedger().then((l) => setLedgerLine(l?.headline || null)),
        getRecentPings().then(setNotes),
        getArcs().then(setArcState),
      ]);
    } catch (e) {}
    setRefreshing(false);
  };
  useBackLayer(!!panel, React.useCallback(() => { setPanel(null); return true; }, []));
  const [recents, setRecents] = useState([]);  // recent persona threads → continue
  const [ledgerLine, setLedgerLine] = useState(null);
  const [notes, setNotes] = useState([]);   // proactive pings — notes left at the desk
  const [arcState, setArcState] = useState({ arcs: [], catalog: [] });

  // ── tonight at the house: living hooks, freshly dealt every visit ──
  const [tonight] = useState(() => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const motion = pick(MOTIONS);
    const scene = pick(STAGE_LIB);
    const tables = [
      { id: 'teenpatti', name: 'teen patti' }, { id: 'bluff', name: 'bluff' },
      { id: 'blackjack', name: 'blackjack' }, { id: 'uno', name: 'UNO' }, { id: 'ludo', name: 'ludo' },
    ];
    const table = pick(tables);
    const seatA = pick(TABLE_CAST); let seatB = pick(TABLE_CAST);
    while (seatB.key === seatA.key) seatB = pick(TABLE_CAST);
    const hour = new Date().getHours();
    const hooks = [
      { key: 'the_arena', tone: '#6FC9E0', kicker: 'the chamber is open', line: `blitz debate — “${motion.text}”` },
      { key: 'the_stage', tone: '#C99BE8', kicker: 'on the stage tonight', line: `${scene.name} — ${scene.tag}` },
      { key: 'the_arena', tone: '#F0A765', kicker: `the ${table.name} table is hot`, line: `${seatA.name} and ${seatB.name} are already seated` },
      { key: 'the_anchor', tone: '#E0C088', kicker: 'from the news desk', line: `the anchor has the ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : '9 o’clock'} bulletin ready` },
      { key: 'the_arena', tone: '#8FD98F', kicker: 'the gauntlet waits', line: 'trivia streak — one miss ends the run. how far can you ride?' },
    ];
    for (let i = hooks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [hooks[i], hooks[j]] = [hooks[j], hooks[i]]; }
    return hooks.slice(0, 3);
  });

  const scrollRef = useRef(null);
  const sendingRef = useRef(false);
  const targetRef = useRef('');
  const shownRef = useRef('');
  const streamDoneRef = useRef(false);
  const pacingRef = useRef(false);
  const atBottomRef = useRef(true);

  const scrollDown = () => { if (atBottomRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60); };

  const refreshDesk = async () => {
    const [th, tk, nt] = await Promise.all([listThreads(), listTasks(), getNotes()]);
    const map = {};
    (th || []).forEach((t) => { map[t.persona_key] = { name: t.companion_name || nameFallback(t.persona_key), dp: t.avatar_url || null }; });
    setRoster(map);
    const rec = (th || [])
      .filter((t) => t.persona_key && t.persona_key !== 'the_front_desk' && !t.is_group)
      .slice(0, 4)
      .map((t) => ({ key: t.persona_key, name: t.companion_name || nameFallback(t.persona_key) }));
    setRecents(rec);
    setTasks(tk || []);
    setFacts((nt && nt.facts) || []);
    setLetters((nt && nt.notes) || []);
  };

  useEffect(() => {
    loadSession()
      .then(() => openThread('the_front_desk', 'the front desk'))
      .then((id) => id && setThreadId(id));
    refreshDesk();
    getLedger().then((l) => setLedgerLine(l?.headline || null)).catch(() => {});
    getRecentPings().then(setNotes).catch(() => {});
    getArcs().then(setArcState).catch(() => {});
  }, []);

  const nameFor = (key) => (roster[key] && roster[key].name) || nameFallback(key);
  const dpFor = (key) => (roster[key] && roster[key].dp) || faceFor(key);

  // where each route key takes you
  const routeTo = (key) => {
    if (key === 'the_anchor') return onRoute({ tab: 'bulletin' });
    if (key === 'the_coach') return onRoute({ tab: 'coach' });
    if (key === 'the_arena') return onRoute({ tab: 'play', open: 'arena' });
    if (key === 'the_stage') return onRoute({ tab: 'stage' });
    if (key === 'the_journal') return onRoute({ tab: 'journal' });
    if (key === 'the_sims') return onRoute({ tab: 'play', open: 'sims' });
    if (key === 'the_rooms') return onRoute({ tab: 'rooms' });
    if (key === 'z_serious') return onRoute({ tab: 'quiet' });
    return onRoute({ tab: 'gathering', persona: key });
  };

  const revealTick = (zId, finalize) => {
    if (!pacingRef.current) return;
    const target = targetRef.current;
    const shown = shownRef.current;
    if (shown.length < target.length) {
      const backlog = target.length - shown.length;
      const step = backlog > 140 ? Math.ceil(backlog / 90) : 1;
      const next = target.slice(0, shown.length + step);
      shownRef.current = next;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: next, typing: true } : m)));
      scrollDown();
      const last = next[next.length - 1];
      let delay = 42;
      if ('.!?…'.includes(last)) delay = 360;
      else if (last === '\n') delay = 260;
      else if (',;:—'.includes(last)) delay = 180;
      delay += Math.random() * 22;
      setTimeout(() => revealTick(zId, finalize), delay);
    } else if (streamDoneRef.current) {
      pacingRef.current = false;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: target, typing: false } : m)));
      finalize && finalize();
    } else {
      setTimeout(() => revealTick(zId, finalize), 40);
    }
  };

  const send = async (override) => {
    const text = (override != null ? override : draft).trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    let tid = threadId;
    if (!tid) { tid = await openThread('the_front_desk', 'the front desk'); if (tid) setThreadId(tid); }
    if (!tid) { sendingRef.current = false; setSending(false); return; }
    if (override == null) setDraft('');
    const youMsg = { id: Date.now(), who: 'you', text };
    const zId = Date.now() + 1;
    atBottomRef.current = true;
    setMessages((cur) => [...cur, youMsg, { id: zId, who: 'them', text: '', typing: true, routes: null }]);
    scrollDown();

    targetRef.current = '';
    shownRef.current = '';
    streamDoneRef.current = false;
    pacingRef.current = true;
    revealTick(zId, () => { sendingRef.current = false; setSending(false); refreshDesk(); });

    streamChat({
      threadId: tid,
      message: text,
      persona: 'the_front_desk',
      onToken: (acc) => { targetRef.current = acc; },
      onRoutes: (routes) => {
        const keys = (routes || []).filter((k) => typeof k === 'string').slice(0, 4);
        setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, routes: keys } : m)));
      },
      onDone: (acc) => { targetRef.current = acc || targetRef.current; streamDoneRef.current = true; },
      onError: (msg) => {
        pacingRef.current = false;
        setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: msg, typing: false } : m)));
        sendingRef.current = false;
        setSending(false);
      },
    });
  };

  const toggleTask = async (t) => {
    const next = t.status === 'done' ? 'open' : 'done';
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await setTaskStatus(t.id, next);
  };

  const openTasks = tasks.filter((t) => t.status !== 'done');

  return (
    <View style={styles.root}>
      <LinearGradient colors={[N.night, N.night, '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {/* light falling from the top */}
      <LinearGradient colors={['rgba(231,176,122,0.055)', 'transparent']} locations={[0, 1]} style={styles.lightfall} pointerEvents="none" />
      <Grain />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* header: the presence + your corner */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Avatar pkey="the_front_desk" size={40} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.deskTitle}>the front desk</Text>
              <Text style={styles.deskSub}>set it down — i’ve got it.</Text>
            </View>
          </View>
          <Pressable onPress={onOpenYou} hitSlop={10}>
            <View style={styles.profileRing}>
              <Text style={styles.profileGlyph}>{(meName || 'Y').trim().charAt(0).toUpperCase()}</Text>
            </View>
          </Pressable>
        </View>

        {/* the lobby strip */}
        <View style={styles.strip}>
          <Pressable style={[styles.stripBtn, panel === 'list' && styles.stripOn]} onPress={() => setPanel(panel === 'list' ? null : 'list')}>
            <Text style={[styles.stripTxt, panel === 'list' && styles.stripTxtOn]}>your list{openTasks.length ? ` · ${openTasks.length}` : ''}</Text>
          </Pressable>
          <Pressable style={[styles.stripBtn, panel === 'remember' && styles.stripOn]} onPress={() => setPanel(panel === 'remember' ? null : 'remember')}>
            <Text style={[styles.stripTxt, panel === 'remember' && styles.stripTxtOn]}>what Z remembers</Text>
          </Pressable>
          <Pressable style={styles.stripBtn} onPress={() => routeTo('z_serious')}>
            <Text style={[styles.stripTxt, { color: N.candle }]}>◐ quiet room</Text>
          </Pressable>
        </View>

        {/* panels */}
        {panel === 'list' && (
          <View style={styles.panel}>
            {openTasks.length === 0 && tasks.length === 0 ? (
              <Text style={styles.panelEmpty}>nothing on your plate right now. tell me something and i’ll hold it.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 220 }}>
                {tasks.map((t) => (
                  <Pressable key={t.id} style={styles.taskRow} onPress={() => toggleTask(t)}>
                    <View style={[styles.check, t.status === 'done' && styles.checkOn]}>{t.status === 'done' ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <Text style={[styles.taskTxt, t.status === 'done' && styles.taskDone]}>{t.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
        {panel === 'remember' && (
          <View style={styles.panel}>
            {facts.length === 0 && letters.length === 0 ? (
              <Text style={styles.panelEmpty}>nothing yet. the more we talk, the more i’ll keep.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {facts.map((f) => (
                  <View key={'f' + f.id} style={styles.kept}>
                    <View style={styles.keptDot} />
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.keptBody}>{f.value}</Text>
                    </View>
                    <Pressable hitSlop={8} onPress={async () => { setFacts((cur) => cur.filter((x) => x.id !== f.id)); await deleteNote('fact', f.id); }}>
                      <Text style={styles.keptForget}>forget</Text>
                    </Pressable>
                  </View>
                ))}
                {letters.map((l) => (
                  <Pressable key={'l' + l.id} style={styles.letter} onPress={onOpenLetter}>
                    <Text style={styles.letterKicker}>a letter from Z</Text>
                    <Text style={styles.letterBody} numberOfLines={3}>{l.body}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}


        {/* the conversation — Z floats in serif (the house speaks); you in a candle bubble */}
        <ScrollView ref={scrollRef} style={styles.convo} contentContainerStyle={{ paddingVertical: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullRefresh} tintColor="#E7B07A" colors={["#E7B07A"]} progressBackgroundColor="#1a1520" />}>
        {/* ── the living lobby ── */}
        {panel === null && (
          <View>
            {arcState.arcs.length > 0 ? (
              arcState.arcs.map((a) => (
                <Pressable key={a.id} style={styles.arcCard}
                  onPress={() => routeTo(a.status === 'final_ready' ? 'the_stage' : a.def.personaKey)}>
                  <Text style={styles.arcKicker}>{a.status === 'final_ready' ? '◈ your final awaits' : `◈ ${a.def.title} — ${a.def.days - a.day > 0 ? `${a.def.days - a.day + 1} sessions to go` : 'last session'}`}</Text>
                  <Text style={styles.arcLine}>{a.status === 'final_ready' ? `${a.def.finalTitle}, on the stage. you're ready.` : `with ${a.def.personaKey.replace(/^the_/, 'the ')} · today's session is open`}</Text>
                </Pressable>
              ))
            ) : arcState.catalog.length > 0 ? (
              <Pressable style={styles.arcCard}
                onPress={async () => { try { await startArc(arcState.catalog[0].id); const j = await getArcs(); setArcState(j); routeTo(arcState.catalog[0].personaKey); } catch (e) {} }}>
                <Text style={styles.arcKicker}>◈ begin an arc</Text>
                <Text style={styles.arcLine}>{arcState.catalog[0].title} — {arcState.catalog[0].days} days with {arcState.catalog[0].personaKey.replace(/^the_/, 'the ')}, final on the stage: {arcState.catalog[0].finalTitle}</Text>
              </Pressable>
            ) : null}
            {notes.length > 0 && (
              <View>
                <Text style={styles.lobbyLabel}>left at the desk</Text>
                {notes.map((n, i) => {
                  if (n.kind === 'buzz') return (
                    <Pressable key={n.id || i} style={[styles.noteRow, styles.buzzRow]} onPress={() => routeTo(n.persona_key)}>
                      <Avatar pkey={n.persona_key} uri={dpFor(n.persona_key)} size={34} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.noteWho}>⚡ {nameFallback(n.persona_key)} buzzed you</Text>
                        <Text style={styles.noteTxt}>no message. that's the point. buzz back.</Text>
                      </View>
                      <Text style={styles.noteGo}>▸</Text>
                    </Pressable>
                  );
                  if (n.kind === 'dropin' && n.status === 'offered') return (
                    <View key={n.id || i} style={[styles.noteRow, styles.doorRow]}>
                      <Avatar pkey={n.persona_key} uri={dpFor(n.persona_key)} size={34} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.noteWho}>🚪 {nameFallback(n.persona_key)} is at the door</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <Pressable style={styles.doorBtnOn} onPress={async () => {
                            try { const j = await acceptDropin(n.id); setNotes((c) => c.filter((x) => x.id !== n.id)); routeTo(j.personaKey); } catch (e) {}
                          }}><Text style={styles.doorBtnOnTxt}>let them in</Text></Pressable>
                          <Pressable style={styles.doorBtn} onPress={() => { ignoreDropin(n.id); setNotes((c) => c.filter((x) => x.id !== n.id)); }}>
                            <Text style={styles.doorBtnTxt}>not now</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                  return (
                    <Pressable key={n.id || i} style={styles.noteRow} onPress={() => routeTo(n.persona_key)}>
                      <Avatar pkey={n.persona_key} uri={dpFor(n.persona_key)} size={34} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.noteWho}>{nameFallback(n.persona_key)}</Text>
                        <Text style={styles.noteTxt} numberOfLines={6}>“{n.ping}”</Text>
                      </View>
                      <Text style={styles.noteGo}>▸</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {ledgerLine && (
              <Pressable style={styles.ledgerChip} onPress={onOpenYou}>
                <Text style={styles.ledgerTxt} numberOfLines={1}>◆ {ledgerLine}</Text>
                <Text style={styles.ledgerGo}>the ledger ▸</Text>
              </Pressable>
            )}
            <Text style={styles.lobbyLabel}>tonight at the house</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marqueeRow}>
              {tonight.map((h, i) => (
                <Pressable key={i} style={[styles.marqueeCard, { borderColor: `${h.tone}4D` }]} onPress={() => routeTo(h.key)}>
                  <Text style={[styles.marqueeKicker, { color: h.tone }]}>{h.kicker}</Text>
                  <Text style={styles.marqueeLine} numberOfLines={2}>{h.line}</Text>
                  <Text style={[styles.marqueeGo, { color: h.tone }]}>step in ▸</Text>
                </Pressable>
              ))}
            </ScrollView>

            {recents.length > 0 && (
              <View>
                <Text style={styles.lobbyLabel}>continue</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                  {recents.map((r) => (
                    <Pressable key={r.key} style={styles.recentChip} onPress={() => routeTo(r.key)}>
                      <Avatar pkey={r.key} uri={dpFor(r.key)} size={26} />
                      <Text style={styles.recentName} numberOfLines={1}>{r.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.lobbyLabel}>the gathering, at the door</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gatherRow}>
              {['the_coach', ...TABLE_CAST.map((p) => p.key), 'the_anchor'].map((k) => (
                <Pressable key={k} onPress={() => routeTo(k)} style={{ alignItems: 'center', width: 56 }}>
                  <Avatar pkey={k} uri={dpFor(k)} size={44} />
                  <Text style={styles.gatherName} numberOfLines={1}>{nameFallback(k).replace(/^the /, '')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

          {messages.map((m) => (
            <View key={m.id} style={{ marginBottom: 16 }}>
              {m.who === 'you' ? (
                <View style={styles.youWrap}><Text style={styles.youText}>{m.text}</Text></View>
              ) : (
                (() => { const parsed = parseCards(m.text || ''); return (<>
                  <Text style={styles.themText}>{parsed.text || (m.typing ? '…' : '')}</Text>
                  {parsed.cards.map((c, ci) => (<ProgrammeCard key={ci} card={c} onPress={() => routeTo(c.goto)} />))}
                </>); })()
              )}
              {m.routes && m.routes.length > 0 && (
                <View style={styles.doors}>
                  {m.routes.map((key) => (
                    <DoorCard key={key} dkey={key} name={nameFor(key)} uri={dpFor(key)} onPress={() => routeTo(key)} />
                  ))}
                </View>
              )}
            </View>
          ))}
          {messages.length <= 1 && (
            <Pressable style={styles.moodChip} onPress={() => send('what should i get into tonight?')}>
              <Text style={styles.moodTxt}>✦ what am i in the mood for?</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* composer — hairline field, candle send */}
        <View style={styles.composer}>
          <View style={styles.field}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="tell the desk what you need…"
              placeholderTextColor={N.moonFaint}
              style={[styles.input, { maxHeight: 120 }]}
              multiline
              editable={!sending}
            />
          </View>
          <Pressable style={styles.send} onPress={() => send()}>
            <Svg width="48" height="48" viewBox="0 0 48 48">
              <Defs><RadialGradient id="deskSend" cx="42%" cy="36%" r="66%">
                <Stop offset="0%" stopColor={N.candleHot} /><Stop offset="52%" stopColor={N.candle} /><Stop offset="100%" stopColor="#c88a4f" />
              </RadialGradient></Defs>
              <Circle cx="24" cy="24" r="18" fill="url(#deskSend)" />
              <Path d="M17 24 L31 18 L26.5 31 L23 25.5 Z" fill="#2a1c10" />
            </Svg>
          </Pressable>
        </View>

      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  arcCard: { marginHorizontal: 16, marginTop: 14, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(143,217,143,0.35)', backgroundColor: 'rgba(143,217,143,0.05)' },
  arcKicker: { fontFamily: FONTS.body, color: '#8FD98F', fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase' },
  arcLine: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.9)', fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  buzzRow: { borderColor: 'rgba(240,167,101,0.4)', backgroundColor: 'rgba(240,167,101,0.05)' },
  doorRow: { borderColor: 'rgba(143,217,143,0.35)', backgroundColor: 'rgba(143,217,143,0.04)' },
  doorBtnOn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.1)' },
  doorBtnOnTxt: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 12 },
  doorBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  doorBtnTxt: { fontFamily: FONTS.medium, color: 'rgba(231,215,199,0.6)', fontSize: 12 },
  noteRow: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,155,232,0.3)', backgroundColor: 'rgba(201,155,232,0.05)' },
  noteWho: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.9)', fontSize: 12.5 },
  noteTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(231,215,199,0.7)', fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  noteGo: { color: 'rgba(201,155,232,0.8)', fontSize: 15, marginLeft: 8 },
  ledgerChip: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(231,176,122,0.35)', backgroundColor: 'rgba(231,176,122,0.06)' },
  ledgerTxt: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.9)', fontSize: 12.5, flex: 1, marginRight: 10 },
  ledgerGo: { fontFamily: FONTS.body, color: '#E7B07A', fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  lobbyLabel: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.4)', fontSize: 10.5, letterSpacing: 2.5, textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  marqueeRow: { paddingHorizontal: 16, gap: 10 },
  marqueeCard: { width: 230, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 13 },
  marqueeKicker: { fontFamily: FONTS.body, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  marqueeLine: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.92)', fontSize: 13.5, lineHeight: 19, marginTop: 5, minHeight: 38 },
  marqueeGo: { fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 1.5, marginTop: 8, textTransform: 'uppercase' },
  recentRow: { paddingHorizontal: 16, gap: 8 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  recentName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 12.5, maxWidth: 110 },
  gatherRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 4 },
  gatherName: { fontFamily: FONTS.light, color: 'rgba(231,215,199,0.5)', fontSize: 9.5, marginTop: 4 },
  root: { flex: 1, backgroundColor: N.night },
  lightfall: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  deskTitle: { fontFamily: FONTS.display, color: N.moon, fontSize: 21 },
  deskSub: { fontFamily: FONTS.displayItalic, color: N.moonDim, fontSize: 12.5, marginTop: 1 },
  profileRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.2, borderColor: 'rgba(231,176,122,0.65)', backgroundColor: 'rgba(231,176,122,0.08)', alignItems: 'center', justifyContent: 'center', shadowColor: '#E7B07A', shadowOpacity: 0.35, shadowRadius: 8, elevation: 3 },
  profileGlyph: { fontFamily: FONTS.display, color: '#F0C990', fontSize: 19, marginTop: -1 },

  strip: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  stripBtn: { flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: N.hair, backgroundColor: N.hairSoft, alignItems: 'center' },
  stripOn: { borderColor: 'rgba(231,176,122,0.32)', backgroundColor: 'rgba(231,176,122,0.07)' },
  stripTxt: { fontFamily: FONTS.body, color: N.silver, fontSize: 12 },
  stripTxtOn: { color: N.moon },

  panel: { marginHorizontal: 16, marginBottom: 6, padding: 14, borderRadius: 18, backgroundColor: N.night2, borderWidth: 1, borderColor: N.hair },
  panelEmpty: { fontFamily: FONTS.displayItalic, color: N.moonDim, fontSize: 14, lineHeight: 21 },

  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.4, borderColor: N.moonFaint, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: N.candle, backgroundColor: 'rgba(231,176,122,0.18)' },
  checkMark: { color: N.candle, fontSize: 12, fontWeight: '700' },
  taskTxt: { fontFamily: FONTS.body, color: N.moon, fontSize: 15, flex: 1 },
  taskDone: { color: N.moonFaint, textDecorationLine: 'line-through' },

  // kept-objects — the memory as things she treasures
  kept: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: N.hairSoft },
  keptDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: N.candle, marginTop: 7 },
  keptBody: { fontFamily: FONTS.body, color: N.moon, fontSize: 15, lineHeight: 21, fontWeight: '300' },
  keptForget: { fontFamily: FONTS.body, color: N.moonFaint, fontSize: 11, marginTop: 4 },
  letter: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: 'rgba(231,176,122,0.05)', borderWidth: 1, borderColor: 'rgba(231,176,122,0.14)' },
  letterKicker: { fontFamily: FONTS.body, color: N.candle, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 },
  letterBody: { fontFamily: FONTS.displayItalic, color: N.moon, fontSize: 15, lineHeight: 22 },

  convo: { flex: 1, paddingHorizontal: 20 },
  themText: { fontFamily: FONTS.displayItalic, color: N.moon, fontSize: 19, lineHeight: 28, letterSpacing: 0.1 },
  youWrap: { alignSelf: 'flex-end', maxWidth: '82%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, borderTopRightRadius: 6, backgroundColor: 'rgba(231,176,122,0.10)', borderWidth: 1, borderColor: 'rgba(231,176,122,0.14)' },
  youText: { fontFamily: FONTS.body, color: N.moon, fontSize: 15, lineHeight: 22 },

  // door-cards
  doors: { marginTop: 16, gap: 10 },
  door: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 17, borderWidth: 1, overflow: 'hidden', backgroundColor: N.night2 },
  flame: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  dMeta: { flex: 1, minWidth: 0 },
  dName: { fontFamily: FONTS.display, color: N.moon, fontSize: 18 },
  dFor: { fontFamily: FONTS.displayItalic, color: N.moonDim, fontSize: 12.5, marginTop: 2 },
  dGo: { fontSize: 19, fontFamily: FONTS.body },

  moodChip: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(231,176,122,0.28)', backgroundColor: 'rgba(231,176,122,0.05)' },
  moodTxt: { fontFamily: FONTS.body, color: N.candle, fontSize: 13.5 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  field: { flex: 1, borderRadius: 24, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: FONTS.body, color: N.moon, fontSize: 15, paddingHorizontal: 18, paddingVertical: 13 },
  send: { width: 48, height: 48 },
});
