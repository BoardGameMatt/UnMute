# Protocol Spec: "The Truth Is..."

**Slug:** `the-truth-is`
**Type:** Turn-based
**Players:** 3–20 (optimal 6–10)
**Duration:** ~15–25 minutes depending on team size
**Purpose:** Surface assumptions, build trust through structured vulnerability, drive interpersonal connection.

---

## Overview

A team engagement protocol where participants submit anonymous personal truths, then take turns reading others' submissions aloud and guessing who wrote them. Designed for virtual meetings (Zoom/Teams) where participants are on camera, with the game running on their phones.

---

## Actors & Views

| Role | Device | What They See |
|------|--------|---------------|
| **Lead** | Phone (primary) + laptop (video call) | All participant views + session controls (advance, pause, end early, "a few more" option) |
| **Member** | Phone + laptop (video call) | Submission prompts, voting UI, reveal animations, leaderboard |
| **Reader** (rotates) | Same as Member | The entry they must read aloud + conversation prompts + voting UI (they vote too) |
| **Author** (per round) | Same as Member | Sits out voting for the round where their entry is being read. Sees a "This one's yours — sit tight" message. |

---

## Game State Machine

```
LOBBY → SUBMISSION_1 → SUBMISSION_2 → READING_ASSIGNMENT → DISCUSSION → VOTING → REVEAL → [LEADERBOARD] → READING_ASSIGNMENT (loop) → WRAP_UP → RESULTS
```

### Phase Details

#### 1. LOBBY
- Standard lobby (from session shell)
- Lead sees "Start Protocol" button when minimum players have joined
- Prompt displayed: instructions about turning off screen share so faces are visible

#### 2. SUBMISSION_1 (all players simultaneously)
**Screen layout (mobile):**
- Top: Protocol label in DM Mono — `THE TRUTH IS...`
- Prompt card (white, rounded): "The truth is..." in Outfit Bold
- Placeholder text (light grey, Inter): "...here's something about me that might surprise some people."
- Text input area: 300 character max. Large, comfortable touch target.
- Timer: Visual countdown, time-timer style (colored arc that diminishes). NOT a numeric countdown. ~35 seconds.
- Submit button: Grey (disabled) → Navy (active once text entered) → Amber (submitted)

**Behavior:**
- Timer starts when phase begins
- If timer expires before submission, whatever is typed gets auto-submitted
- If nothing is typed when timer expires, player is skipped for this prompt (their entry count is 1 instead of 2)
- After submission, show brief confirmation ("Got it.") then hold on a waiting screen until all players have submitted or timer expires

#### 3. SUBMISSION_2 (all players simultaneously)
**Identical layout to SUBMISSION_1 except:**
- Placeholder text: "...something even MORE surprising." (MORE in all caps, bold)
- This is the depth escalation — the placeholder guides them to go further
- Same 35-second timer
- Same submit flow

**After SUBMISSION_2 completes:**
- All entries are pooled. Total entries = (number of players × 2) minus any skipped.
- System creates a randomized play order: select enough entries so that each player is the Reader at least once. Minimum rounds = number of players. After that, Lead gets option to continue.
- Each entry is tagged with its author_id (hidden from players)

#### 4. READING_ASSIGNMENT
**Select the Reader:**
- Round 1: Random player
- Subsequent rounds: The author of the previous round's entry becomes the Reader
- If the selected Reader has already read and the only remaining entries are their own, skip to next eligible reader

**Assign an entry to the Reader:**
- Must NOT be the Reader's own entry
- Pull from the randomized queue
- Mark entry as "used"

**Reader's screen:**
- DM Mono label: `YOUR TURN TO READ`
- The entry text displayed prominently in Outfit
- Instruction: "Read this out loud to your team."
- Below: conversation prompt starters (rotate from a bank), e.g.:
  - "After you read it, ask: 'Who do we think wrote this?'"
  - "Look at people's faces — any tells?"
  - "Ask someone by name what they think."

**Everyone else's screen:**
- "Listening..." with the Reader's name displayed
- Instruction: "Pay attention to reactions. Who do you think wrote this?"

#### 5. DISCUSSION
**Timing:** 60-second timer starts (time-timer visual style)
- Timer runs on all screens
- Reader's screen shows conversation prompts that rotate every ~15 seconds to keep discussion flowing

**At 30-second mark (halfway):**
- Voting buttons appear on ALL screens (except the Author's screen)
- Buttons show each participant's display name
- Author sees: "This one's yours — sit tight while they guess."
- Players can vote immediately or continue discussing and vote before timer expires

#### 6. VOTING
**Screen layout (mobile):**
- Participant name buttons in a clean grid/list
- Select a name → button highlights (navy outline)
- Submit button: Grey (no selection) → Steel Blue (name selected) → Amber on tap (confirmed)
- If timer expires without voting, that player's vote is not counted (no penalty, no forced guess)

**State tracking:**
- Record each voter's guess (voter_id → guessed_author_id)
- The actual author does NOT vote

#### 7. REVEAL
**Screen layout (everyone sees this on their phone):**

**Step 1 — Show all votes:**
- Brief display: who picked whom. Simple list format:
  - "Sarah guessed → Marcus"
  - "Priya guessed → David"
  - etc.
- Hold for ~3 seconds

**Step 2 — The scroll reveal:**
- Names scroll rapidly (slot-machine / roller style, vertical) through all participant names
- Decelerates and lands on the actual author's name
- Author's name highlighted in amber
- Animation duration: ~2–3 seconds total

**Step 3 — Points awarded:**
- Each correct guesser gets 1 point
- Brief flash of "+1" next to their name/avatar
- No negative points for wrong guesses

**Step 4 — Transition:**
- The revealed author is announced as the next Reader
- Brief pause (~2 seconds), then auto-advance to next READING_ASSIGNMENT

#### 8. LEADERBOARD (after round 2, then every 3 rounds)
**Trigger logic:** Show after round 2, then after rounds 5, 8, 11, etc. Also always shown at the end during RESULTS.

**Screen layout:**
- DM Mono label: `LEADERBOARD`
- Ranked list of players with point totals
- Top player gets a subtle amber highlight (no confetti, no fanfare)
- Auto-dismiss after ~5 seconds, or Lead can advance manually

#### 9. WRAP_UP (after minimum rounds completed)
**Lead's screen gets an additional control:**
- After each player has been Reader at least once, Lead sees: "Everyone's had a turn. Keep going?"
- Two buttons: "A Few More" (adds 3–4 more rounds from remaining entries) or "Wrap Up"
- If "A Few More" is selected, game continues with remaining entries
- If "Wrap Up" or all entries exhausted → advance to RESULTS

#### 10. RESULTS
**Screen layout (everyone):**
- Final leaderboard with rankings and point totals
- Total rounds played
- "Most Surprising" badge — the entry that the most people got wrong (optional, nice touch)
- Lead gets: "End Session" button

---

## Data Model (protocol-specific state_json)

```json
{
  "phase": "SUBMISSION_1 | SUBMISSION_2 | READING_ASSIGNMENT | DISCUSSION | VOTING | REVEAL | LEADERBOARD | WRAP_UP | RESULTS",
  "entries": [
    {
      "id": "uuid",
      "author_id": "participant_uuid",
      "text": "string",
      "round_submitted": 1 | 2,
      "used": false,
      "guesses": {
        "voter_id": "guessed_author_id",
        ...
      },
      "correct_count": 0
    }
  ],
  "current_round": 1,
  "total_rounds_played": 0,
  "minimum_rounds": 8,  // = number of players
  "current_entry_id": "uuid | null",
  "current_reader_id": "participant_uuid | null",
  "current_author_id": "participant_uuid | null",
  "scores": {
    "participant_uuid": 0,
    ...
  },
  "play_order": ["entry_uuid", ...],  // pre-shuffled queue
  "timer_started_at": "ISO timestamp | null",
  "timer_duration_seconds": 35 | 60,
  "votes_this_round": {
    "voter_id": "guessed_author_id",
    ...
  },
  "lead_chose_continue": false
}
```

---

## Session Progress Indicator

A persistent, minimal progress bar appears at the very top of every screen during gameplay (after SUBMISSION phases complete). Design principles:

- **Thin horizontal bar** — sits at the top edge of the screen, 3–4px tall
- **Navy fill on cloud grey track** — advances as rounds complete
- **No numeric label** — no "Round 3 of 8" text. The bar communicates feel, not precision.
- **Calculated as:** rounds_completed / minimum_rounds (where minimum_rounds = number of players). When Lead selects "A Few More," the bar gracefully extends (the filled portion proportionally shrinks to accommodate the new total).
- **Inspired by Apple Workout progress** — shows where you are in the session without creating clock-watching anxiety. Players get a sense of "we're about halfway" or "almost done" without exact numbers.
- **Always visible** but never competing for attention. It's environmental, like the edge of a table.

---

## Timer Behavior

| Phase | Duration | Visual Style | Auto-advance? |
|-------|----------|-------------|---------------|
| SUBMISSION_1 | 35 sec | Diminishing colored arc (time-timer) | Yes — auto-submits whatever is typed |
| SUBMISSION_2 | 35 sec | Same | Yes — same behavior |
| DISCUSSION | 60 sec | Same style. Vote buttons appear at 30 sec mark. | Yes — moves to REVEAL when timer expires or all votes are in |
| REVEAL | ~8 sec total | No timer shown — auto-paced animation | Yes — auto-advances to next round |
| LEADERBOARD | 5 sec | No timer shown | Yes, or Lead advances manually |

**Timer visual spec:** Circular arc that diminishes clockwise. Colored fill (navy) on warm white background. No numeric display. The visual metaphor is a Time Timer (the physical red-disc classroom timer) — participants can see roughly how much time remains without the anxiety of watching seconds tick down.

---

## Conversation Prompt Bank (for Reader's screen)

Rotate these during the DISCUSSION phase, changing every ~15 seconds:

- "Read it one more time if people want to hear it again."
- "Ask the group: 'Who's your top suspect?'"
- "Pick someone by name and ask what they think."
- "Look at people's faces — anyone look guilty?"
- "Ask: 'What made you think it was that person?'"
- "Challenge someone: 'You look like you know something.'"
- "Ask: 'Does this surprise you about anyone here?'"

These are facilitation scaffolding — they give the Reader something to say so there's no awkward silence. The goal is to drive conversation between team members, not between the player and the app.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Player submits nothing for both prompts | They still participate in guessing/reading. They just have 0 entries in the pool. |
| Only 1 entry left and it belongs to the current Reader | Skip that entry, assign next eligible Reader. If no valid assignments possible, move to WRAP_UP. |
| Player disconnects mid-game | Mark as disconnected. Their entries stay in the pool. Skip them for Reader rotation. Other players can still guess them as authors. |
| Lead disconnects | Session pauses. If Lead reconnects within 2 minutes, resume. Otherwise, session ends. |
| Tie on leaderboard | Both players share the rank. No tiebreaker needed — this isn't a competition, it's a connection exercise. |
| Very small team (3 people) | Works fine. Fewer rounds, quicker game. Minimum rounds = 3. |
| Very large team (15+ people) | Works but Lead should use "Wrap Up" earlier. 15+ rounds of guessing gets long. Consider showing leaderboard every 3 rounds instead of 4. |

---

## Screen-by-Screen Summary (Mobile, Portrait)

Each screen should show ONE thing to do. Minimal chrome. The phone is a secondary device — the primary experience is the faces on the video call.

| Phase | What's on screen |
|-------|-----------------|
| SUBMISSION | Prompt + text input + timer arc + submit button. That's it. |
| READER VIEW | The entry to read + conversation prompts. Nothing else. |
| LISTENER VIEW | "Listening to [Reader name]..." + anticipation state. |
| VOTING | Name buttons + submit. Timer arc. |
| AUTHOR SIT-OUT | "This one's yours — sit tight." |
| REVEAL | Vote results → scroll animation → author highlight → points |
| LEADERBOARD | Ranked list. Amber highlight on leader. |
| RESULTS | Final standings + stats. End session button (Lead only). |

---

## Notes for Cursor Implementation

- All state transitions go through the `sendAction()` API. The engine validates every action server-side.
- The timer is client-side for display but server-authoritative for phase transitions. When the server says time's up, time's up.
- Real-time sync via Supabase Realtime on `session_state` table. All clients subscribe to state changes.
- The scroll/roller reveal animation is purely client-side — triggered when the REVEAL phase state arrives with the `current_author_id`.
- Conversation prompts are stored in a static array in the protocol module, not in the database.
- The Lead's extra controls (advance, wrap up, a few more) are additional action buttons that only render when `role === 'lead'`.
