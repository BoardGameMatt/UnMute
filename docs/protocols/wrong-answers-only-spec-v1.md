# Wrong Answers Only (WAO) — Protocol Spec v1

**Status:** Build spec, locked for v1
**Branch:** `wrong-answers-only-v1` off `main`
**Target run:** NAFA, week 2
**Slug:** `wrong-answers-only`
**Envelope:** 15 minutes total
**Owner:** Matt Hendricks

---

## 1. What this protocol is

Pairs of participants must silently agree on which answers to eliminate from a ten-item list. They cannot talk. They can only watch each other's selections update in real time on their own phone.

**The trivia is the surface. The payload is convergence under constraint.**

Two people have to reach concurrence with no verbal channel, under time pressure, using only mutual observation. That is a direct simulation of asynchronous written handoffs, which is the actual failure condition of distributed work.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)
**Secondary:** D2 (Fulfillment of Relational Needs)

**What gets revealed about a person:** whether they will confirm your judgment without evidence, whether they hold out when they disagree, and whether they follow or lead. Every round pairs you with someone new, so by the end each participant has four independent readings on four different colleagues.

### 1.1 The two interpersonal failures this Moment makes visible

1. **Unwarranted distrust.** Your partner was right, you saw them tap it, you did not confirm, you both scored nothing on that item. This is quantified as the "left on the table" number.
2. **Unwarranted deference.** You confirmed a selection you had no basis for, they were wrong, and the round scored zero.

Both are invisible in ordinary work. This protocol makes them arithmetic.

---

## 2. Core mechanic

### 2.1 Question structure

- Exactly **10 answer options** per question
- Between **1 and 5** options are **correct** (they genuinely belong to the category)
- Therefore **5 to 9** options are **wrong** and should be eliminated
- Participants always know at least half the list must go

### 2.2 The tap

**Tapping an item marks it for elimination.** The participant is asserting "this does not belong."

### 2.3 Four visual states

Each of the 10 items renders in one of four states, derived at render time from two independent selection sets:

| State | Meaning |
|---|---|
| Unselected | Neither partner has tapped it |
| Mine | Only I have tapped it |
| Theirs | Only my partner has tapped it |
| Both | We have both tapped it |

Either partner can tap or un-tap any item at any time until lock. State is live and bidirectional.

### 2.4 Submission

**Only items in the "Both" state at lock time are submitted as eliminations.** Intersection, never union.

Two paths to lock:
- **Both partners press "Lock It In."** First press shows a waiting state to that partner and a "your partner has locked in" indicator to the other. Second press submits immediately.
- **Timer expires** at 90 seconds. Whatever is in the "Both" state at that moment is the submission.

### 2.5 Post-timer sync settle

At T=0 all input is disabled client-side immediately. A **3-second settle window** follows during which the server reconciles any in-flight taps before computing the score. Participants see a "locking in" state, not a frozen screen.

Server truth is the persisted tap log, not any client-reported state.

---

## 3. Scoring

### 3.1 The zero rule

**If the submitted elimination set contains even one correct answer, the round scores zero for both partners.** No partial credit. No exceptions.

### 3.2 The curve

Points by number of correctly eliminated wrong answers, assuming zero incorrect eliminations:

| Eliminated | Points |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 3 |
| 3 | 6 |
| 4 | 10 |
| 5 | 15 |
| 6 | 20 |
| 7 | 25 |
| 8 | 30 |
| 9 | 35 |

Triangular through 5, then flat +5 per additional. Maximum possible round score varies by question (15 on a five-wrong question, 35 on a nine-wrong question).

### 3.3 Lock It In bonus

`floor(seconds_remaining / 10)` bonus points, **awarded only if the round score is greater than zero.** Locking in early on a zero-scoring set earns nothing.

Awarded only when both partners have pressed Lock It In. Timer expiry earns no bonus.

### 3.4 Left On The Table (LOTT)

Computed and stored per pair per round. **Not displayed to participants in
v1** — the solo-elimination buckets already surface the debrief without
quantifying a colleague's non-confirmation as points.

```
solo_wrong   = items tapped by exactly one partner that were actually wrong
lott_set     = submitted_set ∪ solo_wrong
LOTT         = score(lott_set) − score(submitted_set)
```

Stored on `wao_round_results.lott` for analysis. Facilitator or later
surfaces may show it; the participant reveal does not.

### 3.5 The Save

If any item tapped by exactly one partner was actually **correct**, display instead or additionally:

*"Your partner's caution saved you from a zero."*

Both Save and the solo-elimination buckets can appear in the same round.
That is the interesting case and the debrief should reach for it. LOTT
remains stored for analysis but is not shown on the participant reveal in v1.

### 3.6 Solo play (half value)

Applies in two situations:
- **Odd headcount.** One participant sits out pairing each round and plays solo.
- **Ghost partner.** A partner disconnects or never registers a tap. The remaining partner's selections are scored alone.

Solo rounds score at **half value, rounded down**, using the same curve and the same zero rule. Solo rounds count toward the individual leaderboard. Solo rounds are **excluded from the team concurrence metric**, since there is no concurrence to measure.

The sit-out rotation must not repeat a participant until everyone has sat out once.

### 3.7 Team-level metric

**Concurrence Rate: the percentage of paired rounds in which both partners' final selection sets matched exactly.**

This is the number that carries across the Season. It is the observed-behavior line that sits alongside the T0 to T3 survey waves. Persist it per session.

Note: exact match means the full selection sets are identical, not merely that a non-empty intersection existed. A round where I tapped six and my partner tapped four of those six is not concurrence, even though it scores.

---

## 4. Round structure and session flow

### 4.1 Session flow

| Beat | Duration | Notes |
|---|---|---|
| Join (QR code on shared screen) | 2 min | Runs during facilitator intro |
| Rules + norm statement | 1 min | "No searching, no chat" on screen and spoken |
| **Sample round** | 2 min | Not scored. Uses a deliberately easy question. Purpose is teaching the four states, not the trivia |
| Scored rounds ×4 | ~10 min | 90s play + ~45s reveal + ~15s transition each |
| Reflection close | 3 min | Two standard questions |

Total ≈ 18 minutes. If the envelope is hard 15, cut to 3 scored rounds. **Do not cut the sample round and do not cut the reflection close.**

### 4.2 Reveal screen (per pair, on the participant's own phone)

The reveal is the debrief content. Four buckets, visually distinct, in this order
(paired rounds). Solo rounds use first-person copy with no "both" or partner
references, and omit buckets 3–4.

1. **Both tapped, correct elimination** — scored, green-equivalent treatment
2. **Both tapped, but it belonged** — the zero-maker, if present, called out unambiguously
3. **Only you tapped, and you were right** — the deference failure
4. **Only your partner tapped, and they were right** — the trust failure

Below the buckets: the shared round score (or half-value solo score), and the
Save flag if applicable. LOTT is stored but not shown (see §3.4).

### 4.3 Shared screen (facilitator)

Shows the question and all ten options during play, plus the timer and the norm statement. After the round: correct answers, per-pair scores, running leaderboard, and the session Concurrence Rate.

The shared screen never reveals individual selection states during play.

### 4.4 Sit-out participant

The sit-out player plays solo on their phone. Their screen labels it clearly as a solo round at half value so it does not read as a bug.

---

## 5. Pairing

### 5.1 Constraints, in priority order

1. **No repeat pairings within this session.** Hard constraint.
2. **Cross-department pairing.** Preferred.
3. **Even distribution of sit-outs** where headcount is odd.

### 5.2 Relaxation order

If no valid assignment exists, **relax cross-department first, then no-repeat.** A visible repeat pairing inside a five-round session reads as broken; a same-department pairing does not, and cross-department contact is served by other Moments across the Season.

Log every relaxation event so the facilitator knows it happened.

### 5.3 Scope of the matrix

The pairing matrix persists **within this protocol only**. It does not read from or write to a Season-level pairing matrix in v1. Design the table so it could be promoted later.

### 5.4 Department attribute

Requires a `department` field on the participant record. If null for any participant, treat them as unconstrained rather than failing the assignment.

### 5.5 Assignment

Generated by the system at round start. The facilitator does not assign manually. The facilitator can regenerate a round's pairings before play begins if someone joins or drops.

---

## 6. Data model (Supabase)

```
wao_questions
  id, category_title, disambiguation_rule (bold, ≤140 chars),
  disambiguation_detail (text), correct_count, difficulty (1-5),
  region_tag (us | intl | global), pinned (bool), active (bool),
  created_at

wao_question_items
  id, question_id, label, is_correct (bool),
  trap_tier (gimme | graded | trap),
  source_1_url, source_1_note, source_2_url, source_2_note

wao_sessions
  id, session_id (FK to platform session), timer_seconds (default 90),
  round_count, concurrence_rate, created_at

wao_rounds
  id, wao_session_id, round_number, question_id,
  started_at, locked_at, lock_reason (both_locked | timer)

wao_pairs
  id, round_id, participant_a, participant_b (nullable for solo),
  is_solo (bool), locked_a_at, locked_b_at

wao_taps
  id, pair_id, participant_id, item_id, action (select | deselect),
  created_at (server timestamp), client_seq

wao_round_results
  id, pair_id, submitted_item_ids[], score, bonus,
  lott, had_save (bool), exact_match (bool)
```

### 6.1 Why the tap log matters

`wao_taps` is not an audit table. It is the source of the follow-detection derivation:

**A tap is a "follow" if participant B selects item X within N seconds after participant A selected item X, where B had not previously selected X.** Set N = 8 seconds for v1, store it as config.

Across four rounds and four partners this produces a per-participant follow rate. That is genuinely novel behavioral data, it feeds the Signal to Ed as pattern rather than anecdote, and it speaks directly to the D5 dispersion question flagged in the design document. It is not surfaced to participants in v1.

### 6.2 Question library

Stored in Supabase, seeded from a versioned JSON file in the repo. Reason for Postgres over flat JSON: per-item elimination rates accumulate across sessions, which lets the library self-calibrate difficulty. That requires the item to be a joinable row.

---

## 7. Realtime architecture

### 7.1 Selection state

**Store two independent selection sets. Derive the four states at render.** Never store a shared per-item boolean. This removes the last-write-wins collision when both partners tap the same item within one tick, which is the class of bug behind DIBE D1.

### 7.2 Channel isolation

**One Supabase Realtime channel per pair per round**, keyed `wao:{round_id}:{pair_id}`. Not a session-wide channel.

This is a correctness decision and a security decision. Pair state must be protected by RLS such that a participant with dev tools open cannot read another pair's selections. Test this explicitly.

### 7.3 Tap reliability

Every tap follows: **optimistic local state → server write → ack → confirmed state.**

A visible sync indicator shows unconfirmed taps. A tap that never acks retries twice, then surfaces a non-blocking warning to the participant.

A tap silently dropped at T=88s changes the score. This is exactly DIBE D1. **Fix it here first, then backport.**

### 7.4 Scoring

Computed **server-side** at lock or at the end of the settle window, from `wao_taps`. Never from client-reported state.

### 7.5 Join

QR code on the shared screen. Phone is the primary controller and the design assumption. Desktop must work but is not optimized for v1.

---

## 8. UI states and design constraints

### 8.1 The four states cannot be color-only

Navy `#1A2744`, Warm White `#F5F1EB`, and Amber `#F5A623` do not yield four distinguishable fills, and amber is reserved for primary actions. Differentiate by shape, weight, and label.

| State | Treatment |
|---|---|
| Unselected | Warm White fill, 1px Navy border at 20% opacity |
| Mine | Warm White fill, 2px solid Navy border, Navy left bar, my initial chip |
| Theirs | Warm White fill, 2px **dashed** Navy border, partner initial chip |
| Both | Solid Navy fill, Warm White label, both initial chips, checkmark glyph |

Verify at 4.5:1 contrast minimum and verify the Mine/Theirs distinction survives greyscale.

### 8.2 Amber usage

Amber is reserved for: the Lock It In button, and the timer treatment inside the final 15 seconds. Nowhere else.

### 8.3 Motion

Fade and slide only. State transitions on tap should be immediate and quiet. No bounce, no confetti, no game-show energy. A partner's tap arriving should be noticeable without being startling: a 200ms fade is enough.

### 8.4 Persistent on-screen norm

"No searching. No chat." visible on the participant screen throughout play, not just in the rules beat.

---

## 9. Content specification

### 9.1 Hard content rules

1. **No single canonical list.** If one search resolves all ten items simultaneously, the question is dead. This disqualifies "the seven deadly sins," "Monopoly properties," "characters who survive Hamlet," and any question whose category maps to one Wikipedia page. **Categories must require ten separate lookups.** This is the single most important content constraint and it is not intuitive.
2. **No drifting ground truth.** Nothing whose answer changes over time. No current officeholders, no living/dead status, no rankings, no population thresholds, no box office. There is no verified-by field because there are no expiring questions.
3. **Binary and verifiable.** Every item resolves cleanly true or false under the stated disambiguation rule.
4. **Two independent sources per item**, stored on the item record.
5. **No grim content.** No death, overdose, suicide, crime, illness, or tragedy categories.

### 9.2 Disambiguation rule

Every question carries a bold rule line and an optional smaller detail line.

Worked example:
> **Rule: Born in Canada.** Citizenship, residence, and where someone grew up do not count. Place of birth only.

"People who are Canadian" fails. "People born in Canada" works. Apply this test to every question before it enters the library.

The rule appears on both the shared screen and the participant screen. When a participant challenges an answer live, and they will because traps are the design, the rule is already on screen.

### 9.3 Trap ratio

Every question requires, at minimum:
- **2 gimmes** (obviously wrong, or obviously belonging)
- **2 plausible traps** (feel wrong but belong, or feel right but do not)
- **6 graded** between

Without this template, authored questions land either trivially easy or as coin flips, and coin flips destroy the Concurrence Rate as a signal.

### 9.4 Regional balance

Target 50/50 across the 20-question library between US-anchored and internationally legible categories. Tag each question `us`, `intl`, or `global`.

### 9.5 Category slate

**Strong format: real-or-fake name templates.** Ten items each requiring an independent check. Highly lookup-resistant. This is what the IKEA idea actually is, and it generalizes.
- IKEA product names vs plausible Swedish-sounding inventions
- Pokémon vs invented creature names
- Real named phobias vs invented ones (with the object of the phobia shown parenthetically)
- Real airport codes matched to cities

**Confirmed categories:**
- Video games released in a stated calendar year
- Locations in a named book series (with items drawn from other fantasy works as distractors)
- Vocabulary from a specific practice, for example archery
- Places in Dr. Seuss books
- Characters in the Mickey Mouse universe
- Languages with more than 10 million speakers
- Sports that have never been Olympic
- Countries that drive on the left
- Molecules containing a specified atom
- Flags sharing a stated element
- Inventions of the Ancient Egyptians
- Da Vinci's inventions
- Board games invented before a stated year
- Things older than the Great Pyramid
- Famous duos billed as brothers who were actually brothers
- People knighted by a British monarch
- Cereals containing marshmallows
- Elements named after places
- Words English borrowed from a specified language
- Foods with protected designation of origin

**NAFA pinned question:** one automotive or fleet-adjacent question, flagged `pinned` so it can be forced into the round rotation for this client.

Note for the record: pinning a domain question runs against the Right Answers Only rationale, which is that stripping domain expertise prevents work hierarchies reproducing inside the Moment. This is a deliberate departure, made for rapport, and it should be a single round rather than a pattern.

### 9.6 Question selection at runtime

Random draw from `active` questions, with `pinned` questions forced into the rotation. No question repeats within a session. Difficulty should ascend across rounds where the pool allows.

### 9.7 Library size

20 questions for v1. 200 items requiring 400 source verifications. This is a separate workstream from the build and it is the long pole.

---

## 10. Reflection close

Same two questions as every Moment in the Season. Ninety seconds each.

1. **What did you assume about someone that turned out to be wrong?**
2. **Where does that same assumption show up in how we work?**

**Facilitator prompt specific to this Moment,** to be used if the room is quiet:

*"Did anyone confirm a selection they had no idea about? Did anyone refuse to confirm something their partner was right about?"*

The LOTT number on each participant's phone is the entry point. It is a number attached to a specific colleague on a specific item, which is exactly the concreteness the reflection close needs and rarely gets.

---

## 11. Facilitator script beats

1. Name the mechanic in one sentence: eliminate the wrong answers, both of you have to agree, you cannot talk.
2. State the norm out loud: no searching, no chat.
3. State the zero rule: eliminate one correct answer and the round scores nothing.
4. **Pre-empt the fairness objection before round two.** The strongest trivia player on the team will notice their score is capped by their partner's willingness to confirm, and they will say so. Frame it as the point: *"Your score is what the two of you agreed on, not what you knew. That is the same as work."*
5. Run the sample round. Do not skip it under time pressure.
6. Between rounds, read one LOTT number aloud without naming a winner.

---

## 12. Degraded fallback (write before building)

If the platform fails:

1. Facilitator reads the ten items aloud and shares the list on screen.
2. Pairs converge in Teams private chat (the no-chat norm is suspended, and the silent-convergence mechanic is partially lost).
3. Each pair sends their elimination set to the facilitator by DM.
4. Facilitator scores verbally against the answer key.

Slower, weaker, and it runs with zero platform. It must exist in the facilitator notes before the session, not be improvised live.

---

## 13. Acceptance bar

**Non-negotiable. This is the bar that was bypassed before week 1 became a rerun.**

1. **Two consecutive full-scale rehearsal runs with zero facilitator intervention**, 8 or more real people on real phones, not simulated clients.
2. Self-service QR join works for every participant without assistance.
3. Ghost-partner path tested by deliberately killing a client mid-round.
4. Odd-headcount sit-out rotation tested at 9 and 11 participants.
5. RLS verified: a participant cannot read another pair's state via the network tab.
6. Tap-drop path tested under throttled network.
7. Degraded fallback written into facilitator notes.

---

## 14. Build sequence

One change at a time. Each step independently testable.

1. Schema and migrations. Seed script for the question library.
2. Question library JSON with 3 test questions, so the build is not blocked on content.
3. QR join and participant registration.
4. Pairing algorithm with constraint relaxation and logging.
5. Two-set selection model plus per-pair Realtime channel plus four-state render.
6. Optimistic tap with ack, retry, and sync indicator.
7. Timer, settle window, Lock It In, lock reason.
8. Server-side scoring including zero rule, curve, bonus, solo half-value.
9. LOTT and Save computation.
10. Participant reveal screen with four buckets.
11. Facilitator shared screen, leaderboard, Concurrence Rate.
12. Follow detection derivation (not surfaced to participants).
13. Full content library load.

---

## 15. Open items

- Question authoring and two-source verification for 20 questions. Separate workstream, not blocked by the build.
- Confirm 4 scored rounds versus 3, once one full rehearsal has produced real timing data.
- Follow-rate surfacing to participants: deferred past v1 deliberately. It is interesting data and it may also be the thing that makes people self-conscious enough to stop playing naturally.
- Whether Concurrence Rate rolls into the Season-level calibration number described in the design document, or stands as its own line.

---

## 16. Authorization boundary

Belongs conceptually with Section 7. Recorded separately because it was
identified after the service-role client was built.

The RLS design in Section 7.2 restricts the WAO tables carrying the answer
key and private pair state to `service_role`. That moves the security
boundary out of the database and into application code. The database will
no longer stop a participant from reading another pair's state, because
the service client bypasses RLS entirely.

**Every WAO route that uses the service client must, before touching it:**

1. Verify the caller's participant identity from the cookie.
2. Confirm that participant belongs to the session being addressed.
3. For any pair-scoped read or write, confirm the caller is a member of
   the pair being addressed.

No route may reach for the service client before these checks pass. This
is the only thing preventing cross-pair access, and acceptance bar item 5
in Section 13 tests exactly this.

`lib/supabase/server.ts` and `lib/supabase/admin.ts` are not
interchangeable. `server.ts` carries the participant's cookie session and
is subject to RLS. `admin.ts` carries neither.

---

## 17. Amendment: cross-department pairing deferred

Supersedes the cross-department elements of Section 5.

Cross-department pairing is **out of scope for v1 and for the NAFA pilot.**
NAFA is a small organisation and the pilot roster is close to the whole
team, so the constraint buys little on a group this size while adding a
capture mechanism, a free-text normalisation problem, and a constraint
relaxation path.

**Pairing constraints for v1, in full:**

1. No repeat pairings within a session. Hard constraint.
2. Even distribution of sit-outs where headcount is odd.

That is the complete list. Section 5.2's relaxation order no longer
applies, since there is only one constraint to relax and it is not
optional. If no valid assignment exists, the algorithm surfaces the
failure to the facilitator rather than relaxing anything.

Section 5.4's depSection 5.4's depSection 5.4's depSection 5.4's depSection 5.4's depSection 5.4's depSectioumn to `session_participants` and it
is retained, unused and empty, for a future season where the constraint
is worth its cost. Nothing reads or writes it in v1.

---

## 18. Amendments from build and live testing

Recorded as they were decided. Where these conflict with earlier
sections, these win.

### 18.1 Lock It In is withdrawn from v1

Supersedes Section 2.4's second lock path and all of Section 3.3.

There is no Lock It In button and no time bonus. Without a bonus,
locking early strictly reduces option value, so rational play never
presses it; adding the bonus introduces a second risk decision to a
mechanic that already has one.

**Timer expiry plus the settle window is the only way a round ends.**
`lock_reason` is always `timer`. `wao_round_results.bonus` is always 0.

The `locked_a_at` and `locked_b_at` columns and the `both_locked`
CHECK value remain in migration 008, unused, so the feature can return
without a schema change.

### 18.2 Lock state is per-pair, not per-round

A round contains multipA round contains multipA round contains multipA round contains multipA round contains multier is round-global.

`wao_rounds.locked_at` is set when the timer plus settle window expires.
The participant UI reads its own pair's state, never the round's, to
decide whether input is disabled.

This was a live bug: a solo participant's early lock closed the round
for every other pair and their subsequent taps were rejected.

### 18.3 The partner's name is required, not optional

Adds to Section 4.2.

The play screen and the reveal screen must both name the partner.
Initial chips alone are not sufficient. The reflection close asks why a
specific colleague did or did not confirm a selection, so anonymity
defeats the protocol's purpose.

Solo copy must never use "both" or reference a partner.

### 18.4 Persistent play instruction

Adds to Section 8.4.

A short instruction stays visible throughout play, alongside the
"No searching. No chat." norm:

> Tap the answers you think are WRONG. Only what you and your partner
> BOTH tap counts.

The protocol inverts normal trivia instinct, and the penalty for getting
it backwards is a silent zero. Stating it once at the start is not
enough.

### 18.5 Timer presentation

Adds to Section 8.2 and 8.3.

A depleting ring, no numerals for most of the round. Navy on a grey
track, shifting to amber with a one-second pulse inside the final
fifteen seconds, then a large numeric 3, 2, 1 in the final three
seconds. The numerals disappear when the settle phase begins.

Open question for rehearsal: whether the ring alone is legible enough
mid-round on a phone held at an angle.
