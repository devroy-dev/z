// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE COACH. Name any exam; a web-grounded, day-by-day course that
//  teaches, quizzes, grades, and bends to your weak spots. Signature: the
//  progress SPINE — the syllabus is a connected journey, each day carrying
//  its full focus and, once done, its score.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from './Grain';
import { FONTS } from './theme';
import {
  coachStart, coachGet, coachLesson, coachQuiz, coachGrade, coachAsk,
  coachMockStart, coachMockSubmit,
} from './api';

// ── palette: yourZ warm-dark, disciplined. ember is the one light. ──
const P = {
  ground: '#0C0A08', panel: '#141019', panelSoft: 'rgba(255,255,255,0.028)',
  cream: '#F3EBDF', muted: '#9C8F96', faint: '#5F5560',
  ember: '#E7B07A', emberDim: 'rgba(231,176,122,0.5)', emberFaint: 'rgba(231,176,122,0.14)',
  line: 'rgba(231,215,199,0.08)', rose: '#F0708C', good: '#E7B07A',
};
const OPT = ['A', 'B', 'C', 'D'];
const KEY = 'coach_active_course';

export default function Coach({ onBack = () => {} }) {
  const [stage, setStage] = useState('loading');   // loading|home|lesson|quiz|result|mock|mockresult|ask
  const [course, setCourse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [topic, setTopic] = useState('');
  const [days, setDays] = useState('7');

  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  const [mock, setMock] = useState(null);
  const [mockAns, setMockAns] = useState([]);
  const [mockResult, setMockResult] = useState(null);

  const [askQ, setAskQ] = useState('');
  const [askA, setAskA] = useState(null);

  useEffect(() => { (async () => {
    try {
      const id = await AsyncStorage.getItem(KEY);
      if (id) { const c = await coachGet(id).catch(() => null); if (c && c.courseId) { setCourse(c); setStage('home'); return; } }
    } catch (e) {}
    setStage('home');
  })(); }, []);

  const run = async (fn) => { if (busy) return; setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong. Try again.'); } setBusy(false); };

  const start = () => run(async () => {
    const t = topic.trim(); if (t.length < 2) { setErr('Name the exam or subject to prepare for.'); return; }
    const c = await coachStart(t, Math.max(1, Math.min(parseInt(days, 10) || 7, 30)));
    await AsyncStorage.setItem(KEY, c.courseId);
    setCourse({ ...c, currentDay: 1, weakTags: [], days: {} });
    setStage('home');
  });
  const openLesson = () => run(async () => { setLesson(await coachLesson(course.courseId)); setStage('lesson'); });
  const openQuiz = () => run(async () => { const Q = await coachQuiz(course.courseId, 5); setQuiz(Q); setAnswers(new Array((Q.questions || []).length).fill(null)); setStage('quiz'); });
  const submitQuiz = () => run(async () => { setResult(await coachGrade(course.courseId, answers)); setStage('result'); });
  const continueNext = () => run(async () => { const c = await coachGet(course.courseId); setCourse(c); setLesson(null); setQuiz(null); setResult(null); setStage('home'); });
  const startMock = () => run(async () => { const M = await coachMockStart(course.courseId, 12, 20); setMock(M); setMockAns(new Array((M.questions || []).length).fill(null)); setStage('mock'); });
  const submitMock = () => run(async () => { setMockResult(await coachMockSubmit(course.courseId, mock.mockId, mockAns)); setStage('mockresult'); });
  const ask = () => run(async () => { const q = askQ.trim(); if (q.length < 3) return; const A = await coachAsk(course.courseId, q); setAskA(A); });
  const newCourse = async () => { await AsyncStorage.removeItem(KEY); setCourse(null); setTopic(''); setDays('7'); setAskA(null); setStage('home'); };

  // ── shared bits ─────────────────────────────────────────────────────
  const Head = ({ eyebrow, title, back, right }) => (
    <View style={s.head}>
      <Pressable onPress={back || onBack} hitSlop={14} style={s.backBtn}><Text style={s.back}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
        <Text style={s.headTitle} numberOfLines={1}>{title}</Text>
      </View>
      {right || <View style={{ width: 20 }} />}
    </View>
  );

  const Err = () => err ? <Text style={s.err}>{err}</Text> : null;

  const Question = ({ q, i, chosen, onPick, reveal }) => (
    <View style={s.qBlock}>
      <Text style={s.qNum}>Question {i + 1}</Text>
      <Text style={s.qText}>{q.q}</Text>
      {q.opts.map((o, k) => {
        const picked = chosen === k, right = reveal && reveal.correct === k, wrongPick = reveal && picked && reveal.correct !== k;
        return (
          <Pressable key={k} disabled={!!reveal} onPress={() => onPick && onPick(k)}
            style={[s.opt, picked && !reveal && s.optPicked, right && s.optRight, wrongPick && s.optWrong]}>
            <View style={[s.optDot, (picked && !reveal) && s.optDotPicked, right && s.optDotRight]}>
              <Text style={[s.optDotT, ((picked && !reveal) || right) && { color: P.ground }]}>{OPT[k]}</Text>
            </View>
            <Text style={[s.optT, right && { color: P.ember }]}>{o}</Text>
          </Pressable>
        );
      })}
      {reveal && !!reveal.why && <Text style={s.why}>{reveal.why}</Text>}
    </View>
  );

  // ── the progress SPINE: the syllabus as a connected journey ─────────
  const Spine = () => {
    const cur = course.currentDay || 1;
    return (
      <View style={{ marginTop: 8 }}>
        {(course.plan || []).map((p, i) => {
          const day = i + 1, done = course.days?.[String(day)]?.graded, isNow = day === cur && course.status !== 'done';
          const last = i === (course.plan.length - 1);
          return (
            <View key={i} style={s.spineRow}>
              <View style={s.spineCol}>
                <View style={[s.node, done && s.nodeDone, isNow && s.nodeNow]}>
                  <Text style={[s.nodeN, (done || isNow) && { color: P.ground }]}>{day}</Text>
                </View>
                {!last && <View style={[s.spineLine, done && { backgroundColor: P.emberDim }]} />}
              </View>
              <View style={[s.dayCard, isNow && s.dayCardNow, done && { opacity: 0.72 }]}>
                <View style={s.dayTop}>
                  <Text style={[s.dayTitle, isNow && { color: P.cream }]} numberOfLines={2}>{p.title}</Text>
                  {done && <Text style={s.dayScore}>{done.score}/{done.total}</Text>}
                </View>
                <Text style={s.dayFocus}>{p.focus}</Text>
                {isNow && (
                  <Pressable style={s.dayGo} onPress={openLesson} disabled={busy}>
                    <Text style={s.dayGoT}>{busy ? 'Opening…' : `Begin day ${day} →`}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const body = () => {
    if (stage === 'loading') return <View style={s.center}><ActivityIndicator color={P.ember} /></View>;

    // ── HOME ──
    if (stage === 'home') {
      if (!course) return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Text style={s.bigLead}>What are we{'\n'}preparing for?</Text>
            <Text style={s.leadSub}>Name any exam — CAT, CLAT, NEET, UPSC, GMAT — or a subject to learn. The coach checks the current syllabus and builds a day-by-day plan.</Text>
            <Text style={s.fieldLbl}>EXAM OR SUBJECT</Text>
            <TextInput style={s.input} value={topic} onChangeText={setTopic} placeholder="e.g. CAT quant" placeholderTextColor={P.faint} returnKeyType="done" />
            <Text style={s.fieldLbl}>HOW MANY DAYS</Text>
            <View style={s.daysRow}>
              {[5, 7, 14, 30].map((d) => (
                <Pressable key={d} onPress={() => setDays(String(d))} style={[s.dayChip, String(d) === days && s.dayChipOn]}>
                  <Text style={[s.dayChipT, String(d) === days && { color: P.ground }]}>{d}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={start} disabled={busy}>
              <Text style={s.ctaT}>{busy ? 'Checking the syllabus…' : 'Build my plan'}</Text>
            </Pressable>
            <Err />
          </ScrollView>
        </KeyboardAvoidingView>
      );

      const cur = course.currentDay || 1, total = course.totalDays || (course.plan || []).length;
      const done = course.status === 'done';
      const gradedCount = Object.values(course.days || {}).filter((d) => d.graded).length;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.courseEyebrow}>YOUR COURSE {done ? '· COMPLETE' : `· DAY ${cur} OF ${total}`}</Text>
          <Text style={s.courseTitle}>{course.topic}</Text>
          {/* segmented progress */}
          <View style={s.segs}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[s.seg, i < gradedCount && s.segDone, i === cur - 1 && !done && s.segNow]} />
            ))}
          </View>

          {/* actions */}
          <View style={s.actions}>
            <Pressable style={s.action} onPress={startMock} disabled={busy}>
              <Text style={s.actionIcon}>◎</Text><Text style={s.actionT}>Mock test</Text>
            </Pressable>
            <Pressable style={s.action} onPress={() => { setAskA(null); setStage('ask'); }} disabled={busy}>
              <Text style={s.actionIcon}>?</Text><Text style={s.actionT}>Ask the coach</Text>
            </Pressable>
          </View>

          <Text style={s.sectionLbl}>THE SYLLABUS</Text>
          <Spine />

          {!!(course.weakTags || []).length && (
            <View style={s.weak}>
              <Text style={s.weakLbl}>WORTH REVISITING</Text>
              <View style={s.chips}>{course.weakTags.map((t, i) => <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>)}</View>
            </View>
          )}
          <Pressable onPress={newCourse} style={{ marginTop: 26 }}><Text style={s.newCourse}>Start a different course</Text></Pressable>
          <Err />
        </ScrollView>
      );
    }

    // ── LESSON ──
    if (stage === 'lesson' && lesson) return (
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.dayBadge}>DAY {lesson.day}</Text>
        <Text style={s.lessonTitle}>{lesson.title}</Text>
        {!!lesson.focus && <Text style={s.lessonFocus}>{lesson.focus}</Text>}
        <View style={s.rule} />
        <Text style={s.lessonBody}>{lesson.lesson}</Text>
        {!!(lesson.citations || []).length && <Text style={s.cite}>◈ grounded in your material · {lesson.citations.map((c) => c.ref).join(', ')}</Text>}
        <Pressable style={s.cta} onPress={openQuiz} disabled={busy}><Text style={s.ctaT}>{busy ? 'Loading…' : 'Take the quiz'}</Text></Pressable>
        <Err />
      </ScrollView>
    );

    // ── QUIZ ──
    if (stage === 'quiz' && quiz) {
      const answered = answers.filter((a) => a !== null).length, all = answered === answers.length;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>DAY {quiz.day} · QUIZ</Text>
          <Text style={s.progTiny}>{answered} of {answers.length} answered</Text>
          {(quiz.questions || []).map((q, i) => <Question key={i} q={q} i={i} chosen={answers[i]} onPick={(k) => setAnswers((a) => { const n = [...a]; n[i] = k; return n; })} />)}
          <Pressable style={[s.cta, !all && s.ctaBusy]} onPress={all ? submitQuiz : undefined} disabled={!all || busy}>
            <Text style={s.ctaT}>{busy ? 'Grading…' : all ? 'Submit answers' : `Answer all ${answers.length}`}</Text>
          </Pressable>
          <Err />
        </ScrollView>
      );
    }

    // ── RESULT ──
    if (stage === 'result' && result) return (
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.dayBadge}>DAY {result.day} · RESULT</Text>
        <View style={s.scoreWrap}>
          <Text style={s.score}>{result.score}</Text><Text style={s.scoreOf}> / {result.total}</Text>
        </View>
        <Text style={s.scoreLine}>{result.score === result.total ? 'Clean sweep.' : result.score >= result.total / 2 ? 'Solid — a few to tighten.' : 'Tricky set — we\u2019ll reinforce these.'}</Text>
        {(quiz?.questions || []).map((q, i) => { const r = (result.results || []).find((x) => x.i === i) || {}; return <Question key={i} q={q} i={i} chosen={r.chosen} reveal={{ correct: r.correct, why: r.why }} />; })}
        {!!(result.weakTags || []).length && (
          <View style={s.weak}><Text style={s.weakLbl}>WE\u2019LL REINFORCE</Text><View style={s.chips}>{result.weakTags.map((t, i) => <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>)}</View></View>
        )}
        <Pressable style={s.cta} onPress={continueNext} disabled={busy}><Text style={s.ctaT}>{result.done ? 'Finish course' : `Continue to day ${result.nextDay} →`}</Text></Pressable>
        <Err />
      </ScrollView>
    );

    // ── MOCK ──
    if (stage === 'mock' && mock) {
      const answered = mockAns.filter((a) => a !== null).length, all = answered === mockAns.length;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>FULL MOCK · {mock.count} QUESTIONS</Text>
          <Text style={s.progTiny}>{answered} of {mockAns.length} answered</Text>
          {(mock.questions || []).map((q, i) => <Question key={i} q={q} i={i} chosen={mockAns[i]} onPick={(k) => setMockAns((a) => { const n = [...a]; n[i] = k; return n; })} />)}
          <Pressable style={[s.cta, !all && s.ctaBusy]} onPress={all ? submitMock : undefined} disabled={!all || busy}>
            <Text style={s.ctaT}>{busy ? 'Scoring…' : all ? 'Submit mock' : `Answer all ${mockAns.length}`}</Text>
          </Pressable>
          <Err />
        </ScrollView>
      );
    }

    // ── MOCK RESULT ──
    if (stage === 'mockresult' && mockResult) {
      const bd = Object.entries(mockResult.breakdown || {});
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>MOCK · RESULT</Text>
          <View style={s.scoreWrap}><Text style={s.score}>{mockResult.score}</Text><Text style={s.scoreOf}> / {mockResult.total}</Text></View>
          <Text style={s.sectionLbl}>BY TOPIC</Text>
          {bd.map(([tag, b]) => {
            const pct = b.total ? b.right / b.total : 0;
            return (
              <View key={tag} style={s.bdRow}>
                <View style={s.bdHead}><Text style={s.bdTag}>{tag}</Text><Text style={[s.bdScore, { color: pct === 1 ? P.ember : pct === 0 ? P.rose : P.muted }]}>{b.right}/{b.total}</Text></View>
                <View style={s.bdTrack}><View style={[s.bdFill, { width: `${Math.max(4, pct * 100)}%`, backgroundColor: pct === 0 ? P.rose : P.ember }]} /></View>
              </View>
            );
          })}
          <Pressable style={s.cta} onPress={() => setStage('home')}><Text style={s.ctaT}>Back to course</Text></Pressable>
        </ScrollView>
      );
    }

    // ── ASK ──
    if (stage === 'ask') return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.bigLead}>Ask the coach</Text>
          <Text style={s.leadSub}>A question on {course.topic}. If you\u2019ve uploaded material, the answer is grounded in it, with citations.</Text>
          <TextInput style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]} value={askQ} onChangeText={setAskQ} placeholder="e.g. explain the negotiation rule with an example" placeholderTextColor={P.faint} multiline />
          <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={ask} disabled={busy}><Text style={s.ctaT}>{busy ? 'Thinking…' : 'Ask'}</Text></Pressable>
          {!!askA && (
            <View style={s.answer}>
              <Text style={s.answerT}>{askA.answer}</Text>
              {!!(askA.citations || []).length && <Text style={s.cite}>◈ from your material · {askA.citations.map((c) => c.ref).join(', ')}</Text>}
            </View>
          )}
          <Err />
        </ScrollView>
      </KeyboardAvoidingView>
    );

    return <View style={s.center}><Text style={s.leadSub}>…</Text></View>;
  };

  const headFor = {
    home: course ? { eyebrow: 'THE COACH', title: 'Study desk', back: onBack } : { eyebrow: 'THE COACH', title: 'New course', back: onBack },
    lesson: { eyebrow: 'LESSON', title: course?.topic || 'Lesson', back: () => setStage('home') },
    quiz: { eyebrow: 'QUIZ', title: course?.topic || 'Quiz', back: () => setStage('home') },
    result: { eyebrow: 'RESULT', title: course?.topic || 'Result', back: () => setStage('home') },
    mock: { eyebrow: 'MOCK TEST', title: course?.topic || 'Mock', back: () => setStage('home') },
    mockresult: { eyebrow: 'MOCK', title: course?.topic || 'Mock', back: () => setStage('home') },
    ask: { eyebrow: 'ASK', title: course?.topic || 'Ask', back: () => setStage('home') },
  }[stage] || { eyebrow: 'THE COACH', title: 'Study desk', back: onBack };

  return (
    <View style={s.root}>
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {stage !== 'loading' && <Head {...headFor} />}
        {body()}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 56 },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 6 },
  backBtn: { width: 26 }, back: { color: P.muted, fontSize: 30, marginTop: -4 },
  eyebrow: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 9.5, letterSpacing: 3, opacity: 0.9 },
  headTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 19, marginTop: 1 },

  bigLead: { fontFamily: FONTS.display, color: P.cream, fontSize: 32, lineHeight: 38, marginTop: 10, letterSpacing: -0.5 },
  leadSub: { fontFamily: FONTS.body, color: P.muted, fontSize: 14.5, lineHeight: 21, marginTop: 12, marginBottom: 8 },
  fieldLbl: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2.5, marginTop: 24, marginBottom: 10 },
  input: { fontFamily: FONTS.body, color: P.cream, fontSize: 16.5, borderWidth: 1, borderColor: P.line, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: P.panelSoft },
  daysRow: { flexDirection: 'row', gap: 10 },
  dayChip: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: P.panelSoft },
  dayChipOn: { backgroundColor: P.ember, borderColor: P.ember },
  dayChipT: { fontFamily: FONTS.semibold, color: P.cream, fontSize: 16 },

  cta: { backgroundColor: P.ember, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  ctaBusy: { opacity: 0.55 },
  ctaT: { fontFamily: FONTS.semibold, color: P.ground, fontSize: 15.5, letterSpacing: 0.2 },
  err: { fontFamily: FONTS.body, color: P.rose, fontSize: 13.5, marginTop: 16, textAlign: 'center', lineHeight: 19 },

  courseEyebrow: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 10, letterSpacing: 2.5, marginTop: 6 },
  courseTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 28, lineHeight: 34, marginTop: 8, letterSpacing: -0.5 },
  segs: { flexDirection: 'row', gap: 5, marginTop: 18 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(231,215,199,0.1)' },
  segDone: { backgroundColor: P.ember },
  segNow: { backgroundColor: P.emberDim },

  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  action: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 15, paddingVertical: 16, alignItems: 'center', gap: 7, backgroundColor: P.panelSoft },
  actionIcon: { fontFamily: FONTS.display, color: P.ember, fontSize: 20 },
  actionT: { fontFamily: FONTS.medium, color: P.cream, fontSize: 13 },

  sectionLbl: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2.5, marginTop: 30, marginBottom: 6 },

  // the spine
  spineRow: { flexDirection: 'row', gap: 15 },
  spineCol: { alignItems: 'center', width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center', backgroundColor: P.ground },
  nodeDone: { backgroundColor: P.emberDim, borderColor: P.ember },
  nodeNow: { backgroundColor: P.ember, borderColor: P.ember, shadowColor: P.ember, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  nodeN: { fontFamily: FONTS.semibold, color: P.muted, fontSize: 13 },
  spineLine: { flex: 1, width: 1.5, backgroundColor: P.line, marginVertical: 3, minHeight: 20 },
  dayCard: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 15, marginBottom: 12, backgroundColor: P.panelSoft },
  dayCardNow: { borderColor: P.emberDim, backgroundColor: 'rgba(231,176,122,0.05)' },
  dayTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  dayTitle: { flex: 1, fontFamily: FONTS.semibold, color: 'rgba(243,235,223,0.82)', fontSize: 15, lineHeight: 20 },
  dayScore: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 13 },
  dayFocus: { fontFamily: FONTS.body, color: P.muted, fontSize: 13, lineHeight: 19.5, marginTop: 8 },
  dayGo: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: P.ember, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 16 },
  dayGoT: { fontFamily: FONTS.semibold, color: P.ground, fontSize: 13.5 },

  weak: { marginTop: 26, borderWidth: 1, borderColor: 'rgba(240,112,140,0.25)', borderRadius: 16, padding: 16, backgroundColor: 'rgba(240,112,140,0.045)' },
  weakLbl: { fontFamily: FONTS.semibold, color: P.rose, fontSize: 10, letterSpacing: 2.5, marginBottom: 12, opacity: 0.9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: P.line, borderRadius: 100, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: P.panelSoft },
  chipT: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.8)', fontSize: 12.5 },
  newCourse: { fontFamily: FONTS.displayItalic, color: P.faint, fontSize: 13.5, textAlign: 'center', textDecorationLine: 'underline' },

  dayBadge: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 10, letterSpacing: 2.5, marginTop: 6 },
  lessonTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 25, lineHeight: 31, marginTop: 9, letterSpacing: -0.4 },
  lessonFocus: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  rule: { height: 1, backgroundColor: P.line, marginVertical: 20 },
  lessonBody: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.9)', fontSize: 15.5, lineHeight: 26 },
  cite: { fontFamily: FONTS.displayItalic, color: P.ember, fontSize: 12.5, marginTop: 16, opacity: 0.85 },

  progTiny: { fontFamily: FONTS.body, color: P.faint, fontSize: 12, marginTop: 8 },
  qBlock: { marginTop: 24 },
  qNum: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  qText: { fontFamily: FONTS.medium, color: P.cream, fontSize: 16.5, lineHeight: 23, marginBottom: 14 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: P.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 9, backgroundColor: P.panelSoft },
  optPicked: { borderColor: P.ember, backgroundColor: 'rgba(231,176,122,0.08)' },
  optRight: { borderColor: P.ember, backgroundColor: 'rgba(231,176,122,0.13)' },
  optWrong: { borderColor: P.rose, backgroundColor: 'rgba(240,112,140,0.1)' },
  optDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  optDotPicked: { backgroundColor: P.ember, borderColor: P.ember },
  optDotRight: { backgroundColor: P.ember, borderColor: P.ember },
  optDotT: { fontFamily: FONTS.semibold, color: P.muted, fontSize: 12 },
  optT: { flex: 1, fontFamily: FONTS.body, color: P.cream, fontSize: 15, lineHeight: 20 },
  why: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 13.5, lineHeight: 20, marginTop: 4, paddingLeft: 2 },

  scoreWrap: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  score: { fontFamily: FONTS.display, color: P.ember, fontSize: 64, letterSpacing: -2 },
  scoreOf: { fontFamily: FONTS.display, color: P.faint, fontSize: 30 },
  scoreLine: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 15, marginTop: 2, marginBottom: 8 },

  bdRow: { marginTop: 16 },
  bdHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bdTag: { fontFamily: FONTS.medium, color: P.cream, fontSize: 14, flex: 1 },
  bdScore: { fontFamily: FONTS.semibold, fontSize: 13 },
  bdTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(231,215,199,0.08)', overflow: 'hidden' },
  bdFill: { height: 6, borderRadius: 3 },

  answer: { marginTop: 22, borderWidth: 1, borderColor: P.emberFaint, borderRadius: 16, padding: 17, backgroundColor: 'rgba(231,176,122,0.04)' },
  answerT: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.92)', fontSize: 15, lineHeight: 24 },
});
