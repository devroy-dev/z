// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE FRONT DESK (the landing page).
//  The lobby of callmeZ: Z at the desk, talking. The real concierge persona
//  (the_front_desk) — holds your list, remembers what matters, and knows every
//  room of the house. Its replies can surface tappable route chips that carry
//  you into a persona (Gathering), the Arena, the Stage, the journal, or the
//  quiet room. Names + faces come from what YOU named each persona.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { C, FONTS } from './theme';
import { loadSession, openThread, streamChat, listThreads, listTasks, setTaskStatus, getNotes, deleteNote } from './api';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

// default persona names — the fallback when the user hasn't renamed one yet.
// (custom names + faces come from GET /threads, resolved in nameFor/dpFor below.)
const DEFAULT_NAMES = {
  the_brother: 'the brother', the_cousin: 'the awkward cousin', the_wingman: 'the wingman',
  the_colleague: 'the colleague', the_comic: 'the comic', the_screen_junkie: 'the screen junkie',
  the_healer: 'the healer', the_stranger: 'the stranger', the_guru: 'the guru', the_hippie: 'the hippie',
  the_mentor: 'the motivator', the_oracle: 'the oracle', the_addict: 'the rehab',
  the_self_obsessed: 'the guardian angel', the_brainiac: 'the brainiac', the_philosopher: 'the philosopher',
  the_cosmologist: 'the cosmologist', the_historian: 'the historian', the_leader_opp: 'the leader of opposition',
  the_cynic: 'the cynic', the_crush: 'the crush', the_hottie: 'the hottie', the_diva: 'the diva',
  the_wannabe: 'the wannabe hustler', the_orator: 'the orator', the_media_manager: 'the media manager',
  the_teacher: 'the professor', the_economist: 'the economist',
};
// the special rooms (not personas) — their own labels + emblems
const SPECIALS = {
  the_stage:   { label: 'the Stage',   glyph: '🎭' },
  the_arena:   { label: 'the Arena',   glyph: '⚔' },
  the_journal: { label: 'the journal', glyph: '✎' },
  z_serious:   { label: 'the quiet room', glyph: '◐' },
};
const prettify = (k) => (k || '').replace(/^the_/, 'the ').replace(/^mr_/, 'mr ').replace(/_/g, ' ');

function greetingFor() {
  const h = new Date().getHours();
  if (h < 5) return 'still up? i’m here.';
  if (h < 12) return 'morning. good to see you.';
  if (h < 17) return 'hey — good to see you back.';
  if (h < 22) return 'evening. glad you came by.';
  return 'late one. i’m glad you’re here.';
}

// the concierge presence — a warm bell at the desk
function DeskBell({ size = 44 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs><RadialGradient id="bell" cx="40%" cy="32%" r="72%">
        <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
      </RadialGradient></Defs>
      <Circle cx="24" cy="24" r="23" fill="url(#bell)" opacity="0.16" />
      <Path d="M14 30h20M24 13a8 8 0 018 8v9H16v-9a8 8 0 018-8z" stroke={C.ember} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M24 13v-2M22.5 11h3" stroke={C.ember} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Avatar({ pkey, uri, size = 28 }) {
  const [ok, setOk] = useState(true);
  const src = uri || faceFor(pkey);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' }}>
      {ok ? <Image source={{ uri: src }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} /> : null}
    </View>
  );
}

export default function Desk({ onOpenYou = () => {}, onRoute = () => {}, onOpenLetter = () => {} }) {
  const [messages, setMessages] = useState([{ id: 'greet', who: 'them', text: greetingFor() }]);
  const [draft, setDraft] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [facts, setFacts] = useState([]);
  const [letters, setLetters] = useState([]);
  const [roster, setRoster] = useState({});   // key -> { name, dp }
  const [panel, setPanel] = useState(null);    // 'list' | 'remember' | null

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
    (th || []).forEach((t) => { map[t.persona_key] = { name: t.companion_name || DEFAULT_NAMES[t.persona_key], dp: t.avatar_url || null }; });
    setRoster(map);
    setTasks(tk || []);
    setFacts((nt && nt.facts) || []);
    setLetters((nt && nt.notes) || []);
  };

  useEffect(() => {
    loadSession()
      .then(() => openThread('the_front_desk', 'the front desk'))
      .then((id) => id && setThreadId(id));
    refreshDesk();
  }, []);

  const nameFor = (key) => (roster[key] && roster[key].name) || DEFAULT_NAMES[key] || prettify(key);
  const dpFor = (key) => (roster[key] && roster[key].dp) || faceFor(key);

  // where each route key takes you
  const routeTo = (key) => {
    if (key === 'the_arena') return onRoute({ tab: 'play', open: 'arena' });
    if (key === 'the_stage') return onRoute({ tab: 'stage' });
    if (key === 'the_journal') return onRoute({ tab: 'journal' });
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
      <LinearGradient colors={['#1A1020', '#0E0912', C.void]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* header: the desk + your profile corner */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <DeskBell size={40} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.deskTitle}>the front desk</Text>
              <Text style={styles.deskSub}>set it down — i’ve got it.</Text>
            </View>
          </View>
          <Pressable onPress={onOpenYou} hitSlop={10} style={styles.profile}>
            <View style={styles.profileRing}><Text style={styles.profileGlyph}>you</Text></View>
          </Pressable>
        </View>

        {/* the lobby strip: your list · what Z remembers · the quiet room */}
        <View style={styles.strip}>
          <Pressable style={[styles.stripBtn, panel === 'list' && styles.stripOn]} onPress={() => setPanel(panel === 'list' ? null : 'list')}>
            <Text style={styles.stripTxt}>your list{openTasks.length ? ` · ${openTasks.length}` : ''}</Text>
          </Pressable>
          <Pressable style={[styles.stripBtn, panel === 'remember' && styles.stripOn]} onPress={() => setPanel(panel === 'remember' ? null : 'remember')}>
            <Text style={styles.stripTxt}>what Z remembers</Text>
          </Pressable>
          <Pressable style={styles.stripBtn} onPress={() => routeTo('z_serious')}>
            <Text style={[styles.stripTxt, { color: C.ember }]}>◐ quiet room</Text>
          </Pressable>
        </View>

        {/* expandable panels */}
        {panel === 'list' && (
          <View style={styles.panel}>
            {openTasks.length === 0 && tasks.length === 0 ? (
              <Text style={styles.panelEmpty}>nothing on your list. mention something and i’ll keep it.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 200 }}>
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
              <Text style={styles.panelEmpty}>nothing yet. the more we talk, the more i’ll remember.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 240 }}>
                {facts.map((f) => (
                  <View key={'f' + f.id} style={styles.factRow}>
                    <Text style={styles.factTxt}>· {f.value}</Text>
                    <Pressable hitSlop={8} onPress={async () => { setFacts((cur) => cur.filter((x) => x.id !== f.id)); await deleteNote('fact', f.id); }}>
                      <Text style={styles.factX}>✕</Text>
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

        {/* the conversation with the concierge */}
        <ScrollView ref={scrollRef} style={styles.convo} contentContainerStyle={{ paddingVertical: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
          }}>
          {messages.map((m) => (
            <View key={m.id} style={{ marginBottom: 12 }}>
              <View style={[styles.bubbleWrap, m.who === 'you' ? styles.youWrap : styles.themWrap]}>
                <Text style={m.who === 'you' ? styles.youText : styles.themText}>{m.text || (m.typing ? '…' : '')}</Text>
              </View>
              {m.routes && m.routes.length > 0 && (
                <View style={styles.chips}>
                  {m.routes.map((key) => {
                    const sp = SPECIALS[key];
                    return (
                      <Pressable key={key} style={styles.chip} onPress={() => routeTo(key)}>
                        {sp ? <Text style={styles.chipGlyph}>{sp.glyph}</Text> : <Avatar pkey={key} uri={dpFor(key)} size={20} />}
                        <Text style={styles.chipTxt}>{sp ? sp.label : nameFor(key)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
          {messages.length <= 1 && (
            <Pressable style={styles.moodChip} onPress={() => send('help me figure out what i’m in the mood for tonight')}>
              <Text style={styles.moodTxt}>✦ what am i in the mood for?</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* composer */}
        <View style={styles.composer}>
          <BlurView intensity={24} tint="dark" style={styles.field}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="tell the desk what you need…"
              placeholderTextColor={C.faint}
              style={[styles.input, { maxHeight: 120 }]}
              multiline
              editable={!sending}
            />
          </BlurView>
          <Pressable style={styles.send} onPress={() => send()}>
            <Svg width="46" height="46" viewBox="0 0 48 48">
              <Defs><RadialGradient id="deskSend" cx="40%" cy="34%" r="70%">
                <Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
              </RadialGradient></Defs>
              <Circle cx="24" cy="24" r="23" fill="url(#deskSend)" />
              <Path d="M16 24 L32 17 L27 32 L23.5 25.5 Z" fill="#3A1505" />
            </Svg>
          </Pressable>
        </View>

      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  deskTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },
  deskSub: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 12.5, marginTop: 1 },
  profile: {},
  profileRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(243,168,95,0.3)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  profileGlyph: { fontFamily: FONTS.body, color: C.muted, fontSize: 11 },

  strip: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  stripBtn: { flex: 1, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center' },
  stripOn: { borderColor: 'rgba(243,168,95,0.4)', backgroundColor: 'rgba(243,168,95,0.08)' },
  stripTxt: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },

  panel: { marginHorizontal: 16, marginBottom: 6, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  panelEmpty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.4, borderColor: C.faint, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { borderColor: C.ember, backgroundColor: 'rgba(243,168,95,0.18)' },
  checkMark: { color: C.ember, fontSize: 12, fontWeight: '700' },
  taskTxt: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, flex: 1 },
  taskDone: { color: C.faint, textDecorationLine: 'line-through' },
  factTxt: { fontFamily: FONTS.body, color: C.muted, fontSize: 13.5, paddingVertical: 5, lineHeight: 20, flex: 1 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factX: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, paddingHorizontal: 4 },
  letter: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(243,168,95,0.06)', borderWidth: 1, borderColor: 'rgba(243,168,95,0.14)' },
  letterKicker: { fontFamily: FONTS.body, color: C.ember, fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  letterBody: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 14, lineHeight: 21 },

  convo: { flex: 1, paddingHorizontal: 18 },
  bubbleWrap: { maxWidth: '86%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20 },
  themWrap: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.05)', borderTopLeftRadius: 6 },
  youWrap: { alignSelf: 'flex-end', backgroundColor: 'rgba(243,168,95,0.14)', borderTopRightRadius: 6 },
  themText: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 15, lineHeight: 22 },
  youText: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, lineHeight: 22 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', backgroundColor: 'rgba(255,255,255,0.03)' },
  chipGlyph: { fontSize: 14 },
  chipTxt: { fontFamily: FONTS.body, color: C.cream, fontSize: 13 },

  moodChip: { alignSelf: 'flex-start', marginTop: 4, marginLeft: 4, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', backgroundColor: 'rgba(243,168,95,0.06)' },
  moodTxt: { fontFamily: FONTS.body, color: C.ember, fontSize: 13.5 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  field: { flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  input: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12 },
  send: { width: 46, height: 46 },
});
