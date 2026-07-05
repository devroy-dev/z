// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE COACH. Name any exam or subject; a web-grounded, day-by-day
//  course that teaches, quizzes, grades, and bends to your weak spots.
//
//  Register: WARM LAMPLIGHT — a mentor's study at night. The coach is present
//  in the room (nameplate + portrait + spoken lines), not a faceless app.
//  Lessons render as proper teaching prose — headers, rules, pull-quotes.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from './Grain';
import { FONTS } from './theme';
import { useBackLayer } from './backbus';
import {
  coachStart, coachGet, coachLesson, coachQuiz, coachGrade, coachAsk,
  coachMockStart, coachMockSubmit, API_BASE,
} from './api';

const P = {
  ground: '#0A0806', panel: 'rgba(255,255,255,0.03)', line: 'rgba(231,215,199,0.10)',
  cream: '#F3EBDF', dim: 'rgba(243,235,223,0.9)', muted: '#A2938A', faint: '#6E605A',
  ember: '#E7B07A', emberDim: 'rgba(231,176,122,0.5)', rose: '#F0708C',
  lamp: '#EEC891',                          // warm lamplight — the coach's light
  lampGlow: 'rgba(238,200,145,0.14)',
};
// the study — a warm 3-stop ground, like every other world has its own temperature
const GRAD = ['#1B130B', '#120E0A', '#0A0806'];
const FACE = `${API_BASE}/faces/the_coach.jpg?v=4`;
const OPT = ['A', 'B', 'C', 'D'];
const KEY = 'coach_active_course';

// ── the coach, present in the room: portrait if we have one, a lamp-lit
//    monogram if we don't (so the surface has a face even before the asset ships) ──
function Portrait({ size = 40 }) {
  const [ok, setOk] = useState(true);
  const r = size / 2;
  if (ok) return (
    <Image
      source={{ uri: FACE }} onError={() => setOk(false)}
      style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: 'rgba(238,200,145,0.5)' }}
    />
  );
  return (
    <View style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: 'rgba(238,200,145,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: P.lampGlow }}>
      <Text style={{ fontFamily: FONTS.display, color: P.lamp, fontSize: size * 0.5, marginTop: -1 }}>C</Text>
    </View>
  );
}

// a spoken line from the coach — portrait + name + what he says. His presence.
function Says({ line, size = 40, name = 'THE COACH' }) {
  return (
    <View style={s.says}>
      <Portrait size={size} />
      <View style={{ flex: 1 }}>
        <Text style={s.saysName}>{name}</Text>
        {!!line && <Text style={s.saysLine}>{line}</Text>}
      </View>
    </View>
  );
}

// ── inline emphasis: **bold** · *italic* · `code` ──────────────────────
function inline(str) {
  const out = []; let s = String(str == null ? '' : str); let k = 0;
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`)/;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > 0) out.push(<Text key={k++}>{s.slice(0, m.index)}</Text>);
    if (m[2] != null) out.push(<Text key={k++} style={pr.b}>{m[2]}</Text>);
    else if (m[3] != null) out.push(<Text key={k++} style={pr.b}>{m[3]}</Text>);
    else if (m[4] != null) out.push(<Text key={k++} style={pr.i}>{m[4]}</Text>);
    else if (m[5] != null) out.push(<Text key={k++} style={pr.code}>{m[5]}</Text>);
    s = s.slice(m.index + m[0].length);
  }
  if (s) out.push(<Text key={k++}>{s}</Text>);
  return out;
}

// ── teaching prose → styled blocks (headers, rules, pull-quotes, lists, code) ──
function Prose({ text }) {
  const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n');
  const blocks = []; let para = []; let code = null; let quote = null;
  const flush = () => { if (para.length) { blocks.push({ t: 'p', s: para.join(' ') }); para = []; } };
  const flushQuote = () => { if (quote && quote.length) { blocks.push({ t: 'quote', s: quote.join(' ') }); } quote = null; };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]; const line = raw.trim();
    if (code !== null) { if (line.startsWith('```')) { blocks.push({ t: 'code', s: code.join('\n') }); code = null; } else code.push(raw); continue; }
    if (line.startsWith('```')) { flush(); flushQuote(); code = []; continue; }
    // blockquote — the coach's pull-quote (a rule, a worked line worth setting apart)
    const qm = /^>\s?(.*)$/.exec(line);
    if (qm) { flush(); if (!quote) quote = []; quote.push(qm[1]); continue; }
    if (quote) flushQuote();
    if (line === '') { flush(); continue; }
    if (/^#{1,6}\s/.test(line)) { flush(); const lvl = line.match(/^#+/)[0].length; blocks.push({ t: 'h', lvl, s: line.replace(/^#+\s*/, '').replace(/\*+/g, '') }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ t: 'hr' }); continue; }
    const bm = /^[-*•]\s+(.*)$/.exec(line);
    const nm = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (bm) { flush(); blocks.push({ t: 'li', s: bm[1] }); continue; }
    if (nm) { flush(); blocks.push({ t: 'li', n: nm[1], s: nm[2] }); continue; }
    para.push(line);
  }
  flush(); flushQuote(); if (code) blocks.push({ t: 'code', s: code.join('\n') });

  return (
    <View>
      {blocks.map((b, i) => {
        if (b.t === 'h') return <Text key={i} style={[pr.h, b.lvl === 1 ? pr.h1 : b.lvl === 2 ? pr.h2 : pr.h3]}>{inline(b.s)}</Text>;
        if (b.t === 'hr') return <View key={i} style={pr.hr} />;
        if (b.t === 'quote') return (
          <View key={i} style={pr.quote}><View style={pr.quoteBar} /><Text style={pr.quoteTxt}>{inline(b.s)}</Text></View>
        );
        if (b.t === 'code') return <View key={i} style={pr.codeBox}><Text style={pr.codeTxt}>{b.s}</Text></View>;
        if (b.t === 'li') return (
          <View key={i} style={pr.li}>
            <Text style={pr.mark}>{b.n ? `${b.n}.` : '•'}</Text>
            <Text style={pr.liTxt}>{inline(b.s)}</Text>
          </View>
        );
        return <Text key={i} style={pr.p}>{inline(b.s)}</Text>;
      })}
    </View>
  );
}

export default function Coach({ onBack = () => {}, onAskCoach = () => {} }) {
  const [stage, setStage] = useState('loading');
  const [course, setCourse] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
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
  const [asked, setAsked] = useState('');
  const [askA, setAskA] = useState(null);

  // back gesture walks inward: any sub-stage → home; on home, Nav closes the coach
  useBackLayer(stage !== 'home' && stage !== 'loading', useCallback(() => { setStage('home'); return true; }, []));

  useEffect(() => { (async () => {
    try {
      const id = await AsyncStorage.getItem(KEY);
      if (id) { const c = await coachGet(id).catch(() => null); if (c && c.courseId) { setCourse(c); setStage('home'); return; } }
    } catch (e) {}
    setStage('home');
  })(); }, []);

  const busy = busyKey !== null;
  const run = async (key, fn) => { if (busy) return; setBusyKey(key); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong. Try again.'); } setBusyKey(null); };

  const start = () => run('start', async () => {
    const t = topic.trim(); if (t.length < 2) { setErr('Name the exam or subject to prepare for.'); return; }
    const c = await coachStart(t, Math.max(1, Math.min(parseInt(days, 10) || 7, 30)));
    await AsyncStorage.setItem(KEY, c.courseId);
    setCourse({ ...c, currentDay: 1, weakTags: [], days: {} });
    setStage('home');
  });
  const openLesson = () => run('lesson', async () => { setLesson(await coachLesson(course.courseId)); setStage('lesson'); });
  const openQuiz = () => run('quiz', async () => { const Q = await coachQuiz(course.courseId, 5); setQuiz(Q); setAnswers(new Array((Q.questions || []).length).fill(null)); setStage('quiz'); });
  const submitQuiz = () => run('grade', async () => { setResult(await coachGrade(course.courseId, answers)); setStage('result'); });
  const continueNext = () => run('next', async () => { const c = await coachGet(course.courseId); setCourse(c); setLesson(null); setQuiz(null); setResult(null); setStage('home'); });
  const startMock = () => run('mock', async () => { const M = await coachMockStart(course.courseId, 12, 20); setMock(M); setMockAns(new Array((M.questions || []).length).fill(null)); setStage('mock'); });
  const submitMock = () => run('mockgrade', async () => { setMockResult(await coachMockSubmit(course.courseId, mock.mockId, mockAns)); setStage('mockresult'); });
  const ask = () => run('ask', async () => { const q = askQ.trim(); if (q.length < 3) return; setAsked(q); const A = await coachAsk(course.courseId, q); setAskA(A); setAskQ(''); });
  const newCourse = async () => { await AsyncStorage.removeItem(KEY); setCourse(null); setTopic(''); setDays('7'); setAskA(null); setAsked(''); setStage('home'); };

  const Head = ({ eyebrow, title }) => (
    <View style={s.head}>
      <Pressable onPress={stage === 'home' ? onBack : () => setStage('home')} hitSlop={14} style={{ width: 26 }}><Text style={s.back}>‹</Text></Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.headTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Portrait size={30} />
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
            <View style={[s.optDot, (picked && !reveal) && s.optDotOn, right && s.optDotOn]}>
              <Text style={[s.optDotT, ((picked && !reveal) || right) && { color: P.ground }]}>{OPT[k]}</Text>
            </View>
            <Text style={[s.optT, right && { color: P.ember }]}>{o}</Text>
          </Pressable>
        );
      })}
      {reveal && !!reveal.why && <Text style={s.why}>{reveal.why}</Text>}
    </View>
  );

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
              <View style={[s.dayCard, isNow && s.dayCardNow, done && { opacity: 0.7 }]}>
                <View style={s.dayTop}>
                  <Text style={[s.dayTitle, isNow && { color: P.cream }]}>{p.title}</Text>
                  {done && <Text style={s.dayScore}>{done.score}/{done.total}</Text>}
                </View>
                <Text style={s.dayFocus}>{p.focus}</Text>
                {isNow && (
                  <Pressable style={s.dayGo} onPress={openLesson} disabled={busy}>
                    <Text style={s.dayGoT}>{busyKey === 'lesson' ? 'Opening…' : `Begin day ${day} →`}</Text>
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
    if (stage === 'loading') return <View style={s.center}><ActivityIndicator color={P.lamp} /><Text style={s.loadVoice}>the coach is pulling your books…</Text></View>;

    if (stage === 'home') {
      if (!course) return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.meet}>
              <Portrait size={62} />
              <View style={{ flex: 1 }}>
                <Text style={s.meetKicker}>THE COACH</Text>
                <Text style={s.meetSit}>pull up a chair.</Text>
              </View>
            </View>
            <Text style={s.bigLead}>What are we{'\n'}preparing for?</Text>
            <Text style={s.leadSub}>“Name it — an exam, or a subject you want to actually understand. I'll see what it demands today, and lay out the road, one day at a time.”</Text>
            <Text style={s.fieldLbl}>EXAM OR SUBJECT</Text>
            <TextInput style={s.input} value={topic} onChangeText={setTopic} placeholder="e.g. Critical Reasoning, CAT quant, CLAT…" placeholderTextColor={P.faint} returnKeyType="done" />
            <Text style={s.fieldLbl}>HOW MANY DAYS</Text>
            <View style={s.daysRow}>
              {[5, 7, 14, 30].map((d) => (
                <Pressable key={d} onPress={() => setDays(String(d))} style={[s.dayChip, String(d) === days && s.dayChipOn]}>
                  <Text style={[s.dayChipT, String(d) === days && { color: P.ground }]}>{d}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={start} disabled={busy}>
              <Text style={s.ctaT}>{busyKey === 'start' ? 'Reading the syllabus…' : 'Build my plan'}</Text>
            </Pressable>
            <Err />
          </ScrollView>
        </KeyboardAvoidingView>
      );
      const cur = course.currentDay || 1, total = course.totalDays || (course.plan || []).length;
      const done = course.status === 'done';
      const gradedCount = Object.values(course.days || {}).filter((d) => d.graded).length;
      const greet = done ? 'You finished the road. Come back for a mock whenever you want to stay sharp.'
        : gradedCount === 0 ? "Fresh plan, clean slate. Day one is where it starts — open it."
        : `Day ${cur}. You've cleared ${gradedCount}. Keep the rhythm — momentum is half the work.`;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Says line={greet} size={44} />
          <Text style={s.courseEyebrow}>{done ? 'YOUR COURSE · COMPLETE' : `YOUR COURSE · DAY ${cur} OF ${total}`}</Text>
          <Text style={s.courseTitle}>{course.topic}</Text>
          <View style={s.segs}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[s.seg, i < gradedCount && s.segDone, i === cur - 1 && !done && s.segNow]} />
            ))}
          </View>
          <View style={s.actions}>
            <Pressable style={s.action} onPress={startMock} disabled={busy}>
              <Text style={s.actionIcon}>{busyKey === 'mock' ? '…' : '◎'}</Text><Text style={s.actionT}>{busyKey === 'mock' ? 'Building…' : 'Mock test'}</Text>
            </Pressable>
            <Pressable style={s.action} onPress={() => setStage('ask')} disabled={busy}>
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
          <Pressable onPress={newCourse} style={{ marginTop: 28 }}><Text style={s.newCourse}>Start a different course</Text></Pressable>
          <Err />
        </ScrollView>
      );
    }

    if (stage === 'lesson' && lesson) return (
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.dayBadge}>DAY {lesson.day}</Text>
        <Text style={s.lessonTitle}>{lesson.title}</Text>
        {!!lesson.focus && <Text style={s.lessonFocus}>{lesson.focus}</Text>}
        <Says line={null} size={34} />
        <View style={s.lessonBody}>
          <Prose text={lesson.lesson} />
        </View>
        {!!(lesson.citations || []).length && <Text style={s.cite}>{`◈ grounded in your material · ${lesson.citations.map((c) => c.ref).join(', ')}`}</Text>}
        <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={openQuiz} disabled={busy}><Text style={s.ctaT}>{busyKey === 'quiz' ? 'Loading…' : 'Take the quiz'}</Text></Pressable>
        <Err />
      </ScrollView>
    );

    if (stage === 'quiz' && quiz) {
      const answered = answers.filter((a) => a !== null).length, all = answered === answers.length;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>{`DAY ${quiz.day} · QUIZ`}</Text>
          <Says line="No notes now. Show me it's yours." size={34} />
          <Text style={s.progTiny}>{answered} of {answers.length} answered</Text>
          {(quiz.questions || []).map((q, i) => <Question key={i} q={q} i={i} chosen={answers[i]} onPick={(k) => setAnswers((a) => { const n = [...a]; n[i] = k; return n; })} />)}
          <Pressable style={[s.cta, !all && s.ctaBusy]} onPress={all ? submitQuiz : undefined} disabled={!all || busy}>
            <Text style={s.ctaT}>{busyKey === 'grade' ? 'Grading…' : all ? 'Submit answers' : `Answer all ${answers.length}`}</Text>
          </Pressable>
          <Err />
        </ScrollView>
      );
    }

    if (stage === 'result' && result) {
      const perfect = result.score === result.total, half = result.score >= result.total / 2;
      const reaction = result.reaction || (perfect ? "Clean sweep. That's mastery, not luck." : half ? "Solid. A few edges to sharpen — let's tighten them." : "Tricky set. This is exactly what we double back on. No shame in it.");
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>{`DAY ${result.day} · RESULT`}</Text>
          <View style={s.scoreWrap}><Text style={s.score}>{result.score}</Text><Text style={s.scoreOf}> / {result.total}</Text></View>
          <Says line={reaction} size={40} />
          {(quiz?.questions || []).map((q, i) => { const r = (result.results || []).find((x) => x.i === i) || {}; return <Question key={i} q={q} i={i} chosen={r.chosen} reveal={{ correct: r.correct, why: r.why }} />; })}
          {!!(result.weakTags || []).length && (
            <View style={s.weak}><Text style={s.weakLbl}>WE'LL REINFORCE</Text><View style={s.chips}>{result.weakTags.map((t, i) => <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>)}</View></View>
          )}
          <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={continueNext} disabled={busy}><Text style={s.ctaT}>{result.done ? 'Finish course' : `Continue to day ${result.nextDay} →`}</Text></Pressable>
          <Err />
        </ScrollView>
      );
    }

    if (stage === 'mock' && mock) {
      const answered = mockAns.filter((a) => a !== null).length, all = answered === mockAns.length;
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>{`FULL MOCK · ${mock.count} QUESTIONS`}</Text>
          <Says line="The real thing. Clock's yours — pace it." size={34} />
          <Text style={s.progTiny}>{answered} of {mockAns.length} answered</Text>
          {(mock.questions || []).map((q, i) => <Question key={i} q={q} i={i} chosen={mockAns[i]} onPick={(k) => setMockAns((a) => { const n = [...a]; n[i] = k; return n; })} />)}
          <Pressable style={[s.cta, !all && s.ctaBusy]} onPress={all ? submitMock : undefined} disabled={!all || busy}>
            <Text style={s.ctaT}>{busyKey === 'mockgrade' ? 'Scoring…' : all ? 'Submit mock' : `Answer all ${mockAns.length}`}</Text>
          </Pressable>
          <Err />
        </ScrollView>
      );
    }

    if (stage === 'mockresult' && mockResult) {
      const bd = Object.entries(mockResult.breakdown || {});
      return (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.dayBadge}>MOCK · RESULT</Text>
          <View style={s.scoreWrap}><Text style={s.score}>{mockResult.score}</Text><Text style={s.scoreOf}> / {mockResult.total}</Text></View>
          <Says line="Here's where you actually stand — topic by topic. The red is the map." size={40} />
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

    if (stage === 'ask') return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.bigLead}>Ask the coach</Text>
          <Text style={s.leadSub}>“A question on {course.topic}. If you've handed me your own material, I'll answer from it — and show you where.”</Text>
          <TextInput style={[s.input, { minHeight: 66, textAlignVertical: 'top' }]} value={askQ} onChangeText={setAskQ} placeholder="e.g. explain the assumption question type with an example" placeholderTextColor={P.faint} multiline />
          <Pressable style={[s.cta, busy && s.ctaBusy]} onPress={ask} disabled={busy}><Text style={s.ctaT}>{busyKey === 'ask' ? 'Thinking…' : 'Ask'}</Text></Pressable>
          {!!askA && (
            <View style={{ marginTop: 26 }}>
              <Text style={s.askedQ}>{asked}</Text>
              <Says line={null} size={34} />
              <View style={s.lessonBody}>
                <Prose text={askA.answer} />
              </View>
              {!!(askA.citations || []).length && <Text style={s.cite}>{`◈ from your material · ${askA.citations.map((c) => c.ref).join(', ')}`}</Text>}
            </View>
          )}
          <Err />
        </ScrollView>
      </KeyboardAvoidingView>
    );

    return <View style={s.center}><Text style={s.leadSub}>…</Text></View>;
  };

  const heads = {
    home: course ? ['THE COACHING HUB', 'Study'] : ['THE COACHING HUB', 'New course'],
    lesson: ['LESSON', course?.topic || 'Lesson'], quiz: ['QUIZ', course?.topic || 'Quiz'],
    result: ['RESULT', course?.topic || 'Result'], mock: ['MOCK TEST', course?.topic || 'Mock'],
    mockresult: ['MOCK', course?.topic || 'Mock'], ask: ['ASK', course?.topic || 'Ask'],
  };
  const [eyebrow, title] = heads[stage] || ['THE COACHING HUB', 'Study'];

  return (
    <View style={s.root}>
      <LinearGradient colors={GRAD} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {stage !== 'loading' && <Head eyebrow={eyebrow} title={title} />}
        {body()}
      </SafeAreaView>
    </View>
  );
}

const pr = StyleSheet.create({
  p: { fontFamily: FONTS.body, color: P.dim, fontSize: 15.5, lineHeight: 25, marginBottom: 14 },
  b: { fontFamily: FONTS.semibold, color: P.cream },
  i: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', color: P.ember, fontSize: 14 },
  h: { fontFamily: FONTS.display, color: P.cream, marginBottom: 10, marginTop: 6, letterSpacing: -0.3 },
  h1: { fontSize: 23, lineHeight: 29, marginTop: 4 },
  h2: { fontSize: 19, lineHeight: 25, marginTop: 16 },
  h3: { fontSize: 15, lineHeight: 21, marginTop: 14, fontFamily: FONTS.semibold, color: P.lamp, letterSpacing: 0.3, textTransform: 'uppercase' },
  hr: { height: 1, backgroundColor: P.line, marginVertical: 18 },
  // the coach's pull-quote — a rule or worked line set apart, lamp-lit
  quote: { flexDirection: 'row', marginVertical: 14, paddingRight: 6 },
  quoteBar: { width: 2.5, borderRadius: 2, backgroundColor: P.lamp, marginRight: 14 },
  quoteTxt: { flex: 1, fontFamily: FONTS.displayItalic, color: P.cream, fontSize: 18, lineHeight: 27 },
  li: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9, paddingRight: 4 },
  mark: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 15.5, lineHeight: 25, width: 22 },
  liTxt: { flex: 1, fontFamily: FONTS.body, color: P.dim, fontSize: 15.5, lineHeight: 25 },
  codeBox: { borderWidth: 1, borderColor: P.line, borderRadius: 12, padding: 13, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.25)' },
  codeTxt: { fontFamily: 'monospace', color: '#E7C9A8', fontSize: 13.5, lineHeight: 20 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadVoice: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 14 },
  scroll: { paddingHorizontal: 22, paddingBottom: 60 },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 },
  back: { color: P.muted, fontSize: 30, marginTop: -4 },
  eyebrow: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 9.5, letterSpacing: 3, opacity: 0.9 },
  headTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 20, marginTop: 1 },

  // the coach speaks — portrait + name + line
  says: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 18, marginBottom: 4 },
  saysName: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 9.5, letterSpacing: 3 },
  saysLine: { fontFamily: FONTS.displayItalic, color: 'rgba(243,235,223,0.9)', fontSize: 16, lineHeight: 23, marginTop: 4 },

  // meet the coach (empty state)
  meet: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 8, marginBottom: 6 },
  meetKicker: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 10.5, letterSpacing: 3.5 },
  meetSit: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 16, marginTop: 4 },

  bigLead: { fontFamily: FONTS.display, color: P.cream, fontSize: 34, lineHeight: 40, marginTop: 22, letterSpacing: -0.6 },
  leadSub: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 16, lineHeight: 24, marginTop: 14, marginBottom: 8 },
  fieldLbl: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2.5, marginTop: 26, marginBottom: 11 },
  input: { fontFamily: FONTS.body, color: P.cream, fontSize: 16.5, borderWidth: 1, borderColor: P.line, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: P.panel },
  daysRow: { flexDirection: 'row', gap: 10 },
  dayChip: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 13, paddingVertical: 13, alignItems: 'center', backgroundColor: P.panel },
  dayChipOn: { backgroundColor: P.lamp, borderColor: P.lamp },
  dayChipT: { fontFamily: FONTS.semibold, color: P.cream, fontSize: 16 },

  cta: { backgroundColor: P.lamp, borderRadius: 15, paddingVertical: 16, alignItems: 'center', marginTop: 30 },
  ctaBusy: { opacity: 0.5 },
  ctaT: { fontFamily: FONTS.semibold, color: P.ground, fontSize: 15.5 },
  err: { fontFamily: FONTS.body, color: P.rose, fontSize: 13.5, marginTop: 16, textAlign: 'center', lineHeight: 19 },

  courseEyebrow: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 10, letterSpacing: 2.5, marginTop: 20 },
  courseTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 30, lineHeight: 36, marginTop: 8, letterSpacing: -0.6 },
  segs: { flexDirection: 'row', gap: 5, marginTop: 20 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(231,215,199,0.1)' },
  segDone: { backgroundColor: P.ember },
  segNow: { backgroundColor: P.emberDim },

  actions: { flexDirection: 'row', gap: 12, marginTop: 26 },
  action: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 15, paddingVertical: 17, alignItems: 'center', gap: 8, backgroundColor: P.panel },
  actionIcon: { fontFamily: FONTS.display, color: P.lamp, fontSize: 21 },
  actionT: { fontFamily: FONTS.medium, color: P.cream, fontSize: 13 },

  sectionLbl: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2.5, marginTop: 32, marginBottom: 8 },

  spineRow: { flexDirection: 'row', gap: 15 },
  spineCol: { alignItems: 'center', width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center', backgroundColor: P.ground },
  nodeDone: { backgroundColor: P.emberDim, borderColor: P.ember },
  nodeNow: { backgroundColor: P.lamp, borderColor: P.lamp, shadowColor: P.lamp, shadowOpacity: 0.6, shadowRadius: 8 },
  nodeN: { fontFamily: FONTS.semibold, color: P.muted, fontSize: 13 },
  spineLine: { flex: 1, width: 1.5, backgroundColor: P.line, marginVertical: 3, minHeight: 20 },
  dayCard: { flex: 1, borderWidth: 1, borderColor: P.line, borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: P.panel },
  dayCardNow: { borderColor: P.emberDim, backgroundColor: P.lampGlow },
  dayTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  dayTitle: { flex: 1, fontFamily: FONTS.semibold, color: 'rgba(243,235,223,0.82)', fontSize: 15.5, lineHeight: 21 },
  dayScore: { fontFamily: FONTS.semibold, color: P.ember, fontSize: 13 },
  dayFocus: { fontFamily: FONTS.body, color: P.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  dayGo: { alignSelf: 'flex-start', marginTop: 15, backgroundColor: P.lamp, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 17 },
  dayGoT: { fontFamily: FONTS.semibold, color: P.ground, fontSize: 13.5 },

  weak: { marginTop: 28, borderWidth: 1, borderColor: 'rgba(240,112,140,0.25)', borderRadius: 16, padding: 16, backgroundColor: 'rgba(240,112,140,0.045)' },
  weakLbl: { fontFamily: FONTS.semibold, color: P.rose, fontSize: 10, letterSpacing: 2.5, marginBottom: 12, opacity: 0.9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: P.line, borderRadius: 100, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: P.panel },
  chipT: { fontFamily: FONTS.body, color: 'rgba(243,235,223,0.8)', fontSize: 12.5 },
  newCourse: { fontFamily: FONTS.displayItalic, color: P.faint, fontSize: 13.5, textAlign: 'center', textDecorationLine: 'underline' },

  dayBadge: { fontFamily: FONTS.semibold, color: P.lamp, fontSize: 10, letterSpacing: 2.5, marginTop: 6 },
  lessonTitle: { fontFamily: FONTS.display, color: P.cream, fontSize: 27, lineHeight: 33, marginTop: 10, letterSpacing: -0.5 },
  lessonFocus: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 15.5, lineHeight: 23, marginTop: 11 },
  // the lesson reads as a taught column — a faint lamp-lit left margin
  lessonBody: { marginTop: 18, paddingTop: 20, borderTopWidth: 1, borderTopColor: P.line },
  cite: { fontFamily: FONTS.displayItalic, color: P.ember, fontSize: 12.5, marginTop: 8, opacity: 0.85 },
  askedQ: { fontFamily: FONTS.display, color: P.cream, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },

  progTiny: { fontFamily: FONTS.body, color: P.faint, fontSize: 12, marginTop: 14 },
  qBlock: { marginTop: 24 },
  qNum: { fontFamily: FONTS.semibold, color: P.faint, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  qText: { fontFamily: FONTS.medium, color: P.cream, fontSize: 16.5, lineHeight: 23, marginBottom: 14 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: P.line, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 9, backgroundColor: P.panel },
  optPicked: { borderColor: P.ember, backgroundColor: 'rgba(231,176,122,0.08)' },
  optRight: { borderColor: P.ember, backgroundColor: 'rgba(231,176,122,0.13)' },
  optWrong: { borderColor: P.rose, backgroundColor: 'rgba(240,112,140,0.1)' },
  optDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  optDotOn: { backgroundColor: P.ember, borderColor: P.ember },
  optDotT: { fontFamily: FONTS.semibold, color: P.muted, fontSize: 12 },
  optT: { flex: 1, fontFamily: FONTS.body, color: P.cream, fontSize: 15, lineHeight: 20 },
  why: { fontFamily: FONTS.displayItalic, color: P.muted, fontSize: 13.5, lineHeight: 20, marginTop: 4, paddingLeft: 2 },

  scoreWrap: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  score: { fontFamily: FONTS.display, color: P.lamp, fontSize: 66, letterSpacing: -2 },
  scoreOf: { fontFamily: FONTS.display, color: P.faint, fontSize: 30 },

  bdRow: { marginTop: 16 },
  bdHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bdTag: { fontFamily: FONTS.medium, color: P.cream, fontSize: 14, flex: 1 },
  bdScore: { fontFamily: FONTS.semibold, fontSize: 13 },
  bdTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(231,215,199,0.08)', overflow: 'hidden' },
  bdFill: { height: 6, borderRadius: 3 },
});
