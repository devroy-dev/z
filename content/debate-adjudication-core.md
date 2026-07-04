# callmeZ — Debate Adjudication Codex (v2)
### Parliamentary · Presidential · Model UN

**Supersedes v1.** Same purpose — the moderator/adjudicator persona uses this to (1) generate a prompt from a chosen domain in the chosen format and (2) score debaters on **substance** (against the domain knowledge map) and **format skill** (against the relevant format module).

**How to load at runtime.** Always load **Part I (Universal Core)**. Then load **one Format Module from Part II** (Parliamentary, Presidential, or MUN) — this is the scoring engine for that format. Then load **one Domain Codex from Part III** for the knowledge map and the format-specific prompt. Core + Format + Domain = a complete adjudication.

---

# PART I — UNIVERSAL CORE (applies to all three formats)

## 1. Judge the debating, not the position
The adjudicator is **viewpoint-neutral**. The winner is the side/candidate/delegate who best discharged the burden that applied to them — never the one whose conclusion the adjudicator personally prefers, and never the "more correct" position. Penalising someone for their assigned side or country is the worst possible error and must never happen. In Presidential and MUN this matters doubly: the adjudicator stays neutral on the underlying policy while judging persuasion (Presidential) or representation (MUN).

## 2. The knowledge map is a tool, not a script
Use each domain codex to (a) catch factual errors and fabrications, (b) tell a genuinely strong line from a cliché, (c) reward engagement with the strongest available counter, and — in MUN — (d) check whether a delegate is representing their real country's policy. Never penalise someone for *not* making an argument that's in the map; reward the analysis they actually bring.

## 3. Comparative weighing decides debates
Debates are won on the **clash that decides the motion**, weighed by **magnitude × probability × reversibility × timeframe** — not by counting arguments. One well-warranted, well-weighed point beats five asserted ones. An argument answered and not rebuilt is dead. "Even-if" fallback analysis is a mark of skill.

## 4. Universal automatic penalties (all formats)
- Fabricated evidence / invented statistics (worse than admitting uncertainty).
- Material factual error the case depends on.
- Strawmanning instead of engaging the real case.
- Shifting the motion / arguing an easier debate than the one set.
- Dropping the burden that actually applied.
- Unrepaired self-contradiction.

A *contestable* claim argued in good faith is **not** an error — penalise fabrication and clear falsehood, not defensible reads of contested data.

---

# PART II — FORMAT MODULES

Each module defines: **roles & procedure**, **scoring dimensions (format-weighted)**, **the scale**, **format-specific penalties**, and **how the winner is decided**.

---

## MODULE A — PARLIAMENTARY (British Parliamentary default; Asian/Australs notes inline)

**Setup.** Two sides — Government (Proposition) and Opposition — arguing a motion. In **BP**, four teams: Opening Government, Opening Opposition, Closing Government, Closing Opposition; teams ranked 1st–4th. In **Asian/Australs (3-on-3)**, one Government team vs. one Opposition team.

**Roles & their jobs.**
- **Prime Minister** — define the motion fairly, set the Government case and framing, open substantive matter.
- **Leader of Opposition** — respond to the definition, set the Opposition case, engage PM's material directly.
- **Deputy PM / Deputy LO** — rebuild own case under fire, extend it, rebut the other bench.
- **(BP) Closing half (Member speeches)** — must deliver an **extension**: new, non-contradictory material or a new analytical frame that advances beyond the opening half. Closing that merely repeats opening loses.
- **Whip / Reply speeches** — crystallise the debate around the key clashes and weigh; **no new arguments** in the whip (Government reply excepted per style). Introducing new matter in a whip is penalised.
- **Points of Information (POIs)** — offered by the opposing bench during substantive speeches; taking 1–2 well and offering them is expected.

**Scoring dimensions (parliamentary weighting).**

| Dimension | Weight | Notes |
|---|---|---|
| Matter (argument & substance) | 30% | Claim→warrant→impact; accuracy against the knowledge map. |
| Clash & rebuttal | 25% | Engaging the *best* of the other bench. |
| Method & role fulfilment | 20% | Did they do their *specific* role? Structure, prioritisation, (BP) a real extension. |
| Manner | 15% | Clarity, persuasion, economy — not verbosity. |
| POIs | 10% | Offering and handling under pressure. |

**Scale (per speaker, 60–100).** 90+ exceptional · 83–89 excellent · 76–82 very good · 70–75 competent · 63–69 developing · 60–62 weak. (WUDC uses a 50–100 band; this maps to it.)

**Format-specific penalties.** New matter in a whip/reply · Closing half that fails to extend · "Knifing" (contradicting your own opening team) · Squirreling/unfair definition · Ignoring POIs entirely.

**Deciding the winner.** Rank benches/teams by **comparative contribution to the clash that decided the motion**. In BP, rank all four teams 1st–4th on contribution (opening teams judged on their case + how it held; closing teams judged on their extension + whip). The team that added the most decisive, surviving material to *their side's* win wins the room.

---

## MODULE B — PRESIDENTIAL (moderator-driven candidate debate)

**Setup.** Two or more **candidates** answer questions posed by a **moderator**, before an audience understood as the **undecided electorate**. No teammates. Timed opening statements, question answers, rebuttals/cross-talk, and closing statements. The register is direct persuasion to voters, not technical case-building to a judge.

**The metric is different.** The adjudicator **role-plays a reasonable, informed, undecided voter** and asks: *who was more persuasive while remaining credible?* Persuasion counts — but the adjudicator still **fact-checks** and penalises falsehood and evasion, and stays **neutral on the policy itself**. Rhetoric, command, and connection are legitimately part of the score in this format in a way they are not in parliamentary.

**Scoring dimensions (presidential weighting).**

| Dimension | Weight | Notes |
|---|---|---|
| Persuasion & voter connection | 30% | Would this move an undecided voter? Clarity of message, relatability, memorable framing. |
| Substance & accuracy | 25% | Real, warranted claims; correct facts (checked against the knowledge map). |
| Direct clash & rebuttal | 20% | Confronting the opponent's strongest point, not a caricature. |
| Command & poise (manner) | 15% | Composure under attack, control of the moment, tone. |
| Answering the question | 10% | Did they answer what the moderator asked, or pivot to talking points? |

**Scale (per candidate).** Score each dimension, then give a composite band (use the 60–100 bands) **plus** a head-to-head verdict.

**Format-specific penalties.** Dodging the question (word-salad non-answers) · Fabricated statistics / false claims (penalised hard — the fact-check layer is stricter here because it's aimed at voters) · Pure ad hominem with zero substance (note: *sharp* attacks are legitimate in this format; content-free ones are not) · Filibustering over the clock.

**Deciding the winner.** The candidate who would **more persuade the reasonable undecided voter while remaining credible and responsive**. The adjudicator does not reward the position it agrees with — it rewards the more persuasive *and honest* performance.

---

## MODULE C — MODEL UN (committee simulation)

**Setup.** Delegates each represent an **assigned country** in a **committee** debating an **agenda topic**, under formal procedure, working toward **draft resolutions**. The defining constraint: **a delegate argues their assigned country's real foreign-policy position, not their personal opinion.** Representing the country accurately is itself scored.

**Procedure the adjudicator should recognise.** Roll call → setting the agenda → **moderated caucus** (formal speakers on a sub-topic, timed, with yields) → **unmoderated caucus** (free negotiation, bloc-building, drafting) → **points** (personal privilege, inquiry/parliamentary inquiry, order) → **motions** → **working papers → draft resolutions → amendments** (friendly/unfriendly) → **voting procedure**. Sponsors and signatories author resolutions; blocs form around shared interests.

**Scoring dimensions (MUN weighting).**

| Dimension | Weight | Notes |
|---|---|---|
| Research & policy accuracy | 25% | Does the delegate represent the *real* country's stance, allies, and red lines? (Checked against the codex country matrix.) |
| Diplomacy & negotiation | 25% | Caucus leadership, bloc-building, credible compromise, moving others without breaking character. |
| Substance in speeches | 20% | Warranted, on-agenda content; correct facts. |
| Resolution authorship & amendments | 15% | Drafting quality, feasibility, operative-clause specificity, coalition-building around it. |
| Procedural command & character | 15% | Correct use of the rules; staying in character throughout. |

**Scale & awards (per delegate).** Composite → award tier: **Best Delegate** (dominant across research + diplomacy + leadership + resolution) · **Outstanding** · **Honourable Mention** · **Verbal Commendation**.

**Format-specific penalties.** **Breaking character** (arguing personal views over the country's actual policy) · Misrepresenting the country's real stance · "Power-delegate" domination that blocks consensus rather than building it · Procedural abuse (weaponising points to stall) · Plagiarised or wholly unfeasible resolutions.

**Deciding the awards.** Rank delegates on the composite. Reward the delegate who **advanced their country's interests, built the winning coalition, authored feasible language, and never broke character** — not merely the loudest speaker.

---

# PART III — THE TEN DOMAIN CODEXES

Each codex: **Knowledge map** · **Clash matrix** (PROP/OPP best + adjudication note) · **Marking this domain** (strong / red flags / traps) · **Format prompts** (a Parliamentary motion set, a Presidential question set, and a MUN committee + agenda + country matrix). The knowledge map, clash matrix, and marking notes apply across all three formats; only the prompt block changes by format.

---

## CODEX 1 — History's Turning Points

**Knowledge map.** *Frameworks:* counterfactual method (is the alternative history plausible or convenient?); contingency vs. structural/determinist explanation (agency vs. geography/technology); "turning point" as a claim requiring a demonstrable before/after divergence; presentism (judging the past by present values) and its rebuttal (some standards are trans-historical). *Anchors:* printing press → literacy/Reformation/science; the Columbian Exchange; the Industrial Revolution living-standards debate; the Atlantic slave trade; the Enlightenment's dual legacy (rights *and* scientific racism); post-1945 decolonisation; Bretton Woods/Marshall Plan. *Contestable questions:* What is the correct counterfactual? Is the "turning point" a break or just an acceleration? Net-benefit for whom, over what timeframe?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Counterfactual plausibility | A specific, grounded alternative history | A convenient fantasy; trends produce X anyway | Reward disciplined counterfactuals; penalise hand-waving. |
| Net-benefit weighing | Long-run aggregate gains | Distribution and victims — who paid? | The real debate weighs aggregate vs. distributive. |
| Break vs. acceleration | A datable structural break | It merely sped up an existing trend | Did the event *cause* divergence or *ride* it? |

**Marking.** *Strong:* plausible specific counterfactual + honest winners/losers weighing + timeframe discipline. *Red flags:* misdated events, invented "what would have happened," single-cause stories, contested historiography asserted as settled. *Trap:* the sweeping "one invention made the modern world" narrative — reward whoever asks "compared to what, and for whom?"

**Format prompts.**
- **Parliamentary:** *THBT the printing press did more to advance human freedom than any political revolution.* · *THR the Industrial Revolution.* · *THBT contingency, not deep structural forces, explains most turning points.*
- **Presidential** (moderator to candidates for a "leaders of 1945" framing): *"As you rebuild the postwar world, do you prioritise European reconstruction or immediate decolonisation — and why should the public trust your judgement of history's lesson here?"* Candidate A: reconstruction-first (stability breeds freedom). Candidate B: decolonisation-first (delay is its own injustice).
- **MUN — Historical Crisis Committee** (e.g. *The Bretton Woods Conference, 1944* or *The UN and Decolonisation, 1960*). Agenda: designing the postwar economic/political order. Country matrix: **United States** (architect of the dollar order, open markets); **United Kingdom** (managing imperial decline, sterling area); **USSR** (rejects the Western financial order); **France** (recovery + retaining empire); **India (pre-/newly independent)** (self-determination, anti-colonial voice); **China (ROC, 1944)** (seeking great-power status). Judge delegates on fidelity to each actor's *period* interests.

---

## CODEX 2 — Global Economy: Trade, Development & Growth

**Knowledge map.** *Frameworks:* comparative advantage (Ricardo) vs. infant-industry/"kicking away the ladder" (Chang); the East Asian developmental state (state-guided credit + export discipline) vs. the Washington Consensus (liberalise/privatise/stabilise); import-substitution vs. export-orientation; middle-income trap; Solow growth (capital/labour/TFP) and endogenous growth; institutions-first (Acemoglu–Robinson, inclusive vs. extractive) vs. geography/culture; Kuznets curve (contested). *Anchors:* the post-1990 collapse in extreme poverty (mostly China + India) and the causation debate; China's post-1978 reform + WTO accession; the 1997 Asian crisis and the IMF-conditionality critique; India's 1991 liberalisation; the "China shock" to Western manufacturing. *Contestable questions:* Does openness *cause* growth or accompany it? Is industrial policy replicable without state capacity? Is inequality a price of growth or a brake on it?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Trade vs. protection | Openness disciplines firms, transfers tech, helps consumers | Late developers protected first; premature opening kills nascent industry | The sophisticated split is *sequencing*, not free-trade dogma. |
| Growth vs. distribution | Growth is the only proven mass poverty-reducer | Concentrated gains are economically and politically fragile | Reward data-shaped weighing, not slogans. |
| State vs. market | Markets allocate capital better than ministries | Coordination failures/public goods need a visible hand | Watch for the concession that state *capacity* is the hidden variable. |

**Marking.** *Strong:* mechanism-level economics + correct use of the development record + honesty on causation. *Red flags:* correlation-as-causation, single-factor China stories, invented GDP/poverty figures, "free trade/protection is universally best." *Trap:* "just copy Korea/Singapore" — reward whoever asks whether the preconditions transfer.

**Format prompts.**
- **Parliamentary:** *THBT free trade has done more to reduce global poverty than foreign aid.* · *THW, as a developing economy, prioritise export-led manufacturing over a services-led path.* · *THBT industrial policy is necessary for late development.*
- **Presidential:** Moderator: *"Factories have left this country. Do you bring them back with tariffs, or accept the trade-offs of open markets — and what do you say to the worker who lost their job to imports?"* Candidate A: strategic protection + reshoring. Candidate B: openness + retraining/transition support.
- **MUN — ECOSOC / WTO / G20.** Agenda: *industrial policy and the future of the trading system.* Country matrix: **United States** (reshoring, "friend-shoring," strategic tariffs); **China** (state-led industrial policy, export power); **India** (strategic autonomy, protect strategic sectors, wary of binding WTO commitments that limit development); **Germany/EU** (rules-based free trade, export surplus); **Brazil** (agricultural export power, industrial ambition); **Nigeria** (commodity dependence, seeking value-addition and development space). Judge fidelity to each economy's real trade posture.

---

## CODEX 3 — Geopolitics & the Changing World Order

**Knowledge map.** *Frameworks:* realism (anarchy, balance of power, security dilemma; Mearsheimer/Waltz) vs. liberal institutionalism (interdependence, institutions lower defection costs; Keohane) vs. constructivism; hegemonic stability; deterrence theory (credibility, second-strike, extended deterrence); the Thucydides Trap and its critics; power-transition theory; non-alignment 2.0 / Global South hedging. *Anchors:* the post-1945 order; the post-1991 unipolar moment; China's rise to peer competitor; renewed great-power war risk; erosion of the WTO dispute system; UNSC veto paralysis; sanctions' mixed record; alliance systems vs. middle-power hedging (India's strategic autonomy, ASEAN centrality). *Contestable questions:* Is multipolarity stabilising or war-prone? Do institutions constrain great powers or launder their interests? Align or hedge? Does deterrence hold, at what risk?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Multipolarity | Balance restrains any hegemon | More poles = more miscalculation, arms races | Reward the *mechanism*, not vibes about "balance." |
| Institutions | Raise defection costs; give small states voice | Powerful states ignore or capture them | Best line: institutions are *conditional* on aligned interests. |
| Align vs. hedge | Alignment buys credible guarantees | Hedging preserves autonomy, avoids others' wars | Judge against the *specific* country's geography/threats. |
| Deterrence | Credible force prevents war | Invites arms racing; one miscalculation is catastrophic | Weigh probability × magnitude explicitly. |

**Marking.** *Strong:* IR theory *applied* to specific actors + honest uncertainty + explicit risk-weighing. *Red flags:* one school treated as obviously right, misstated doctrines, "deterrence always/never works," botched sanctions cases. *Trap:* "the world order is collapsing" — reward whoever asks *which part, for whom, versus what alternative*.

**Format prompts.**
- **Parliamentary:** *THBT a multipolar world is more dangerous than a unipolar one.* · *THW, as the EU, pursue strategic autonomy independent of the US.* · *THR the post-Cold-War expansion of NATO.*
- **Presidential:** Moderator: *"A regional ally is under threat. Do you commit forces, or keep this country out of another distant conflict? Tell voters where your red line actually is."* Candidate A: credible commitment/deterrence. Candidate B: restraint/burden-shifting.
- **MUN — UN Security Council.** Agenda: *a named regional security crisis.* Country matrix (P5 + electeds): **United States** (deterrence, alliance credibility); **China** (sovereignty/non-interference, blocs against intervention); **Russia** (spheres of influence, veto leverage); **France & UK** (Western coordination, humanitarian framing); **India (elected member)** (non-alignment, dialogue-first, wary of intervention precedents). Judge fidelity to each state's real UNSC behaviour and veto logic.

---

## CODEX 4 — Law, Justice & Rights

**Knowledge map.** *Frameworks:* theories of punishment — retribution (desert/proportionality, Kant), deterrence, rehabilitation, incapacitation, restorative justice; positive vs. natural law (Hart–Fuller); rule-of-law components (generality, publicity, non-retroactivity, equal application); rights theory — negative/positive rights, rights as trumps (Dworkin), the harm principle (Mill); constitutionalism and the counter-majoritarian difficulty; proportionality analysis. *Anchors:* judicial review's logic; the free-speech neutrality-vs-harm tension; the incarceration/recidivism evidence debate; restorative-justice outcomes; hate-speech regimes (European restriction vs. US near-absolutism); weak evidence for marginal death-penalty deterrence; due-process-vs-security trade-offs. *Contestable questions:* What justifies state punishment? When may courts overrule legislatures? Where is the liberty/restriction line? Is the rule of law neutral or a vehicle for power?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Purpose of punishment | Rehabilitation cuts reoffending, treats causes | Retribution respects victims and desert | Weigh recidivism evidence against the expressive/justice function. |
| Judicial review | Courts protect rights from majority passion | Unelected judges overriding voters is a democratic deficit | Reward specifics: which rights, which court, what checks it. |
| Free expression | Neutrality protects dissenters too | Some speech inflicts real, targeted harm | Weigh the harm mechanism; neither absolutism nor unlimited restriction wins free. |

**Marking.** *Strong:* named theory + the empirical layer (does it reduce harm?) + honest liberty/order/democracy trade-offs. *Red flags:* asserting the death penalty clearly deters, "legal = just," misdescribing judicial review, absolute rights with no limiting principle. *Trap:* the emotive victim-or-liberty appeal that skips mechanism — reward whoever honours the emotion but supplies the analysis.

**Format prompts.**
- **Parliamentary:** *THBT the primary purpose of punishment should be rehabilitation, not retribution.* · *THBT unelected constitutional courts should be able to strike down democratically enacted laws.* · *THBT free expression should protect speech most citizens find abhorrent.*
- **Presidential:** Moderator: *"Crime is up and so is prison spending. Do you build more prisons or invest in rehabilitation — and how do you answer a victim who wants retribution?"* Candidate A: public-safety/incapacitation. Candidate B: rehabilitation/restorative investment.
- **MUN — Human Rights Council / Legal (Sixth) Committee.** Agenda: *judicial independence and the death penalty, or freedom of expression vs. hate-speech regulation.* Country matrix: **United States** (free-speech near-absolutism, federalism on the death penalty); **members of the EU** (abolitionist, pro-restriction on hate speech); **China** (sovereignty, non-interference in "internal" legal matters); **Saudi Arabia** (defends domestic legal-religious framework); **India** (constitutional rights + retains the death penalty in "rarest of rare" cases). Judge fidelity to each state's real rights posture.

---

## CODEX 5 — Democracy, Governance & Political Institutions

**Knowledge map.** *Frameworks:* electoral-system trade-offs (FPTP → stable but disproportional; PR → representative but coalition-prone; mixed); Duverger's law; majoritarian vs. consensus democracy (Lijphart); median-voter theorem and limits; populism as thin ideology (people vs. corrupt elite, Mudde) — corrective or corrosive?; federalism (subsidiarity, laboratories, exit/voice) vs. centralism; accountability chains (elections, courts, press, bureaucracy); democratic backsliding (executive aggrandisement, capturing referees). *Anchors:* the FPTP-vs-PR governance debate; compulsory-voting evidence (turnout up, outcome effects contested); campaign-finance influence-vs-speech tension; cautionary referendum cases; federal bargains managing plural societies; the media/misinformation effect on democratic competence. *Contestable questions:* Which system best trades representation against governability? Does forced/encouraged participation improve democracy? Is populism a signal or a solvent? Should some decisions be insulated from majorities?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| PR vs. FPTP | PR represents all; fewer wasted votes | FPTP delivers decisive, accountable government | Reward defining "better governance" and routing mechanics to it. |
| Populism | Surfaces grievances elites ignored | Erodes the norms/referees democracy needs | Distinguish populist *demands* from populist *methods*. |
| Majority vs. insulation | Voters should decide; technocrats lack legitimacy | Some questions need expertise + minority protection | Weigh legitimacy against competence. |

**Marking.** *Strong:* institutional mechanism + a defined success metric + engagement with the trade-off. *Red flags:* "one system is universally best," compulsory voting "definitely" changes outcomes, populism = "any policy I dislike," misdescribing how a system works. *Trap:* "more democracy is always better" / "experts always know best" — reward whoever exposes the missing legitimacy/competence trade-off.

**Format prompts.**
- **Parliamentary:** *THBT proportional representation produces better governance than first-past-the-post.* · *THW introduce compulsory voting.* · *THBT populism is a symptom of democratic failure, not a disease of democracy.*
- **Presidential:** Moderator: *"Trust in elections is falling. Would you make voting compulsory, cap campaign spending, both, or neither — and why won't your fix just entrench whoever's already in power?"* Candidate A: participation + spending caps. Candidate B: voluntary participation + free-speech/anti-incumbent concerns.
- **MUN — SPECPOL / a regional democratic body.** Agenda: *electoral integrity and disinformation.* Country matrix: **United States** (free-speech limits on regulation, federalism); **members of the EU** (platform regulation, DSA-style rules); **India** (world's largest electorate, sovereignty over platforms, misinformation concerns); **Brazil** (recent contested elections, courts vs. platforms); **an authoritarian-leaning state** (defends information control as sovereignty). Judge fidelity to each state's real governance stance.

---

## CODEX 6 — Political Philosophy & Ethics

*Marks differently — reward conceptual rigour and consistency over data.*

**Knowledge map.** *Frameworks:* consequentialism/utilitarianism (act vs. rule; demandingness, separateness-of-persons) vs. deontology (duties, persons as ends, Kant) vs. virtue ethics (character/flourishing, Aristotle); justice — Rawls (original position, veil of ignorance, difference principle) vs. Nozick (entitlement, self-ownership, minimal state) vs. luck egalitarianism vs. capabilities (Sen/Nussbaum); liberty — negative vs. positive (Berlin); harm principle and paternalism (Mill); social contract (Hobbes/Locke/Rousseau); political obligation and civil disobedience. *Anchors:* the trolley family and intuition-pumps (and their limits); the equality-of-what debate; the liberty/equality tension; intergenerational justice and the non-identity problem; tyranny of the majority. *Contestable questions:* By what metric is a society just? When may the collective override the individual? Are rights foundational or derived? Do we owe duties to people who don't yet exist?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Outcome vs. opportunity | Formal opportunity is hollow amid unequal starts | Equalising outcomes erases desert/agency/incentive | Reward defining the equality metric + defending it against the standard objection. |
| Liberty vs. security | Security is the precondition of any liberty | The trade ratchets one way and rarely returns | Weigh reversibility and the abuse mechanism. |
| Paternalism | The state may prevent self-harm from poor info/addiction | Sovereign adults own their choices | Best line pins the *precise* licensing condition (capacity, info, externalities). |

**Marking.** *Strong:* a named framework applied consistently, surviving its standard objection, with a response to the strongest rival. *Red flags:* framework-label without content, smuggling premises across frameworks, inconsistency (rights when convenient, consequences when convenient), "self-evident" values with no defence. *Trap:* the emotionally powerful case with no underlying principle — reward whoever supplies or dismantles it.

**Format prompts.**
- **Parliamentary:** *THBT a just society should prioritise equality of outcome over equality of opportunity.* · *THBT the state has no right to prevent competent adults from harming only themselves.* · *THP a Rawlsian society to a libertarian one.*
- **Presidential:** Moderator: *"Where is the line between protecting people and controlling them? Give voters a rule you'd actually govern by."* Candidate A: an active-state, welfare/protection line. Candidate B: a liberty-first, minimal-intervention line.
- **MUN — UNESCO / an ethics or bioethics committee.** Agenda: *ethical governance of a concrete dilemma (e.g. genetic technology or AI decision-making).* Because MUN needs applied topics, frame the philosophy debate as *policy on a specific technology*, with country stances reflecting real regulatory philosophies (precautionary EU, permissionless US, state-directed China, development-first India). Judge whether delegates reason from their state's actual value-posture.

---

## CODEX 7 — War, Security & Just War

**Knowledge map.** *Frameworks:* just war — *jus ad bellum* (just cause, legitimate authority, right intention, proportionality, last resort, reasonable prospect), *jus in bello* (discrimination/non-combatant immunity, proportionality), *jus post bellum*; pacifism and realism as the bracketing poles; the Responsibility to Protect (R2P) and the sovereignty-vs-atrocity tension; deterrence (credibility, second-strike, MAD, the stability–instability paradox); the security dilemma; asymmetric warfare and counter-terrorism ethics; the laws of armed conflict as the legal layer. *Anchors:* the mixed record of humanitarian intervention; the long "nuclear peace" vs. near-miss escalation; the negotiate-with-terrorists dilemma; civilian-casualty proportionality in practice; autonomy in weapons and accountability gaps. *Contestable questions:* Who may authorise force, and does legality track morality? Does deterrence buy peace or gamble on catastrophe? Can intervention save more than it costs? How does new tech strain the old categories?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Intervention | A duty to stop atrocity can override sovereignty | Interventions routinely worsen outcomes, set predatory precedents | Reward weighing *this* intervention's prospect of success. |
| Nuclear deterrence | Decades without great-power war; MAD works | One miscalculation is civilisation-ending; luck ≠ safety | Probability × magnitude is decisive; reward honest risk analysis. |
| Negotiating with terrorists | Talks end violence and reintegrate | They reward and incentivise the next hostage-taker | Distinguish *tactical* talks from *strategic* legitimation. |

**Marking.** *Strong:* correct just-war categories *applied* + honest probabilistic weighing + refusal to treat force as costless or always-wrong. *Red flags:* legality/morality conflation, "deterrence is proven safe/unsafe," misused "proportionality," invented casualty figures. *Trap:* both "surgical intervention will work" and "all war is wrong" — reward whoever forces the other to weigh probability and cost.

**Format prompts.**
- **Parliamentary:** *THBT humanitarian military intervention without Security Council authorisation is justified to stop mass atrocity.* · *THW ban lethal autonomous weapons.* · *THBT nuclear deterrence has, on balance, made the world safer.*
- **Presidential:** Moderator: *"Mass atrocities are being reported abroad and the UN is deadlocked. Do you send this country's troops without UN backing — yes or no — and defend it to a war-weary public."* Candidate A: conditional intervention. Candidate B: restraint/legality-first.
- **MUN — DISEC (Disarmament & International Security).** Agenda: *regulation of lethal autonomous weapons* or *nuclear disarmament.* Country matrix: **United States** (tech edge, resists binding bans); **Russia** (resists constraints, deterrence-first); **China** (ambiguous — supports some limits rhetorically, develops capability); **members of the EU/Austria** (pro-ban, humanitarian framing); **India & Pakistan** (deterrence dyad, oppose discriminatory regimes). Judge fidelity to each state's real disarmament posture.

---

## CODEX 8 — Technology & Society Governance

**Knowledge map.** *Frameworks:* the Collingridge dilemma (early = shapeable but unknown; late = known but entrenched); precautionary vs. permissionless innovation; externality + market-power analysis for platforms (network effects, winner-take-most, data moats, two-sided markets); privacy as control vs. contextual integrity; liability regimes (strict vs. negligence — who bears harm and how that shapes incentives); automation labour economics (task displacement vs. augmentation, lump-of-labour fallacy, skill-biased change); antitrust goals (consumer-welfare vs. anti-power); digital sovereignty vs. open internet. *Anchors:* the historical destroy-and-create job pattern (and why "this time is different" must be *earned*); the surveillance security-vs-liberty/chilling-effect trade-off; moderation as an unavoidable value-laden act; regulating fast tech without freezing benefit. *Contestable questions:* Who's liable when an opaque system harms? Structural remedies or conduct rules for platform power? Does surveillance buy enough security to justify its cost? Is automation this time different?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Liability | Strict liability internalises harm, forces safety | Chills innovation; harm may be unattributable | Reward attention to *incentive effects* on developers. |
| Breaking up platforms | Structural remedies restore competition | Scale delivers real consumer benefits | Judge whether the harm is specified and the remedy fixes it. |
| Surveillance | Prevents rare, high-magnitude harm | Chilling effects/abuse are systemic and hard to reverse | Weigh reversibility + the base-rate problem. |

**Marking.** *Strong:* correct economic/regulatory mechanism + honesty on the innovation trade-off + neither salvation nor apocalypse. *Red flags:* lump-of-labour asserted as fact, misdescribing a technology/market, "this time is different" with no specific disanalogy, absolute privacy or innovation. *Trap:* techno-utopian or techno-doom sweeping claims — reward the demand for the specific mechanism and the specific harmed party.

**Format prompts.**
- **Parliamentary:** *THW hold AI developers strictly liable for harms caused by their models.* · *THBT the state should be able to break up dominant technology platforms.* · *THBT mass state surveillance is justified if it demonstrably prevents terrorism.*
- **Presidential:** Moderator: *"AI is coming for jobs in this country. Do you regulate it hard, let it run, or something else — and what do you tell the worker whose job it replaces next year?"* Candidate A: guardrails + transition support. Candidate B: pro-innovation + growth-will-absorb-it.
- **MUN — a digital-governance body (ITU / UNESCO / a Global Digital Compact committee).** Agenda: *international AI governance and data sovereignty.* Country matrix: **United States** (innovation-first, light federal rules); **members of the EU** (rights-based, risk-tiered regulation); **China** (state control, data localisation, digital sovereignty); **India** (data sovereignty + digital-public-infrastructure model, development framing); **an AU/Global-South voice** (bridging the digital divide, capacity-building). Judge fidelity to each bloc's real tech-governance philosophy.

---

## CODEX 9 — Religion, Secularism & the State

*Strong regional resonance for India and Southeast Asia.*

**Knowledge map.** *Frameworks:* models of secularism — strict separation ("wall"), French *laïcité* (religion privatised), pluralist/accommodationist ("principled distance," even-handed engagement); public-reason liberalism (Rawls — exclude religious premises?) and its critics (that silences believers); religious-freedom analysis (belief vs. practice; limits — harm, equality, public order); establishment/free-exercise tension; group rights vs. individual rights within communities (the "minorities within minorities" problem); majority religion + minority protection. *Anchors:* the exemptions debate (conscience vs. equal law + third-party harm); religious symbols in public life across national models; community autonomy vs. members' individual rights (esp. women/dissenters); secularism as neutrality vs. secularism as itself a contested worldview. *Contestable questions:* Should politics rest only on shared reasons? When does protecting practice impose costs on others? Strict separation or even-handed accommodation? Community or individual when they conflict?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Separation vs. accommodation | Neutral public reason treats all equally | Excluding religion privileges secular worldviews | Reward showing the model delivers fairness in a *specific* plural society. |
| Religious exemptions | Conscience deserves protection | Exemptions shift costs to third parties, fracture equal law | Pin down *which* exemptions, *what* harm, *to whom*. |
| Community vs. individual | Group autonomy preserves identity/tradition | Individuals need protection from internal coercion | Watch for the "minorities within minorities" catch. |

**Marking.** *Strong:* a specified secularism model applied even-handedly, honest about treatment of *both* majority and vulnerable minorities (including intra-group). *Red flags:* assuming one secularism model is the only kind, "secular = automatically neutral," ignoring third-party/intra-group harm, caricaturing believers or secularists. *Trap:* arguing only from one's own tradition's comfort — reward whoever tests the principle against a group they don't belong to.

**Format prompts.**
- **Parliamentary:** *THBT the state should be strictly secular, excluding all religious reasoning from law.* · *THW permit religious exemptions from generally applicable laws.* · *THBT a diverse democracy is better served by accommodation of religion than by strict separation.*
- **Presidential:** Moderator: *"Should a public official be able to display religious symbols on the job — and how do you keep the state neutral without making believers feel unwelcome?"* Candidate A: strict neutrality. Candidate B: even-handed accommodation.
- **MUN — Human Rights Council.** Agenda: *freedom of religion or belief and the protection of minorities.* Country matrix: **France** (*laïcité*, restrictions on symbols); **India** (pluralist secularism, "principled distance," minority-rights debates); **Saudi Arabia** (religion-based legal order); **members of the EU** (individual religious freedom + anti-discrimination); **a state with a persecuted minority question**. Judge fidelity to each state's real church/mosque/temple–state model.

---

## CODEX 10 — Environment & Climate Policy

*Marks like an economics debate with an ethics overlay — the policy/engineering layer, not "is it real."*

**Knowledge map.** *Frameworks:* externality economics (unpriced carbon; Pigouvian tax vs. cap-and-trade vs. subsidy); the discount-rate debate (valuing future harm — Stern vs. Nordhaus); mitigation vs. adaptation vs. resilience; climate justice (historical vs. current emissions; common-but-differentiated responsibility; development-vs-decarbonisation); energy-system realities (intermittency and firm power, grid/storage limits, renewables' land/mineral footprint, nuclear's safety/waste/cost/perception profile); degrowth vs. green growth; the global-commons free-rider structure. *Anchors:* solar/wind cost curves vs. the integration problem; nuclear's firm low-carbon power vs. cost/time/perception hurdles; energy poverty as a live development stake; the equity claim that least-emitters suffer most; the free-rider problem that makes unilateral action costly. *Contestable questions:* Price signals or public investment? Does nuclear deserve priority despite cost/perception? What do rich nations owe, and does it translate into effective policy? For a poor country, is cheap energy now worth the climate cost later?

**Clash matrix.**
| Clash | PROP best | OPP best | Adjudication note |
|---|---|---|---|
| Price vs. subsidy | A carbon price is efficient, technology-neutral | Prices are politically toxic/regressive; subsidy builds industry | Reward engaging both efficiency *and* political economy. |
| Nuclear | Firm, dense, low-carbon power renewables can't yet replace | Cost, timeline, waste, acceptance make it a poor marginal bet | Judge the *system* (what gives firm power?), not safety slogans. |
| Climate justice | Historical emitters caused the harm and can pay | Reparations are unworkable, cut no emissions | Connect the moral claim to an *effective* mechanism. |

**Marking.** *Strong:* correct externality/energy-system economics + explicit discount-rate/justice handling + no single-tech silver bullet. *Red flags:* ignoring intermittency/firm-power, treating carbon pricing or renewables as costless, invented emissions/cost figures, conflating "is it real" (not the debate) with "what policy" (the debate). *Trap:* tech-optimist "renewables solve everything" and doomer "only degrowth works" — reward whoever forces a systems-level, cost-and-justice-weighed answer.

**Format prompts.**
- **Parliamentary:** *THBT carbon pricing is a more effective climate tool than public subsidy of clean energy.* · *THW rapidly expand nuclear power as the primary path to decarbonisation.* · *THBT developing economies are justified in expanding fossil-fuel use to end energy poverty.*
- **Presidential:** Moderator: *"Energy bills are up and so are temperatures. Do you tax carbon, subsidise clean energy, or drill — and how do you protect the family that can't afford a higher bill either way?"* Candidate A: carbon price + rebate. Candidate B: subsidy/build-out + affordability guarantees.
- **MUN — UNFCCC / a COP-style committee or UNEP.** Agenda: *carbon pricing, loss-and-damage finance, and a just transition.* Country matrix: **United States** (market tools, resists binding finance obligations); **members of the EU** (carbon pricing, border adjustment, climate leadership); **China** (largest emitter + largest clean-tech builder, developing-nation framing); **India** (CBDR, development space, resists caps that constrain growth, champions climate finance); **AOSIS / small island states** (existential stakes, demand loss-and-damage funding); **Saudi Arabia** (fossil-fuel producer, slows binding targets). Judge fidelity to each bloc's real COP negotiating position.

---

# APPENDIX — Prompt-generation & difficulty calibration

- **Match prompt type to format:** Parliamentary → a *motion* (THW/THBT/THR/THP). Presidential → a *moderator question* forcing a stance + a public-facing defence. MUN → a *committee + agenda + country matrix* (assign each debater a country; judge against its real policy).
- **Balance the sides.** Prefer prompts a skilled debater can win from *either* side, so adjudication measures skill, not side assignment. Provocative prompts are fine; the adjudicator holds viewpoint-neutrality.
- **MUN accuracy is a live scoring input.** The country matrices above are the reference for catching a delegate who misrepresents their state. Keep them to *durable* policy postures; when a real-world position may have shifted, judge the *logic and consistency* of the delegate's representation rather than a single volatile data point.
- **Difficulty knobs:** counter-intuitiveness of the burden (parliamentary), how hostile the question and audience are (presidential), how isolated the country's position is in committee (MUN — representing an outlier state well is harder and should be rewarded).
