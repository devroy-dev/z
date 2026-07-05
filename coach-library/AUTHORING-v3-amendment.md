# AUTHORING.md — v3 amendment (subject-knowledge variant)

*Apply: append the section below to `coach-library/AUTHORING.md`, bump the status header to v3, and add the changelog line. This is a surgical addition — it does not alter any v2 rule; it adds a second, clearly-scoped codex type alongside the six universal skill codices.*

---

## Codex types: SKILL codices vs SUBJECT-KNOWLEDGE codices

The standard now governs two kinds of coach codex. They share the same §-structure (Scope / How-tested / §-sections each carrying **Rule + Worked example + Trap + Key facts**; section order = study plan) but obey different constraint sets.

**1. Skill codices (the v1/v2 default).** The six universal skills (logical reasoning, quant, critical reasoning, grammar, reading comp, legal reasoning) and anything like them. These obey all v2 non-negotiables *including* constraint #2 (cultural/geographic **neutrality**) and constraint #4 (**one defensible answer**). A skill is content-agnostic and has a keyable right answer; that is what makes it a skill.

**2. Subject-knowledge codices (new in v3).** Courses that teach a *body of contested real-world knowledge* — history, the global economy, geopolitics, law, democracy, political philosophy, war/just-war, technology governance, religion/secularism, environment/climate policy (the ten converted Battlefield domains), and future courses of that kind. These are irreducibly *about* real countries, thinkers, dates, and debates, so they **cannot** satisfy constraint #2, and they are built around genuinely contested questions, so they **cannot** satisfy constraint #4 as written. They obey the three locked adaptations below instead.

### The three locked adaptations (subject-knowledge codices only)

1. **Neutrality (#2) is WAIVED.** Real named content is kept — Ricardo, China 1978, Rawls, the 1994 Rwandan genocide. Do not sand off the names; the named cases *are* the substance. (Constraint #2 still fully governs skill codices.)

2. **The Rule field is ALWAYS a defensible fact — never a verdict.** In every section, the `**Rule:**` line must be a definition, an attribution, a mechanism, a school's stated position, a dated event, or **the crux a contested question turns on**. All of these have clean, keyable answers. A verdict ("free trade beats aid," "the intervention was justified") is *never* a Rule.

3. **The contested verdict is TAUGHT, never keyed.** Debate sections teach the disagreement: the Rule states the crux ("this question turns on X"); the Worked example presents the strongest case on **both** sides, marked **"taught, not keyed"**; the Trap names the fallacy. The engine may quiz knowledge *of* the debate — "what is the standard objection to X," "what does this question turn on," "state the mechanism each side claims" — but **no quiz item ever has "which side is right" as its key.** This firewall is what lets the verify-pass operate safely on contested material: warmth/coverage colours the teaching prose; the answer key only ever touches defensible facts.

### Section architecture for a subject-knowledge codex

Mirror the ten converted domains: **Scope** → **How this subject is tested** (formats, difficulty mix ~35/45/20, in-scope, out-of-scope [the verdict layer lives here], classic traps) → **foundations §§** (grouped vocabulary; each Rule a definition/mechanism) → **schools §§** (each school: claim → mechanism → strongest case → standard objection, with the objection in the Trap) → **factual-record §§** (dated episodes; each Rule a settled fact) → **debate §§** (crux as Rule; both blades in the Worked example, "taught, not keyed"; fallacy in the Trap) → a final **"most error-prone claims" §** carrying the myth-corrections as high-value defensible quiz material.

### What stays identical to v2

House subject-knowledge codices are authored **brief-direct** (bypass the Sonnet clerk; § is the citation unit; no page anchors; declared-gaps normally empty). The lightweight embed-and-insert ingest still runs (parse §s → Voyage voyage-4 embed → insert `coach_briefs`/`coach_brief_sections` under the librarian owner, no `course_id`; the sync trigger builds FTS/HNSW). Size each section to one teachable sitting; split into modules only on genuine overflow. The Sonnet clerk remains reserved for user-uploaded custom material.

---

## Changelog line to add

`v3 — Adds the SUBJECT-KNOWLEDGE codex type alongside the six SKILL codices. Subject-knowledge codices teach contested real-world bodies of knowledge (the ten Battlefield domains and kin): neutrality (#2) waived; Rule is always a defensible fact, never a verdict; contested verdicts are taught in the Worked example ("taught, not keyed"), never quiz-keyed. Skill codices are unchanged and still obey neutrality + one-defensible-answer. Brief-direct authoring, embed-and-insert ingest, and clerk-for-uploads-only all carry over from v2.`
