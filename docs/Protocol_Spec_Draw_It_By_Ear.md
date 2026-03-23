# Protocol Spec: "Draw It By Ear"

**Slug:** `draw-it-by-ear`
**Type:** Real-time (synchronized phases across subgroups)
**Players:** 5–20 (optimal 6–12)
**Duration:** ~12–15 minutes (minimum 3 rounds, auto-extends if under 10 min)
**Purpose:** Build communication precision, active listening, and collaborative trust through a high-energy drawing challenge. Based on the mechanics of Duplik/Portrayal.

---

## Overview

The team is divided into subgroups. In each round, one person per subgroup (the Describer) sees an image and has 90 seconds to verbally describe it to their subgroup members, who draw it on physical paper with markers. After drawing, everyone self-scores against 9 hidden criteria. Subgroups compete against each other. Designed for virtual meetings with breakout rooms.

**Physical materials required:** Paper (multiple sheets) and a dark, thick marker (Sharpie recommended). Players are told this at the start.

---

## Actors & Views

| Role | Device | What They See |
|------|--------|---------------|
| **Lead** | Phone + laptop (video call) | Session controls, subgroup assignments, round management, all scores |
| **Describer** (rotates per subgroup) | Phone + laptop (in breakout room) | The image + timer during description phase. Scoring criteria during scoring. |
| **Drawer** (everyone else in subgroup) | Phone + laptop (in breakout room) | Instructions during description phase ("Listen and draw!"). Scoring criteria during scoring. |

---

## Pre-Game: Subgroup Formation

### Division Rules (in priority order)

1. No group larger than 4 members
2. Group sizes as even as possible
3. Favor larger groups over smaller ones
4. No group with only 1 person

### Division Table

| Team Size | Subgroups | Sizes |
|-----------|-----------|-------|
| 5 | 2 | 3, 2 |
| 6 | 2 | 3, 3 |
| 7 | 2 | 4, 3 |
| 8 | 2 | 4, 4 |
| 9 | 3 | 3, 3, 3 |
| 10 | 3 | 4, 3, 3 |
| 11 | 3 | 4, 4, 3 |
| 12 | 3 | 4, 4, 4 |
| 13 | 4 | 4, 3, 3, 3 |
| 14 | 4 | 4, 4, 3, 3 |
| 15 | 4 | 4, 4, 4, 3 |
| 16 | 4 | 4, 4, 4, 4 |
| 17 | 5 | 4, 4, 3, 3, 3 |
| 18 | 5 | 4, 4, 4, 3, 3 |
| 19 | 5 | 4, 4, 4, 4, 3 |
| 20 | 5 | 4, 4, 4, 4, 4 |

Assignment should be randomized — not alphabetical, not by join order. The randomness is part of the mixing.

---

## Game State Machine

```
LOBBY → MATERIALS_CHECK → SUBGROUP_REVEAL → BREAKOUT_SETUP → DESCRIPTION → RETURN_TO_MAIN → SHOW_DRAWINGS → SCORING → IMAGE_REVEAL → ROUND_SCORES → [AUTO_CONTINUE or LEAD_EXTEND] → BREAKOUT_SETUP (loop) → FINAL_RESULTS
```

### Phase Details

#### 1. LOBBY
- Standard lobby from session shell
- Lead sees "Start Protocol" button when minimum players (5) have joined

#### 2. MATERIALS_CHECK
**Everyone's screen:**
- Outfit heading: "Grab your supplies"
- Checklist-style display (not interactive, just informational):
  - "Several sheets of blank paper"
  - "A dark, thick marker (Sharpie is ideal)"
- DM Mono subtext: "You'll be drawing on paper — not on your screen."
- Lead sees: "Ready to Continue" button
- This phase is brief — just long enough for people to grab materials (~15 seconds, Lead advances manually)

#### 3. SUBGROUP_REVEAL
**Everyone's screen:**
- Outfit heading: "Here are your teams"
- Subgroups displayed as named groups (Group A, Group B, etc.)
- Each group shows its members' display names
- The first-round Describer in each group is highlighted with a subtle indicator (amber dot or "Describer" badge in DM Mono)
- Lead's screen additionally shows: "Have everyone set up breakout rooms to match these groups, then tap Ready."

**Important:** The app does NOT create breakout rooms. The Lead (or whoever controls the video call) manually creates breakout rooms in Zoom/Teams to match the subgroups shown. The app just shows who goes where.

#### 4. BREAKOUT_SETUP
**Everyone's screen:**
- "Head to your breakout room now"
- Shows which group they're in and who else is in it
- Describer sees: "You're the Describer this round. When everyone is in the breakout room and ready, the image will appear."
- Lead sees: "Start Round" button. Lead taps this when breakout rooms are set up and everyone is in place.

#### 5. DESCRIPTION (90 seconds)
**Describer's screen (per subgroup — all Describers see the same image simultaneously):**
- The image, displayed as large as possible on the phone screen
- Time-timer style visual countdown (90 seconds) — same style as "The Truth Is..."
- No other UI elements. Image + timer. Maximum screen real estate for the image.
- Describer verbally describes what they see. No constraints on what they can say — they can name objects, describe positions, colors, shapes, whatever they think will help.

**Drawer's screen (everyone else):**
- DM Mono label: `LISTEN AND DRAW`
- Outfit text: "Draw what you hear. Don't peek at other screens!"
- Time-timer visual countdown (same 90 seconds, synchronized)
- No image shown. The phone is just a timer and reminder — the actual drawing happens on physical paper.

**Behavior:**
- Timer is server-authoritative. When 90 seconds elapse, all screens advance simultaneously.
- Image disappears from Describer's screen when timer ends.

#### 6. RETURN_TO_MAIN
**Everyone's screen:**
- "Time's up! Head back to the main room."
- Brief hold (~10 seconds or until Lead advances) for people to leave breakout rooms and rejoin the main video call.
- Lead sees: "Everyone Back?" button to advance.

#### 7. SHOW_DRAWINGS
**Everyone's screen:**
- Outfit heading: "Show off your masterpieces!"
- Subtext: "Hold your drawing up to the camera so everyone can see."
- A gentle timer runs (15 seconds) — enough time for laughs and reactions
- Auto-advances to SCORING after the timer, or Lead can advance early
- This is the fun social moment. No scoring yet, just the reveal of what people drew.

#### 8. SCORING
**Everyone's screen (Drawers only — Describers do not score):**
- DM Mono label: `SCORE YOUR DRAWING`
- Outfit subtext: "Be honest — it's more fun that way."
- 9 criteria displayed as a vertical list, each with a YES / NO toggle
- Criteria are ordered: 3 easy (1 pt each), 3 medium (2 pts each), 3 hard (3 pts each)
- Each criterion shows its point value: "(1 pt)", "(2 pts)", "(3 pts)"
- Point value labels use DM Mono, criteria text uses Inter
- Submit button at bottom: Grey → Steel Blue (when all 9 answered) → Amber (submitted)

**Describer's screen during scoring:**
- "Your team is scoring — hang tight."
- Can see the 9 criteria (for reference/discussion) but does not score.

**Scoring criteria example (for a beach scene with palm tree, sailboat, and sun):**
- Easy (1 pt): "There is water in the scene" / "There is a tree" / "The sun is visible"
- Medium (2 pts): "The tree is a palm tree" / "There is a boat on the water" / "The sun is in the upper-right area"
- Hard (3 pts): "The boat has a triangular sail" / "There are exactly 2 clouds" / "The palm tree is leaning to the right"

**Maximum score per Drawer per round:** 3(1) + 3(2) + 3(3) = 18 points

#### 9. IMAGE_REVEAL
**Everyone's screen:**
- The original image is revealed — displayed prominently
- Outfit heading: "Here's what it actually was"
- Hold for ~8 seconds. This is usually a big reaction moment.
- Lead can advance manually or it auto-advances.

#### 10. ROUND_SCORES
**Everyone's screen:**
- DM Mono label: `ROUND [N] SCORES`
- Subgroup scores displayed side by side (competitive comparison)
- Each subgroup shows: group name, total score (sum of all Drawers' scores in that subgroup), and individual Drawer scores within the group
- Winning subgroup for this round gets an amber highlight
- Running cumulative scores shown below the round scores
- Auto-advance after ~8 seconds or Lead advances

#### 11. AUTO_CONTINUE / LEAD_EXTEND
**Logic:**
- After each round, check elapsed time since protocol started
- If elapsed < 10 minutes AND more images are available: automatically start next round (go to BREAKOUT_SETUP with rotated Describer)
- If elapsed >= 10 minutes AND < 15 minutes: Lead sees "Another Round?" / "Wrap Up" buttons (same pattern as "The Truth Is...")
- If elapsed >= 15 minutes OR no more images available: go to FINAL_RESULTS
- Minimum 3 rounds always play regardless of time

**Describer rotation:**
- Rotates to the next person in each subgroup each round
- If the subgroup has 4 members: rounds 1-4 each have a different Describer
- If the subgroup has 3 members: Describer rotates through all 3, then cycles back if more rounds are played
- If the subgroup has 2 members: they alternate

#### 12. FINAL_RESULTS
**Everyone's screen:**
- Outfit heading: "Final Scores"
- Subgroup rankings with cumulative scores
- Winning subgroup highlighted in amber
- "MVP Describer" — the Describer whose round produced the highest subgroup score (optional, fun award)
- "Most Precise Drawer" — the Drawer with the highest individual cumulative score (optional)
- Session progress bar at 100%
- Lead sees: "End Session" button

---

## Data Model (protocol-specific state_json)

```json
{
  "phase": "MATERIALS_CHECK | SUBGROUP_REVEAL | BREAKOUT_SETUP | DESCRIPTION | RETURN_TO_MAIN | SHOW_DRAWINGS | SCORING | IMAGE_REVEAL | ROUND_SCORES | FINAL_RESULTS",
  "subgroups": [
    {
      "id": "group-a",
      "name": "Group A",
      "member_ids": ["participant_uuid", ...],
      "describer_rotation": ["participant_uuid", ...],
      "current_describer_index": 0
    }
  ],
  "rounds": [
    {
      "round_number": 1,
      "image_id": "image_uuid",
      "describer_ids": {
        "group-a": "participant_uuid",
        "group-b": "participant_uuid"
      },
      "scores": {
        "participant_uuid": {
          "criteria_responses": [true, false, true, ...],
          "total": 12
        }
      },
      "subgroup_totals": {
        "group-a": 34,
        "group-b": 28
      }
    }
  ],
  "current_round": 1,
  "total_rounds_played": 0,
  "protocol_started_at": "ISO timestamp",
  "timer_started_at": "ISO timestamp | null",
  "timer_duration_seconds": 90 | 15 | 0,
  "cumulative_scores": {
    "group-a": 0,
    "group-b": 0
  },
  "images_used": ["image_uuid", ...],
  "lead_chose_continue": false
}
```

---

## Image Library Data Model

Each image is stored as a record in an `protocol_images` table:

```json
{
  "id": "uuid",
  "protocol_slug": "draw-it-by-ear",
  "name": "Beach Scene",
  "image_url": "https://[supabase-storage]/images/beach-scene.png",
  "criteria": [
    { "text": "There is water in the scene", "points": 1, "difficulty": "easy" },
    { "text": "There is a tree", "points": 1, "difficulty": "easy" },
    { "text": "The sun is visible", "points": 1, "difficulty": "easy" },
    { "text": "The tree is a palm tree", "points": 2, "difficulty": "medium" },
    { "text": "There is a boat on the water", "points": 2, "difficulty": "medium" },
    { "text": "The sun is in the upper-right area", "points": 2, "difficulty": "medium" },
    { "text": "The boat has a triangular sail", "points": 3, "difficulty": "hard" },
    { "text": "There are exactly 2 clouds", "points": 3, "difficulty": "hard" },
    { "text": "The palm tree is leaning to the right", "points": 3, "difficulty": "hard" }
  ],
  "created_at": "ISO timestamp"
}
```

**Image sourcing format:**
- PNG or JPG, ideally simple illustrations (not photographs)
- Recommended size: 1000x1000px or similar square format (displays well on phone screens)
- Style: clear, colorful, moderately complex scenes with 8-15 distinct visual elements
- Each image MUST ship with exactly 9 criteria: 3 easy (1pt), 3 medium (2pt), 3 hard (3pt)
- Images are stored in Supabase Storage. The `image_url` points to the storage bucket.
- Start with 10-15 images minimum. The system draws from unused images each session.

---

## Timer Behavior

| Phase | Duration | Visual Style | Auto-advance? |
|-------|----------|-------------|---------------|
| MATERIALS_CHECK | No timer | — | Lead advances manually |
| SUBGROUP_REVEAL | No timer | — | Lead advances manually |
| BREAKOUT_SETUP | No timer | — | Lead taps "Start Round" |
| DESCRIPTION | 90 sec | Time-timer arc (same as Truth Is) | Yes — image disappears, all advance |
| RETURN_TO_MAIN | ~10 sec hold | No visible timer | Lead advances ("Everyone Back?") |
| SHOW_DRAWINGS | 15 sec | No visible timer | Yes, or Lead advances early |
| SCORING | 60 sec | Time-timer arc | Yes — unsubmitted scores count as all "No" |
| IMAGE_REVEAL | 8 sec | No visible timer | Yes, or Lead advances |
| ROUND_SCORES | 8 sec | No visible timer | Yes, or Lead advances |

---

## Session Progress Bar

Same shared component as "The Truth Is..." — thin bar at top of screen.
- Calculated as: rounds_completed / estimated_total_rounds
- Estimated total rounds = 3 initially, adjusts if Lead extends
- Appears after MATERIALS_CHECK phase

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Team of exactly 5 (subgroups of 3 and 2) | Works fine. The group of 2 has 1 Describer + 1 Drawer. Scoring still works — just fewer individual scores per subgroup. |
| Team of exactly 4 | Below minimum (5). Show error: "Draw It By Ear needs at least 5 players." |
| Describer disconnects during description phase | Timer continues. Drawers see "Your Describer disconnected — do your best with what you heard!" Round still scores. |
| Drawer disconnects during scoring | Their score is not counted. Subgroup total adjusts (doesn't penalize remaining members). |
| All images in library have been used | Extremely unlikely with 10+ images and 3-5 rounds per session. If it happens, recycle from the beginning (shuffle again). |
| Lead forgets to create breakout rooms | The app can't enforce this. The BREAKOUT_SETUP phase gives clear instructions. If the Lead starts the round without breakouts, Describers will just describe to the whole room (less fun, but still works). |
| Uneven subgroups affect scoring fairness | Normalize scores for display: show "average score per Drawer" alongside raw totals so a group of 3 Drawers isn't disadvantaged against a group of 2. |

---

## Screen-by-Screen Summary (Mobile, Portrait)

| Phase | What's on screen |
|-------|-----------------|
| MATERIALS_CHECK | Supply list. Lead: "Ready" button. |
| SUBGROUP_REVEAL | Group assignments with Describer highlighted. |
| BREAKOUT_SETUP | "Go to your breakout room." Describer badge if applicable. Lead: "Start Round." |
| DESCRIPTION (Describer) | Image + timer. Full screen. Nothing else. |
| DESCRIPTION (Drawer) | "Listen and draw!" + timer. Minimal. |
| RETURN_TO_MAIN | "Head back to the main room." Lead: "Everyone Back?" |
| SHOW_DRAWINGS | "Hold up your drawing!" Brief social moment. |
| SCORING | 9 criteria, YES/NO toggles, point values shown. Submit button. |
| IMAGE_REVEAL | The actual image, large and prominent. |
| ROUND_SCORES | Subgroup scores side by side. Running totals. |
| FINAL_RESULTS | Final rankings, awards, end session button. |

---

## Notes for Cursor Implementation

- Subgroup formation is computed server-side when the Lead starts the protocol. The algorithm follows the division table above.
- The image is ONLY sent to Describer participants during the DESCRIPTION phase. It must NOT appear in any client state that Drawers could inspect. Use a separate Supabase RPC or API route that checks the participant's role before returning the image URL.
- Scoring criteria are only revealed during the SCORING phase — they are not included in any earlier state broadcasts.
- Image selection: when starting a round, pick a random image from the library that hasn't been used in this session (check `images_used` array).
- The protocol_images table needs a Supabase migration added to Prompt 1B. Include it as an additional table.
- For the demo, seed 3-5 sample images with criteria so the protocol is playable immediately.
- The session progress bar component should be extracted from "The Truth Is..." and made into a shared component in /components/SessionProgressBar.tsx.
- Score normalization (average per Drawer) should be the primary display metric for subgroup comparison, with raw totals shown as secondary.
