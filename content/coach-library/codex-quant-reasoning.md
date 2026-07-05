# Quantitative & Numerical Reasoning

*Coach house skill codex. Authored to the v2 standard for skill codices: substance not voice; globally and culturally neutral (unit-free or SI quantities — "units," "items" — never a real currency); every rule and every worked example has exactly one correct, arithmetically verifiable answer; § is the citation unit; section order is the study plan.*

## Scope

This skill is quantitative reasoning — arithmetic relationships, ratios, percentages, averages, rates, data interpretation, series, and elementary counting and probability — applied to solve word and data problems. It covers the calculation methods and the translation of a stated problem into the right operation. It deliberately excludes advanced algebra, calculus, formal proof, and any culture- or currency-specific content; all quantities are unit-free or in neutral units.

## How this subject is tested

- **Question formats:** word problems; data interpretation from tables and charts; series completion; single-value computation.
- **Difficulty mix:** ~30% recall/recognition (applying a known formula), ~50% application (setting up and solving a one- or two-step problem), ~20% multi-step (chained operations, successive changes, multi-stage probability).
- **In scope:** order of operations; ratio and proportion; percentages and percentage change; averages and weighted averages; rates, speed, and work; data interpretation; number series; translating words to equations; basic counting and probability; estimation.
- **Out of scope:** algebra beyond linear equations; trigonometry, calculus, and proof; statistics beyond the mean; any real-currency or region-specific figures.
- **Classic traps:** ignoring order of operations; dividing a ratio by one term instead of the sum; using the new value as the percentage base; adding successive percentage changes instead of multiplying; averaging times instead of adding rates.

---

## §1 Operations and their order

Every multi-operation calculation has one correct value, fixed by the order in which operations are carried out.

**Rule:** Evaluate in the order brackets, then exponents, then multiplication and division (left to right), then addition and subtraction (left to right).

**Worked example:** Evaluate 2 + 3 × 4² − 6. Method: exponent first, 4² = 16; then multiplication, 3 × 16 = 48; then left-to-right addition and subtraction, 2 + 48 − 6 = 44. Answer: **44**. (Evaluating strictly left to right instead would wrongly give 2+3=5, ×16=80, −6=74 — which violates precedence.)

**Trap:** Working left to right and ignoring that exponents and multiplication bind before addition.

**Key facts:** brackets → exponents → ×/÷ (left to right) → +/− (left to right) · 2 + 3 × 4² − 6 = 44 · multiplication binds before addition · division and multiplication share a level, resolved left to right.

## §2 Ratio and proportion

A ratio splits a total into shares; each share is the total scaled by that term over the sum of terms.

**Rule:** To divide a quantity N in the ratio a : b, give each part N × (its term) ÷ (a + b).

**Worked example:** Divide 60 units in the ratio 2 : 3. Method: the terms sum to 2 + 3 = 5, so one part is 60 × 2 ÷ 5 = 24 units and the other is 60 × 3 ÷ 5 = 36 units. Check: 24 + 36 = 60, and 24 : 36 simplifies to 2 : 3. Answer: **24 units and 36 units**.

**Trap:** Dividing by a single term (60 ÷ 2 and 60 ÷ 3) instead of by the sum of the terms — the shares must add back to the original total.

**Key facts:** share = N × term ÷ (sum of terms) · 60 in 2:3 → 24 and 36 · shares must sum to N · a ratio is unchanged by scaling both terms equally.

## §3 Percentages and percentage change

A percentage change is always measured against the *original* value, and successive changes multiply rather than add.

**Rule:** Percentage change = (new value − old value) ÷ old value × 100, measured against the old (starting) value.

**Worked example:** A quantity rises from 80 to 100 units. Method: change = (100 − 80) ÷ 80 × 100 = 20 ÷ 80 × 100 = 25%. To reverse-check, 80 increased by 25% is 80 × 1.25 = 100. Answer: a **25% increase**. Note on successive changes: a +10% then a +20% gives 1.10 × 1.20 = 1.32, a net **+32%**, not +30% — percentage changes multiply, they do not add.

**Trap:** Using the new value as the base (20 ÷ 100 = 20%) instead of the old value, and adding successive percentages instead of multiplying the factors.

**Key facts:** % change = (new − old) ÷ old × 100 · 80 → 100 is a 25% increase · successive changes multiply (1.10 × 1.20 = 1.32) · a p% increase means × (1 + p/100).

## §4 Averages

The arithmetic mean is the total shared equally; changing the count is as important as changing the total.

**Rule:** The arithmetic mean = (sum of the values) ÷ (number of values).

**Worked example:** Find the mean of 4, 8, 10, 14. Method: sum = 4 + 8 + 10 + 14 = 36; count = 4; mean = 36 ÷ 4 = 9. Answer: **9**. Now add a fifth value of 19: the new sum is 36 + 19 = 55 over 5 values, so the mean becomes 55 ÷ 5 = 11 — adding a value above the old mean pulls the mean up.

**Trap:** Updating the sum but forgetting the count also changes when a value is added or removed — divide by the *new* count.

**Key facts:** mean = sum ÷ count · mean of 4,8,10,14 = 9 · adding a value equal to the mean leaves it unchanged · adding a value above the mean raises it.

## §5 Weighted averages and mixtures

When quantities of different sizes are combined, the overall average is weighted by each quantity.

**Rule:** The weighted mean of values with weights w₁, w₂, … is (w₁·x₁ + w₂·x₂ + …) ÷ (w₁ + w₂ + …).

**Worked example:** Combine 2 units measured at value 10 with 3 units measured at value 20; find the overall value per unit. Method: weighted total = 2 × 10 + 3 × 20 = 20 + 60 = 80; total weight = 2 + 3 = 5; weighted mean = 80 ÷ 5 = 16. Answer: **16 per unit**. (The simple average of 10 and 20 is 15, but the larger quantity at 20 pulls the true average above 15.)

**Trap:** Taking the plain average of the values (15) and ignoring that the quantities differ — the larger quantity carries more weight.

**Key facts:** weighted mean = Σ(wᵢxᵢ) ÷ Σwᵢ · 2 at 10 and 3 at 20 → 16 · the weighted mean leans toward the larger quantity · equal weights reduce it to the simple average.

## §6 Rates, speed, and work

Rate problems combine a quantity, a rate, and a time; combined rates add, combined times do not.

**Rule:** Quantity = rate × time (so distance = speed × time); when two agents work together, their rates add, and the combined time is the reciprocal of the combined rate.

**Worked example:** Two problems. Speed: covering 120 units of distance at 40 units per hour takes time = 120 ÷ 40 = 3 hours. Work: if one agent completes a task in 6 hours (rate 1/6 per hour) and another in 3 hours (rate 1/3 per hour), their combined rate is 1/6 + 1/3 = 1/6 + 2/6 = 3/6 = 1/2 per hour, so together they finish in 1 ÷ (1/2) = 2 hours. Answers: **3 hours** and **2 hours**.

**Trap:** Averaging the two individual times (6 and 3 averaging to 4.5) instead of adding the rates — rates add, times do not.

**Key facts:** quantity = rate × time · 120 at 40/hr → 3 hours · combined rate = sum of rates · together-time = 1 ÷ (combined rate); 1/6 + 1/3 → 2 hours.

## §7 Data interpretation

Reading a table or chart means locating the right cells and combining them with the correct operation.

**Rule:** To answer a data-interpretation question, identify the exact rows/columns the question refers to, then apply the required operation (sum, difference, ratio, or percentage) to those figures only.

**Worked example:** Consider this table of quantities (in units):

| Category | Period 1 | Period 2 |
|----------|----------|----------|
| A        | 20       | 30       |
| B        | 30       | 30       |
| C        | 50       | 60       |

Find Category A's share of the Period 2 total. Method: sum the Period 2 column, 30 + 30 + 60 = 120; A's Period 2 value is 30; share = 30 ÷ 120 = 0.25 = 25%. Answer: **25%**.

**Trap:** Using the wrong total (e.g. the Period 1 total, 100) or the wrong row — anchor to the exact period and category the question names.

**Key facts:** locate the exact cells first · Period 2 total = 120 · A's Period 2 share = 30 ÷ 120 = 25% · a "share" divides the part by the relevant total, not the grand total of everything.

## §8 Number series and patterns

A series has one governing rule that must reproduce every given term before it is used to extend the sequence.

**Rule:** Solve a series by finding the operation (or the pattern of differences) that generates each term from the previous ones and holds across *all* given terms, then apply it once more.

**Worked example:** Solve 3, 6, 11, 18, 27, ? Method: first differences are 6 − 3 = 3, 11 − 6 = 5, 18 − 11 = 7, 27 − 18 = 9 — increasing by 2 each time, so the next difference is 11, giving 27 + 11 = 38. Confirm with a closed form: each term is n² + 2 for n = 1, 2, 3, 4, 5 (1 + 2 = 3, 4 + 2 = 6, 9 + 2 = 11, 16 + 2 = 18, 25 + 2 = 27), so the sixth term is 36 + 2 = 38. Both agree. Answer: **38**.

**Trap:** Choosing a rule that fits the first two or three terms but fails a later one — a valid rule must reproduce every given term.

**Key facts:** find the rule consistent across all terms · check first (and second) differences · 3,6,11,18,27 → 38 · confirm with a closed form (here n² + 2).

## §9 Translating word problems to equations

A word problem is solved by naming the unknown, writing the stated relationships as an equation, and solving.

**Rule:** Assign a variable to the unknown, translate each stated relationship into an equation, then solve for the variable.

**Worked example:** "A number increased by 8 equals three times the number. Find it." Method: let the number be x; "increased by 8" is x + 8, "three times the number" is 3x, so x + 8 = 3x. Subtract x from both sides: 8 = 2x, so x = 4. Check: 4 + 8 = 12 and 3 × 4 = 12. Answer: **4**.

**Trap:** Mis-assigning which quantity is multiplied or added — translate each phrase literally ("three times the number" is 3x, not x + 3) before solving.

**Key facts:** name the unknown · turn each phrase into an equation · x + 8 = 3x → x = 4 · always substitute the solution back to check.

## §10 Basic counting

Whether order matters decides which counting rule applies — permutations for ordered selections, combinations for unordered.

**Rule:** From n distinct items, the number of *ordered* selections of r is n! ÷ (n − r)!, and the number of *unordered* selections of r is n! ÷ [r! (n − r)!].

**Worked example:** Choose 2 items from 4 distinct items where order does not matter. Method: this is a combination, so the count is 4! ÷ [2! × 2!] = 24 ÷ (2 × 2) = 24 ÷ 4 = 6. Answer: **6**. (If order *did* matter, it would be a permutation: 4! ÷ 2! = 24 ÷ 2 = 12.)

**Trap:** Using permutations (12) when order does not matter, which double-counts each pair once in each order.

**Key facts:** ordered = n!/(n−r)! · unordered = n!/[r!(n−r)!] · choose 2 of 4 unordered = 6 · order-mattering counts are larger than order-free counts.

## §11 Basic probability

A probability is favourable outcomes over total equally-likely outcomes, and in multi-stage problems the totals can change between stages.

**Rule:** Probability = (number of favourable outcomes) ÷ (total number of equally-likely outcomes), a value between 0 and 1; for successive draws without replacement, update the counts at each stage.

**Worked example:** A bag holds 3 red and 2 blue items (5 in total). Method: the probability the first draw is red is 3 ÷ 5. For *both* of two draws (without replacement) to be red, multiply the first probability by the second, computed after one red is removed: (3 ÷ 5) × (2 ÷ 4) = 6 ÷ 20 = 3 ÷ 10. Answer: P(red first) = **3/5**, and P(both red) = **3/10**.

**Trap:** Reusing 3/5 for the second draw — without replacement the counts drop to 2 red out of 4 remaining.

**Key facts:** P = favourable ÷ total, between 0 and 1 · P(red) = 3/5 · without replacement, update counts each stage · P(both red) = (3/5)(2/4) = 3/10.

## §12 Estimation and speed heuristics

Rounding to convenient values gives a fast bound that checks whether an exact answer is the right order of magnitude.

**Rule:** To estimate, round each quantity to a convenient value, compute, and note the direction of rounding so you know whether the estimate is high or low.

**Worked example:** Estimate 297 × 41. Method: round to 300 × 40 = 12,000. Since 297 was rounded up (by 3) and 41 rounded down (by 1), the estimate is close; the exact value is 297 × 41 = 297 × 40 + 297 = 11,880 + 297 = 12,177. Answer: estimate **12,000**, exact **12,177** — the estimate is within about 1.5%, confirming the exact figure's order of magnitude.

**Trap:** Rounding both factors the same direction, which compounds the error rather than partly cancelling it.

**Key facts:** round to convenient values, then refine · 297 × 41 ≈ 12,000 (exact 12,177) · track the direction of each rounding · use estimation to sanity-check the exact answer's magnitude.
