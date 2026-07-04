# callmeZ — Store Submission Pack

Everything below is meant to be **transcribed into App Store Connect and the Google Play Console**, not hosted. Character counts are noted. Confirmation points are marked **[CONFIRM]**.

> **General note:** Store console fields change over time. Everything here maps to the substance of what each store asks; verify the exact field labels against the live console when you submit. Answer every questionnaire **honestly and conservatively** — under-rating or under-declaring is the fastest route to rejection or removal.

---

## A. Apple App Store — "App Privacy" nutrition label

Set **"Data used to track you": NONE.** callmeZ does not track users across other companies' apps/websites and shows no third-party ads. For every item below, **"Used for tracking": No.**

| Apple category → data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info → Phone Number** | Yes | Yes | No | App Functionality (login/OTP) |
| **Contact Info → Name** (display name) | Yes | Yes | No | App Functionality |
| **Identifiers → User ID** (handle/@username) | Yes | Yes | No | App Functionality |
| **User Content → Photos or Videos** (profile photo, optional) | Yes | Yes | No | App Functionality |
| **User Content → Other User Content** (conversations, memory) | Yes | Yes | No | App Functionality; Product Personalization |
| **User Content → Gameplay Content** (match/activity records) | Yes | Yes | No | App Functionality |
| **User Content → Audio Data** (voice, *if/when enabled*) | [CONFIRM — only if voice ships] | Yes | No | App Functionality |
| **Usage Data → Product Interaction** (usage/cost logs) | Yes | Yes | No | App Functionality; Analytics |
| **Other Data → Date of Birth** | Yes | Yes | No | App Functionality (age verification) |
| **Other Data → Sex/Gender** (optional) | Yes | Yes | No | App Functionality (persona gendering) |
| **Other Data → Region** (free text, optional) | Yes | Yes | No | App Functionality (language/slang mirroring) |
| **Other Data → PIN** (hashed, optional) | Yes | Yes | No | App Functionality (authentication) |

Notes for transcription:
- Apple's list has **no dedicated Date-of-Birth or Gender bucket**; DOB, sex, region, and PIN go under **"Other Data Types."** Apple's "Sensitive Info" bucket covers things like sexual orientation, race, religion, health, and biometrics — **none of which callmeZ collects**, so leave Sensitive Info unchecked. **[CONFIRM]** with your reviewer whether you'd rather classify DOB/sex here; the honest answer is they're used only for app functionality, not tracking.
- **Precise/Coarse Location: Not collected.** "Region" is a free-text preference, not device location.
- **Diagnostics (Crash Data / Performance Data): [CONFIRM]** — declare these only if you add a crash/analytics SDK (e.g. Sentry, Firebase Analytics). §2 doesn't list one; if you're not running one, leave unchecked.
- Answer **"Made for Kids": No.**

---

## B. Google Play — Data Safety form

Global answers:
- **Is all data encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data be deleted?** Yes — in-app (Settings → Privacy & Data → Delete Account) and via help@callmez.app; deactivated immediately, permanently erased after 30 days.
- **Play Families / target children?** No — 18+ app.
- **Independent security review?** [CONFIRM — likely No.]

**Important "collected" vs "shared" note:** In Google's definitions, sending data to a provider that processes it **on your behalf** (Anthropic, Twilio, Supabase, Railway) is generally **"collected," not "shared."** "Shared" means transfer to a third party for *their own* use. callmeZ does not do that, so **"Shared": No** across the board. **[CONFIRM this framing with your lawyer]**, but it's the standard reading.

| Google data type | Collected? | Shared? | Optional/Required | Purpose |
|---|---|---|---|---|
| **Personal info → Phone number** | Yes | No | Required | App functionality; Account management; Fraud prevention & security |
| **Personal info → Name** | Yes | No | Required | App functionality; Account management |
| **Personal info → User IDs** (handle) | Yes | No | Required | App functionality; Account management |
| **Personal info → Other info** (DOB) | Yes | No | Required | App functionality (age gating); Compliance |
| **Personal info → Other info** (sex, optional) | Yes | No | Optional | App functionality; Personalization |
| **Personal info → Other info** (region, optional) | Yes | No | Optional | Personalization |
| **Personal info → Other info** (PIN, hashed) | Yes | No | Optional | Fraud prevention & security (authentication) |
| **Photos and videos → Photos** (profile photo) | Yes | No | Optional | App functionality |
| **Messages → Other in-app messages** (conversations) | Yes | No | Required | App functionality; Personalization |
| **App activity → Other user-generated content** (memory, roleplay, verdicts) | Yes | No | Required | App functionality; Personalization |
| **App activity → App interactions** (usage/cost logs, game records) | Yes | No | Required | App functionality; Analytics |
| **Audio → Voice or sound recordings** (*if/when voice ships*) | [CONFIRM — only if voice] | No | Optional | App functionality |
| **Device or other IDs** (push token, *if push ships*) | [CONFIRM — only if push] | No | Optional | App functionality |
| **App info & performance → Crash logs / Diagnostics** | [CONFIRM — only if you add crash SDK] | No | — | Analytics |

- **Email address: Not collected** as an account identifier (login is phone OTP). If users email support, that's outside the app's data collection.
- **Location: Not collected.**

---

## C. Google Play — account deletion URL

Google requires a **public account-deletion instructions URL**. Use the `ACCOUNT_DELETION.md` page (host it at e.g. `callmez.app/delete-account`) and enter that URL in the Play Console's Data Safety → Deletion section. It documents both the in-app path and the email path, plus the 30-day retention.

---

## D. Store listing copy

### App name
**callmeZ**

### Apple — Subtitle (max 30 chars) — pick one
| Option | Chars |
|---|---|
| `Talk & play with AI + friends` | 29 |
| `Minds that don't fit the room` | 29 |
| `Anti-doomscroll. Talk & play.` | 29 |

### Google — Short description (max 80 chars) — pick one
| Option | Chars |
|---|---|
| `Talk and play with AI characters and friends. Build skills, not screen time.` | 76 |
| `An anti-doomscroll app to talk & play with AI characters and real friends.` | 74 |
| `Chat, debate, and play with AI characters and friends. For restless minds.` | 74 |

### Apple — Keywords (max 100 chars, comma-separated, no spaces)
```
AI chat,AI friend,debate,learn,social,personas,roleplay,mentor,practice,skills,conversation
```
(91 chars. Don't repeat "callmeZ" — the app name is already indexed. **[CONFIRM]** — tune toward your India/SEA ASO once you have search data.)

### Apple — Promotional text (max 170 chars)
```
A place for minds that don't fit the room. Talk and play with AI characters and friends, sharpen real skills, and skip the doomscroll.
```
(133 chars.)

### Full description (works for both stores; both allow ~4000 chars — this is ~1,650)

```
callmeZ is where you go to think, talk, and play — instead of scroll.

It's built for minds that don't quite fit the room: people with ideas the feed can't meet, who'd rather engage than just consume. Inside, you talk and play with a cast of AI characters — a mentor, a debate opponent, a news anchor, a teacher, a reflective listener — and with the real friends you bring along.

Not another feed. A place to actually do something with your attention.

WHAT YOU CAN DO
• Talk to AI characters with real personality — each one a distinct human archetype, not a blank chatbot.
• Sharpen real skills — practice public speaking, negotiation, and interviews with an opponent who pushes back.
• Play together — Ludo, card games, debate duels, trivia and more, with AI players and your friends. All games use play-money credits only. No real-money gambling.
• Bring your friends — add real people and DM them. callmeZ is the place where your friend group and the AI hang out together.
• Be remembered — the AI remembers what matters to you across conversations, and you can see and edit everything it remembers.

HONEST BY DESIGN
The AI can be wrong, and it'll tell you when it's not sure. It isn't a therapist, doctor, or lawyer, and it won't pretend to be. It's a sharper, more honest place to spend your attention than an endless feed.

BUILT FOR ADULTS
callmeZ is for people 18 and over.

YOUR DATA, YOUR CALL
Export your data anytime, delete your account whenever you want, and tell the AI to forget anything — all from inside the app.

Come for a conversation the feed can't give you.
```

### What's New / release notes — v1.0
```
Welcome to callmeZ 1.0.

Talk and play with a cast of AI characters and your real friends. Practice skills, debate, play games (play-money only), and have conversations the feed can't give you.

This is our first release — tell us what you think at help@callmez.app.
```

**[CONFIRM]** — no medical, therapeutic, or "improve your mental health" claims anywhere in the listing. The copy above deliberately says "reflective listener," not "therapist." Keep it that way; therapeutic claims trigger stricter review and health-app requirements.

---

## E. Reviewer notes (paste into App Store Connect "App Review Information" and Play Console notes)

```
Thanks for reviewing callmeZ.

WHAT IT IS
callmeZ is an app for talking and playing with AI characters ("personas") and with other real users. Each persona is a fictional AI character (a mentor, debate opponent, news anchor, teacher, reflective listener, etc.). Personas are AI-generated and do not depict or impersonate real living people.

HOW TO LOG IN (phone OTP)
Login is by phone number + a one-time SMS code. So you can test without a real phone, we've set up a test number:

  Phone: +91 8757788550
  Code:  123456

This test number bypasses live SMS and logs you straight in. (A 4-digit PIN, if ever prompted, is only for quick re-login on a returning device — you will not need it to log in fresh.)

WHAT TO TRY
- Chat with any persona from the home surface to see AI conversation.
- Open a game (e.g. Ludo, a card game, or a debate duel). NOTE: all games use play-money credits with NO real-world value. There is no real-money gambling, no wagering, and no cash-out.
- Open the "what Z remembers" screen to see and delete individual remembered facts.
- Settings → Privacy & Data to see data export and account deletion (soft-delete: deactivated immediately, purged after 30 days).

SAFETY / RATING CONTEXT
- The app is for adults (18+).
- Games are simulated/play-money only.
- Users can message each other; public rooms have moderation (creators can remove people) and a report path.
- No sexual content; never any sexual content involving minors.

Questions during review: help@callmez.app
```

---

## F. Age / content rating guidance

**Recommended result: Apple 18+, Google/IARC Mature 17+ (ESRB) / PEGI 18 / equivalent, targeting adults.** Set the app's audience to **adults / 18+** in both consoles. Because callmeZ has a policy minimum age of 18, use Apple's **"set a higher minimum age" override** to lock it to 18+ even if the questionnaire alone would compute lower.

### Apple (2025 system: 4+, 9+, 13+, 16+, 18+ — 12+/17+ retired)

Answer the questionnaire honestly. The answers that matter for callmeZ:

| Questionnaire area | Honest answer for callmeZ |
|---|---|
| **Simulated Gambling** | Yes — the app has play-money card/casino-style games. Declare it. This is a real rating trigger even though no real money is involved. |
| **Mature/Suggestive Themes** | Yes — mature social themes and adult romantic-companionship conversation. |
| **Sexual Content or Nudity** | None — explicit content is blocked. |
| **Violence (cartoon/realistic)** | None / minimal. |
| **Profanity or Crude Humor** | Possible (open AI conversation) — answer Infrequent/Mild honestly. |
| **Alcohol, Tobacco, Drugs** | None. |
| **Horror/Fear** | None. |
| **Capabilities → AI features / chatbot** | Yes — declare that the app has AI-generated conversation. Apple's new questionnaire specifically asks about AI features. |
| **Capabilities → User-generated content / messaging between users** | Yes — declare it. UGC + user-to-user messaging almost always raises the rating and must be disclosed. |
| **Capabilities → Unrestricted web access** | No — users don't get an open, unfiltered browser. (Some personas can retrieve web info, but there's no unrestricted in-app browser.) **[CONFIRM]** this matches the shipped behavior. |
| **In-app controls** | Declare the controls you have: account deletion, per-item "forget," data export, room moderation/kick, reporting. Strong controls can help. |
| **Medical or Wellness topics** | The reflective persona offers supportive conversation but the app does **not** provide medical/wellness advice, and shows disclaimers. Answer that it does not provide medical guidance. **[CONFIRM]** — do not present callmeZ as a wellness/health app; that invites stricter review. |

Then use the **minimum-age override to set 18+.**

### Google Play (IARC questionnaire)

| IARC area | Honest answer for callmeZ |
|---|---|
| **Simulated gambling (play money, no real prizes)** | Yes. |
| **Real-money gambling** | No. |
| **Users can interact / communicate** | Yes — user-to-user chat and public rooms. This bumps the rating. |
| **Users can share content / user-generated content** | Yes. |
| **Sexual / suggestive content** | No explicit sexual content; mature/suggestive social themes yes. |
| **Violence / fear / crude humor** | None to mild. |
| **Shares user location** | No. |
| **Digital purchases** | Yes if you ship paid tiers — declare in-app purchases. **[CONFIRM]** |
| **Target age group** | Adults (18+). Do not set a "for children/families" audience. |

IARC will generate the regional ratings (ESRB, PEGI, USK, etc.) from these answers. Expect a mature band. Set the content/target-age settings to adults.

### Both stores — non-negotiables
- **Never** target children/families; answer "for kids" = No everywhere.
- Disclose **AI conversation, user-to-user messaging/UGC, and simulated gambling** honestly — these three are the ones reviewers check hardest for social+AI+games apps, and hiding any of them risks removal.
- Keep the app's minimum age set to **18+**.
```
