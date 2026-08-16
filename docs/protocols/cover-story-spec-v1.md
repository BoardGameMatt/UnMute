# Cover Story — Protocol Spec v1

**Status:** Build spec, locked for v1  
**Branch:** `cover-story-v1` off `main`  
**Target run:** NAFA, Sitting A in-season; Sitting B on-site 10 September 2026  
**Slug:** `cover-story`  
**Type:** `async` (two live sittings with a multi-week field period)  
**Envelope:** Sitting A ~15 minutes (video call). Field period = facilitator-set reveal date minus deal date. Sitting B ~5 minutes per participant (on-site; ~60 minutes at 12 people, ~75 minutes at the 15-person cap).  
**Players:** 6–15. Hard minimum 6 (Type 1 scoring collapses below that). Hard maximum 15.  
**Owner:** Matt Hendricks  
**Playable library:** [`cover-story-agencies-v1.json`](./cover-story-agencies-v1.json) (50 agencies, aliases included). Spreadsheet copy: [`cover-story-agencies-v1.csv`](./cover-story-agencies-v1.csv).

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

---

## 1. What this protocol is

Participants independently read a short passage on team dynamics. They are not told that each of the five screens hides the title of an Oasis song. After a discussion of the ideas, the facilitator reveals the hidden titles. Then each person is dealt three unique agencies, locks one, and spends the following weeks speaking five assigned words into real meetings. They must not name their agency. On the reveal date, the team guesses each person’s agency. Some people will have noticed. Most will not.

**The passage is the cover. The weeks of ordinary talk are the protocol. The Oasis briefing is only the teaching example.**

**Primary target dimensions:** D8 (Peer Interaction Frequency), D3 (Shared Collaborative Understanding)  
**Secondary:** D2 (Fulfillment of Relational Needs)

**What gets revealed about a person:** whether colleagues actually hear them in ordinary meetings; whether they can place a word without making the room about themselves; whether they notice a pattern that was in front of them the whole time.

### 1.1 The two interpersonal failures this Moment makes visible

1. **Unwarranted inattention.** The word was spoken, in a meeting you were in, and you did not hear it as anything. Same failure as the Oasis briefing.
2. **Unwarranted performance.** The word was forced so hard that everyone can name the agency. You were not in cover. You were on stage.

Both are invisible in ordinary work. This protocol makes them arithmetic.

### 1.2 Opt-outs from Moment conventions (with rationale)

| Convention | Opt-out | Rationale |
|---|---|---|
| Lobby explainer teaches the real mechanic before start | Phase 1 lobby teaches only the cover: read a short passage, then discuss | Teaching hidden titles or agencies spoils Sitting A |
| Session progress bar | None | Two sittings weeks apart. A filling bar implies one sitting |
| Single-sitting device story | Sitting A is a video call (phone + laptop). Sitting B is on-site (phones + a shared board) | Reveal is in the room, not on a video grid |
| Lead may be a player | Lead is **not** a player in v1 | The lead judges free-text guesses against the true agencies |

---

## 2. Core mechanic

### 2.1 Two sittings, one session

One join code. One session record. Three clocks:

| Clock | What happens |
|---|---|
| **Sitting A** | Lobby → independent reading → facilitator-gated discussion → shared playback → insights → deal → lock → mission sheet |
| **Field period** | Participants reopen the same code, tap their name, log planted words or mark the mission incomplete |
| **Sitting B** | Facilitator starts the reveal. No new agents. Guess → mark → reveal → talk → points strip → repeat. Final board → NPS → reflection |

Late joiners may be admitted **only by the lead**, only **before Sitting B starts**, and only if three unshown agencies remain. They skip the live briefing, go to three cards, and may optionally read the passage on their own.

If someone first appears on the reveal date, they are too late to take an agency. They do not join as a player.

### 2.2 Identity (no authentication)

v1 does **not** require Google/Microsoft auth.

- Sitting A join: type a display name, enter the lobby.
- Rejoin (field period and Sitting B): roster of names already in the session. **Tap your name.**
- A cookie on that browser remembers the last claimed participant and auto-resumes.
- Impersonation risk is accepted for v1: anyone with the join code can tap another name and see that person’s agency. Recorded in §16. Do not add a PIN or magic link in v1.

### 2.3 Unique agencies, disjoint hands

Agencies are unique inside a session. Oasis is **banned** as a playable agency. It exists only in the briefing passage.

**Deal rule (authoritative):**

1. Pool = agencies with `active = true` and `playable = true` (Oasis is `playable = false`).
2. When a participant reaches the deal phase, draw **three agencies that have never been shown to anyone in this session.**
3. Those three are **burned** (removed from the pool) whether or not they are chosen.
4. The participant views all three cards — agency name and all five words — then picks one and locks.
5. Lock is final. No re-pick.

This is why the library is 50 agencies: 15 players × 3 shown = 45, plus spare for late joiners when the opening roster is smaller than 15.

If fewer than three unshown agencies remain, the lead cannot admit another late joiner.

### 2.4 The field rule

Each locked agency has five words. The agent must **speak** each word (or multi-word phrase, entire and in order) in a meeting that includes **at least two other people from this session** (three people total, including the agent).

| Counts | Does not count |
|---|---|
| Spoken in a video call | Chat, email, docs, Slack, reactions |
| Spoken in a room | Mouthing, slides, a filename |
| Several words in the same meeting | Naming the agency, showing the card |
| Virtual meetings | Meetings with no other session member |

They must not tell anyone their agency. They may not confirm or deny guesses during the field period.

### 2.5 Mission log

On rejoin, each of the five words is in one of three states:

| State | What the agent enters |
|---|---|
| Planted | Date + at least two witnesses from this session’s roster (not self) |
| Not planted | Explicit mark |
| Open | Neither yet |

**Couldn’t complete mission** is a convenience control: remaining open words become `not planted`. Already-planted logs stay.

Date must fall on or after the deal timestamp’s calendar date, and **before** the reveal date. Witnesses are a multi-select of session participants excluding self. Minimum two.

The in-app log is the source of truth for scoring. A copy-paste block is offered at lock time as a personal backup. Copy-paste is not scored.

---

## 3. Scoring

Three independent lines. Displayed separately on the points strip and summed on the final board. The person on the board does not guess themselves. The lead does not guess and does not have an agency.

Let \(n\) = number of participants who submitted a guess for this target (everyone in the session who is present as a player, excluding the target).  
Let \(k\) = number of those guesses the lead marks correct.

Absent players do not increment \(n\).

### 3.1 Type 1 — being guessed

\[
S_1 = k \times (n - k)
\]

Zero if nobody is right. Zero if everybody is right. Peak when about half the room is right. For seven guessers, 3 correct and 4 correct both score 12; 2 and 5 score 10; 1 and 6 score 6.

### 3.2 Type 2 — guessing others

Each participant \(i\) who is marked correct on target \(X\) receives:

\[
S_2(i, X) = n_X - k_X
\]

Not split. If you are the only person who got X, you get a large personal score. If half the room got X, you get a modest one. If everyone got X, you get nothing — same as missing.

A miss scores 0 for that target. The evidence field is never scored.

### 3.3 Mission complete

\[
S_m = 15 \text{ if all five words are } \texttt{planted} \text{ with valid date and witnesses, else } 0
\]

All-or-nothing. Four planted words score 0 on this line and still appear on the reveal board. Invalid logs (too few witnesses, date out of range, witness not in session) do not count as planted.

### 3.4 Worked totals (illustrative, 10 guessers)

| Outcome for a target | Type 1 to the agent | Type 2 to each correct guesser |
|---|---|---|
| \(k = 0\) | 0 | — |
| \(k = 1\) | 9 | 9 |
| \(k = 3\) | 21 | 7 |
| \(k = 5\) | 25 | 5 |
| \(k = 10\) | 0 | 0 |

A finished mission is +15 on top of Type 1. A player who listens well can beat a player who only finished the mission. A player who is medium-obvious and also listens can win. That is the intended mix.

### 3.5 When scores appear

**Not** a running leaderboard after every three people. After each target is finalized:

- A **points-just-awarded** strip: the agent’s Type 1 and mission points; each guesser’s Type 2 delta for this target. Names on. No cumulative totals.

After every target has been finalized:

- The **final board** (§8.4). Then NPS. Then reflection.

---

## 4. Session flow

### 4.1 Sitting A — video call, ~15 minutes

| Beat | Duration | Notes |
|---|---|---|
| Lead creates session, sets reveal date | before join | Date only, no time of day. Shown to players as a long date (e.g. Thursday, September 10, 2026) |
| Join (QR on shared screen) | ~2 min | Display name. Lead sees roster, admits as with other Moments |
| Cover explainer in lobby | during join | §9.1. Does not mention Oasis, agencies, or missions |
| Lead: one start button | — | Verbal prompt in §12 beat 2 |
| Independent reading, five screens | ~3 min | Back and forward. Persistent “Read silently.” Lead sees who has reached screen 5 |
| Lead gates “everyone’s done — discuss” | — | Stragglers: lead may force-advance a reader to screen 5 after a spoken check, then gate. Conservative default: do not auto-advance on a timer |
| Discussion, lead-driven | ~4 min | Prompts in §4.4. Shared playback is **lead-only**. Participants’ readers become view-only |
| Insights | ~2 min | Same five screens, song titles highlighted. Separate lead control from plain playback |
| Deal, pick, lock | ~3 min | Three cards. Finalize is the amber action |
| Mission sheet + copy-paste | remaining | Reveal date, rules, five words, log reminder |
| Lead reminder screen | remaining | T−7 and T−2 copy ready to paste into Slack/Teams. Not sent by the product (no participant email in v1) |

If someone blurts the Oasis pattern during independent reading, the lead does not confirm. Script: *“Hold that — read silently, we’ll talk when everyone is through.”*

### 4.2 Field period

No live facilitator. Same join code. Tap name → mission sheet + log. Lead may open **Admit late** and walk one person through three cards (optional passage first, then deal from remaining pool).

Lead field dashboard (no agency names): roster, locked yes/no, planted count `0–5`, late-admit control. Agencies stay hidden from the lead until that person’s Sitting B reveal.

### 4.3 Sitting B — on-site reveal

| Beat | Notes |
|---|---|
| Rejoin, tap name | Reveal-sitting explainer (§9.2). Lead starts reveal. Admit late is disabled |
| Order | Fisher–Yates at reveal start, **persisted**. Refresh must not reshuffle |
| For each target, in that order | Name on the board → 90s guess (agency ≤50 chars, evidence ≤250) → wait or timer lock → anonymized gallery (agency + evidence, no guesser names) → lead marks with suggestions → finalize → big reveal (agency, five words, planted/not) → live talk → points strip → lead advances |
| Absent target | Lead may **Skip for now** (goes to end of queue) or **Score without story** (guesses still happen; no live talk; logs still shown) |
| After the last target | Final board, then Continue → NPS → reflection |

Guess lock: whichever comes first — all guesses submitted, or 90 seconds. Early submit is a waiting state. Lead cannot extend the timer in v1.

The evidence field may deanonymize a guesser. Accepted.

### 4.4 Facilitator discussion ladder (Sitting A, after independent reading)

Spoken, in this order. Do not skip to Oasis.

1. What did you notice? What insights are you taking back to the team?
2. Did any sentence feel slightly off — as if it had been written to include a word?
3. If I told you each screen hid one title from the same catalog, what catalog would you guess?
4. Insights view. Then: each of you is going to take a cover of your own. You will not share it.

---

## 5. Briefing passage (locked copy)

Teaching theme: Oasis. **Not a playable agency.** Five screens. ~50 words each. One title per screen, set in the same type as every other word during independent reading. No italics, no weight, no color until Insights.

**Insights treatment:** body `text-unmute-navy`; song title contiguous span `font-bold text-signal-amber`. That is the style-guide mapping of “blue passage, yellow titles.” Do not use raw hex.

Difficulty ramps from camouflaged to the tell.

### Panel 1 — Little by Little (camouflaged)

When people know they can rely on one another, the workday changes. You spend less energy protecting yourself and more on the actual problem. Little by little, colleagues ask for help sooner and treat mistakes as information. The result is not just a warmer room. It is a team that keeps moving when the plan gets messy.

### Panel 2 — The Masterplan (camouflaged)

A busy team without a shared picture of success will still produce motion. It will also pull in five directions. The masterplan does not have to live on a slide. It has to show up in ordinary conversation: what we are optimizing for, what we will not do, and who owns the next step. When that picture is held in common, individual effort stops canceling itself out.

### Panel 3 — Don’t Look Back in Anger (recognizable, still a sentence)

When a deadline moves or a launch misses, don't look back in anger. Name what happened, skip the referendum on competence, and renegotiate in the open. Teams that can do this are not being soft. They are keeping the work alive through contact with the real week.

### Panel 4 — Live Forever (recognizable)

Job satisfaction tracks a simple question: when I get stuck, will anyone stay in it long enough that I can finish well? People who have that experience grow faster. They also stay. The best teams build work that can live forever in the practices they leave behind.

### Panel 5 — Wonderwall (the tell)

None of this holds if the only record of success is a fading thread in chat. Teams need a place to mark what they pulled off together, a wonderwall of the work worth remembering, however informal. Names, dates, the ugly version before it worked. That memory is how a group becomes a culture instead of a calendar of meetings.

**Do not play Oasis audio in product.** Titles only.

Independent reader: each screen has Back (hidden on 1) and Next (on 5, Next becomes “I’m done”). Done is sticky. They may still page back after done until the lead gates discussion.

Shared playback after the gate: only the lead’s Next/Back move the room. Participant screens follow.

---

## 6. Agency content contract

v1 playable library is locked in [`cover-story-agencies-v1.json`](./cover-story-agencies-v1.json): **50 agencies**, each with five words and aliases. Oasis is **not** in this file. It remains the non-playable teaching theme in §5.

CSV column mapping from the authored sheet:

| CSV | Runtime |
|---|---|
| `id` | Stable library id (1–50). Deal by this, never by row order. |
| `source_id` | Authoring provenance only. Do not show. |
| `status` | All `final`. Seed only `final` rows. |
| `agency_name` | `official_name` |
| `kind` | Content taxonomy. Not shown to players. Optional later for hand-balance; v1 shuffle ignores it. |
| `word_1`…`word_5` | Phrases in easiest → hardest order |
| `diff_1`…`diff_5` | Integer 1–5 (1 = easy to sneak in; 5 = the tell) |
| `pop_culture` | `Y` on the 13 franchise cards |
| `tier` | Playability grade for us (1 = strongest, 3 = Pottery only). Not shown. |
| `change_log` / `notes` | Authoring only. Never shown. |
| `aliases` | Added in v1 content. Lowercase strings for the suggester. |

### 6.1 Agency record

```
id
source_id              // authoring only
slug
official_name          // what the board shows at reveal
aliases[]              // normalized lowercase strings
kind                   // natural_taxonomy | food_drink | procedural_terms |
                       // manufactured_object | proper_noun_set |
                       // abstract_vocabulary | pop_culture_property
pop_culture            // bool
tier                   // 1 | 2 | 3
playable               // false only for a future Oasis library row; v1 JSON is all true
active
hr_safe                // true on every v1 row
words[5]
change_log             // authoring only
notes                  // authoring only
```

### 6.2 Words

Each agency has exactly five words or short phrases, stored with `ordinal` 1–5 and `difficulty` 1–5.

- Word 1 is the easiest plant; word 5 is the diagnostic tell. Difficulty is non-decreasing.
- Agencies themselves are **not** easy/medium/hard. `tier` is an authoring grade, not a deal weight.
- Multi-word phrases must be spoken as a unit.
- No politics, bodies, insults, alcohol-as-punchline, weapons, religion, or dating.
- No Oasis titles in the playable library.

### 6.3 Aliases

Aliases are **category and franchise names a guesser would type**, not the five mission words (except where the alternate name *is* the property, e.g. `dunder mifflin` → The Office, `hogwarts` → Harry Potter).

Rules used to generate v1 aliases:

1. Official name is matched on its own; do not duplicate it in `aliases`.
2. Normalize the same way as guesses: trim, lowercase, strip punctuation, collapse space, ASCII-fold.
3. No alias (or official name) may belong to two agencies. v1: 294 aliases, 0 collisions.
4. A planted word from agency A must not be an alias for agency B.
5. The lead can still override the suggester.

Regenerate from the authored CSV with `docs/protocols/cover-story-aliases-v1.py` if the word list changes. The JSON is the seed source of truth.

### 6.4 Guess matching (suggestion only)

On the mark screen, for each guess:

1. Trim, lowercase, strip punctuation and extra space, ASCII-fold.
2. If it equals `official_name` or any alias (same normalization), **suggest correct**.
3. Otherwise suggest incorrect.
4. Suggestions render as unchecked chips. The lead toggles. Finalize writes the lead’s marks, not the suggester’s.

The lead may mark a non-matching guess correct (e.g. a clear synonym that never made the alias list).

### 6.5 Deal randomness

CSV / JSON file order is authoring order, **not** deal order.

At deal time, on the server:

1. Load all agencies with `playable` and `active` and `status = final`.
2. Shuffle the pool.
3. Draw three ids that have never been shown in this session.
4. Burn all three. The participant locks one.

Do not deal on the client. Do not weight by `tier` or `kind` in v1. Log `shown_agency_ids` and `locked_agency_id` per participant.

---

## 7. Data model (Supabase)

```
cover_story_sessions
  id
  session_id            // FK platform session
  reveal_on             // date only
  phase                 // lobby | reading | discuss | insights | deal | field | reveal | complete
  reveal_order[]        // participant ids, set when Sitting B starts
  reveal_index          // current target, 0-based
  created_at

cover_story_agencies
  // library, §6.1 — seeded from cover-story-agencies-v1.json
  id, slug, official_name, aliases[], kind, pop_culture, tier,
  playable, active, hr_safe, notes

cover_story_agency_words
  id, agency_id, ordinal (1–5), phrase, difficulty (1–5)

cover_story_deals
  id, cover_story_session_id, participant_id
  shown_agency_ids[3]
  locked_agency_id      // nullable until lock
  locked_at

cover_story_word_logs
  id, deal_id, word_id
  status                // open | planted | not_planted
  planted_on            // date, required if planted
  witness_ids[]         // participant ids, min 2 if planted
  updated_at

cover_story_guesses
  id, cover_story_session_id, target_participant_id, guesser_participant_id
  agency_text           // ≤50
  evidence_text         // ≤250
  submitted_at
  suggested_correct     // bool, from matcher at submit time
  marked_correct        // nullable until lead finalizes
  UNIQUE (session, target, guesser)

cover_story_target_results
  id, cover_story_session_id, target_participant_id
  n, k
  type1_score
  mission_score
  finalized_at
```

Type 2 is derived at read time from finalized `cover_story_guesses` (`marked_correct` and that target’s `n, k`). Do not store Type 2 as a mutable running total.

Reading progress (which screen, done or not) may live in `session_state.state_json` for Sitting A. Deals, logs, and guesses are first-class tables because they outlive the sitting.

---

## 8. UI states and design constraints

### 8.1 Device context

| Sitting | Participant | Lead |
|---|---|---|
| A (video) | Phone is primary; laptop keeps the video call. Desktop reading works, not optimized | Phone for controls; laptop shared screen for QR, then for playback/insights |
| Field | Phone | Laptop/phone dashboard |
| B (on-site) | Phone for guessing | Laptop on a shared board for the name, gallery, reveal, points strip, final board |

### 8.2 Persistent play instructions

**Independent reading (participant):**

> Read silently. You will discuss once everyone is through.

**After lock, and on every field rejoin:**

> Speak each word in a meeting with at least two other people from this session. Do not name your agency. Spoken words only.

**Sitting B guess screen:**

> Name their agency. You have ninety seconds. Do not talk.

### 8.3 Guess timer

Follow the WAO timer pattern (`WaoPlayTimer.tsx`).

| Phase | Treatment |
|---|---|
| Most of 90s | Depleting circular arc, no numerals. Track `cloud-grey`, fill `unmute-navy` |
| Final ~15s | Arc `signal-amber`, subtle pulse (1s) |
| Final ~3s | Numeric 3-2-1 |
| Lock | Numerals off; “locking in” |

Server-authoritative. Client expiry does not finalize the target; it only closes input. The lead still marks and finalizes.

Reading is untimed.

### 8.4 Final board motion

Bars fill. Some stop. The longest settles to the top.

Allowed: fade, opacity, width, `translateY` 4–8px, 400–600ms, `cubic-bezier(0.4, 0, 0.2, 1)`, stagger 100–150ms.  
Forbidden: bounce, spring overshoot, confetti, shake, game-show sting.

Hold briefly after the last bar finishes, then reorder so rank 1 is at the top. Score values in `font-display`. Labels in `font-mono` uppercase: TYPE 1, GUESSES, MISSION, TOTAL.

### 8.5 Amber usage

Amber is the one action: Start, I’m done (lead gate is navy/secondary; the participant “I’m done” may be navy until the last screen), Finalize pick, Finalize marks, Next person. Insights is a distinct secondary control, not a second primary.

Song titles on the insights screens are the other amber use (highlight, not a button).

### 8.6 Card UI

Each of the three cards: `warm-white`, `cloud-grey` border, `rounded-lg`, `p-6`. Top: `font-mono` uppercase tracking-widest “AGENCY”. Then official name in `font-display`. Then five words in `font-body`. Selected card: 2px solid `unmute-navy`, not color-only. Finalize disabled until one card is selected. After lock, the other two cards are gone.

---

## 9. Lobby explainer

Required by convention. Two explainers, swapped on `phase`.

### 9.1 Sitting A — cover only

Visual shell as in moment-conventions §1.

| Beat | Caption | Sample data |
|---|---|---|
| 1 Device | Play on your phone. Keep everyone’s video up on your laptop. | Phone + laptop illustration |
| 2 Core action | You will read a short passage, five screens, at your own pace. | Fake title “A note on working together.” Never Oasis, never a real agency |
| 3 Constraint | Read silently. Do not talk until the lead opens discussion. | — |
| 4 Upside | You will come back with one insight for the team. | — |
| 5 Penalty | There is no score in this reading. The discussion is the point. | — |

Reuse the five-screen reader chrome at tiny scale with obviously fake copy. Do not reuse Sitting B UI.

### 9.2 Sitting B — guessing

| Beat | Caption | Sample data |
|---|---|---|
| 1 Device | Phone for guessing. The board is at the front of the room. | — |
| 2 Core action | A colleague’s name comes up. You name their agency and why you think so. | Target “Alex”; guesses “houseplants” / “train stations” (fake) |
| 3 Constraint | Do not talk. Ninety seconds. Short name, longer why. | — |
| 4 Upside | You score if you catch a cover other people missed. They score if some, not all, of you are right. | — |
| 5 Penalty | If nobody is right, or everybody is right, that person scores nothing for being guessed. | — |

### 9.3 Field rejoin

No looping explainer. The persistent field instruction in §8.2 is enough.

---

## 10. Session end flow

Sitting A does **not** run NPS or reflection. Ending Sitting A parks in `field`.

Sitting B, after the final board:

```
Final board → NPS (`/session/[id]/feedback`) → Reflection (`/session/[id]/reflection`)
```

Reflection is the last screen.

### 10.1 Standard reflection prompts (Season default)

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

### 10.2 Facilitator prompt if the room is quiet

*"Who did you work with for weeks and still not hear? What else are we missing in the meetings we already have?"*

---

## 11. Lead metrics (when)

| Phase | Lead sees |
|---|---|
| Lobby | Headcount, names, reveal date, Start (enabled at 6+) |
| Reading | Per-person screen index and done flag. Gate discussion (enabled when all done, or force-advance then gate) |
| Discuss / insights | Playback position 1–5. Toggle Insights. Advance to deal |
| Deal | Who has locked. Advance to field when all present players have locked (late seats may still be empty) |
| Field | Locked yes/no, planted `0–5`, Admit late. No agency names. Copy for T−7 and T−2 reminders |
| Reveal | Current target, guess-in count, timer, suggested marks, Finalize, Skip for now, Score without story, Next |
| Complete | Continue to NPS |

Reminder copy (lead pastes; product does not send):

**T−7:** One week until Cover Story reveal on [date]. Speak any words you still owe, in a meeting with at least two other people from this session. Log them when you have.

**T−2:** Cover Story reveal is on [date]. Finish your logs. Do not name your agency.

---

## 12. Facilitator script beats

1. Before Start: names on the roster, reveal date confirmed out loud.
2. Start: *“We’re going to ask each of you to read a short passage on team dynamics independently, and then, when you come back, we’re going to discuss your insights.”*
3. *“Read silently. Don’t comment until everyone’s through.”*
4. When all done: discussion ladder §4.4, while you drive shared playback.
5. Insights. Let the room see the amber titles. Do not rush the laugh.
6. *“That was the cover. Now you each get one of your own. You will see three agencies. Lock one. Do not tell anyone what you picked. You will speak those five words, out loud, in real meetings, before [date]. We’ll guess then.”*
7. When everyone has locked: *“Save the copy. You’ll get a reminder from me. See you on [date].”*
8. Sitting B: *“Phones out. A name will come up. Guess their agency. Don’t talk.”*
9. After marks: reveal, then *“Tell us how you got the words in.”*
10. After the last person: let the board run. Then NPS, then the two reflection questions.

---

## 13. Degraded fallback (write before building)

If the platform fails at Sitting A:

1. Lead shares a five-slide deck of the locked panels, people read silently on their own screens, cameras stay up.
2. Discussion ladder as written.
3. Insights: lead’s slide with titles already in amber.
4. Physical or PDF cards, pre-shuffled into unique sets of three, enough for the roster plus a late envelope. People photograph their locked card.
5. Paper log: word, date, two names from this team.

If the platform fails at Sitting B:

1. Lead reads the true agency only after paper ballots are in.
2. Ballots: target name, guessed agency, why.
3. Lead marks, tallies \(k\) and \(n\), scores Type 1 / Type 2 / mission from paper logs on a visible sheet.
4. Same live talk. Final totals on a whiteboard.

Slower, weaker, and it runs with zero platform. It must exist in the facilitator notes before Sitting A, not be improvised live.

---

## 14. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention through Sitting A, a simulated field log, and a Sitting B with real free-text guesses.
2. Self-service QR join works without assistance.
3. Rejoin path: new browser, tap name, mission words still there.
4. Edge headcounts: 6 (minimum), 7 (odd Type 1), 15 (deal must still have unique hands). Late admit at 12 → 13 with three remaining agencies. Block admit when fewer than three remain.
5. Authorization: a participant cannot read another participant’s `locked_agency_id` or word list via the API they are supposed to use, other than the accepted tap-name impersonation on the join code. Cross-participant reads without claiming that name must fail.
6. Throttled-network path: lock agency, log a word, submit a guess — retry then non-blocking warning. Server is truth at guess lock.
7. Degraded fallback in facilitator notes.
8. Oasis does not appear in the playable deal in 20 consecutive simulated sessions of 15 players.
9. Impersonation is demonstrated once (tap someone else’s name, see their words) so the lead knows the v1 risk, then left as accepted.

---

## 15. Build sequence

One change at a time. Each step independently testable.

1. Schema and migrations. Seed from `cover-story-agencies-v1.json` (50 playable). Oasis stays briefing-only, not a library row.
2. Sitting A lobby explainer (cover only) + reveal-date on session create.
3. Independent five-screen reader, done flags, lead gate.
4. Lead-only shared playback + insights highlight.
5. Deal: disjoint three, lock one, burn shown ids.
6. Mission sheet + copy-paste + field rejoin by tap-name.
7. Word log (date, witnesses, not planted, complete-mission convenience).
8. Admit late (optional passage, then deal from remaining pool). Block on reveal start and on empty pool.
9. Sitting B: persisted random order, 90s guess, character limits.
10. Anonymized gallery, alias suggester, lead marks, finalize.
11. Reveal board (agency, five words, planted/not) + points strip.
12. Server-side Type 1 / Type 2 / mission scores.
13. Final board motion. NPS. Reflection.
14. Lead reminder copy. Field dashboard without agency names.
15. Seed the 50-agency JSON (already locked). Oasis remains briefing-only.

---

## 16. Authorization boundary

Field logs and deals are secret from other players until that target is finalized in Sitting B.

If routes use a service-role client, each route must, before touching it:

1. Verify caller participant identity (cookie claim, or the tap-name claim just written).
2. Confirm that participant belongs to this session.
3. For deal/log reads, confirm the caller is that participant **or** the lead **after** that target is finalized, **or** the lead on the mark screen for the current target only.
4. Lead field dashboard queries must not return `locked_agency_id`, word phrases, or aliases.

Tap-name impersonation is a known hole in v1. Do not widen it: do not list other people’s words on any roster endpoint.

`lib/supabase/server.ts` and `lib/supabase/admin.ts` are not interchangeable.

---

## 17. Realtime

Sitting A done-flags and lead playback index: session channel, optimistic write → ack → confirmed. Retry twice, then non-blocking warning.

Guess submissions: same. At timer expiry the server closes the guess window; late writes fail.

Field logs do not need presence. Ordinary request/response is enough.

---

## 18. Choices recorded (conservative)

Where conversation left a gap, v1 uses these. Changing them is an amendment, not a silent edit.

1. Minimum 6 players.
2. Lead is not a player.
3. Hands are disjoint; shown agencies stay burned.
4. Mission is +15 all-or-nothing, not per-word.
5. Type 1 is \(k(n-k)\). Type 2 is \(n-k\) per correct guesser, not a split pool.
6. No mid-reveal cumulative leaderboard.
7. No auth; tap-name rejoin; impersonation accepted.
8. Reading is untimed; lead gates discussion.
9. Guess window is 90s or all-in, no lead extend.
10. Reveal date is a date only.
11. Reminders are lead copy-paste, not product email.
12. Absent target: skip-for-now or score-without-story, lead’s choice.
13. Optional passage for late joiners; primary path is three cards.
14. No session progress bar.
15. Insights highlight is `unmute-navy` body + bold `signal-amber` titles.
16. Evidence may deanonymize; names of guessers still omitted from the gallery.
17. Deal shuffles the 50-agency JSON server-side. File order is not deal order. `kind` / `tier` are not deal weights in v1.
18. Word difficulty is the CSV’s 1–5 scale, not easy/medium/hard.

---

## 19. Open items

- Confirm NAFA Sitting A date (Sitting B is 10 September 2026). Does not block build; reveal date is session config.
- Whether a future version requires auth to close the tap-name hole. Out of scope for v1.
- Whether Type 2 should be shown to guessers as “you were the only one” on the points strip. v1 shows the numeric delta only; copy can name the target, not the other guessers’ identities.
- Alias review: v1 lists are generated. Spot-check anything the lead would not actually mark correct (e.g. `disney` → Disney Princesses, `poker` → Card Games). Override in JSON; do not block the build on a perfect list.

---

## 20. Spec checklist

- [x] § Lobby explainer — beat list + sample data (§9)
- [x] § Device context — Sitting A video; Sitting B on-site (§8.1)
- [x] § UI states — cards, insights highlight, marks (§8)
- [x] § Timer — 90s guess only (§8.3)
- [x] § Persistent play instruction — exact copy (§8.2)
- [x] § Facilitator script beats (§12)
- [x] § Session end flow — final board → NPS → reflection (§10)
- [x] § Reflection — standard prompts + facilitator prompt (§10)
- [x] § Degraded fallback (§13)
- [x] § Acceptance bar (§14)
- [x] § Authorization boundary (§16)
- [x] § Build sequence (§15)
- [x] § Agency library locked — 50 playable, aliases, 1–5 difficulty (§6)
