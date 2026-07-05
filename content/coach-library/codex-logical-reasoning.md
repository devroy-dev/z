# Logical & Analytical Reasoning

*Coach house skill codex. Authored to the v2 standard for skill codices: substance not voice; globally and culturally neutral (letters, colours, generic roles — no real names, places, currencies, or institutions); every rule and every worked example has exactly one defensible, verifiable answer; § is the citation unit; section order is the study plan.*

## Scope

This skill is reasoning from given information to what follows — deductive validity, conditional logic, and the constraint-based deductions of analytical puzzles. It covers formal statements and their logical form, the syllogism, conditionals, necessary and sufficient conditions, connectives and negation, inductive pattern inference, series and analogies, and the ordering, grouping, and relational puzzle types. It deliberately excludes argument evaluation on real-world content (assumptions, strengthen/weaken — that is Critical Reasoning) and any subject-matter knowledge; here the information needed is always supplied.

## How this subject is tested

- **Question formats:** "which must be true" / "which could be true" / "which must be false"; puzzle sets with constraints; series completion; analogies; validity judgements on a supplied argument.
- **Difficulty mix:** ~30% recall/recognition (identifying logical form, valid vs invalid patterns), ~50% application (drawing a valid conclusion, solving a bounded constraint set), ~20% multi-step (chained deductions across several constraints).
- **In scope:** logical form of statements; deductive validity; the syllogism; conditionals and the contrapositive; necessary vs sufficient conditions; and/or and De Morgan's laws; inductive inference; series and analogies; ordering, grouping, and relational puzzles; formal fallacies.
- **Out of scope:** the truth of real-world premises; argument critique on real content (Critical Reasoning); probability calculation (Quantitative Reasoning); any external knowledge — every puzzle is self-contained.
- **Classic traps:** reading "some" as "some but not all"; confusing validity with the truth of the premises; affirming the consequent and denying the antecedent; treating a necessary condition as sufficient; reading an inductive inference as certain.

---

## §1 Categorical statements and logical form

Reasoning starts by stripping a statement to its logical form — the quantifier and the two groups it relates — ignoring the specific content.

**Rule:** A categorical statement has one of four forms — "all A are B," "no A are B," "some A are B," "some A are not B" — and "some" means *at least one* (possibly all), never "some but not all."

**Worked example:** Take "Some A are B." Does it allow that *all* A are B? Method: "some" is defined as "there exists at least one," which is satisfied whether one, several, or every A is a B — so "all A are B" is one way "some A are B" can be true. Therefore "Some A are B" does **not** rule out "All A are B." Conversely, "Some A are B" also does not establish "Some A are not B" — that is a separate claim. Answer: from "some A are B" alone, neither "all A are B" nor "some A are not B" can be concluded.

**Trap:** Reading "some" as "some but not all," and so wrongly inferring "some A are not B" from "some A are B."

**Key facts:** four forms: all-are / no-are / some-are / some-are-not · "some" = at least one · "some A are B" does not imply "some A are not B" · quantifier + two groups = the logical form.

## §2 Deductive validity versus truth

The single most important distinction in the subject: whether a conclusion *follows* is separate from whether the statements are actually true.

**Rule:** An argument is deductively valid when the truth of its premises would *guarantee* the truth of its conclusion — validity is a property of the argument's form, independent of whether the premises are in fact true.

**Worked example:** Consider: "All A are B. All B are C. Therefore all A are C." Method: assume the premises true and test whether the conclusion could still be false. If every A is a B, and every B is a C, then every A must be a C — no case makes the premises true and the conclusion false, so the form is **valid**. Now note validity says nothing about real truth: "All fish can fly; all flying things are green; therefore all fish are green" is equally *valid* (same form) yet has false premises. Validity is about the *link* from premises to conclusion, not their content.

**Trap:** Judging an argument invalid because a premise is factually false, or valid because the conclusion happens to be true — validity concerns only whether the conclusion follows *if* the premises hold.

**Key facts:** valid = premises true would force conclusion true · validity is a matter of form · a valid argument can have false premises · a true conclusion does not make an argument valid.

## §3 The categorical syllogism

A syllogism draws a conclusion about two groups from two premises linked by a shared middle group — and the fastest test of validity is the search for a counterexample.

**Rule:** A categorical syllogism is valid only if *no* assignment of members makes both premises true while the conclusion is false; finding one such counterexample proves it invalid.

**Worked example:** Test: "All A are B. Some B are C. Therefore some A are C." Method: try to build a world where both premises hold but the conclusion fails. Let A = {things also in B}, and let the C's among B be entirely *outside* A. Concretely: all A are B (satisfied), some B are C (the C's sit in B but not in A, so "some B are C" holds), yet *no* A is a C — so "some A are C" is false. A counterexample exists, therefore the syllogism is **invalid**. Contrast the valid "All A are B; all B are C; therefore all A are C," where no counterexample can be built.

**Trap:** Accepting a syllogism because it "sounds right"; the overlap in "some B are C" need not touch A at all, so the shared middle term does not transfer the property.

**Key facts:** two premises, one shared middle term · valid = no counterexample possible · one counterexample proves invalidity · "all A are B + some B are C" does not give "some A are C."

## §4 Conditional logic and the contrapositive

A conditional "if P then Q" makes one guarantee, and exactly one rearrangement preserves it: the contrapositive.

**Rule:** "If P then Q" is logically equivalent to its contrapositive "if not Q then not P"; both are true in exactly the same cases.

**Worked example:** Given "If a figure is a square, then it has four sides." Method: to form the contrapositive, negate both parts and swap them — "if a figure does *not* have four sides, then it is *not* a square." Check equivalence: any figure lacking four sides cannot be a square (since every square has four sides), so the contrapositive holds whenever the original does. If you are told a particular figure does not have four sides, you may validly conclude it is not a square. Answer: the only guaranteed rearrangement of "if P then Q" is "if not Q then not P."

**Trap:** Assuming that knowing Q is true tells you P is true — the conditional only runs P → Q, so Q gives you nothing about P.

**Key facts:** "if P then Q" ≡ "if not Q then not P" · negate *and* swap to form the contrapositive · P → Q lets you conclude Q from P, and not-P from not-Q · nothing else is guaranteed.

## §4.1 The converse and inverse errors

Two rearrangements of a conditional look valid but are not — they are the classic conditional fallacies.

**Rule:** The converse ("if Q then P") and the inverse ("if not P then not Q") do **not** follow from "if P then Q."

**Worked example:** From "If it is a square, then it has four sides," test the converse "if it has four sides, then it is a square." Method: find a counterexample — a rectangle that is not a square has four sides but is not a square, so the converse fails. The inverse "if it is not a square, then it does not have four sides" fails for the same rectangle (not a square, yet four sides). Answer: converse and inverse are both invalid; only the contrapositive is guaranteed.

**Trap:** Affirming the converse — sliding from "P → Q" to "Q → P" — the most common conditional error.

**Key facts:** converse ("if Q then P") = invalid · inverse ("if not P then not Q") = invalid · a counterexample (four-sided non-square) breaks both · only the contrapositive is equivalent.

## §5 Necessary versus sufficient conditions

"Enough to guarantee" and "required for" are different relationships, and swapping them is a frequent error.

**Rule:** P is *sufficient* for Q when P guarantees Q (P → Q); P is *necessary* for Q when Q cannot hold without P (Q → P, equivalently not-P → not-Q).

**Worked example:** Say "Having a valid ticket is necessary to enter." Method: "necessary" means entry cannot occur without it — so *no ticket ⇒ no entry* (Q → P form: entry ⇒ ticket). It does **not** mean a ticket is *sufficient*: holding a ticket does not guarantee entry (there may be other conditions). Now compare "Pressing the button is sufficient to sound the alarm": pressing guarantees the alarm (P → Q), but the alarm might also sound another way, so pressing is not *necessary*. Answer: necessary ⇒ its absence blocks the outcome; sufficient ⇒ its presence forces the outcome; a condition can be one, the other, both, or neither.

**Trap:** Treating a necessary condition as sufficient (assuming the ticket guarantees entry) or a sufficient condition as necessary (assuming the alarm can only sound via the button).

**Key facts:** sufficient: P → Q (presence forces outcome) · necessary: Q → P (absence blocks outcome) · necessary ≠ sufficient · a condition may be both, one, or neither.

## §6 Connectives, negation, and De Morgan's laws

Combining statements with "and"/"or" and negating them correctly is governed by two exact rules.

**Rule:** By De Morgan's laws, "not (P and Q)" is equivalent to "(not P) or (not Q)," and "not (P or Q)" is equivalent to "(not P) and (not Q)"; "or" is inclusive (P, or Q, or both) unless stated otherwise.

**Worked example:** Negate "The room is both locked and empty." Method: the statement is "locked AND empty," so its negation is "not (locked and empty)" = "not locked OR not empty" — i.e. the negation is true whenever the room is unlocked, or occupied, or both. It is **not** "unlocked and occupied," which would require *both* to fail. Check: if the room is locked but occupied, the original ("locked and empty") is false, and "not locked or not empty" is true (not empty) — consistent. Answer: the correct negation is "the room is not locked, or it is not empty."

**Trap:** Negating "P and Q" as "not-P and not-Q" (instead of "not-P or not-Q") — flipping the connective is the step learners drop.

**Key facts:** not(P and Q) = not-P or not-Q · not(P or Q) = not-P and not-Q · negating flips the connective · "or" is inclusive by default.

## §7 Inductive reasoning and pattern inference

Induction generalises from cases to a *probable* conclusion — strong support, never a guarantee.

**Rule:** An inductive inference moves from observed cases to a broader or predicted conclusion that the evidence makes *likely but not certain*; adding a case consistent with the pattern strengthens it, a counter-case weakens it.

**Worked example:** Observed: the sequence so far is circle, square, circle, square, circle. Method: identify the simplest rule fitting all cases — strict alternation of circle and square — and project it: the next term is most likely a square. But note the logical status: alternation is the *best-supported* continuation, not the *only* logically possible one (the true rule could differ after the observed portion). So "square" is a strong inductive prediction, not a deductive certainty. Answer: the best-supported next term is a square, held as probable, not guaranteed.

**Trap:** Treating an inductive conclusion as certain — a strong pattern makes a prediction likely, but unlike a valid deduction it can still turn out false.

**Key facts:** induction = cases → probable conclusion · strength, not validity · consistent case strengthens, counter-case weakens · best-supported ≠ only possible.

## §8 Number and letter series

A series is solved by finding the single consistent operation that generates each term from the ones before it.

**Rule:** To solve a series, identify the operation relating consecutive terms (or their differences) that holds across *every* given term, then apply it once more.

**Worked example:** Solve 2, 6, 12, 20, 30, ? Method: take first differences — 6−2=4, 12−6=6, 20−12=8, 30−20=10 — which increase by 2 each step, so the next difference is 12, giving 30+12 = **42**. Confirm with a closed form: each term is n(n+1) for n = 1,2,3,4,5 (1·2=2, 2·3=6, 3·4=12, 4·5=20, 5·6=30), so the sixth term is 6·7 = 42. Both methods agree. Answer: 42.

**Trap:** Fixing on a rule that fits the first two terms but fails a later one — a valid rule must reproduce *all* the given terms before it is used to extend the series.

**Key facts:** find the operation consistent across all terms · check differences (and second differences) · verify against every given term · confirm with a closed form where possible.

## §9 Analogies

An analogy asks you to find the relationship in the first pair and apply the *same* relationship to complete the second.

**Rule:** To complete "A is to B as C is to ?", state the exact transformation from A to B, then apply that identical transformation to C.

**Worked example:** Solve "AC : BD :: EG : ?" Method: find the rule from AC to BD — A→B is +1 in the alphabet, C→D is +1 — so the rule is "advance each letter by one." Apply to EG: E→F, G→H, giving **FH**. Verify the rule is consistent across both letters of the source pair (both +1), so it transfers unambiguously. Answer: FH.

**Trap:** Latching onto a relationship that fits one element but not the other (e.g. spotting A→B as +1 but ignoring that C→D must follow the same rule) — the transformation must hold for the whole pair.

**Key facts:** identify the exact A→B transformation · apply the identical rule to C · the rule must fit every part of the source pair · here: advance each letter by one → FH.

## §10 Analytical puzzles: ordering and sequencing

Ordering puzzles fix items into positions using constraints; the deductions often force facts the constraints never state directly.

**Rule:** In an ordering puzzle, combine the constraints to eliminate impossible placements until only the forced arrangements remain, then read off what *must* be true across all of them.

**Worked example:** Five items P, Q, R, S, T occupy positions 1–5 left to right, with: (i) P is immediately left of Q; (ii) R is somewhere left of S; (iii) T is at position 3. Question: what must be true of R and S? Method: T fixes position 3, so the P–Q block (two adjacent cells) fits only in positions 1–2 or 4–5. If P–Q takes 1–2, then R and S take 4–5, and (ii) forces R=4, S=5. If P–Q takes 4–5, then R and S take 1–2, and (ii) forces R=1, S=2. In *both* surviving arrangements, S sits immediately to the right of R. Answer: "S is immediately to the right of R" **must be true** — even though constraint (ii) only said R was *somewhere* left of S.

**Trap:** Stopping at "R is left of S" (the stated constraint) and missing that the structure forces the stronger fact that they are adjacent — always test what the *combination* of constraints forces.

**Key facts:** place fixed items first (T at 3) · treat "immediately left" pairs as a movable block · enumerate the surviving arrangements · a "must be true" holds in *every* surviving arrangement.

## §11 Analytical puzzles: grouping, matching, and distribution

Grouping puzzles assign items to categories under constraints; counting the slots often forces an assignment on its own.

**Rule:** In a grouping puzzle, use the group sizes and constraints together — once a group's slots are filled by forced members, every remaining item is pushed into the other group(s).

**Worked example:** Four people W, X, Y, Z are split into two teams, Red and Blue, two per team, with: (i) W and X are on different teams; (ii) Y is on Red. Question: which team is Z on? Method: constraint (i) means exactly one of W, X is on Red and the other on Blue. Red has two slots; one is taken by Y (given), and the other must be the one of W/X that is on Red — so Red = {Y, one of W or X} and is now full. That leaves Z (and the other of W/X) for Blue. So Z is forced onto Blue regardless of which of W/X is Red. Answer: **Z is on Blue** — it must be true.

**Trap:** Trying to place Z first and finding "it could be either"; the deduction comes from filling Red's two slots (Y plus one of the split pair), which leaves no Red slot for Z.

**Key facts:** track group sizes as hard limits · a "split across groups" constraint uses up one slot in each · fill the constrained group first · leftover items are forced into the remaining group.

## §12 Relational and spatial reasoning

Relational puzzles chain comparisons; when the relation is transitive, the chain fixes a complete order.

**Rule:** A transitive relation (such as "taller than") lets you chain comparisons — if A is greater than B and B is greater than C, then A is greater than C — to assemble a full ordering from partial ones.

**Worked example:** Given: A is taller than B; C is shorter than B; D is taller than A. Question: who is tallest? Method: rewrite each as a "greater-than" link — A > B, B > C (since C is shorter than B), and D > A. Chain them: D > A, A > B, B > C, giving the single order D > A > B > C. The top of the chain is D. Answer: **D is the tallest**, and the full order is D, A, B, C from tallest to shortest.

**Trap:** Reversing a comparison when rewriting ("C is shorter than B" becoming "C > B") — fix a single direction (here, "greater = taller") and convert every statement into it before chaining.

**Key facts:** transitive relation: A>B and B>C ⇒ A>C · convert every comparison to one consistent direction · chain the links into a single order · the chain's top/bottom answers "most/least."

## §13 Common formal fallacies

A handful of invalid patterns recur; recognising the pattern is enough to reject the argument.

**Rule:** The core formal fallacies are affirming the consequent ("P → Q; Q; therefore P"), denying the antecedent ("P → Q; not P; therefore not Q"), the undistributed middle ("all A are B; all C are B; therefore A and C are related"), and illicit conversion (treating "all A are B" as "all B are A") — each is invalid because a counterexample can always be built.

**Worked example:** Test affirming the consequent: "If it is a square, then it has four sides. This figure has four sides. Therefore it is a square." Method: the conditional runs square → four sides, but the argument uses "four sides" (the consequent) to conclude "square" (the antecedent) — the converse direction, which is not guaranteed. Counterexample: a non-square rectangle has four sides yet is not a square. So the argument is **invalid**. Denying the antecedent fails the same way ("it is not a square, therefore it does not have four sides" — again the rectangle breaks it).

**Trap:** Being persuaded by a fallacy because its conclusion is plausible; validity depends on the pattern, and each of these patterns admits a counterexample regardless of how reasonable the conclusion sounds.

**Key facts:** affirming the consequent: Q, so P — invalid · denying the antecedent: not-P, so not-Q — invalid · undistributed middle: shared B does not link A and C · illicit conversion: "all A are B" ≠ "all B are A" · each is broken by a counterexample.
