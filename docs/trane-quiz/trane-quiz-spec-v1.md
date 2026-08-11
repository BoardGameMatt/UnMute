# Trane Quiz — Spec v1

**Status:** Locked for v1  
**Locked:** 2026-08-10  
**Slug:** `trane-quiz`  
**Host:** Unmute Labs app-platform (side project surface, not an Unmute Moment)  
**Client:** Trane Technologies — Product Management training  
**Replaces:** Poll Everywhere pre/post knowledge baseline  
**Owner:** Matt Hendricks  
**Question sources:** TT PM Test Questions PDFs (Rev 2024-01 through 2026-01)  
**Brand authority:** [`Trane_PM_Training_Visual_Standards_Reference_20260809.pdf`](./Trane_PM_Training_Visual_Standards_Reference_20260809.pdf)

---

## 1. What this product is

A facilitator-run knowledge quiz for Trane Technologies Product Management courses. Participants answer the same 10 multiple-choice questions **before** and **after** a class. The facilitator runs the room, watches join/completion counts, and downloads a Trane-branded **PDF report** to email to Learning & Development (or anyone else).

**Surface:** Poll Everywhere replacement.  
**Payload:** Aggregate and (anonymously) paired evidence that learning happened — by question and across the room.

This is **not** an Unmute Moment. It reuses Unmute hosting, host-token / join-QR patterns, and mobile-first UX craft, but it has its own actors, data model, and Trane visual system.

---

## 2. Actors (two only)

| Actor | Needs |
|-------|--------|
| **Facilitator** | Create a class offering (course + date), claim console via **host link/code**, show participant QR, open pre then post, see join/completion counts, **download PDF report** |
| **Participant** | Scan QR, answer 10 questions at own pace (tap → Submit → auto-advance), remain anonymous |

There is **no L&D login**. L&D is a report recipient: the facilitator generates the PDF and sends it by email outside the product.

No participant names, emails, or SSO.

---

## 3. Core flow

```
Facilitator creates class offering (course + date)
  → system issues unique host_token URL (facilitator console)
  → system issues unique join_code / participant QR
  → facilitator opens PRE phase

Participants join (anonymous token issued)
  → progress through 10 questions at own pace
  → complete PRE

Class runs (offline / training)

Facilitator opens POST phase (same offering)

Participants return on the same phone
  → same 10 questions
  → complete POST

Facilitator downloads Trane-branded PDF report
  → emails PDF to L&D / stakeholders
```

### 3.1 Facilitator kickoff and auth

**Auth model (locked):** Same pattern as Unmute sessions — a **new host token per offering**, not a shared password and not SSO for v1.

1. Facilitator creates an offering: choose course + class date (+ optional label).
2. System creates:
   - `host_token` → facilitator console URL, e.g. `/trane-quiz/host/[token]`
   - `join_code` + participant URL / QR
3. Facilitator bookmarks or keeps the host URL for that class (treat as a secret — anyone with it can control the offering).
4. Facilitator projects the **participant** QR (not the host URL).
5. Facilitator starts **PRE**. Until PRE is open, participants see a waiting screen.
6. After PRE, facilitator opens **POST** when class ends.
7. Facilitator downloads the PDF report when enough people have finished POST (or after closing the session).

Host token properties:

- Cryptographically random, long (match Unmute `host_token` practice — ≥32 hex chars)
- Unique per offering
- Sufficient to claim/control that offering’s console (phase controls + report download)
- Not reusable across offerings

### 3.2 Participant quiz UX

- One question per screen.
- Tap a single answer option (selectable row).
- **Submit** button: disabled until an option is selected → active when selected → confirmed on tap.
- On Submit: record answer, **auto-advance** to next question (no “correct/incorrect” feedback).
- Progress: “Question N of 10” or thin bar — environmental, not gamified.
- After Q10 Submit: thank-you / “You’re done — return to the training room.” No score shown.
- Own pace; no shared timer forcing advancement.
- **No edit after submit (locked):** once an answer is submitted, the participant cannot go back to change it.

### 3.3 Phase rules

| Phase | Who can answer | Facilitator sees |
|-------|----------------|------------------|
| Waiting | Nobody | Join count |
| PRE open | Participants who have not finished PRE | Joined / PRE completed |
| PRE closed | Nobody | Final PRE counts |
| POST open | Anyone who has not finished POST for this offering | Joined / POST completed / of which unpaired |
| Closed | Nobody | Final counts + PDF download |

**Beginning vs end (plain language):**  
People who took the beginning quiz on the same phone are **paired** automatically for before/after comparison.  
People who **missed the beginning quiz** may still take the end quiz, but only after an explicit confirmation screen:

> You didn’t complete the beginning quiz on this phone.  
> Continue with the end-of-class quiz only?  
> [Go back]  [Continue]

That confirmation is required before the first POST question. Confirmed unpaired POST responses are stored and counted in POST totals, but they are **not** included in the paired before/after learning delta on the PDF (they appear as a footnote: “N completed end quiz only”).

**Also:** one beginning attempt and one end attempt per phone per class. No retakes.

### 3.4 Anonymity + linking before/after

**Requirement:** No names. Same person comparable before → after.

**v1 method — anonymous device token:**

1. On first join, server issues a random `participant_token` (UUID).
2. Stored in an HTTP-only cookie scoped to Trane Quiz + `localStorage` backup for the offering.
3. Not derived from name, email, or fingerprinting beyond “this browser kept the cookie.”
4. Answers keyed by `(offering_id, participant_token, phase)`.
5. PDF report never shows tokens — aggregates only.
6. Facilitator console shows counts only — never a named roster.

**Limit (honest):** Same phone → linked for before/after. Different phone for the end quiz → treated as unpaired (confirmation required). Facilitator should still say: “Use the same phone you used this morning if you can.”

---

## 4. Facilitator console

Desktop-optimized (projector + laptop); usable on phone in a pinch.

### 4.1 Create offering

**What this means (plain language):**  
Someone has to press “Create class” somewhere — pick the course and date — before there is a host link and a QR for the room. That person is almost always **you (the facilitator)**.

**v1 (locked):** A simple create page at an unlisted URL (e.g. `/trane-quiz/new`). Anyone who has that link can create an offering. Creating one immediately issues:

- a **host URL** (secret control for that class)
- a **participant QR / join code**

No SSO, no admin role, no separate operator account. Control of a live class = possession of that class’s host URL. If the create URL leaks, worst case is someone spins up empty quiz shells — they still cannot control *your* class without *your* host token.

Flow:

- Course picker (six courses)
- Class date (required)
- Optional label
- Create → show host URL (copy) + land on live console

### 4.2 Live console (host-token gated)

Always visible:

- Course name + class designation
- Participant join QR (large) + short URL + join code
- **Joined** count
- Phase controls: Start PRE / Close PRE / Start POST / Close session
- **PRE completed** count
- **POST completed** count (with subcount: paired / end-only)
- **Download PDF report** (enabled once at least one POST completion exists; empty-state copy otherwise)

No live per-question leaderboard. Counts only.

### 4.3 Class designation

- `class_date` (date)
- `label` (optional string)
- Display: `PGT Foundations · 2026-03-12` (+ label if present)

---

## 5. PDF report (facilitator-generated)

**Who creates it:** Facilitator, from the host console.  
**Who receives it:** Anyone the facilitator emails (typically L&D).  
**Format:** PDF download — not a separate L&D web app.  
**Visual system:** Trane PM Training visual standards (§8).

### 5.1 Report contents (one page preferred; two max)

Header band (Deep Purple `#32007E`, white type):

- “Product Management Training — Knowledge Check”
- Course name
- Class designation (date + label)
- Generated timestamp

Summary block:

- N joined / PRE completed / POST completed / **paired** (finished both) / **end-only** (POST without PRE, after confirmation)
- Mean % correct PRE vs POST (**paired cohort only** for the headline delta)
- Absolute change in percentage points
- Footnote if end-only > 0: “N people completed the end quiz only (no beginning quiz on this phone).”

By-question table (flat, white ground, purple headers):

| # | Question (truncated) | % correct before | % correct after | Change |
|---|----------------------|------------------|-----------------|--------|

Footer:

- Short note: “Anonymous responses. Same-device pairing when available. No individual scores.”
- Trane logo lockup bottom right (`trane-technologies-logo.png` — do not rebuild in type)
- Unmute Labs production credit only if required operationally; keep visually secondary

**Room signal (optional second page or bottom of page 1 if space):**

- Largest gains (top 2–3 questions)
- Still weakest after class (top 2–3) — teach-back candidates

No raw answer dumps. No participant-level rows.

### 5.2 Scoring definition

- Each question: 1 if selected option equals correct key, else 0.
- Participant phase score: sum / 10.
- Primary aggregates: mean of per-participant % correct among **paired** completers.
- PRE-only participants: footnote only; excluded from primary before/after delta.
- **End-only (POST without PRE):** counted in POST totals; excluded from headline paired delta and from paired per-question PRE/POST/Δ columns; noted in PDF footer.

### 5.3 PDF generation

- Server-generated PDF (e.g. HTML→PDF or PDF kit) so layout matches Trane tokens reliably.
- Filename: `Trane_PM_KnowledgeCheck_[course-slug]_[YYYY-MM-DD].pdf`
- Download requires valid host token for that offering.
- Logo: `app-platform/public/trane-quiz/trane-technologies-logo.png` (mirrored in `docs/trane-quiz/assets/`). Seeklogo PNG for v1; swap for official vector when available.

---

## 6. State machine

```
OFFERING_CREATED
  → WAITING
  → PRE_OPEN
  → PRE_CLOSED
  → POST_OPEN
  → CLOSED
```

Participant path:

```
JOIN → (if PRE_OPEN) Q1…Q10 → PRE_DONE
JOIN → (if POST_OPEN and already finished PRE on this phone) Q1…Q10 → POST_DONE (paired)
JOIN → (if POST_OPEN and no PRE on this phone)
       → confirmation screen → if Continue → Q1…Q10 → POST_DONE (unpaired)
else WAITING
```

---

## 7. Data model (logical)

| Entity | Purpose |
|--------|---------|
| `trane_course` | Catalog: slug, title, revision label |
| `trane_question` | Course-scoped: stem, options[], correct_option, sort_order |
| `trane_offering` | One live class: course_id, class_date, label, phase, join_code, **host_token** |
| `trane_participant` | Anonymous token row for an offering (no PII) |
| `trane_response` | offering_id, participant_id, phase (`pre`\|`post`), question_id, selected_option, submitted_at |

Constraints:

- Unique `(offering, participant, phase, question)`
- At most one completed PRE and one completed POST per participant per offering
- Answer key never sent to participant clients
- Host token never appears on participant screens or QR

---

## 8. Visual system — Trane PM Training

Authority: `docs/trane-quiz/Trane_PM_Training_Visual_Standards_Reference_20260809.pdf`  
(Observational working standard until official Trane brand guide arrives.)

### 8.1 Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| Trane Purple | `#6400FF` | Identity, headlines on white, cover-style fields |
| Deep Purple | `#32007E` | Section bands, table headers, structural blocks |
| White | `#FFFFFF` | Default content ground |
| Near black | `#111111` (working) | Body text |
| Navy | `#00007E` | Optional third stage in sequenced diagrams |
| Teal | `#089C82` | Single “you are here” / one emphasis only |
| Neutral Gray | `#A1A1A1` | Inactive / de-emphasized only |
| Alert Red | `#FE0000` | Outline emphasis only — never decorative fill |

Rules:

- Purple bands, white body
- Headlines on white in Trane Purple, sentence case, left-aligned
- One accent per screen (teal or red) — not both as decoration
- No gradients, no shadows
- No emoji in any Trane-facing UI or PDF

### 8.2 Typography

- Participant UI + PDF: **Arial** (working substitute; official corporate face VERIFY)
- Facilitator run-adjacent docs may use Calibri; this product’s participant + PDF surfaces use Arial
- Sentence case for headlines; Title Case only for short diagram-style labels
- No all-caps except inside the logo lockup asset

### 8.3 Logo

- Asset in repo: `app-platform/public/trane-quiz/trane-technologies-logo.png` (black wordmark + purple apex “A”, “TECHNOLOGIES” underline + ™)
- Source used for v1: [Seeklogo — Trane Technologies](https://seeklogo.com/vector-logo/410688/trane-technologies) (PNG). Replace with official Trane vector when available.
- Do not recreate the wordmark in type
- PDF / participant chrome: bottom right or header as appropriate, consistent size, clear space ≈ height of “TECHNOLOGIES” line
- Prefer black+purple on white grounds; for purple bands, use a white knock-out treatment if an all-white asset is later supplied (v1 may keep logo on a white chip on purple bands)

### 8.4 Surface mapping

| Surface | Brand |
|---------|-------|
| Participant quiz | Trane |
| PDF report | Trane |
| Facilitator console (projected QR) | Trane-leaning; white-dominant, purple headers |
| Offering create (`/trane-quiz/new`) | Trane-leaning (same program look) |

### 8.5 UX craft carried from Unmute (behavior only)

- Mobile-first participants
- Large tap targets; one primary CTA
- Quiet transitions; no game-show motion
- Familiar QR join pattern

---

## 9. Course catalog (v1)

| # | Slug | Title | Source revision |
|---|------|-------|-----------------|
| 01 | `intro-to-pm` | Introduction to Product Management | Jan 2024 |
| 02 | `product-line-strategy` | Product Line Strategy | Jan 2024 |
| 03 | `gdlo-commercialization` | GDLO and Commercialization | Jan 2024 |
| 04 | `in-line-action-planning` | In-Line Action Planning | Jul 2025 |
| 05 | `value-based-pricing` | Value-Based Pricing | Dec 2025 |
| 06 | `pgt-foundations` | **PGT Foundations** | Jan 2026 |

Full stems, options, answer keys: [`trane-quiz-question-bank-v1.md`](./trane-quiz-question-bank-v1.md).

PDFs are the content source of truth (no newer Word doc).

---

## 10. Technical constraints

- Route tree under `app-platform`: suggested `/trane-quiz/...`
- Do not register as an Unmute protocol / Season Moment
- Participants = anonymous cookies; cannot read others’ responses or answer keys
- Facilitator actions require valid `host_token` for that offering
- PDF download requires same host token
- Reuse Unmute QR / join URL builder patterns where practical

---

## 11. Degraded fallback

1. Facilitator runs questions from the course PDF / slides.
2. Participants answer on paper or private Teams chat.
3. Facilitator scores manually from the question bank.
4. No digital paired PDF that session — note “manual run” when emailing L&D.

---

## 12. Acceptance bar

1. Create offering via `/trane-quiz/new`; host URL controls console; participant QR does not.
2. ≥8 real participants complete before and after on phones; counts match ±0.
3. Same-phone before/after pairs correctly; PDF paired N matches.
4. Participant with no PRE who starts POST sees confirmation; Cancel returns to waiting; Continue allows end-only quiz; PDF footnotes end-only count and keeps headline delta paired-only.
5. Participants never see correct answers or personal scores; no edit after submit.
6. PDF downloads with Trane tokens, logo, overall delta, and per-question before/after/change for a fixture dataset.
7. Answer key absent from participant network payloads.
8. Host token rotation: each new offering gets a new host URL.

---

## 13. Build sequence

1. Schema + seed six courses / 60 questions  
2. Offering create (`/trane-quiz/new`) → `host_token` + `join_code` + QR  
3. Anonymous join + PRE quiz UX (Trane tokens)  
4. Facilitator live counts + phase controls (host-gated)  
5. POST phase + pairing + unpaired confirmation flow  
6. Scoring + Trane-branded PDF download  
7. Soft launch with one live class  

---

## 14. Open questions (remaining)

None blocking. Optional later:

- Replace Seeklogo PNG with official Trane vector / all-white lockup when Aaron supplies assets.
- Confirm corporate typeface if official brand guide arrives (Arial remains working substitute).

---

## 15. Decisions locked this revision

- [x] Course 06 display name = **PGT Foundations**
- [x] Two actors only (Facilitator + Participant)
- [x] Facilitator auth = **per-offering host token** (Unmute-style)
- [x] Create offering = unlisted `/trane-quiz/new` (link possession); control = host URL
- [x] No L&D login — facilitator downloads PDF and emails it
- [x] Brand tokens from Visual Standards Reference 2026-08-09
- [x] Logo PNG from Seeklogo in repo for v1
- [x] PDFs are content source (no newer Word doc)
- [x] **No edit after submit**
- [x] **POST without PRE allowed**, with required participant confirmation; unpaired excluded from headline paired delta

---

## 16. Spec checklist

- [x] Actors and flows
- [x] Host-token facilitator model
- [x] Create-offering entry point
- [x] Anonymity + before/after linking
- [x] Unpaired POST + confirmation
- [x] Participant UX (incl. no edit after submit)
- [x] Facilitator console
- [x] PDF report (not L&D web app)
- [x] Trane visual tokens + logo asset
- [x] Question bank companion
