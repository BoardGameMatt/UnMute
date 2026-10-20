# On the Same Page — Protocol Spec v1

**Status:** Build spec, locked for v1
**Slug:** `on-the-same-page`
**Type:** realtime
**Players:** 8–16 phones (optimal 12). The facilitator plays on their phone. The host laptop is the shared screen and is not a player.
**Envelope:** ~18–22 minutes at 12 people and three rounds. A round that runs to every limit is ~9 minutes in round 1 and ~7 minutes after.
**Owner:** Matt Hendricks
**Pack mode:** `required`. Pack A is 50 pictures in five families of 10.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Source: *On the Same Page: Moment Spec* (Oct 17, 2026). Where that document and this file disagree, this file wins. Do not invent further mechanics at build time.

Purpose and fit in the source document is internal. It is not client copy and it does not appear in the product. The screen never names accountability.

---

## 1. What this Moment is

Five players build one picture on a 10×10 grid, one tile per turn. Four **Builders** know the picture. One **Improviser** does not, and has to keep up. Everyone else is an **Inspector**: name the picture from a 10-item list, and pin who is improvising.

The picture is the standard. Builders have to make it readable to the Inspectors and not to the Improviser. The Improviser is the person who does not know the target and is covering, not an underperformer.

**Primary target dimension:** D3 Shared Collaborative Understanding.
**Secondary:** D8 Peer Interaction Frequency. D4 is a guardrail, not a score.

**What gets revealed about a person:** whether the picture became readable, who the room suspected, and whether that suspicion matched the person who was missing the target.

---

## 2. Players, join, device

- **Start floor: 8 phones. Cap: 16 phones.** The shared screen does not count. Start is disabled below 8 ("Need 8 to start"). A 17th name is refused: "This moment is full."
- Eight is the smallest room with three Inspectors, so a single correct guess cannot end the round.
- **The facilitator is a player on their phone.** That phone has no Lead controls. Every Lead control is on the shared screen. Same split as Airtime and Rank and File.
- Opening the host link does not ask for a name. That browser claims the roster row `Shared screen`, which is excluded from the draw, the start count, and the lobby roster. A human may not join with that name.
- No auth. Display name, 6-character join code, QR on the shared screen.
- **New names close at Start.** Tap-your-name rejoin works for people already on the roster. No late joiners. No in-app player removal.
- Phone is the primary controller. Desktop can drag a tile onto a cell; Place still commits. The video call stays on the laptop.

---

## 3. Lobby explainer

Registers as `lobbyExplainer`. Below the join QR, above the roster, on phones and the shared screen.

**Approach:** coded loop, about 8 seconds a beat, six beats, six `LobbyExplainerDots`. One fixed panel size. `useReducedMotion()` stacks the beats and hides the dots.

The source document's five panes did not include the device beat. This spec prepends it. That is the platform rule, not a new mechanic.

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep everyone's video up on your laptop. | Phone and laptop. |
| 2 | Five players build a picture together on a 10×10 grid, one tile at a time. On your turn: tap a tile, tap a square, tap Place. | A few sample tiles on a small grid. |
| 3 | Builders know the picture. Build it so the Inspectors can name it, but the Improviser can't. | The word `Rubber duck`, marked SAMPLE. |
| 4 | The Improviser doesn't know the picture. Place tiles that fit, and work out what it is. | The same grid, no label. |
| 5 | Inspectors watch. Lock the picture, and pin who is improvising. | Two actions: a guess chip and a pin chip. |
| 6 | Lock the right picture early for the most points. Pin the Improviser for 2 more. Builders score when the Inspectors get it and the Improviser doesn't. | `Rubber duck` with a point chip. |

**Sample data:** `Rubber duck`, `Paper boat`, `Snowman`. None of these are in Pack A.

**Reuse:** `OtspTile` and the guess/pin chips from play.

---

## 4. Core mechanic

### 4.1 Draw

Each round draws 5 players, seeded from the session seed plus the round number.

1. Players not yet drawn this session fill the five first.
2. Among those, anyone carried from the previous On the Same Page session on this team fills first.
3. Remaining slots are random, including people already drawn this session once the undrawn pool runs out.
4. The Improviser is random among the five who have not yet been Improviser this session.
5. If all five already have been, the one who was Improviser earliest this session is chosen.
6. Turn order is a seeded shuffle of the five, and it stays the same every lap. If the Improviser would go first, the order rotates by one seat. The seed stays reproducible.
7. Five piece colors are shuffled after roles are drawn and assigned to the five. Color does not encode role.

Anyone still undrawn when the facilitator opens the scoreboard is written to this team's carry list. The next On the Same Page session on that team reads it. No other Moment reads it in v1.

Three rounds give 15 placing slots. Up to 14 phones, everyone places at least once. At 15 or 16, someone may sit the session out and carry priority forward.

### 4.2 Pictures

Round 1 draws from the 16-item starter pool. Later rounds draw from all 50. The guess list is the target's family, so every option is a look-alike. No picture repeats for this team across the Season. No family twice in a row inside a session.

If a constraint empties the pool, relax in this order: drop the family rule, then on round 1 allow the rest of the library, then allow repeats. An empty library is an error.

### 4.3 Round

Server-driven. Timers display on the client. The server advances them.

| Phase | Duration | What happens |
|---|---|---|
| Deal | 20s | Role cards on phones. Everyone sees the 10-item list. Only Builders see which item is the picture. The shared screen shows the five names and no roles. |
| Build, laps 1–2 | 15s per turn in round 1, 10s after | Active player places one tile. The turn passes the moment Place is tapped. |
| Check-in | 60s | Spoken. Any Builder or Inspector may ask any placer one question. One sentence. The answer cannot name the picture. The server ends it at 60 seconds. The arc is not shown, because nobody is placing. The app does not capture the words. |
| Build, laps 3–5 | same turn clock | Up to 15 more turns. |
| Final lock | 15s | Last chance to pin, and to lock a guess if you have not. |
| Reveal | beats below | Then the facilitator chooses another round or the scoreboard. |

A guess locked during Deal scores as lap 1. A guess locked during Check-in scores as lap 2. A guess locked in lap 5 or during Final lock scores 1.

**Early end.** More than half the Inspectors have locked the correct item, as an integer test: `correct × 2 > inspectorCount`. At 12 people that is 4 of 7.

- If that happens in Deal, lap 1, lap 2, or Check-in, the build still finishes laps 1 and 2, Check-in still runs, and the round then skips laps 3–5.
- From lap 3 on, the round ends after the current turn.
- Final lock always runs after the build stops. Reveal always runs after Final lock.

Lap 5 ends the build even if fewer than 25 tiles were placed. Every turn places one tile.

**Timeout.** The server keeps accepting Place for 2 seconds after the arc hits zero. Then a complete preview (tile and cell) is placed. If the preview is incomplete, the server places one tile on an empty square. There is no pass. Place stays disabled until both are chosen.

**Placement.** One tile per cell. No rotate, move, or remove. Any empty cell is legal. Tiles need not touch. Others see a tile only after Place.

**Preview** is stored on the server so a timeout can place it, and it is sent only to the player who set it.

### 4.4 Pieces

Ten tiles, each one cell. No rotation in the tray: each orientation is its own tile.

| Id | Shape |
|---|---|
| `square` | Full cell |
| `tri_ll` | Right triangle, right angle at the lower left |
| `tri_lr` | Right triangle, right angle at the lower right |
| `tri_ul` | Right triangle, right angle at the upper left |
| `tri_ur` | Right triangle, right angle at the upper right |
| `porthole` | Full cell with a centered hole, diameter 70% of the cell |
| `half_bottom` | Half-circle, flat edge on the bottom, diameter = cell width |
| `half_top` | Half-circle, flat edge on the top |
| `half_left` | Half-circle, flat edge on the left |
| `half_right` | Half-circle, flat edge on the right |

A full circle is two half-circles, flat edge to flat edge, in neighboring cells. Two turns.

The board background is `warm-white` on every screen. Piece fills use the palette in §7. That palette is the one opt-out from the token rule, and it is pieces only.

### 4.5 Reactions, pin, guess

Reactions are anonymous on every screen. The event log stores reactor, role, target tile, and time. Rate limit: one reaction per person per 2 seconds. Reactions close when the reveal starts.

| Id | Label | Meaning |
|---|---|---|
| `with_you` | With you | That tile fits |
| `not_sure` | Not sure | I'm questioning that one |
| `lost` | Lost me | I can't see where this is going |
| `see_it` | I see it | I think I know the picture |

`see_it` ships in v1.

The client sends the latest tile id with the reaction. The log keeps it. The float does not name a person, and it does not point at the tile on screen.

**Pin.** Starts empty. Builders and Inspectors may pin one of the five placers, never themselves, move it, or clear it, until Final lock ends. Every move is logged. The Improviser does not pin. They already know who is improvising.

**Guess.** Inspectors and the Improviser each lock one item, once. Builders do not guess. The count of Inspectors who have locked is public. Their choices are not. The Improviser's lock is hidden and uncounted until the reveal.

### 4.6 Persistent play copy

Same two-line block on every phone, for the whole round after Deal.

| Role | Line |
|---|---|
| Builder | Picture: [item]. Build it so Inspectors can name it, and the Improviser can't. |
| Improviser | You're improvising. Place tiles that fit, and work out the picture. |
| Inspector | You're an Inspector. Name the picture, and pin who's improvising. |

### 4.7 Reveal

Timed beats, then the outcome holds for the facilitator.

1. Suspicion (6s). A bar per placer: how many final pins landed on them.
2. Improviser (5s).
3. Improviser's guess (5s).
4. Picture (6s), with the share of Inspectors who named it.
5. Outcome. Round points and running totals. Facilitator: **Another round** or **Reflection questions**.

Reflection questions opens the session scoreboard. Continue there completes the session and follows NPS, then the reflection screen.

---

## 5. Scoring

Points accumulate across the rounds of one session and reset next session. Shown per person.

| Who | For | Points |
|---|---|---|
| Inspector or Improviser | Correct guess locked in lap 1, including during Deal | 5 |
| Inspector or Improviser | Correct, lap 2, including during Check-in | 4 |
| Inspector or Improviser | Correct, lap 3 | 3 |
| Inspector or Improviser | Correct, lap 4 | 2 |
| Inspector or Improviser | Correct, lap 5 or Final lock | 1 |
| Inspector or Improviser | Wrong, or none | 0 |
| Builder or Inspector | Final pin on the Improviser | 2 |
| Each Builder | More than half the Inspectors right, and the Improviser wrong or blank, judged when the round ends | 3 |
| Improviser | Pins on them × 2 is less than everyone else in the room, including people who never pinned | 3 |

The Improviser cannot pin themselves, so the pin denominator is `headcount − 1`.

**Shown at the reveal**

| Metric | Definition |
|---|---|
| Read the picture | Correct Inspector guesses ÷ Inspectors, blanks included |
| Read the person | Pins on the Improviser from everyone else ÷ everyone else, blanks included |

**Stored, not displayed.** Time to a correct pin that stayed. Time to a correct Inspector majority. Pins on each Builder. Who left a pin or a guess blank. Each reaction, with role, in the event log.

### 5.1 Worked example (12 phones)

7 Inspectors, 4 Builders, 1 Improviser. Eligible pinners: 11.

- 3 Inspectors lock the picture in lap 1: 5 each.
- 1 Inspector locks it in lap 3: 3.
- 3 Inspectors never lock a correct guess: 0.
- The Improviser locks a wrong item: 0 for the guess.
- 4 final pins are on the Improviser. `4 × 2 = 8`, which is less than 11, so the Improviser scores 3 for staying unpinned.
- Correct Inspectors are 4 of 7 (`8 > 7`) and the Improviser is wrong, so each Builder scores 3.
- Each Builder or Inspector whose own pin is on the Improviser scores 2 more.

Read the picture is 4/7. Read the person is 4/11.

---

## 6. State machine

```
LOBBY → DEAL → BUILD (laps 1–2) → CHECK-IN → BUILD (laps 3–5) → FINAL LOCK → REVEAL
                  ↘ early: still finish laps 1–2 and Check-in, then FINAL LOCK
                  ↘ early from lap 3: FINAL LOCK after the current turn
REVEAL → another round → DEAL
REVEAL → SCOREBOARD → NPS → REFLECTION
```

| Phase | Timer | Advances when |
|---|---|---|
| Deal | 20s | Server clock |
| Build | 15s round 1, 10s later, plus 2s Place grace | Place, or grace expiry |
| Check-in | 60s | Server clock |
| Final lock | 15s | Server clock |
| Reveal beats | 6, 5, 5, 6s, then hold | Server clock, then the facilitator |
| Scoreboard | none | Facilitator: Continue |

---

## 7. UI notes

**Protocol label:** `ON THE SAME PAGE`, mono, uppercase, tracking widest.

**Timer.** The arc shows only while someone is placing. The active name is on the screen as "Your turn" or "[Name]'s turn", and that name is marked Turn. Deal, Check-in, Final lock, and the reveal still end on the server clock, without an arc, because nobody is placing. Arc: `cloud-grey` track, `unmute-navy` fill. Last 5 seconds of a turn go `signal-amber` with a slow pulse. Last 3 seconds show 3-2-1. Turn clocks are only 10 or 15 seconds, so the amber band is the last 5 seconds. That shorter band is the opt-out from the platform 15-second band.

**Progress.** `SessionProgressBar`. Completed rounds ÷ 3. No numeric label.

**Piece palette** (fills only):

| Name | Hex |
|---|---|
| Indigo | `#332288` |
| Cyan | `#88CCEE` |
| Green | `#117733` |
| Sand | `#DDCC77` |
| Rose | `#CC6677` |

Shared-screen tiles are all indigo. Phones use the player's color. Every shape has a 1px `#4D4D4D` stroke. The five names sit in two rows, three then two, with no horizontal scroll. Tapping a name outlines that player's tiles with weight, not color alone. The active name has a 2px navy border and the word Turn. Running scores are not on the shared screen during a round. They appear on the outcome and the scoreboard.

**Your turn.** Board, then the tray in two rows of five, then Place. Place is disabled at opacity 40 until a tile and a cell are chosen, then `signal-amber`.

**Watching.** Board, then reactions. Builders and Inspectors get the pin. Inspectors and the Improviser get the guess list.

**Buttons.** Another round is the amber primary on the outcome. Reflection questions is navy. Continue on the scoreboard is amber.

**Motion.** Reactions rise and fade over about 2.4 seconds, with a small horizontal offset and no name. No wavy path. That is the motion-rule opt-out from the source document's "wavy" float: the float stays, the wave does not.

**Sending.** An unconfirmed tap shows `Sending…`.

---

## 8. Roles and visibility

The picture, the role map, guesses, pins, reaction authors, and the active preview are secrets. They live in `otsp_sessions.game_json`, which is service-role only. The realtime poke on `session_state` carries phase, round, lap, and a timestamp. It never carries a secret.

| Viewer | Sees | Must not see |
|---|---|---|
| Shared screen | Board in one color, five names, timer, lap, Inspector lock count, anonymous reactions, reveal beats. Scores only on the outcome and the scoreboard | Picture, roles, guesses, who pinned whom, who reacted, any preview |
| Builder phone | Picture name, persistent Builder line, own pin, board in player colors | Other guesses, other pins, other previews, who reacted |
| Improviser phone | Improviser line, guess list, own guess | The picture, the pin choices, other guesses, other pins, own role on the shared screen |
| Inspector phone | Inspector line, guess list, own guess, own pin | The picture, other guesses, other pins |
| Anyone, from the Improviser beat on | Who the Improviser was | — |
| Anyone, from the picture beat on | The picture and Read the picture | — |

A Builder's phone may show the picture during the reveal before the picture beat. The shared screen waits for that beat.

---

## 9. Edge cases

- Disconnect: at the end of the grace the server places one tile for that turn. No removal. Rejoin with the same name gets the filtered state.
- Place and timeout race: the write version accepts one of them. A Place that lands inside the 2-second grace counts.
- Below 8 or above 16: cannot start, and the cap refuses the join.
- 0 Inspectors cannot occur at the start floor. Builder bonus and early end use the integer test, which is false at 0.
- All five have already been Improviser: pick the earliest this session.
- Library exhausted: §4.2 relaxation order.
- Late name after Start: refused.
- Shared-screen name on a phone: refused.
- Check-in speech: not recorded. Whether a question was direct or hedged stays with the facilitator.
- Reactions stop at the reveal.

---

## 10. Authorization boundary

Every play and action route, before the service client is used for the write:

1. Participant cookie.
2. That participant belongs to this session.
3. The session's protocol is `on-the-same-page`.
4. Host actions require the shared-screen lead.

**Secret:** the picture id, the role map, unpublished guesses, pins, and reaction authors.

**Network-tab test:** during Build, a phone that is not a Builder, and the shared screen, do not receive the picture, the role map, or anyone else's guess or pin.

---

## 11. Facilitator script beats

Lead-only panel on the shared screen, label `FACILITATOR`. One line for the phase. Metrics there: round, lap, Inspectors locked, and at the outcome the two team metrics plus running scores.

1. Lobby. "Phones out. Cameras stay on the laptop. Five of you will build. One of those five doesn't know the picture."
2. Deal. "Read your phone. If you know the picture, don't say it."
3. Build. "Your turn is three taps: tile, square, Place."
4. Check-in. "One question to someone who placed. One sentence back. Don't name the picture."
5. Final lock. "Last chance to lock a guess and a pin."
6. Outcome. Read the two metrics in one line. Then another round, or the reflection.
7. Reflection open. "In the game, the Builders couldn't say what the picture was. At work, you can. Where are we acting like we can't?"

---

## 12. Content pack

**Pack mode:** `required`.
**Pack A:** 50 pictures, five families of 10, loaded through `sessions.content_pack_id`.

| Family | Items |
|---|---|
| Round | Alarm clock, Apple, Cat, Ghost, Guitar, Hot air balloon, Ladybug, Light bulb, Rabbit, Tree |
| Peaked | Bell, House, Kite, Lighthouse, Mushroom, Pine tree, Rocket, Sailboat, Table lamp, Umbrella |
| Long | Boot, Bus, Car, Fish, Key, Snail, Submarine, Tractor, Train, Turtle |
| Boxy | Bed, Castle, Chair, Gift, Laptop, Mug, Teapot, Television, Toaster, Top hat |
| Distinct | Airplane, Cactus, Candle, Crown, Flower, Heart, Hourglass, Ladder, Robot, Trophy |

**Starter pool (round 1):** Apple, Candle, Car, Chair, Fish, Flower, Guitar, Hourglass, Key, Ladybug, Mug, Rocket, Sailboat, Submarine, Teapot, Top hat.

Season uniqueness is a query across this team's prior `otsp_rounds`, not a second pack. Intra-session family uniqueness is not a pack.

---

## 13. Data model

Service role only. No client policy.

| Table | Holds |
|---|---|
| `otsp_pictures` | Pack rows: slug, label, family, starter, active |
| `otsp_sessions` | `game_json` (secret live state) and a write version |
| `otsp_rounds` | One row per round as it is dealt: picture slug, family, seed. Season memory. |
| `otsp_events` | Append-only log. Every row has session, round, time, actor, role. |
| `otsp_rotation_debt` | Team + participant, written when this session goes to the scoreboard. Next On the Same Page session on that team reads it. |

`session_state.state_json.otsp` is the poke: phase, round number, lap, timestamp. Public fields only.

Event types: `session_start`, `round_start`, `place`, `react`, `pin_move`, `guess_lock`, `checkin_start`, `checkin_end`, `round_end`, `host_action`. A timeout is a `place` with `timeout: true`.

`round_end` stores the end reason, final pins, final guesses, points, blanks, and the two metrics.

---

## 14. Session end flow

Outcome → **Reflection questions** → session scoreboard (totals, the two metrics from the last round, the bridge line for the facilitator) → Continue → NPS `/session/[id]/feedback` → reflection `/session/[id]/reflection`.

Reflection is the final screen.

---

## 15. Reflection close

Three questions, in this order:

1. Where do we assume we’re on the same page about what is “good” even without ever saying it out loud?
2. When a teammate's work doesn't seem to fit the picture, do you tend to stay quiet or speak up? What enables you (or might enable you) to voice your concerns?
3. Suspicion often landed on someone doing their part. How do we check our read of a situation (or another team member) before we act on it?

The bridge line in §11.7 is on the reflection screen above those questions, and on the scoreboard so the facilitator can read it.

---

## 16. Locked decisions

| # | Decision |
|---|---|
| 1 | 8–16 phones. Shared screen is not a player. |
| 2 | Early end finishes laps 1–2 and Check-in when the majority lands that early. From lap 3 it ends after the current turn. Final lock always runs. |
| 3 | Check-in guesses score as lap 2. Deal guesses score as lap 1. Final-lock guesses score 1. |
| 4 | Carry list is for the next On the Same Page session on this team. |
| 5 | Improviser-first order rotates by one seat. |
| 6 | Timeout places the preview when it has a tile and a cell. Otherwise the server places one tile. There is no pass. |
| 7 | Read the person includes people who never pinned. Denominator is everyone except the Improviser. |
| 8 | Piece hex values are the palette opt-out. Interface chrome uses tokens. |
| 9 | The arc shows only on a placing turn, with the active name. Amber is the last 5 seconds. |
| 10 | Reactions rise and fade. They do not travel on a wave. `see_it` ships. |
| 11 | Check-in words are not captured. |
| 12 | Device beat is the first explainer pane. |
| 13 | Three discussion questions, in §15. The bridge line is a preface, not a fourth question. |

---

## 17. Degraded fallback

**Opt-out.** Do not run this Moment without the app. A paper grid or a chat thread cannot keep the picture and the Improviser hidden at the same time. If the app is down, skip the Moment. There is no in-app fallback and no player-removal path.

---

## 18. Acceptance bar

1. Two consecutive full-scale rehearsals, 8 or more people on phones, without the facilitator fixing a stuck turn.
2. QR join works without help.
3. A disconnected active player gets one placed tile at the end of the grace, then can rejoin and see only their role's state.
4. Headcounts 8, 12, and 16. At 8, one correct Inspector guess does not end the round (majority is 2 of 3).
5. Network tab: during Build, the shared screen and a non-Builder phone do not contain the picture or anyone else's guess or pin.
6. A Place tapped as the arc hits zero still counts inside the 2-second grace. A throttled duplicate Place does not place a second tile.
7. This degraded-fallback opt-out is in the facilitator notes (§17).

---

## 19. Conservative leftovers

| Call | Choice |
|---|---|
| All five already Improviser | Earliest this session |
| Library constraints empty the pool | Relax family, then starter-only, then allow repeats |
| Scoreboard sort when points tie | Alphabetical by display name. Display only. |
| Reactions during the reveal | Closed |
| Drag on desktop | Sets the preview. Place still commits. |
| Cross-moment queue | Stored on the team. Only this Moment reads it in v1. |
| Amber on a 10–15s turn | Last 5 seconds, not the whole turn |
| Speech in Check-in | Not a feature |

---

## 20. Build sequence

Each step is independently testable.

1. Spec locked in this file.
2. Pure engine: draw, order, picture pick, turns, early end, scoring. Unit tests, no database.
3. Migration `031_on_the_same_page.sql`: protocol, Pack A, secret tables, service-role only.
4. Server: start, actions, versioned writes, filtered play payload, poke with no secrets.
5. Wire join cap, lobby start floor, shared-screen host link, registry.
6. Phone and shared-screen UI, explainer, reveal, scoreboard, reflection preface.
7. `npm test` for the engine, then `npm run build`.

---

## 21. Open questions

None. The source document's playtest items are decided: `see_it` ships, picture difficulty is watched in the event log rather than gated, and this Moment does not use the pairing matrix.
