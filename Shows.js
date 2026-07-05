// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE SHOWS. The Play door where the cast performs: STORY COLLAB
//  (write a story round-robin with the personas) and THE TRAITORS (watch the
//  deception play out — you see every role; the faithful don't). Its own world.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Grain from './Grain';
import { FONTS } from './theme';
import { TABLE_CAST } from './games/personas';
import { traitorsStart, traitorsStep, storyStart, storyStep, storyPublish } from './api';

const P = {
  ground: '#0C0A08', panelSoft: 'rgba(255,255,255,0.03)', line: 'rgba(231,215,199,0.08)',
  cream: '#F3EBDF', muted: '#9C8F96', faint: '#5F5560',
  ember: '#E7B07A', story: '#C9A86A', traitor: '#D9607A', good: '#8FBF9A',
};
const nameOf = (k) => (TABLE_CAST.find((p) => p.key === k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));
const toneOf = (k) => (TABLE_CAST.find((p) => p.key === k)?.tone || P.ember);

// ── shared persona picker ───────────────────────────────────────────────
function Picker({ selected, onToggle, min, max, accent }) {
  return (
    <View style={s.picker}>
      {TABLE_CAST.map((p) => {
        const on = selected.includes(p.key);
        const full = selected.length >= max && !on;
        return (
          <Pressable key={p.key} disabled={full} onPress={() => onToggle(p.key)}
            style={[s.pill, on && { backgroundColor: accent, borderColor: accent }, full && { opacity: 0.35 }]}>
            <Text style={[s.pillT, on && { color: P.ground }]}>{p.name.replace(/^the /, '')}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Head({ title, eyebrow, onBack, accent }) {
  return (
    <View style={s.head}>
      <Pressable onPress={onBack} hitSlop={14} style={{ width: 26 }}><Text style={s.back}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[s.eyebrow, accent && { color: accent }]}>{eyebrow}</Text>
        <Text style={s.headTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={{ width: 20 }} />
    </View>
  );
}

// ══ STORY COLLAB ════════════════════════════════════════════════════════
function Story({ onBack }) {
  const [phase, setPhase] = useState('setup');   // setup | play | published
  const [cast, setCast] = useState(['the_historian', 'the_philosopher', 'the_comic']);
  const [mode, setMode] = useState('coherent');
  const [premise, setPremise] = useState('');
  const [view, setView] = useState(null);
  const [id, setId] = useState(null);
  const [pub, setPub] = useState(null);
  const [draft, setDraft] = useState('');
  const [human, setHuman] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn) => { if (busy) return; setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong.'); } setBusy(false); };
  const begin = () => run(async () => {
    if (cast.length < 2) { setErr('Pick at least two writers.'); return; }
    const r = await storyStart(cast, { mode, premise: premise.trim(), humanPlays: human, rounds: 2 });
    setId(r.storyId); setView(r.view); setPhase('play');
  });
  const step = (text) => run(async () => { const r = await storyStep(id, text); setView(r.view); setDraft(''); });
  const publish = () => run(async () => { setPub(await storyPublish(id)); setPhase('published'); });

  if (phase === 'setup') return (
    <>
      <Head title="Story Collab" eyebrow="WRITE IT TOGETHER" onBack={onBack} accent={P.story} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.lead}>A story, one paragraph each.</Text>
          <Text style={s.sub}>Pick your writers — their voices set the genre. The historian and philosopher turn literary; the comic and conspiracy theorist turn absurd.</Text>

          <Text style={s.lbl}>THE WRITERS · {cast.length}/4</Text>
          <Picker selected={cast} onToggle={(k) => setCast((c) => c.includes(k) ? c.filter((x) => x !== k) : [...c, k])} min={2} max={4} accent={P.story} />

          <Text style={s.lbl}>THE MODE</Text>
          <View style={s.modeRow}>
            {[['coherent', 'Coherent', 'one story, built with care'], ['chaos', 'Chaos', 'exquisite-corpse — swerve & surprise']].map(([m, t, d]) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[s.modeCard, mode === m && { borderColor: P.story, backgroundColor: 'rgba(201,168,106,0.06)' }]}>
                <Text style={[s.modeT, mode === m && { color: P.story }]}>{t}</Text>
                <Text style={s.modeD}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.lbl}>THE PREMISE (OPTIONAL)</Text>
          <TextInput style={s.input} value={premise} onChangeText={setPremise} placeholder="e.g. a lighthouse keeper finds a door in the sea" placeholderTextColor={P.faint} multiline />

          <Pressable onPress={() => setHuman((h) => !h)} style={s.check}>
            <View style={[s.box, human && { backgroundColor: P.story, borderColor: P.story }]}>{human && <Text style={s.boxT}>✓</Text>}</View>
            <Text style={s.checkT}>I'll write too (take a turn in the rotation)</Text>
          </Pressable>

          <Pressable style={[s.cta, { backgroundColor: P.story }, busy && { opacity: 0.55 }]} onPress={begin} disabled={busy}>
            <Text style={s.ctaT}>{busy ? 'Setting the scene…' : 'Begin the story'}</Text>
          </Pressable>
          {!!err && <Text style={s.err}>{err}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );

  if (phase === 'play' && view) {
    const done = view.status === 'done';
    const yourTurn = view.yourTurn;
    return (
      <>
        <Head title="Story Collab" eyebrow={done ? 'FINISHED' : `ROUND ${view.round} OF ${view.maxRounds}`} onBack={onBack} accent={P.story} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {!!view.premise && <Text style={s.premise}>{view.premise}</Text>}
            {(view.paragraphs || []).map((p, i) => (
              <View key={i} style={s.para}>
                <Text style={[s.paraName, { color: toneOf(view.players?.[p.seat]?.name ? '' : '') || P.story }]}>{p.name}</Text>
                <Text style={s.paraText}>{p.text}</Text>
              </View>
            ))}
            {!done && !yourTurn && (
              <Pressable style={[s.cta, { backgroundColor: P.story }, busy && { opacity: 0.55 }]} onPress={() => step()} disabled={busy}>
                <Text style={s.ctaT}>{busy ? `${view.turnName} is writing…` : `Let ${view.turnName} write →`}</Text>
              </Pressable>
            )}
            {!done && yourTurn && (
              <View style={{ marginTop: 20 }}>
                <Text style={s.lbl}>YOUR PARAGRAPH</Text>
                <TextInput style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]} value={draft} onChangeText={setDraft} placeholder="continue the story…" placeholderTextColor={P.faint} multiline />
                <Pressable style={[s.cta, { backgroundColor: P.story, marginTop: 12 }, (busy || draft.trim().length < 3) && { opacity: 0.55 }]} onPress={() => draft.trim().length >= 3 && step(draft)} disabled={busy || draft.trim().length < 3}>
                  <Text style={s.ctaT}>Add my paragraph</Text>
                </Pressable>
              </View>
            )}
            {done && (
              <Pressable style={[s.cta, { backgroundColor: P.story }, busy && { opacity: 0.55 }]} onPress={publish} disabled={busy}>
                <Text style={s.ctaT}>{busy ? 'Publishing…' : 'Publish this story'}</Text>
              </Pressable>
            )}
            {!!err && <Text style={s.err}>{err}</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      </>
    );
  }

  if (phase === 'published' && pub) return (
    <>
      <Head title="Published" eyebrow="YOURZ STORIES" onBack={onBack} accent={P.story} />
      <ScrollView contentContainerStyle={s.scroll}>
        {!!pub.premise && <Text style={s.pubTitle}>{pub.premise}</Text>}
        <Text style={s.byline}>by {(pub.byline || []).join(', ')}</Text>
        <View style={s.rule} />
        <Text style={s.pubText}>{pub.text}</Text>
        <Pressable style={[s.ghost, { borderColor: P.story }]} onPress={onBack}><Text style={[s.ghostT, { color: P.story }]}>Back to shows</Text></Pressable>
      </ScrollView>
    </>
  );

  return <View style={s.center}><ActivityIndicator color={P.story} /></View>;
}

// ══ THE TRAITORS ════════════════════════════════════════════════════════
function Traitors({ onBack }) {
  const [phase, setPhase] = useState('setup');   // setup | play
  const [cast, setCast] = useState(['the_historian', 'the_comic', 'the_philosopher', 'the_brainiac', 'the_cynic']);
  const [view, setView] = useState(null);
  const [id, setId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn) => { if (busy) return; setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong.'); } setBusy(false); };
  const begin = () => run(async () => {
    if (cast.length < 4) { setErr('The Traitors needs at least four at the table.'); return; }
    const r = await traitorsStart(cast, {});   // you watch — the spectator sees every role
    setId(r.sessionId); setView(r.view); setPhase('play');
  });
  const step = () => run(async () => { const r = await traitorsStep(id, {}); setView(r.view); });

  if (phase === 'setup') return (
    <>
      <Head title="The Traitors" eyebrow="WATCH THE DECEPTION" onBack={onBack} accent={P.traitor} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.lead}>Some of them are lying.</Text>
        <Text style={s.sub}>Seat the table. A hidden traitor works to survive; the faithful try to root them out. You watch from above — you see every role. They don't.</Text>
        <Text style={s.lbl}>THE TABLE · {cast.length}/6</Text>
        <Picker selected={cast} onToggle={(k) => setCast((c) => c.includes(k) ? c.filter((x) => x !== k) : [...c, k])} min={4} max={6} accent={P.traitor} />
        <Pressable style={[s.cta, { backgroundColor: P.traitor }, busy && { opacity: 0.55 }]} onPress={begin} disabled={busy}>
          <Text style={s.ctaT}>{busy ? 'Seating the table…' : 'Begin the game'}</Text>
        </Pressable>
        {!!err && <Text style={s.err}>{err}</Text>}
      </ScrollView>
    </>
  );

  if (phase === 'play' && view) {
    const over = !!view.winner;
    return (
      <>
        <Head title="The Traitors" eyebrow={over ? 'THE GAME IS OVER' : `ROUND ${view.round} · ${(view.phase || '').toUpperCase()}`} onBack={onBack} accent={P.traitor} />
        <ScrollView contentContainerStyle={s.scroll}>
          {over && (
            <View style={[s.banner, { borderColor: view.winner === 'traitors' ? P.traitor : P.good }]}>
              <Text style={[s.bannerT, { color: view.winner === 'traitors' ? P.traitor : P.good }]}>
                {view.winner === 'traitors' ? 'The traitors win.' : 'The faithful win.'}
              </Text>
            </View>
          )}

          {/* the table — you see every role (dramatic irony) */}
          <Text style={s.lbl}>THE TABLE</Text>
          <View style={s.tableWrap}>
            {(view.players || []).map((pl) => (
              <View key={pl.seat} style={[s.seat, !pl.alive && { opacity: 0.4 }]}>
                <Text style={[s.seatName, !pl.alive && { textDecorationLine: 'line-through' }]}>{pl.name}</Text>
                {pl.role === 'traitor'
                  ? <Text style={[s.roleTag, { color: P.traitor }]}>traitor</Text>
                  : <Text style={[s.roleTag, { color: P.faint }]}>faithful</Text>}
              </View>
            ))}
          </View>

          {/* the roundtable — public talk + reveals */}
          <Text style={[s.lbl, { marginTop: 26 }]}>THE ROUNDTABLE</Text>
          {(view.log || []).map((l, i) => (
            l.phase === 'reveal' ? (
              <View key={i} style={s.reveal}>
                <Text style={s.revealT}>{l.text}</Text>
              </View>
            ) : (
              <View key={i} style={s.turn}>
                <Text style={[s.turnName, { color: P.traitor }]}>{l.name}</Text>
                <Text style={s.turnText}>{l.text}</Text>
              </View>
            )
          ))}

          {!over && (
            <Pressable style={[s.cta, { backgroundColor: P.traitor }, busy && { opacity: 0.55 }]} onPress={step} disabled={busy}>
              <Text style={s.ctaT}>{busy ? 'The table deliberates…' : view.phase === 'roundtable' ? 'To the banishment →' : 'Next round →'}</Text>
            </Pressable>
          )}
          {over && <Pressable style={[s.ghost, { borderColor: P.traitor }]} onPress={onBack}><Text style={[s.ghostT, { color: P.traitor }]}>Back to shows</Text></Pressable>}
          {!!err && <Text style={s.err}>{err}</Text>}
        </ScrollView>
      </>
    );
  }

  return <View style={s.center}><ActivityIndicator color={P.traitor} /></View>;
}

// ══ LANDING ═════════════════════════════════════════════════════════════
export default function Shows({ onBack = () => {} }) {
  const [open, setOpen] = useState(null);   // null | 'story' | 'traitors'

  const content = () => {
    if (open === 'story') return <Story onBack={() => setOpen(null)} />;
    if (open === 'traitors') return <Traitors onBack={() => setOpen(null)} />;
    return (
      <>
        <Head title="The Shows" eyebrow="THE CAST PERFORMS" onBack={onBack} accent={P.ember} />
        <ScrollView contentContainerStyle={s.scroll}>
          <Pressable style={[s.showCard, { borderColor: 'rgba(217,96,122,0.3)' }]} onPress={() => setOpen('traitors')}>
            <Text style={[s.showKick, { color: P.traitor }]}>SOCIAL DEDUCTION</Text>
            <Text style={s.showTitle}>The Traitors</Text>
            <Text style={s.showLine}>Seat the cast. A hidden traitor lies to survive; the faithful hunt them. You watch from above — you see every role, they don't.</Text>
          </Pressable>
          <Pressable style={[s.showCard, { borderColor: 'rgba(201,168,106,0.3)' }]} onPress={() => setOpen('story')}>
            <Text style={[s.showKick, { color: P.story }]}>CO-WRITING</Text>
            <Text style={s.showTitle}>Story Collab</Text>
            <Text style={s.showLine}>Write a story one paragraph at a time with the personas. Coherent or chaos — their voices set the genre. Publish the ones you love.</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  };

  return (
    <View style={s.root}>
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>{content()}</SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 6 },
  back: { color: P.muted, fontSize: 30, marginTop: -4 },
  eyebrow: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 9.5, letterSpacing: 3, opacity: 0.9 },
  headTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 19, marginTop: 1 },

  lead: { fontFamily: FONTS.display, color: P.cream, fontSize: 29, lineHeight: 35, marginTop: 8, letterSpacing: -0.5 },
  sub: { fontFamily: FONTS.body, color: P.muted, fontSize: 14.5, lineHeight: 21, marginTop: 11, marginBottom: 4 },
  lbl: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2.5, marginTop: 26, marginBottom: 12 },

  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: P.line, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: P.panelSoft },
  pillT: { fontFamily: FONTS.body, color: P.cream, fontSize: 13.5 },

  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 15, padding: 15, backgroundColor: P.panelSoft },
  modeT: { fontFamily: FONTS.semibold, color: P.cream, fontSize: 16 },
  modeD: { fontFamily: FONTS.body, color: P.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },

  input: { fontFamily: FONTS.body, color: P.cream, fontSize: 15.5, borderWidth: 1, borderColor: P.line, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: P.panelSoft },
  check: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  boxT: { color: P.ground, fontSize: 13, fontFamily: FONTS.semibold },
  checkT: { fontFamily: FONTS.body, color: P.muted, fontSize: 14, flex: 1 },

  cta: { borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  ctaT: { fontFamily: FONTS.semibold, color: P.ground, fontSize: 15.5 },
  ghost: { borderWidth: 1, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 26 },
  ghostT: { fontFamily: FONTS.medium, fontSize: 14.5 },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13.5, marginTop: 16, textAlign: 'center' },

  // landing
  showCard: { borderWidth: 1, borderRadius: 20, padding: 22, marginTop: 16, backgroundColor: P.panelSoft },
  showKick: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 2.5 },
  showTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 27, marginTop: 8, letterSpacing: -0.5 },
  showLine: { fontFamily: FONTS.body, color: P.muted, fontSize: 14, lineHeight: 20.5, marginTop: 10 },

  // story
  premise: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 15.5, lineHeight: 23, marginTop: 8, marginBottom: 4 },
  para: { marginTop: 22 },
  paraName: { fontFamily: FONTS.semibold, color: P.story, fontSize: 11.5, letterSpacing: 1.5, marginBottom: 7, textTransform: 'lowercase' },
  paraText: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.9)', fontSize: 15.5, lineHeight: 25 },
  pubTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 26, lineHeight: 32, marginTop: 8, letterSpacing: -0.4 },
  byline: { fontFamily: FONTS.displayItalic, color: P.story, fontSize: 14, marginTop: 8 },
  rule: { height: 1, backgroundColor: P.line, marginVertical: 20 },
  pubText: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.9)', fontSize: 16, lineHeight: 27 },

  // traitors
  banner: { borderWidth: 1, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 6, marginBottom: 6, backgroundColor: P.panelSoft },
  bannerT: { fontFamily: FONTS.display, fontSize: 22, letterSpacing: -0.3 },
  tableWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seat: { borderWidth: 1, borderColor: P.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: P.panelSoft, minWidth: '47%' },
  seatName: { fontFamily: FONTS.medium, color: P.cream, fontSize: 14 },
  roleTag: { fontFamily: FONTS.semibold, fontSize: 10.5, letterSpacing: 1, marginTop: 3 },
  turn: { marginTop: 16 },
  turnName: { fontFamily: FONTS.semibold, fontSize: 11.5, letterSpacing: 1, marginBottom: 5, textTransform: 'lowercase' },
  turnText: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.88)', fontSize: 14.5, lineHeight: 21 },
  reveal: { borderLeftWidth: 2, borderLeftColor: P.traitor, paddingLeft: 13, marginTop: 18, marginBottom: 2 },
  revealT: { fontFamily: FONTS.displayItalic, color: P.cream, fontSize: 14.5, lineHeight: 21 },
});
