# Coach House Codex — Authoring Standard

**Status:** v1 — living standard, committed to the repo at `coach-library/AUTHORING.md`.

**This is the standing format for _every_ house codex, present and future.** It governs the six universal subjects authored first, and equally governs everything authored later — additional subjects, exam-specific codexes (CLAT, GMAT, CAT, and so on), and any future authoring pass. Any new codex added to the coach's house corpus must follow this document. Read it before authoring anything; keep it open while you author.

Treat it as **v1, not final.** The template is designed to distill cleanly, but the first real distillation (Logical Reasoning → PDF → clerk → shelf) is what proves it. If the clerk mangles the structure, this spec is corrected once and every later codex inherits the fix. When that happens, bump the version and note the change here.

**For:** the authoring model (Opus). **Deliverable:** one teaching document per subject, run through the coach's existing distiller and shelved as the shared house corpus.

You are authoring **substance, not voice.** The coach already has a soul (a warm, plain-spoken teacher) authored separately. Do not write in character, do not add personality, jokes, or a teaching persona. Write clean, correct, well-structured ground truth. The soul supplies the manner at runtime; you supply the truth it teaches from.

---

## 0. What a codex is (and how it's used)

Each codex is a **document of teaching ground truth for one universal skill.** It gets converted to PDF and passed through the coach's distiller (a one-time reading pass) which turns it into a §-numbered, page-anchored, searchable "Brief." At runtime the engine:

- distributes your **section order** across the days of a course (your section order literally becomes the study plan),
- retrieves your sections to **teach** each lesson (cited by § and page),
- retrieves them again to **generate quizzes and mocks**, then independently verifies each answer key against a second pass.

So three things must be true of what you write: the **order is the curriculum**, the **rules must be quotable and exact**, and **every worked answer must be defensible** — a wrong or ambiguous fact here becomes a wrong answer key in a paid product.

**Do not author a question bank with answer keys.** The engine generates and self-verifies quiz items from your ground truth. Your job is the knowledge, the methods, the worked examples, and the traps the questions will be drawn from — not the questions themselves.

---

## 1. The six subjects — author in this order

Ordered by **global portability** (how many markets the skill serves with zero translation). Build the top ones first.

| # | Subject | One-line scope | Why it's universal |
|---|---------|----------------|--------------------|
| 1 | **Logical & Analytical Reasoning** | Deduction, conditionals, and analytical puzzles | Language-neutral. Serves Thailand TGAT2, Japan SPI non-verbal, Indonesia *penalaran umum*, India CLAT/CAT, Philippines analytical ability — untranslated. |
| 2 | **Quantitative / Numerical Reasoning** | Arithmetic reasoning, ratios, data interpretation, series | Language-neutral and the **hardest right answers** (safest for the verifier). Present in every market's aptitude test. |
| 3 | **Critical Reasoning** | Argument analysis: assumptions, strengthen/weaken, flaws, inference | The premium admission/professional skill (GMAT/LSAT/GRE/CLAT and every civil-service analytical section). |
| 4 | **English Grammar & Usage** | Standard-English syntax, agreement, usage | Serves the English component of *every* market, and the full verbal load in English-medium markets (India, Philippines, Singapore). |
| 5 | **Reading Comprehension** | Main idea, inference, structure, tone, vocab-in-context | Same reach as grammar; pairs with it. |
| 6 | **Legal Reasoning** (jurisdiction-neutral) | Applying a *given* rule/principle to facts | CLAT / LSAT / law-aptitude everywhere. The reasoning is universal; specific law is not — so teach only the application skill. |

---

## 2. Non-negotiable constraints (apply to every codex)

1. **Exam-agnostic.** Teach the *skill*, never one exam's branding or quirks. One Logical Reasoning corpus must serve all markets. Do not name specific exams as scope.
2. **Globally & culturally neutral.** No country-specific names, places, currencies, institutions, festivals, foods, or scenarios. Use neutral tokens (letters, colours, generic roles like "the manager," "City A"), neutral themes (health, work, environment, technology), and unit-free or SI quantities ("units," not ₹/$). A "universal" subject with Indian dressing isn't universal.
3. **Teaching order = section order.** Author from foundations to advanced, in the exact sequence a learner should progress. The engine slices this into days; each section must be **one teachable sitting** — a single concept, rule, method, or example-type a learner can absorb and drill in one go.
4. **One defensible answer, always.** Every stated rule and every worked example must have exactly one correct, verifiable resolution. No "it depends," no ambiguous keys. This is the paid product's integrity; the engine's verifier and deterministic grading both rely on your ground truth being clean.
5. **English medium.** The corpus is authored and taught in English.
6. **Load-bearing statements must be quotable.** State each rule/definition/formula as one crisp, self-contained sentence. The distiller quotes these verbatim; write them so they survive on their own.

---

## 3. Document structure (the shape every codex takes)

Author in Markdown. Use explicit hierarchical section numbers that the distiller will preserve.

```
# <Subject Title>

## Scope
<2–3 sentences: what this skill is, what it covers, what it deliberately excludes.>

## How this subject is tested
- Question formats: <the real formats, e.g. "which must be true", strengthen/weaken, series completion>
- Difficulty mix: <rough split, e.g. 30% recall/recognition, 50% application, 20% multi-step>
- In scope: <the sub-skills covered>
- Out of scope: <adjacent things NOT covered — fences the quiz generator>
- Classic traps: <the recurring mistakes learners make on this subject>

## §1 <First concept — foundational>
<concept in plain language>
**Rule:** <one crisp, quotable statement of the load-bearing rule/definition/formula>
**Worked example:** <setup → the method, step by step → the answer. Show the method, not just the result.>
**Trap:** <the specific mistake learners make here>
**Key facts:** <3–6 short anchors — the takeaways a question would test>

## §1.1 <Sub-concept, if the topic needs splitting>
...

## §2 <Next concept in teaching order>
...
```

Rules for the structure:

- **Every section carries a Rule, a Worked example, a Trap, and Key facts.** The Rule feeds accurate teaching; the Worked example seeds question patterns and shows method; the Trap becomes good distractors *and* gives the verifier something real to check against; Key facts are the anchors.
- **One concept per section.** If a concept has distinct moves (e.g. "necessary vs sufficient conditions"), give each its own numbered sub-section.
- **Self-contained examples.** For Reading Comprehension, include the passages inside the codex. For every subject, an example must stand alone without external references.
- **Size for whole-indexing.** Keep each document to a size the distiller can index in one pass. If a subject is large, split it into **modules** — separate documents on the same shelf (see per-subject briefs for suggested splits). Number sections continuously *within* a module.

---

## 4. Per-subject authoring briefs

Each brief gives the **concept spine** — the ordered sections to write. This spine *is* the study plan. Follow it, expand where a concept needs sub-sections, and keep every section to one-sitting granularity.

### 1. Logical & Analytical Reasoning
**Spine (in order):** statements & logical form (all/some/none, quantifiers) → deductive validity vs invalidity → the syllogism → conditional logic (if-then, contrapositive; the converse/inverse errors) → necessary vs sufficient conditions → connectives & negation (and/or, De Morgan) → inductive reasoning & pattern inference → analytical puzzles: ordering/sequencing → analytical puzzles: grouping/matching/distribution → relational/spatial reasoning → common formal fallacies.
**Formats:** "which must/could be true," puzzle sets with constraints, series, analogies.
**Neutrality:** use letters, colours, generic actors. **Suggested split if large:** *Deductive Logic* / *Analytical Puzzles* as two modules.

### 2. Quantitative / Numerical Reasoning
**Spine:** number sense → ratio & proportion → percentages & percentage change → averages, mixtures, rates → data interpretation (tables, charts) → number series & patterns → translating word problems to equations → basic counting & probability → estimation & speed/accuracy heuristics.
**Formats:** word problems, data interpretation, series completion.
**Neutrality:** unit-free ("units," "items") or SI; never a real currency. This is the safest subject for the verifier — keep every answer arithmetically unambiguous.

### 3. Critical Reasoning
**Spine:** anatomy of an argument (premise, conclusion, assumption) → finding the conclusion/main point → identifying the necessary assumption → strengthen → weaken → flaw in the reasoning → inference / what must follow → method of reasoning & role of a statement → parallel reasoning → evaluate the argument.
**Formats:** short argument + stem (assumption/strengthen/weaken/flaw/inference).
**Neutrality:** argument topics on universal themes only; no real policies, parties, countries, or named people.

### 4. English Grammar & Usage
**Spine:** parts of speech & sentence structure → subject–verb agreement → tense & aspect consistency → pronoun reference & agreement → modifiers (misplaced/dangling) → prepositions & idiom → articles & determiners → parallelism → punctuation → commonly confused words & usage errors.
**Formats:** error spotting, sentence correction, fill-in, sentence improvement.
**Neutrality:** teach standard international English; where US/UK conventions differ, **pick one, state it explicitly, and be consistent** across all six codexes.

### 5. Reading Comprehension
**Spine:** reading for main idea & purpose → passage structure & organisation → explicit detail retrieval → inference from text → author's tone & attitude → argument & rhetoric within a passage → vocabulary in context → strategy (question-first, mapping).
**Formats:** passage + questions (main idea, detail, inference, tone, vocab).
**Neutrality:** author 4–6 self-contained passages on neutral universal topics (science, history-of-ideas, environment, general essays); no country-specific or culturally-loaded content.

### 6. Legal Reasoning (jurisdiction-neutral)
**Spine:** what legal reasoning tests — rule + facts → application, *not* legal knowledge → reading a rule precisely (elements, conditions, exceptions) → applying a supplied rule to a fact pattern → principle-application questions (given principle + facts → conclusion) → identifying the material facts → analogical reasoning from a supplied precedent → spotting the issue → distinguishing / qualifying → reasoning under competing principles.
**Hard rule:** the rule or principle is **always supplied in the question**. Teach the *application skill* only. **Never** cite a real statute, a real jurisdiction's law, or a named real case — invent neutral principles ("Principle: a person who... is liable for..."). This is what keeps it global and keeps it legally safe.
**Formats:** principle + facts → single best conclusion.

---

## 5. Output & handoff

- **Write every codex into `coach-library/`** alongside this standard — sources and spec version and deploy together.
- **One Markdown file per subject** (or per module for split subjects), following the Section-3 structure exactly.
- **Filename:** `codex-<subject>.md` — e.g. `codex-logical-reasoning.md`, `codex-quant-reasoning.md`, `codex-legal-reasoning.md`. For modules: `codex-logical-reasoning-deductive.md`. Later exam-specific codexes follow the same convention: `codex-clat.md`, `codex-gmat.md`.
- Author **in priority order** (start with Logical & Analytical Reasoning). Each is independent; ship them as they're done.
- **Every future codex** — new subjects and exam-specific ones alike — is authored to this same standard and the same self-check below.

**Self-check before you hand back a codex — every item must be yes:**
- [ ] Substance only — no voice, personality, or teaching persona.
- [ ] Exam-agnostic and culturally/geographically neutral throughout.
- [ ] Sections run foundations → advanced, each one teachable sitting.
- [ ] Every section has Rule + Worked example (method shown) + Trap + Key facts.
- [ ] Every rule is one crisp quotable sentence; every worked answer is unambiguous.
- [ ] A "How this subject is tested" section is present with scope-out fences.
- [ ] No answer-key question bank (engine generates + verifies those).
- [ ] Sized to distill in one pass, or cleanly split into modules.

---

## 6. Note for the engineer (not the author)

These distill to the **shared house corpus**, owned by the single librarian identity, with **no course_id** — distinct from a user's private uploaded material. In the coach room the learner chooses **house coaching** (reads these) or **custom coaching** (reads only their own uploads); the two shelves never mix in a single retrieval call. Seed each codex-PDF through the distiller against the librarian owner. (Architecture already ruled; recorded here so the handoff is self-contained.)
