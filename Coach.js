// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE COACH. Name any exam, get a day-by-day plan; each day a lesson,
//  a quiz, a grade, and the plan bends to your weak spots. Its own surface
//  (newsroom-style front door), reached from the desk. Phase 1: the daily loop
//  + a full mock. (Material upload lives here too once the picker is wired.)
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from './Grain';
import { C, FONTS } from './theme';
import {
  coachStart, coachGet, coachLesson, coachQuiz, coachGrade,
  coachMockStart, coachMockSubmit,
} from './api';

const GOLD = '#E7B07A';
const OPT_LABELS = ['A', 'B', 'C', 'D'];
const STORE_KEY = 'coach_active_course';

export default function Coach({ onBack = () => {} }) {
  const [stage, setStage] = useState('loading');   // loading | home | lesson | quiz | result | mock | mockresult
  const [course, setCourse] = useState(null);      // { courseId, topic, totalDays, currentDay, plan, weakTags, days }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // start form
  const [topic, setTopic] = useState('');
  const [days, setDays] = useState('7');

  // lesson / quiz / result
  const [lesson, setLesson] = useState(null);      // { day, title, focus, lesson, citations }
  const [quiz, setQuiz] = useState(null);          // { day, questions:[{q,opts,tag}] }
  const [answers, setAnswers] = useState([]);      // per-question chosen index
  const [result, setResult] = useState(null);      // grade result

  // mock
  const [mock, setMock] = useState(null);          // { mockId, questions }
  const [mockAns, setMockAns] = useState([]);
  const [mockResult, setMockResult] = useState(null);

  useEffect(() => { (async () => {
    try {
      const id = await AsyncStorage.getItem(STORE_KEY);
      if (id) { const c = await coachGet(id).catch(() => null); if (c && c.courseId) { setCourse(c); setStage('home'); return; } }
    } catch (e) {}
    setStage('home');
  })(); }, []);

  const guard = async (fn) => { if (busy) return; setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'something went wrong'); } setBusy(false); };

  const start = () => guard(async () => {
    const t = topic.trim(); if (t.length < 2) { setErr('name an exam or topic'); return; }
    const c = await coachStart(t, Math.max(1, Math.min(parseInt(days, 10) || 7, 30)));
    await AsyncStorage.setItem(STORE_KEY, c.courseId);
    setCourse({ ...c, currentDay: 1, weakTags: [], days: {} });
    setStage('home');
  });

  const openLesson = () => guard(async () => {
    const L = await coachLesson(course.courseId);
    setLesson(L); setStage('lesson');
  });

  const openQuiz = () => guard(async () => {
    const Q = await coachQuiz(course.courseId, 5);
    setQuiz(Q); setAnswers(new Array((Q.questions || []).length).fill(null)); setStage('quiz');
  });

  const submitQuiz = () => guard(async () => {
    const R = await coachGrade(course.courseId, answers);
    setResult(R); setStage('result');
  });

  const continueNext = () => guard(async () => {
    const c = await coachGet(course.courseId);
    setCourse(c); setLesson(null); setQuiz(null); setResult(null); setStage('home');
  });

  const startMock = () => guard(async () => {
    const M = await coachMockStart(course.courseId, 12, 20);
    setMock(M); setMockAns(new Array((M.questions || []).length).fill(null)); setStage('mock');
  });

  const submitMock = () => guard(async () => {
    const R = await coachMockSubmit(course.courseId, mock.mockId, mockAns);
    setMockResult(R); setStage('mockresult');
  });

  const newCourse = async () => { await AsyncStorage.removeItem(STORE_KEY); setCourse(null); setTopic(''); setDays('7'); setStage('home'); };

  // ── render helpers ──────────────────────────────────────────────────
  const Bar = ({ title, sub, back }) => (
    <View style={st.bar}>
      <Pressable onPress={back || onBack} hitSlop={12}><Text style={st.chev}>‹</Text></Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={st.masthead}>{title}</Text>
        {!!sub && <Text style={st.edition}>{sub}</Text>}
      </View>
      <View style={{ width: 26 }} />
    </View>
  );

  const Q = ({ q, i, chosen, onPick, reveal }) => (
    <View style={st.qCard}>
      <Text style={st.qText}>{i + 1}. {q.q}</Text>
      {q.opts.map((o, k) => {
        const picked = chosen === k;
        const isRight = reveal && reveal.correct === k;
        const isWrongPick = reveal && picked && reveal.correct !== k;
        return (
          <Pressable key={k} disabled={!!reveal} onPress={() => onPick(k)}
            style={[st.opt, picked && st.optPicked, isRight && st.optRight, isWrongPick && st.optWrong]}>
            <Text style={[st.optL, (picked || isRight) && { color: C.void }]}>{OPT_LABELS[k]}</Text>
            <Text style={[st.optT, isRight && { color: GOLD }]}>{o}</Text>
          </Pressable>
        );
      })}
      {reveal && !!reveal.why && <Text style={st.why}>{reveal.why}</Text>}
    </View>
  );

  const body = () => {
    if (stage === 'loading') return <View style={st.center}><ActivityIndicator color={GOLD} /></View>;

    // ── HOME: start a course, or the current course's dashboard ──
    if (stage === 'home') {
      if (!course) return (
        <ScrollView contentContainerStyle={st.scroll}>
          <Text style={st.lead}>What are we preparing for?</Text>
          <Text style={st.leadSub}>Name any exam or topic — GMAT, CLAT, NEET, UPSC, or a subject you want to learn.</Text>
          <TextInput style={st.input} value={topic} onChangeText={setTopic} placeholder="e.g. CLAT legal reasoning" placeholderTextColor={C.faint} />
          <View style={st.row}>
            <Text style={st.rowLbl}>Sprint length</Text>
            <TextInput style={st.daysInput} value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={2} />
            <Text style={st.rowLbl}>days</Text>
          </View>
          <Pressable style={st.cta} onPress={start} disabled={busy}>
            <Text style={st.ctaT}>{busy ? 'building your plan…' : 'Build my plan'}</Text>
          </Pressable>
          {!!err && <Text style={st.err}>{err}</Text>}
        </ScrollView>
      );
      const dayFocus = course.plan?.[(course.currentDay || 1) - 1];
      const done = course.status === 'done';
      return (
        <ScrollView contentContainerStyle={st.scroll}>
          <Text style={st.kick}>YOUR COURSE</Text>
          <Text style={st.h1}>{course.topic}</Text>
          <Text style={st.leadSub}>{done ? 'Course complete — revisit any day or run a mock.' : `Day ${course.currentDay} of ${course.totalDays}`}</Text>

          {!done && !!dayFocus && (
            <View style={st.today}>
              <Text style={st.todayKick}>TODAY · {dayFocus.title}</Text>
              <Text style={st.todayFocus}>{dayFocus.focus}</Text>
              <Pressable style={st.cta} onPress={openLesson} disabled={busy}>
                <Text style={st.ctaT}>{busy ? 'opening…' : `Start day ${course.currentDay}`}</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={st.ghost} onPress={startMock} disabled={busy}><Text style={st.ghostT}>Take a full mock test</Text></Pressable>

          <Text style={[st.kick, { marginTop: 22 }]}>THE PLAN</Text>
          {(course.plan || []).map((p, i) => {
            const g = course.days?.[String(i + 1)]?.graded;
            return (
              <View key={i} style={st.planRow}>
                <Text style={[st.planDay, (i + 1) === course.currentDay && { color: GOLD }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.planTitle}>{p.title}</Text>
                  {!!g && <Text style={st.planScore}>scored {g.score}/{g.total}</Text>}
                </View>
              </View>
            );
          })}
          {!!(course.weakTags || []).length && (
            <View style={st.weakBox}>
              <Text style={st.kick}>WORTH REVISITING</Text>
              <Text style={st.weakT}>{course.weakTags.join(' · ')}</Text>
            </View>
          )}
          <Pressable onPress={newCourse}><Text style={st.newCourse}>start a different course</Text></Pressable>
          {!!err && <Text style={st.err}>{err}</Text>}
        </ScrollView>
      );
    }

    // ── LESSON ──
    if (stage === 'lesson' && lesson) return (
      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={st.kick}>DAY {lesson.day} · {lesson.title}</Text>
        <Text style={st.lessonBody}>{lesson.lesson}</Text>
        {!!(lesson.citations || []).length && <Text style={st.cite}>grounded in your material: {lesson.citations.map((c) => c.ref).join(', ')}</Text>}
        <Pressable style={st.cta} onPress={openQuiz} disabled={busy}><Text style={st.ctaT}>{busy ? 'loading…' : 'Take the quiz'}</Text></Pressable>
        {!!err && <Text style={st.err}>{err}</Text>}
      </ScrollView>
    );

    // ── QUIZ ──
    if (stage === 'quiz' && quiz) {
      const all = answers.every((a) => a !== null);
      return (
        <ScrollView contentContainerStyle={st.scroll}>
          <Text style={st.kick}>DAY {quiz.day} · QUIZ</Text>
          {(quiz.questions || []).map((q, i) => (
            <Q key={i} q={q} i={i} chosen={answers[i]} onPick={(k) => setAnswers((a) => { const n = [...a]; n[i] = k; return n; })} />
          ))}
          <Pressable style={[st.cta, !all && st.ctaOff]} onPress={all ? submitQuiz : undefined} disabled={!all || busy}>
            <Text style={st.ctaT}>{busy ? 'grading…' : all ? 'Submit' : 'answer every question'}</Text>
          </Pressable>
          {!!err && <Text style={st.err}>{err}</Text>}
        </ScrollView>
      );
    }

    // ── RESULT ──
    if (stage === 'result' && result) return (
      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={st.kick}>DAY {result.day} · RESULT</Text>
        <Text style={st.score}>{result.score}<Text style={st.scoreOf}>/{result.total}</Text></Text>
        {(quiz?.questions || []).map((q, i) => {
          const r = (result.results || []).find((x) => x.i === i) || {};
          return <Q key={i} q={q} i={i} chosen={r.chosen} onPick={() => {}} reveal={{ correct: r.correct, why: r.why }} />;
        })}
        {!!(result.weakTags || []).length && (
          <View style={st.weakBox}><Text style={st.kick}>WE'LL REINFORCE</Text><Text style={st.weakT}>{result.weakTags.join(' · ')}</Text></View>
        )}
        <Pressable style={st.cta} onPress={continueNext} disabled={busy}>
          <Text style={st.ctaT}>{result.done ? 'Finish course' : `Continue to day ${result.nextDay}`}</Text>
        </Pressable>
        {!!err && <Text style={st.err}>{err}</Text>}
      </ScrollView>
    );

    // ── MOCK ──
    if (stage === 'mock' && mock) {
      const all = mockAns.every((a) => a !== null);
      return (
        <ScrollView contentContainerStyle={st.scroll}>
          <Text style={st.kick}>FULL MOCK · {mock.count} QUESTIONS</Text>
          {(mock.questions || []).map((q, i) => (
            <Q key={i} q={q} i={i} chosen={mockAns[i]} onPick={(k) => setMockAns((a) => { const n = [...a]; n[i] = k; return n; })} />
          ))}
          <Pressable style={[st.cta, !all && st.ctaOff]} onPress={all ? submitMock : undefined} disabled={!all || busy}>
            <Text style={st.ctaT}>{busy ? 'scoring…' : all ? 'Submit mock' : 'answer every question'}</Text>
          </Pressable>
          {!!err && <Text style={st.err}>{err}</Text>}
        </ScrollView>
      );
    }

    // ── MOCK RESULT ──
    if (stage === 'mockresult' && mockResult) return (
      <ScrollView contentContainerStyle={st.scroll}>
        <Text style={st.kick}>MOCK · RESULT</Text>
        <Text style={st.score}>{mockResult.score}<Text style={st.scoreOf}>/{mockResult.total}</Text></Text>
        <Text style={[st.kick, { marginTop: 18 }]}>BY TOPIC</Text>
        {Object.entries(mockResult.breakdown || {}).map(([tag, b]) => (
          <View key={tag} style={st.planRow}>
            <View style={{ flex: 1 }}><Text style={st.planTitle}>{tag}</Text></View>
            <Text style={[st.planScore, { color: b.right === b.total ? GOLD : b.right === 0 ? '#F0708C' : C.muted }]}>{b.right}/{b.total}</Text>
          </View>
        ))}
        <Pressable style={st.cta} onPress={() => setStage('home')}><Text style={st.ctaT}>Back to course</Text></Pressable>
      </ScrollView>
    );

    return <View style={st.center}><Text style={st.loading}>…</Text></View>;
  };

  const titleFor = { home: 'THE COACH', lesson: 'LESSON', quiz: 'QUIZ', result: 'RESULT', mock: 'MOCK TEST', mockresult: 'MOCK' }[stage] || 'THE COACH';
  const backFor = (stage === 'lesson' || stage === 'quiz' || stage === 'result') ? () => setStage('home')
    : (stage === 'mock' || stage === 'mockresult') ? () => setStage('home') : onBack;

  return (
    <View style={st.root}>
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Bar title={titleFor} sub={course && stage === 'home' ? 'your study desk' : null} back={backFor} />
        {body()}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B08' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  masthead: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, letterSpacing: 3 },
  edition: { fontFamily: FONTS.body, color: GOLD, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loading: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  scroll: { paddingHorizontal: 18, paddingBottom: 48 },

  lead: { fontFamily: FONTS.display, color: C.cream, fontSize: 24, lineHeight: 30, marginTop: 8 },
  leadSub: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.7)', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 18 },
  input: { fontFamily: FONTS.body, color: C.cream, fontSize: 16, borderWidth: 1, borderColor: 'rgba(224,192,136,0.32)', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.025)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  rowLbl: { fontFamily: FONTS.body, color: C.muted, fontSize: 14 },
  daysInput: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(224,192,136,0.35)', paddingHorizontal: 10, paddingVertical: 4, textAlign: 'center', minWidth: 44 },

  cta: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  ctaOff: { backgroundColor: 'rgba(224,192,136,0.25)' },
  ctaT: { fontFamily: FONTS.semibold, color: C.void, fontSize: 15.5 },
  ghost: { borderWidth: 1, borderColor: 'rgba(224,192,136,0.3)', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  ghostT: { fontFamily: FONTS.medium, color: GOLD, fontSize: 14 },

  kick: { fontFamily: FONTS.semibold, color: C.faint, fontSize: 10.5, letterSpacing: 3, marginTop: 6, marginBottom: 8 },
  h1: { fontFamily: FONTS.display, color: C.cream, fontSize: 26, lineHeight: 32 },
  today: { borderWidth: 1, borderColor: 'rgba(224,192,136,0.22)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginTop: 8 },
  todayKick: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 10.5, letterSpacing: 2 },
  todayFocus: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.85)', fontSize: 14.5, lineHeight: 20, marginTop: 7 },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  planDay: { fontFamily: FONTS.display, color: C.faint, fontSize: 18, width: 22, textAlign: 'center' },
  planTitle: { fontFamily: FONTS.medium, color: C.cream, fontSize: 14.5 },
  planScore: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 2 },

  weakBox: { borderWidth: 1, borderColor: 'rgba(240,112,140,0.28)', borderRadius: 14, padding: 14, marginTop: 18, backgroundColor: 'rgba(240,112,140,0.05)' },
  weakT: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.85)', fontSize: 13.5, lineHeight: 19 },
  newCourse: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 24, textDecorationLine: 'underline' },

  lessonBody: { fontFamily: FONTS.body, color: 'rgba(238,232,224,0.9)', fontSize: 15, lineHeight: 24, marginTop: 4 },
  cite: { fontFamily: FONTS.displayItalic, color: GOLD, fontSize: 12, marginTop: 14, opacity: 0.8 },

  qCard: { marginTop: 16 },
  qText: { fontFamily: FONTS.medium, color: C.cream, fontSize: 15.5, lineHeight: 22, marginBottom: 10 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 8 },
  optPicked: { borderColor: GOLD, backgroundColor: GOLD },
  optRight: { borderColor: GOLD, backgroundColor: 'rgba(224,192,136,0.16)' },
  optWrong: { borderColor: '#F0708C', backgroundColor: 'rgba(240,112,140,0.12)' },
  optL: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13, width: 16 },
  optT: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, flex: 1, lineHeight: 19 },
  why: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2, marginBottom: 4, paddingLeft: 4 },

  score: { fontFamily: FONTS.display, color: GOLD, fontSize: 52, textAlign: 'center', marginVertical: 8 },
  scoreOf: { fontFamily: FONTS.display, color: C.faint, fontSize: 28 },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, marginTop: 14, textAlign: 'center' },
});
