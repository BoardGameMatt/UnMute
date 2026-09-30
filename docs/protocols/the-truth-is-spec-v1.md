# The Truth Is — Protocol Spec v1

**Status:** Build spec, locked for v1  
**Slug:** `the-truth-is`  
**Type:** Turn-based (two submissions, then read → discuss → vote → reveal)  
**Players:** 3–20 (optimal 6–10). Facilitator is a player.  
**Envelope:** ~15–25 minutes at optimal headcount  
**Owner:** Matt Hendricks  
**Pack mode:** `none`. The payload is what players write. There is no staff-swappable library.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Locked decisions are in §16. Where the original writeup and the running game disagreed, this document locks the running game.

**Opt-outs**

- **Pack mode `none`.** Truths are player-authored. A content pack would invent a prompt library this Moment does not use. The reader prompt bank is a static facilitation list, not a pack.
- **No pairs.** Convention §5 (partner chips) does not apply. Display names are still required everywhere a person is named.
- **Reveal is not a WAO bucket board.** The outcome of a round is one author plus point lines. §9 is the equivalent of convention §7.
- **Leaderboard does not use the urgent timer.** It is a 5-second pause. A 3-2-1 on a 5-second beat would be mostly numerals. Play clocks use `WaoPlayTimer`.
- **Ballots stay off the open channel until reveal.** `session_state` does not carry `author_id`, unread texts, or in-progress guesses. Revealed votes are names on the play payload.

---

## 1. What this Moment is

Everyone writes two short truths. The room then takes turns: one person reads a truth aloud, the group guesses who wrote it, and the phone scores the guesses.

**The surface is a guessing game. The payload is how much the room actually knows about each other** — and who is willing to let a true thing sit in the silence without claiming it.

**Primary target dimension:** D2 (Fulfillment of Relational Needs)  
**Secondary:** D3 (Shared Collaborative Understanding) — whose model of a colleague is accurate, and what the group assumed.

**What gets revealed about a person:** a fact colleagues did not have; whether they can hear a truth without announcing it is theirs; whether the room’s guesses match the person or the stereotype.

---

## 2. Players, join, device

- **Start floor: 3.** Below 3, Start stays disabled.
- **Cap: 20.**
- **The facilitator is a player on their phone.** They submit, read, guess, and can be the author. Lead-only controls (Start, skip the leaderboard, a few more, wrap up, continue to debrief) stay on the shared laptop.
- No auth. Lobby: display name. Same 6-character join code as every Moment.
- **Phone is the primary controller; desktop works but is not optimized.** Video call stays on the laptop. The laptop is the shared screen. It does not write or guess.

### 2.1 Shared screen (host laptop)

Opening the host link does not ask for a name. That browser joins as **Shared screen** and shows the join code with **Join on your phone.**

- **Shared screen is not a player.** It is excluded from the Start count, the lobby roster, and the submission, read, and vote pool. The floor of 3 is three phones.
- During writing and voting, that laptop shows the public board only. It never mounts the text field, the vote buttons, or the bluff banner.
- The facilitator’s phone is their player. Start and the other Lead controls stay on the laptop.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.
- The roster is frozen at Start. Later display-name edits do not rewrite the game.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~20s, five beats × 4s). `useReducedMotion()` stacks the beats. Dots via `LobbyExplainerDots`. The stage is one grid cell so the shell stays as tall as the tallest beat.

v1 teaches the main loop only. “A few more” is not in the lobby loop.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep the facilitator's video up on your laptop. | Phone + laptop with a video grid. |
| 2 | Write two truths. The second one goes further. Don't include anything that would make it obvious that you wrote it. | Two stacked cards. The second card reads MORE. |
| 3 | Someone reads one aloud. Don't say if it's yours. | The sample line on a card, and a reader name. |
| 4 | Guess who wrote it, on your phone. | Three name buttons. One is selected with a heavier navy border. |
| 5 | A correct guess scores. If you read your own and nobody catches you, you score. | “Maya +1” under the sample line. |

**Sample data (obviously fake):** “I once sat next to Tina Fey on a train.” Names: Maya, Jordan, Sam.

**Reuse:** the submission card, the name button, and the bluff line from play. No Pack A words — there is no pack.

---

## 4. Core mechanic

### 4.1 Submissions

Two rounds, everyone at once.

| Round | Placeholder | Clock |
|---|---|---|
| 1 | ...here's something about me that might surprise some people. | 75s |
| 2 | ...something even MORE surprising. | 75s |

- 300 characters. Trimmed. Empty text is a skip, not an entry.
- Submit: grey (empty) → navy (text) → amber (submitted). Copy after submit: “Got it.”
- If the clock ends, the server skips anyone who has not submitted. A phone that still has the phase open sends whatever is typed in the same action as the expiry, so that player’s draft is kept.
- When every player has an entry or a skip, the phase advances. Round 2 then builds a shuffled queue and starts the first read.
- If the pool is empty after round 2, the phase is wrap-up.

### 4.2 Who reads

- Round 1: a random player.
- Later rounds: the author of the entry just revealed.
- The entry is the next unused id in the shuffled queue.
- **The reader may be reading their own entry.** That round is a bluff. Only that reader’s phone shows the bluff banner. Nobody else is told.
- If the queue is empty and the room has already played at least one round per player, the phase is wrap-up. Otherwise the phase is results.

### 4.3 Discussion and voting

- Discussion: 3 minutes. The reader sees the entry text and a facilitation prompt that rotates about every 15s. Everyone else sees “Listening to [name]” and does not get the written line on screen (they hear it). The written line is still on the play payload as the current entry, because it is the line in play — unread lines are not.
- The reader may open voting early with **Ready to vote**. Listeners do not get that button.
- Then voting: 60s. Name buttons for every player. Anyone may vote, including for themselves. No vote is not a penalty.
- When every player has voted, reveal starts early.
- Persistent line on both phases, for everyone: **Guess on your phone. Don’t say if it’s yours.**

### 4.4 Bluff banner (reader-author only)

> This one's yours. Earn points for each person who guesses someone else. Perfect bluff = bonus point.

### 4.5 Scoring

**Ordinary round** (reader is not the author): +1 for each guess that names the author. The author’s own vote does not score. Wrong guesses score 0. No negative points.

**Bluff round** (reader is the author): the author gains +1 for each other player who names someone else, plus 1 if nobody names the author. Each other player who names the author gains +1.

### 4.6 Leaderboard, a few more, results

- After round 2, then after rounds 5, 8, 11, … the room sees a leaderboard for 5 seconds. The Lead may continue early. No numerals.
- The leader row uses a heavier navy border. Amber is not a rank fill.
- After the third completed round, and after every round after that, play pauses while unread entries remain. The Lead sees **One more round** and **Wrap up now**. Members wait. **One more round** deals the next unread entry only. The same choice appears again when that round ends.
- If nothing is left to read, the Lead sees **Wrap up**, which opens results.
- **Wrap up** opens results: standings, rounds played, and **Most surprising** — the played entry with the most wrong guesses, shown with its author name. Ties keep the first such entry. Rank ties share a place; there is no tiebreaker.
- The Lead’s primary action on results is **Continue to debrief**, which completes the session and opens NPS. Members see waiting copy, then follow to NPS when the session completes.

---

## 5. Timers

Server stores `timer_started_at` and `timer_duration_seconds`. Clients render `WaoPlayTimer` from the server clock included in the play payload, so a phone whose own clock is ahead still shows the full round. Phase changes when the server clock is due (`expireIfNeeded` on every play read and on `timerExpired`). A client action does not advance a clock that is still running. A phone that reports the writing clock has ended does not save that draft and does not skip anyone else until 75 seconds have passed on the server. Each writing prompt also ends as soon as every player has submitted, without waiting out the clock.

| Phase | Duration | Urgent | Numerals | On expiry |
|---|---|---|---|---|
| Submission 1 and 2 | 75s | last 15s amber | last 3s | Skip anyone without an entry or a skip, then advance. Also advances immediately when every player has submitted |
| Discussion | 3 min | last 15s | last 3s | Voting, 60s. The reader may open voting early |
| Voting | 60s | last 15s | last 3s | Reveal |
| Reveal | 8s settle, no arc | — | — | Award points and deal the next beat. The phone may call this early when the fade finishes |
| Leaderboard | 5s, no arc, no numerals | — | — | Next read, or wrap-up |

---

## 6. Persistent play instruction

During discussion and voting, on every phone:

> Guess on your phone. Don’t say if it’s yours.

The reader also sees one line from the static bank, swapping about every 15 seconds:

- Read it one more time if people want to hear it again.
- Ask the group: 'Who do you think said this?'
- Pick someone by name and ask what they think.
- Look at people's faces — anyone look guilty?
- Ask: 'What made you think it was that person?'
- Challenge someone: 'You look like you know something.'
- Ask: 'Does this surprise you about anyone here?'

---

## 7. UI states

Vote buttons are not color-only.

| State | Treatment |
|---|---|
| Name, idle | Warm-white, 1px cloud-grey border |
| Name, selected | Warm-white, 2px unmute-navy border, semibold label |
| Submit, empty | Cloud-grey, opacity 40, not clickable |
| Submit, ready | Steel-blue, warm-white label |
| Submit, confirmed | Signal-amber, deep-navy label |

Bluff copy is a left amber rule on deep-navy, and it renders only for the reader-author.

Progress bar: `SessionProgressBar` after submissions, hidden on results. Fill is rounds played / `progress_total_rounds`. “A few more” extends the denominator.

---

## 8. Reveal

Three fades, about 2 seconds each. No slot reel, no scale bounce, no glow pulse. `useReducedMotion()` shows the landed result immediately.

1. **The guesses** — “Maya guessed → Jordan”, as names.
2. **The author** — display name.
3. **Points** — who gained a point, in the same words the room just learned.

Then the server awards points, marks the entry used, and either opens the leaderboard or deals the next read. The next reader is this author.

---

## 9. Session end and reflection

```
Results scoreboard → NPS (/session/[id]/feedback) → Reflection (/session/[id]/reflection)
```

Reflection prompts registered on the protocol:

1. Was it challenging in deciding what truths to reveal about yourself? Why or why not?
2. Was it difficult to determine which truths belonged to the other members of your team? Why or why not?

**Facilitator prompt** (said aloud if the room is quiet; not a stored field): ask the two reflection questions above, one at a time.

---

## 10. Facilitator script

1. This laptop stays shared. I join on my phone. Phones out. I’ll start when everyone’s in.
2. You’ll write two truths. The second one should go a step further. Don’t include anything that would make it obvious you wrote it. Don’t say them out loud yet.
3. When it’s your turn to read, read it straight. Don’t say if it’s yours.
4. Everyone else: guess on your phone, not in the chat.
5. If you notice you’re reading your own, your phone will tell you how that round scores. Leave it there.
6. After the third round, I’ll either play one more or we’ll stop and talk. Same choice after each later round.

**Lead-only metrics**

| When | What |
|---|---|
| After round 3, and each later round | Unread entries remaining. Actions: One more round, Wrap up now. Label: FACILITATOR |
| Leaderboard | Ranked names and points. Action: Continue |
| Results | Rounds played, standings, most surprising. Action: Continue to debrief |

Members never see those buttons. They see a waiting line.

---

## 11. Degraded fallback

No platform: the Lead collects two truths per person on paper or in a private chat, shuffles them, and reads them without names. The room says a name out loud. The Lead keeps a tally of correct guesses. Skip the bluff bonus if the paper pile can’t guarantee a reader draws their own. Then ask the two reflection questions.

---

## 12. Authorization boundary

`session_state` is world-readable realtime. It must not hold authorship.

| Store | Who can read | What |
|---|---|---|
| `truth_is_sessions.state_json` | Service role | Phase, clocks, scores, roster snapshot, current reader id, current author id, queue |
| `truth_is_entries` | Service role | Text, author id, used, guesses |
| `session_state.state_json` | Room (open) | Phase, clocks, progress, current reader id, the one line currently being read, a nonce. No `author_id`. No other lines. No ballots |
| Play route | That participant | Role-filtered DTO. `youAreAuthor` is true only for the reader on a bluff round. Author name appears at reveal and on the most-surprising card. Unread texts never appear |

Every play and action route checks the participant cookie, session membership, and slug before it builds a service client.

**Network-tab bar:** on a phone that is not the author, before reveal, the play response and the realtime payload contain neither `author_id` / `authorId` / `current_author_id` nor any unread line.

Votes and submits use the cookie identity. The body cannot name a different voter.

---

## 13. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention.
2. Self-service QR join works without assistance.
3. A phone that sleeps during discussion still lands in voting when another phone fetches play after the clock.
4. Headcounts 3 and a mid-size room (about 8). One bluff round and one ordinary round both score as §4.5.
5. Network tab on a non-author phone, before reveal, shows no `author_id` and no unread text.
6. Throttled-network submit still records that player’s truth if it arrives before the server skip.
7. Degraded fallback in §11 is in the facilitator notes.

---

## 14. Content pack

**Pack mode: `none`.** Engines must not query `content_packs` for this slug. Intra-session uniqueness is the queue: an entry is read once (`used`).

---

## 15. State machine

```
SUBMISSION_1 → SUBMISSION_2 → DISCUSSION → VOTING → REVEAL
  → (LEADERBOARD every 2, 5, 8, …) → DISCUSSION …
  → WRAP_UP → DISCUSSION … | RESULTS
```

`READING_ASSIGNMENT` and `BLUFF_RULES` remain in the type so an older row can be saved. New games enter `DISCUSSION` directly from the deal.

---

## 16. Locked decisions

| Decision | Lock |
|---|---|
| Reader may read their own entry | Yes. Bluff scoring in §4.5. Only that phone sees the banner |
| Author sits out | No. Everyone may vote |
| Submission clock | 75 seconds, twice |
| Discussion / vote | 3 minutes, then 60s to guess. The reader may open voting early |
| Empty submission | Skip that prompt. The player still reads and guesses |
| Points | +1 only. No negatives |
| Leaderboard | After round 2, then every 3 rounds. 5 seconds |
| After round 3 | Lead chooses One more round or Wrap up now. Same choice after each later round while entries remain |
| Secrets | Off `session_state`. Play DTO is filtered |
| Reveal motion | Fade through guesses, author, points |
| Session end | Scoreboard → NPS → reflection |
| Pack | None |

---

## 17. Conservative leftovers

The build must not invent these:

- No lead-disconnect pause and no auto-end if the Lead drops.
- No skip of a disconnected reader. Their entries stay in the pool. They stay in the rotation.
- No Admit late.
- No second prompt pack, and no staff editor for the reader lines.
- No tiebreaker.
- No penalty for a missed vote.
- Most surprising is the played entry with the most wrong guesses. If nothing was guessed wrong, the card is omitted.

---

## 18. Build sequence

1. This spec.
2. Private tables and the filtered play DTO.
3. Dedicated play and action routes. Start creates the private session. Clocks expire on the server.
4. Phone reads the play DTO, not raw `state_json`.
5. Lobby explainer and reflection prompts.
6. Shared timer, persistent line, reader prompts.
7. Quiet reveal.
8. Scoreboard continues to NPS, then reflection.
9. Engine tests and a network-tab check.

---

## 19. Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator-as-player called
- [x] § Lobby explainer — beat list + sample data; fixed panel size
- [x] § Device context — phone + laptop video
- [x] § UI states — shape/weight table
- [x] § Timer — durations and presentation thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats — plus which Lead-only metrics appear
- [x] § Session end flow — scoreboard → NPS → reflection
- [x] § Reflection — prompts + facilitator prompt
- [x] § Degraded fallback
- [x] § Acceptance bar — includes network-tab secret test
- [x] § Authorization boundary
- [x] § Content pack — pack-none
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence
