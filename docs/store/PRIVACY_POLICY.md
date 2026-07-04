# callmeZ — Privacy Policy

**Effective date:** [INSERT LAUNCH DATE]
**Last updated:** [INSERT LAUNCH DATE]

> **Founder note (delete before publishing):** This is founder-usable starting text, not legal advice. Have a lawyer familiar with India's DPDP Act 2023 (and, if you take EU/UK or California users seriously, GDPR/CCPA) review this before public launch. Spots that need your confirmation are marked **[CONFIRM]**.

---

## The short version

callmeZ is a place to talk and play with AI characters and with real friends. To make that work, we collect the things you'd expect — your phone number to log you in, your name and handle, and the conversations you have inside the app. We store your data in India, we don't sell it, and we don't run third-party ad tracking. You can export your data or delete your account whenever you want, and you can make the AI forget specific things it remembers about you.

This policy explains the full picture. If anything here is unclear, email us at **help@callmez.app**.

---

## 1. Who we are

callmeZ ("callmeZ", "we", "us", "our") operates the callmeZ mobile app and the web app at **callmez.app**. For the purposes of India's Digital Personal Data Protection Act, 2023 (the "DPDP Act"), we are the **Data Fiduciary** for the personal data described here. For GDPR purposes, we are the **data controller**.

- **Contact / grievance:** help@callmez.app
- **Legal entity & registered address:** [CONFIRM — insert your company legal name and address]
- **Grievance Officer (DPDP Act requirement):** [CONFIRM — the DPDP Act requires you to name a contact point for grievances; a named person or role + help@callmez.app is fine]
- **EU/UK representative & Data Protection Officer:** [CONFIRM — only required if you have significant EU/UK user base; a DPO is not mandatory for most apps but name one if you appoint one]

---

## 2. Who can use callmeZ (age)

**callmeZ is for adults aged 18 and over.** The app contains open-ended AI conversation, mature social themes, and simulated (play-money) card games. We ask for your date of birth at sign-up and use it to keep the experience age-appropriate. We do not knowingly create accounts for, or knowingly collect personal data from, anyone under 18.

If you believe someone under 18 is using callmeZ, contact **help@callmez.app** and we will act on it.

*(A separate, walled experience for students under 18 is planned for the future. It is not part of this app, and this policy does not cover it.)*

---

## 3. What we collect, and why

We only collect what the app actually needs. Here's the full list.

### Information you give us

| Data | Why we collect it |
|---|---|
| **Phone number** | To log you in. We send a one-time code (OTP) by SMS. Your phone number is your primary account identifier. |
| **Display name** | The name you choose to be called in the app. |
| **Handle (@username)** | Your unique public username. You set this once. |
| **Profile photo** *(optional)* | If you choose to add one. It may be a real photo of you — that's your choice. Stored as image data associated with your account. |
| **Date of birth** | To confirm you're 18+ and to keep AI behavior age-appropriate. |
| **Sex** *(optional)* | If you provide it, we use it to gender certain AI personas the way you'd expect. You can leave this blank. |
| **Region** *(optional, free text)* | Helps the AI mirror your language and local expressions so conversations feel natural. It is not shown as a public label. |
| **PIN** *(optional, 4-digit)* | For quick re-login. We store only a secure hash of your PIN — never the PIN itself. |

### Information created as you use the app

| Data | Why we collect it |
|---|---|
| **Conversation content** | The messages you send to AI personas and to other users, the AI's replies, and activity in group chats and rooms. This is the core of the product — it's what you're here to do. |
| **Memory** | Facts and moments the AI derives from your conversations so it can remember you across sessions (e.g. that you're learning Spanish). You can see everything the AI remembers on the "what Z remembers" screen and delete any item individually. |
| **Game & activity records** | Match results, roleplay outcomes, verdicts, and your growth ledger. |
| **Usage & cost logs** | Internal, per-turn technical accounting so we can run the service and understand costs. |

We do **not** collect precise location, we do **not** use advertising identifiers, and we do **not** track you across other companies' apps or websites.

---

## 4. How your data is processed, and who else touches it

Your data is handled by our own systems and by a small set of service providers who process it **on our behalf and under our instructions**. We don't sell your data to anyone, and we don't share it for anyone else's advertising.

### Our own infrastructure
Your account and conversations are stored in a **Supabase (PostgreSQL) database hosted in Mumbai, India**, with row-level security enabled so accounts are isolated from one another. Our application logic runs on a TypeScript/Express backend hosted on Railway.

### Service providers (sub-processors)

| Provider | What they process | Why |
|---|---|---|
| **Anthropic (Claude AI)** | Your conversation content | The AI personas are powered by Anthropic's Claude model. When you chat, the relevant conversation content is sent to Anthropic to generate the reply. **[CONFIRM — verify Anthropic's current API data-processing terms before publishing. Anthropic's commercial API terms state that it does not train its models on data submitted through the API, but confirm the exact terms and, if accurate, you may state that here and link to them.]** |
| **Twilio** | Your phone number | To deliver your login code (OTP) by SMS. Shared only for that purpose. |
| **Supabase** | Your account data & conversations | Database hosting (Mumbai, India). |
| **Railway** | Data in transit through our backend | Application/compute hosting. |
| **Expo / Firebase Cloud Messaging (FCM)** *(planned)* | A device push token, if you opt in | To send push notifications you've asked for. |
| **Sarvam AI / ElevenLabs** *(planned, if/when voice is enabled)* | Audio, for speech-to-text and text-to-speech | Only for voice features, and only on **non-private, performative surfaces** (like news, debate, or stage features). |

### A commitment about private conversations and voice
By design, **sensitive or private conversations — such as reflective, confessional threads with the healer persona ("Z") — are never routed to any voice provider that trains on audio.** Voice processing, when we add it, is limited to public/performative surfaces. Your private conversations stay text-based on our own infrastructure and with Anthropic for reply generation.

---

## 5. Where your data goes (international transfers)

Your core data is stored in **India (Mumbai)**. Some of our service providers (for example, Anthropic and Twilio) may process data on servers outside India, including in the United States. Where data crosses borders, we rely on the providers' contractual data-protection commitments. **[CONFIRM — for GDPR/EU users you should reference an appropriate transfer mechanism such as Standard Contractual Clauses; confirm with your lawyer which providers offer these.]**

---

## 6. Legal basis for processing (for EU/UK users)

Where GDPR applies, we process your data on these bases:
- **Performance of a contract** — to give you the app you signed up for (login, conversations, games).
- **Legitimate interests** — to keep the service secure, prevent abuse, and improve it, balanced against your rights.
- **Consent** — for optional things like push notifications and, later, voice features. You can withdraw consent at any time.

---

## 7. How long we keep your data

We keep your data for as long as your account is active. When you delete your account:

> **Your account is deactivated immediately and permanently erased after 30 days.** During that 30-day window your data is inaccessible in the app, but you can contact **help@callmez.app** to recover the account. After 30 days, it is permanently purged and cannot be recovered.

Some minimal records may be retained longer where we're legally required to (for example, basic transaction or fraud-prevention records), and we keep only what the law requires for as long as it requires. **[CONFIRM — adjust if you have specific statutory retention obligations.]**

---

## 8. Your rights and controls

You're in control of your data. Inside the app (**Privacy & Data** screen) and by contacting **help@callmez.app**, you can:

- **Access & export your data** — download a copy of your data (right to portability).
- **Delete your account** — triggers the 30-day soft-delete described above.
- **Make the AI forget** — delete individual remembered facts on the "what Z remembers" screen.
- **Correct your information** — update your name, handle, and profile details.
- **Withdraw consent** — turn off optional features like notifications.
- **Object or restrict** *(EU/UK)* — ask us to stop or limit certain processing.

Under the **DPDP Act (India)** you have the right to access, correct, and erase your personal data, to nominate someone to exercise your rights, and to raise a grievance with us. If we don't resolve it, you may approach the **Data Protection Board of India**.

Under **GDPR (EU/UK)** you also have the right to lodge a complaint with your local data protection authority. Under **CCPA/CPRA (California)** you have the right to know, delete, correct, and opt out of "sale" or "sharing" of personal information — **we do not sell or share your personal information** in the way those laws define it.

We'll respond to rights requests within the timeframe the applicable law requires, and we won't charge you or treat you differently for exercising them.

---

## 9. How we protect your data

- Data in transit is encrypted (HTTPS/TLS).
- Your PIN is stored only as a secure hash, never in plain text.
- Our database uses **row-level security** so accounts are isolated.
- Access to production data is limited to what's needed to run the service.

No system is perfectly secure, but we take reasonable technical and organizational measures to protect your data. If a breach affects your data, we'll notify you and the relevant authorities as required by law.

---

## 10. AI-generated content — an honest note

The personas you talk to are **fictional AI characters**, not real people, and they do not impersonate real living individuals. AI replies are generated automatically and **can be wrong**. Nothing the AI says is professional medical, legal, financial, or mental-health advice. For those, talk to a qualified professional.

---

## 11. Changes to this policy

If we make material changes, we'll update the "Last updated" date and let you know in the app or by other reasonable means before the changes take effect. Continuing to use callmeZ after that means you accept the updated policy.

---

## 12. Contact us

Questions, requests, or complaints:
**help@callmez.app**

[CONFIRM — insert legal entity name and registered address]
