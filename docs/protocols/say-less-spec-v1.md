# Say Less — Protocol Spec v1

**Status:** Build spec, locked for v1  
**Slug:** `say-less`  
**Type:** Real-time (one active clue-giver; server-authoritative 45s clock)  
**Players:** 4–14 (optimal 6+), always two teams of 2–7. Facilitator is a player.  
**Envelope:** ~20 minutes (≈13 play including setup, 7 reflection)  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is one pack of five categories × 15 cards (§14).

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Source: *Say Less: Moment Spec* (Matt Hendricks, Oct 25 2026). Decisions from the spec conversation are in §16. Calls the conversation did not make are in §17. **Rev. Oct 27 2026** after the first multi-browser test: competitive team scores, one Pass / Oops button (round 2 only), round 1 Hint button, 10s preview, two-person team switch, new explainer copy (§16 marks the revised rows).

---

## 1. What this Moment is

A simplified Time's Up / Monikers in two rounds. On a turn, one person gives clues and their team guesses out loud for 45 seconds. **Round 1:** say anything except the words on the card, unlimited guesses, no passing. **Round 2:** the same 20 cards, reshuffled, **one-word clues, one guess**. Each team scores one point per card it guesses; after round 2 the team with the most points across both rounds wins.

**The guessing game is the surface. The payload is shorthand.** A one-word clue in round 2 only works because of something the room built together minutes earlier. The reflection takes that to work: shorthand that feels shared but isn't, shorthand as an in-group boundary, and shorthand that softens candor.

**Primary target dimension:** D3 (Shared Collaborative Understanding — clearer communication of expectations).

**Known limit (from source):** both teams hear every turn, so nobody sits outside the shorthand during play. The game shows shorthand working; the reflection carries the case for where it fails. Reflection time must be protected.

---

## 2. Players, join, device

- **Start floor: 4** (two teams of 2). **Cap: 14** (two teams of 7). Always exactly two teams.
- **The facilitator is a player.** They sit on a team and take clue-giving turns. They also get Lead-only controls (category pick, team edits, pause, skip turn, end round).
- No auth. Lobby: display name. Same 6-character join code as every Moment. Phone is the primary controller; desktop works but is not optimized. Video call stays on the laptop.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.
- Single main room on Teams. No breakouts. Cameras encouraged, not required; nothing depends on video.

---

## 3. Lobby explainer

Registers as `lobbyExplainer`. Coded animated loop (~6.5s per beat, ~40s total), fixed panel size, `LobbyExplainerDots` under the stage. `useReducedMotion()` → static stacked panels, no dots.

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep everyone's video up on your laptop. | Phone + laptop with a video grid. |
| 2 | Teams alternate turns. One member of each team gives clues while the rest of their team guesses. The other team listens silently. | Two team tiles: Team A "Maya · clues", "Jordan · guessing", "Sam · guessing"; Team B "Listening / Muted. No card." |
| 3 | Round 1: say whatever you want to get your team to guess the card, except the words themselves, derivatives, or spelling. No passing, and your team gets as many guesses as they want. Tap Hint if you don't know the card. | Card **PIZZA** with the Hint button, and a spoken bubble "It's an Italian treat. You often have it at parties or on Friday nights, and it's usually very cheesy." |
| 4 | When your team guesses correctly, tap Got it. Keep guessing until your team gets it or time runs out. | Got it and Pass / Oops controls, Got it highlighted, Pass / Oops greyed (round 1). |
| 5 | Round 2: one-word clues only (again, no derivatives), and your team gets one guess. If they guess wrong or you can't come up with something, tap Pass / Oops. | Card **PIZZA** (no hint), bubble "Cheesy.", Pass / Oops highlighted. |
| 6 | Play rotates back and forth between teams until the deck is exhausted. After Round 2, the team with the highest score across both rounds wins! | Two score tiles: Team A 23, Team B 19. |

**Beat dots:** 6.  
**Sample data (obviously fake, not Pack A):** `PIZZA` (hint "Round, cheesy, sliced"); names Maya, Jordan, Sam; scores 23 / 19.  
**Reuse:** `SayLessCardFace` and `SayLessTurnControls` from play UI.

---

## 4. Core mechanic

### 4.1 The deck

- At Start, the server draws **10 random active cards from each of the two chosen categories** (20 total) and shuffles them into the round 1 pile. The deck is fixed for the session.
- Round 2 uses **the same 20 cards**, freshly shuffled, regardless of how round 1 ended (§4.6).
- Cards that share a name word across categories (Dolly Parton / Dolly the sheep, Henry Ford / Harrison Ford, the Franklins) are **allowed**. The collision is reflection material.

### 4.2 A turn (45 seconds)

1. Server picks the clue-giver (§5.3) and starts the clock for the whole room. The clock does not pause.
2. Clue-giver sees the **top card of the pile**: the name, the timer, and two buttons. **Round 1:** a **Hint** button under the name reveals the hint on tap (hidden by default; resets on each new card). **Round 2:** no Hint button; the hint is not sent.
3. Their team guesses out loud on the call. The other team stays muted.
4. Buttons (clue-giver only):
   - **Got it** — card leaves the pile and scores 1 point for the clue-giver's team. Next card shows.
   - **Pass / Oops** — one button. **Round 2 only:** the team guessed wrong (they get one guess), the clue-giver can't think of a word, or the clue-giver slipped on a rule. Card goes to the **bottom** of the pile and scores nothing. Unlimited.
   - **Round 1:** Pass / Oops is shown greyed out. A tap is rejected by the server with *"No passing or wrong answers in round 1."* The team keeps guessing until they get it or time runs out.
5. The turn ends when the clock hits zero, the pile is empty, or the turn is skipped (§10).

If one card remains and is passed, it shows again immediately. That is expected.

### 4.3 Clue rules (honor system)

The platform does not hear the room. In round 2 the clue-giver presses Pass / Oops on a wrong guess or their own slip. No debate.

- **Round 1:** say anything except the words on the card, derivatives of them, or spelling. Unlimited guesses. No passing.
- **Round 2:** one-word clues only, no derivatives. The team gets one guess per card.

### 4.4 Time's up

At T=0 both buttons disable. The card in hand returns to the **bottom** of the pile, unscored. No settle window; a tap that reaches the server after the deadline is rejected. Everyone goes to HOLD.

### 4.5 Pile empty

When the last card of a round is guessed, the turn **ends immediately** (leftover time is not carried). Round 1 → ROUND_BREAK. Round 2 → FINAL_SCORES. The next round starts with the **next** clue-giver in rotation.

### 4.6 Lead ends a round early

On HOLD, the Lead can tap **End round now**. Cards still in the pile do not score. Round 1 → ROUND_BREAK (round 2 still uses all 20 cards). Round 2 → FINAL_SCORES.

### 4.7 Persistent play instruction

Visible on every play screen for the whole session:

| Round | Copy |
|---|---|
| 1 | Say anything except the words on the card. No derivatives, no spelling. |
| 2 | One-word clues only. No derivatives. One guess. |

Role line under it:

| Role | Round 1 | Round 2 |
|---|---|---|
| Clue-giver | Tap Got it when your team guesses it. | Got it, or Pass / Oops if they miss or you're stuck. |
| Active team | Guess out loud. As many guesses as you want. | One guess only. |
| Other team | Stay muted. Listen. | Stay muted. Listen. |

During a TURN everyone also sees who is giving clues **and to whom**: "Maya is giving clues to Jordan and Sam" (the clue-giver sees "You are giving clues to …"). The list is the clue-giver's teammates in roster order.

---

## 5. Teams and turn order

### 5.1 Formation

At Start, the server splits the roster **at random** into two teams as even as possible (odd headcount: Team A gets the extra person). Not alphabetical, not join order.

### 5.2 Lead edits (TEAMS hold)

Before the preview, the Lead sees both teams and can **switch two people**, the same interaction as Airtime and On The Same Page: tap a name (it gets a navy outline), then tap a name on the other team, and the two trade places. Tapping the same name again deselects; tapping a second name on the same team moves the selection. Team sizes never change, so each team stays 2–7. Members see the teams update (read-only). Lead copy: "Mix departments across both teams."

The platform has no department data. Mixing is the Lead's job.

### 5.3 Speaking order and rotation

- Within each team, a random speaking order is fixed when the Lead confirms teams (switches before Confirm don't affect it).
- Turns alternate teams: A1, B1, A2, B2, … Each team cycles through its own order and wraps.
- Round 2 **continues the rotation** from where round 1 stopped. Nobody gets an extra turn because the round changed.
- First team is random, persisted.

### 5.4 Names

**Team A** and **Team B** (conservative; §17). Display names on every team list and HOLD screen.

---

## 6. Preview

Before round 1, every player sees **two cards from the deck**, each with name and hint, for **10 seconds**. Heading: "A preview of the deck". Sub-line: "These cards will come up in play. Remember them."

**Assignment:** shuffle the 20 cards; deal two per player, cycling through the shuffled list so coverage is maximal (10+ players → every card previewed by someone) and duplicates are spread evenly. A player's two cards are distinct.

- Fewer than 10 players: some cards are not previewed. Accepted.
- Each player's preview payload contains **only their two cards**.
- After 10s the preview closes and does not return.

---

## 7. Session flow

```
LOBBY → TEAMS → PREVIEW (10s) → READY → TURN → HOLD → TURN → … (round 1)
      → ROUND_BREAK → TURN → HOLD → … (round 2)
      → FINAL_SCORES → NPS → REFLECTION
```

| State | Kind | Server default / exit |
|---|---|---|
| LOBBY | Facilitator hold | Lead picks two categories, taps Start (≥4 players) |
| TEAMS | Facilitator hold | Lead taps **Confirm teams** |
| PREVIEW | Timed, 10s | Deadline → READY |
| READY | Facilitator hold | Lead taps **Start round 1** |
| TURN | Timed, 45s | Deadline → card in hand to bottom, HOLD. Pile empty → end of round |
| HOLD | Timed, ~5s | Deadline → next TURN. Lead can **Pause** (becomes a facilitator hold), **Resume**, **End round now** |
| ROUND_BREAK | Facilitator hold | Lead taps **Start round 2** |
| FINAL_SCORES | Facilitator hold | Continue → NPS |

Liveness (§3.1 of conventions): every timed state has a server default above; play read and every action run advance-if-due; clients re-read every 2–3s while a deadline is pending; Lead controls sit only on holds the server reaches by itself.

### 7.1 LOBBY

Standard shell. Explainer as §3. `lobbyLeadControls` renders the **category picker**, headed "Today's categories" with the single line "Choose any two packs." Each option shows only the category name (no per-category descriptions). Choose exactly two of the five. Default: **Automotive & Fleet + Movie People**. The selection is saved server-side as it changes and is shown to everyone in the lobby ("Today's categories: …"). Start is disabled below 4 players or without two categories.

`startProtocol` is Lead-only, lobby-only. In one server action it draws the deck, forms teams, and enters TEAMS.

### 7.2 ROUND_BREAK

Everyone sees "Same cards. One word only." and the **round 1 score for each team** (whole numbers, nothing else). Lead screen shows the host line: *"Same cards. Now you get one word. Use what you just heard, from either team."*

---

## 8. Scoring

- **Team scores, whole numbers.** Each Got it is 1 point for the clue-giver's team. Team score = cards that team guessed. Nothing else is scored or shown: no cards-per-turn, no pass or turn counts on any score screen.
- **Winner:** the team with the highest total across both rounds. Equal totals → "It's a tie!"
- No Lead score adjustment in v1.

### 8.1 What is visible when

| Moment | Everyone sees |
|---|---|
| During a turn | Timer, **cards left in the pile this round** (e.g. "12 of 20 left"), who is giving clues and to whom |
| HOLD | Cards got that turn, cards left, next clue-giver |
| ROUND_BREAK | Round 1 score for Team A and Team B |
| FINAL_SCORES | Headline "Team A wins!" / "Team B wins!" / "It's a tie!", and each team's total across both rounds |

### 8.2 FINAL_SCORES host line (Lead only)

Computed from cards per turn internally (never displayed). If round 2 was faster: *"Round 2 was faster because you built a shared language in six minutes. Now let's talk about the one you've built over years."*  
If not: *"One word was harder than it felt, because the shorthand was in your head and not theirs."*

---

## 9. UI states

Amber is reserved for Got it and timer urgency.

### 9.1 Roles (same clock, different payload)

| Role | Sees |
|---|---|
| **Clue-giver** | Card name, Hint button (round 1 only), timer, Got it and Pass / Oops, Skip turn (ghost, small), round instruction |
| **Active team guesser** | Timer, cards left, "X is giving clues to …", round role line. **No card, no hint** |
| **Other team** | Timer, cards left, "X is giving clues to …", "Stay muted. Listen." **No card, no hint** |
| **Lead** (in addition to player role) | Pause / Resume and End round now on HOLD; Skip turn during any TURN; round, turns this round, cards left |

### 9.2 Controls

| Control | Treatment |
|---|---|
| Got it | Primary amber |
| Pass / Oops | One ghost button. Round 1: greyed (opacity-40) but tappable; the server rejects with "No passing or wrong answers in round 1." Round 2: active |
| Hint | Small ghost under the card name, round 1 only; tap reveals the hint |
| Skip turn | Small ghost, text-only, separated from the two |
| Disabled (in flight / after deadline) | opacity-40 |

### 9.3 Timer

WAO pattern (`WaoPlayTimer.tsx`). Turn: **45s**, urgent at 15s (amber, subtle pulse), numeric 3-2-1 in the final 3s, then "Time's up." Preview: **10s**, same component, no "Time's up" copy.

### 9.4 Session progress bar

`SessionProgressBar`. Progress = (cards resolved in round 1 + cards resolved in round 2) ÷ 40. A round ended early by the Lead counts as all 20 resolved. Full on FINAL_SCORES.

---

## 10. Disconnects and skipped turns

| Situation | Rule |
|---|---|
| Clue-giver not connected when their turn would start | Skip them automatically; the turn goes to the next connected person on the **same** team. Their place in rotation is consumed. |
| No one on a team connected | Skip that team's turn; the other team goes again. |
| Clue-giver or Lead taps **Skip turn** during a TURN | Turn ends now. Cards already got this turn stay. Card in hand to bottom. HOLD, then the other team as normal. Counts as a turn played. |
| Clue-giver drops mid-turn | Clock runs out (server default). |
| Lead's phone dies | Cookie / host-token rejoin. HOLD auto-advances, so the room keeps playing. |

Connectivity uses the same presence signal Talk Track uses at turn start.

---

## 11. Authorization boundary

The card name and hint are the DIBE image.

- **TURN:** only the current clue-giver's play read contains the current card (name, plus hint in round 1 only; round 2 sends no hint). Everyone else, including their own teammates, never receives it — not in the play payload, Realtime, or an error.
- **PREVIEW:** each player's read contains only their own two preview cards.
- **The deck list is never sent to any client**, including the Lead.
- Not on `session_state.state_json` if that column is open RLS; not on a session-wide channel.

Every route using the service client verifies first: caller identity from cookie; caller belongs to the session; Got it and Pass / Oops — caller is the current clue-giver and the request's card id is the current card (stale or duplicate taps are rejected, not double-counted), and Pass / Oops is rejected in round 1; Skip turn — caller is the clue-giver or the Lead; category pick, team switches, Confirm teams, Start round, Pause, End round — caller is the Lead.

---

## 12. Facilitator script beats

1. **Open (1 min):** the Return sentence, then "Every team builds its own language. Today we'll build some on purpose."
2. **Setup (2 min):** name the teams, paste the rules box into chat. "You'll each see two cards that are in the deck. Remember them; they will help you guess."
3. **Round 1 (~6 min):** let it run. No passing in round 1; a card nobody recognizes: the clue-giver taps Hint and keeps going.
4. **Between rounds:** read the round 1 team scores, then "Same cards. Now you get one word. Use what you just heard, from either team."
5. **Round 2 (~4 min):** one guess per card. A wrong guess, two words, or a blank → Pass / Oops, move on, no debate.
6. **Score:** announce the winning team (or the tie), then the host line §8.2 as the bridge to reflection.
7. **Reflection (7 min):** three questions in order, 2–2.5 minutes each. If play ran long, shorten question 1, never question 2.

**Rules box (paste into chat)** — source wording, revised Oct 27 to match the rules above:

> Before we start, you'll each see two cards that are in the deck. Remember them; they will help you guess.
>
> Teams alternate turns. One member of each team gives clues while the rest of their team guesses. You have 45 seconds. The other team listens silently.
>
> Round 1: say whatever you want except the words on the card, derivatives, or spelling. No passing; your team gets as many guesses as they want. Tap Hint if you don't know the card.
> Round 2: same cards, one-word clues only (no derivatives), and your team gets one guess.
>
> Clue-giver buttons: Got it when your team guesses it. In round 2, Pass / Oops if they guess wrong or you're stuck (the card goes back in the pile).
>
> Play rotates between teams until the deck is exhausted. After round 2, the team with the highest score across both rounds wins.

**Lead-only metrics:** round, turns played this round, cards left, next clue-giver.

---

## 13. Reflection close

Opt-out of the two standard Season prompts: Say Less replaces them with its own three (question 1 is the Season's standing question applied to the game). Registered via `reflectionPrompts`; display-only, nothing stored.

1. Which one-word clue did you assume would land, and it didn't?
2. Where does our team's shorthand help us, and where might it hide where we mean different things?
3. What phrase do we use when we don't want to say something directly?

**Facilitator notes (Lead copy, not on the shared reflection):**

- Q1 follow-up: "Why did you think it would work?" (Nearly always "because I knew what I meant.")
- Q2 seed if the room goes general: "done," "urgent," "approved," or "on track." Ask two people from different departments what it means to them.
- Q3 follow-up: "What would the direct version sound like?" Leave it with the team. If quiet, the host goes first with a phrase they use.

**Signal to Ed (within 48 hours, off-platform):** round 1 and round 2 team scores plus one or two callbacks; the strongest answer to Q2 or Q3; one word or phrase the team agrees means different things; Return delivered Y/N.

---

## 14. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | One pack, **five categories × 15 cards** = 75 cards. Each card: name + hint. |
| Session config | Lead picks **two categories** in the lobby; engine draws 10 from each |
| Intra-session uniqueness | 20 distinct cards per session; same 20 in both rounds by design |
| Engine | Load only through `sessions.content_pack_id`, filtered by the two chosen categories |

Categories: `automotive-fleet` (Automotive & Fleet), `life-sciences`, `inventors` (Inventors & Innovators), `musicians`, `movie-people`. Content is the source spec's tables, verbatim. Aspirin belongs to Life Sciences.

Source guidance (facilitator guide only; not shown in the picker): Movie People and Musicians generate the most callbacks; Life Sciences and Inventors suit technical audiences.

When this ships, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §8.4.2.

---

## 15. Data model (protocol-specific)

```
say_less_cards
  id, content_pack_id, category, name, hint, active, sort_index

say_less_sessions
  session_id (FK), phase, categories[2], deck_card_ids[20],
  round (1|2), pile_card_ids[], first_team, rotation cursor per team,
  current_turn_id, phase_deadline, paused, version, created_at

say_less_teams
  id, session_id, label (A|B), member_ids[] (speaking order)

say_less_previews
  session_id, participant_id, card_ids[2]

say_less_turns
  id, session_id, round, team_id, clue_giver_id, started_at, ended_at,
  end_reason (timer | pile_empty | skipped | round_ended)

say_less_card_events
  id, turn_id, card_id, outcome (got_it | pass | oops | expired), at
```

Scores are derived from `say_less_card_events` + `say_less_turns` (got_it events grouped by the turn's `team_id`); clients never send totals. The Pass / Oops button records outcome `pass`; `oops` stays in the schema but is no longer written. Team membership lives only on `say_less_teams.member_ids`.

---

## 16. Locked decisions

| Topic | Locked as |
|---|---|
| Packs | One Say Less pack with five categories; Lead picks two in the lobby |
| Default categories | Automotive & Fleet + Movie People |
| Card collisions across categories | Kept |
| Team formation | Random even split at Start; Lead **switches two people** before preview (Airtime / On The Same Page pattern) *(rev. Oct 27)* |
| Facilitator | Plays on a team |
| Headcount | 4–14, always two teams of 2–7 |
| Preview | **10s** server-timed, then READY hold, Lead starts round 1 *(rev. Oct 27)* |
| Preview coverage | Max coverage, duplicates spread; gaps under 10 players accepted |
| Turn start | ~5s auto HOLD naming the next clue-giver; Lead can pause |
| Turn length | 45s, no pause |
| Pass / Oops | **One button**, round 2 only; card to bottom; unlimited. Round 1: greyed, server rejects *(rev. Oct 27)* |
| Hint | Round 1: hidden behind a Hint button. Round 2: none *(rev. Oct 27)* |
| Last card with time left | Turn ends; next round starts with next clue-giver |
| Slow rounds | Lead "End round now" on HOLD; leftover cards don't score |
| Live number during turn | Cards left in the pile this round |
| Scoring | **Team scores, whole numbers** (cards guessed). Highest total across both rounds wins. No other stats shown *(rev. Oct 27)* |
| Skip turn | Clue-giver or Lead; disconnected clue-givers auto-skipped |
| End path | Scoreboard → NPS → reflection (three Say Less questions) |

---

## 17. Conservative leftovers

Calls the conversation did not make. Build must not go further than this.

- **Team names:** Team A / Team B. No themed names.
- **Time's up mid-card:** card to bottom, unscored, no settle window, late taps rejected.
- **No score adjustment** by the Lead.
- **No in-app deck export.** The facilitator plays, so the Lead must not hold the deck. The fallback deck keeper works from §14's category lists.
- **Round 2 after an early-ended round 1** still uses all 20 cards.
- **Rotation across rounds** continues; it does not reset.
- **Skip turn mid-turn** counts as a turn played and passes to the other team; an auto-skip at turn start keeps the team and moves to the next connected teammate.
- **Categories visible** to everyone in the lobby once picked.
- **The Return sentence and Season close** are facilitator-spoken; no extra platform screen.
- **Liveness stop:** if a round reaches 10 counted turns with cards still in the pile, HOLD pauses so the Lead can End round now. Resume continues. This is not a hard cap; it is what keeps a walk-away room from cycling forever when nobody hits Got it.

---

## 18. Degraded fallback

From source; written before build. If the platform fails at any point, switch without restarting the round and keep the platform's score up to that point.

1. Deck keeper (not the host) holds the category lists from §14 and picks 10 per category.
2. **Preview:** send two cards, with hints, to each player by private Teams chat.
3. **Turns:** at the start of each turn, paste the next 6–8 remaining cards into a private chat with the clue-giver. They work from the top, say "skip" to pass, and report the count when time is up.
4. Deck keeper removes guessed cards and moves skipped ones to the bottom. A phone is the timer.
5. If audio fails for one person, they pass their turn.

---

## 19. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention.
2. Self-service QR join works without assistance.
3. Clue-giver disconnect: before their turn → auto-skipped to next connected teammate; mid-turn → clock runs out and the card returns to the pile.
4. Headcounts 4, 5, 13, 14: teams split evenly; a Lead switch keeps both team sizes; 4-person room completes both rounds.
5. Network tab: guessers and the other team never receive the current card or hint; each preview payload holds only that player's two cards; no client ever receives the 20-card deck.
6. Throttled network: a double-tapped Got it records once; Got it and Pass / Oops on the same card cannot both land. Pass / Oops in round 1 shows "No passing or wrong answers in round 1." and does not move the card.
7. Degraded fallback in the facilitator notes; deck keeper named.
8. Walk-away test (conventions §3.1): during round 1, lock every phone and background the shared-screen tab for twice the envelope. Opening any one screen shows the room at ROUND_BREAK or later (or at a Lead pause), with the Lead control on screen. Repeat with one clue-giver who never taps.
9. Source requirement: at least 4 people on separate devices each play one turn in each round and press both buttons (and Hint in round 1).

---

## 20. Build sequence

One step at a time. Each independently testable.

1. Schema + migration: pack, five categories, 75 cards from the source tables. Run `npm run verify:schema`.
2. Registry entry, lobby explainer, lobby category picker (`lobbyLeadControls`), Start gate at 4 and two categories.
3. Engine: deck draw, team split, rotation, preview dealing (unit tests for coverage and the even split).
4. Role-filtered play read (card only to the clue-giver; preview only own cards). Load-bearing security step — do not defer.
5. State machine with advance-if-due, version check, and the liveness test from every timed state.
6. TURN UI: timer, card face with round 1 Hint button, Got it and Pass / Oops, cards-left, "giving clues to" line, role screens.
7. TEAMS hold with Lead two-person switch; HOLD with Pause / Resume / End round now; ROUND_BREAK.
8. Skip turn and disconnect rules (§10).
9. FINAL_SCORES team totals and winner → existing NPS → reflection with the three Say Less prompts.

---

## 21. Open items (from source)

- Offer Say Less to David on Tuesday as one of the final-Moment options, alongside the rerun he suggested.
- Decide who holds the fallback list and acts as deck keeper.
- One full rehearsal with 4+ people on separate devices before the live session.

---

## Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator plays
- [x] § Lobby explainer — beat list, fake sample data, fixed panel, 6 dots
- [x] § Device context — phone + laptop video
- [x] § UI states — role and control table
- [x] § Timer — 45s turn, 10s preview, thresholds
- [x] § Liveness — server default at every deadline; Lead controls only on self-reached holds; walk-away test
- [x] § Persistent play instruction — exact copy per round
- [x] § Facilitator script beats — plus Lead-only metrics
- [x] § Session end flow — scoreboard → NPS → reflection
- [x] § Reflection — three Say Less prompts (documented opt-out) + facilitator notes
- [x] § Degraded fallback
- [x] § Acceptance bar — includes network-tab secret test
- [x] § Authorization boundary
- [x] § Content pack — required; Pack A = 5 categories × 15
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence
