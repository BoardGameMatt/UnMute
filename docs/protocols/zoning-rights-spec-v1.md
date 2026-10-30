# Zoning Rights — Protocol Spec v1

**Status:** Build spec, mechanics locked for v1  
**Slug:** `zoning-rights`  
**Type:** Turn-based (rotating City Planner / Zoning Manager; simultaneous secret guesses; team-play Lead Developer; server-authoritative clocks)  
**Players:** 3–20 (optimal 6–12). Facilitator is a player.  
**Envelope:** ~20–30 minutes for 3 individual rounds + 3 team-play rounds, plus optional extra individual rounds  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is the 121-building library in §14. v1 has no Pack B.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Locked decisions are in §17. Conservative calls (conversation did not specify) are recorded there and in §21. Do not invent further mechanics at build time.

Surface inspiration: simplified placement from the board game *Link City*. The Unmute payload is not city-building score. It is **whether you can predict how a specific colleague would place three (then four) named buildings**, and then whether the **room can form one shared model** of that person.

---

## 1. What this Moment is

A city grows on a shared grid, **7 squares high by 5 squares wide** (portrait). City Hall is always on the middle-center square. At Start, four tiles are drawn at random from the building deck and placed orthogonally adjacent to City Hall — north, south, east, and west. They are the opening context for every later zoning decision.

Each round, one person (the **City Planner**) picks the next empty lots. Another person (the **Zoning Manager**) is dealt random buildings and, in secret, assigns them to those lots. After they lock, their phone tells them to go off camera and mute until everyone else has chosen. Everyone else has one minute to guess that exact assignment.

The map is public. The assignment is not.

After two individual rounds the facilitator may switch to **team play**: same secret Zoning Manager, no hints, two minutes of discussion while a randomly chosen **Lead Developer** places the team's guess live on the map — and the lot count goes from three to four. The two-minute timer commits whatever is on the map. The facilitator may also continue individual play through round 3 (and extras) before switching.

Score is a recap, not the point. Individual rounds are individual victories (your name on the reveal, or not). Team play is a group victory (the team got it, or not). The Zoning Manager never scores.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who is readable, who is idiosyncratic, whether the room can agree on a model of one person without that person coaching.

**What gets revealed about a person:** whether colleagues can predict their taste and logic; whether they can keep a secret under social pressure; whether a team discussion converges or fragments when the answer key is sitting silently in the call.

---

## 2. Players, join, device

- **Start floor: 3.** City Planner, Zoning Manager, and at least one guesser. Below 3, Start stays disabled.
- **Cap: 20.**
- **The facilitator is a player.** Round 1 they are the City Planner. They guess in any round they are not Zoning Manager. They may be Zoning Manager or Lead Developer in later rounds. They also get session-Lead controls (advance from reveal, extra individual round, move to team play, end). They are **not** automatically the person who locks team play.
- No auth. Lobby: display name. Same 6-character join code as every Moment.
- **Phone is the primary controller; desktop works but is not optimized.** Video call stays on the laptop. The **shared laptop** (facilitator screen / projector) is where the full city map is read. Phones carry private trays, except as specified in §5.8.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~16s, looping), same convention as Talk Track and Wrong Answers Only. `useReducedMotion()` → static stacked panels. Easy sample data only — **never a real Pack A building.**

The looping panel is **one fixed size for every beat** (CSS grid overlap so the stage is as tall as the tallest beat). Do not grow/shrink the shell as captions change.

v1 explainer teaches **individual play only**. Team play is not in the lobby loop (facilitator can still run it in the sitting).

If a hosted video file is supplied later under `/public`, it may replace or sit above the loop. v1 does not block on a video file.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep the facilitator’s video open on your laptop. | Phone + laptop with a video grid. |
| 2 | The Zoning Manager zones the lots however they think is best for the city. Everyone else guesses that placement in secret — then you find out who read them right. | Mid-game map: some squares occupied, some empty lettered lots; copy asking how they would zone A, B, C. |
| 3 | Here’s the order of a round. | Numbered steps: Zoning Manager is chosen; City Planner picks squares; Zoning Manager places buildings; everyone else guesses in secret on their phones. |
| 4 | After the Zoning Manager has made a decision, they turn off their camera and go on mute while the other players decide. | Phone copy: camera off, mute. |
| 5 | It’s all or nothing. Match every lot and you score. One wrong, and you don’t. | Maya, Jordan, and Steve, each with a sunrise-gold check. |

**Sample data (obviously fake, not in Pack A):** `FERRY`, `PIER`, `MILL`, `DOCK`, `INN`, `YARD`. Lots `A`, `B`, `C`.

**Reuse:** the lettered lot markers, building-tile face, and lock-in button from play UI, with the same visual states as §9.

---

## 4. Board

### 4.1 Grid

Portrait **5 columns × 7 rows**. 35 cells. Coordinates are `(col, row)` with `(0,0)` at top-left.

```
        0     1     2     3     4
     ┌─────┬─────┬─────┬─────┬─────┐
  0  │     │     │     │     │     │
     ├─────┼─────┼─────┼─────┼─────┤
  1  │     │     │     │     │     │
     ├─────┼─────┼─────┼─────┼─────┤
  2  │     │     │  N  │     │     │
     ├─────┼─────┼─────┼─────┼─────┤
  3  │     │  W  │ HALL│  E  │     │
     ├─────┼─────┼─────┼─────┼─────┤
  4  │     │     │  S  │     │     │
     ├─────┼─────┼─────┼─────┼─────┤
  5  │     │     │     │     │     │
     ├─────┼─────┼─────┼─────┼─────┤
  6  │     │     │     │     │     │
     └─────┴─────┴─────┴─────┴─────┘
```

- **City Hall** is always at `(2,3)` — the middle-center square. It is not drawn from the deck. It never moves.
- **Opening cross:** at Start, the engine draws **four distinct buildings** uniformly at random from Pack A and places one on each orthogonal neighbor of City Hall:
  - North `(2,2)`
  - East `(3,3)`
  - South `(2,4)`
  - West `(1,3)`
- Which building lands on which cardinal is random (shuffle four, assign N, E, S, W in that draw order).
- Those four tiles are **consumed** — they cannot be dealt to a Zoning Manager later. They stay on the board for the whole sitting. They have no extra mechanical effect: they are occupied cells and **opening context** for human decisions.

There is **one deck**. The opening four are the same Pack A buildings as every later deal. There is no separate feature library.

City Hall and the four opening tiles are **occupied** for the rest of the session.

### 4.2 Legal lot

A cell is a **legal lot** when it is:

1. Empty, and
2. Orthogonally adjacent (N/E/S/W, not diagonal) to **at least one occupied** cell.

Occupied = City Hall, an opening-cross building, or any building already locked onto the board in a previous round.

Diagonal adjacency is never legal. You cannot place in a cell that only touches a building on a corner.

### 4.3 Opening legal lots (round 1)

The opening cross yields **exactly eight** legal lots:

| Cell | Why it is legal |
|---|---|
| `(2,1)` | North of N tile |
| `(1,2)` | West of N tile |
| `(3,2)` | East of N tile |
| `(4,3)` | East of E tile |
| `(3,4)` | East of S tile |
| `(1,4)` | West of S tile |
| `(0,3)` | West of W tile |
| `(2,5)` | South of S tile |

Later rounds have more than eight as the city grows. The planner UI always shows a checkbox on **every current legal lot**, not a hardcoded eight.

### 4.4 Growing the city

When a round’s lots are locked and the Zoning Manager’s assignment is revealed, those buildings **stay on the board**. They are occupied for the rest of the session. New legal lots appear around them. The city is one continuous orthogonal mass for the whole sitting.

---

## 5. Core mechanic

Two modes. Individual play first (minimum 2 rounds). Team play after the facilitator opts in (not before round 2 is revealed). After the first team round, the facilitator may run another team round or wrap. Then the session ends.

### 5.1 Roles in a round

| Role | Who | Public? | Acts |
|---|---|---|---|
| **City Planner** | Round 1: the facilitator (session Lead). Later: the previous round’s Zoning Manager | Spot picks are public | Selects exactly *k* legal lots, then locks |
| **Zoning Manager** | Random eligible participant (see §6.2). Never the current City Planner | Assignment is secret until reveal | Receives *k* random unused buildings; assigns each to a lettered lot; locks |
| **Guesser** | Individual play: everyone who is not the Zoning Manager this round | Guesses are secret | Assigns the same *k* buildings to A/B/C; locks or waits out the timer |
| **Lead Developer** | Team play only. Random eligible participant each team round (see §6.4). Never the current Zoning Manager or City Planner | Placement is public and live on the shared map | During the 120s discussion, assigns A–D for the team. Timer expiry commits |

*k* = **3** in individual play, **4** in team play.

Lead Developer does not exist during individual play.

### 5.2 Individual round — step by step

**A. City Planner picks lots (no timer)**

1. Exactly *k* lots may be selected at once. A tap on a further lot is ignored until one selected lot is toggled off.
2. Taps update **immediately on the planner’s device** (local). Do not wait for a server round-trip before the check appears or the next tap registers. Lock is the commit; the lock payload includes the *k* cells.
3. When exactly *k* lots are selected, **Lock lots** becomes visible (grey while *k* not met → amber when *k* met).
4. Planner may keep toggling until they lock.
5. On lock, the server assigns letters to those lots (see §5.5) and the shared map shows **A, B, C** on those cells. Checkboxes disappear.

**Where the checkboxes appear**

| Round | Checkbox map | Everyone else |
|---|---|---|
| Individual round **1** | **Facilitator screen only** (shared laptop). Not on member phones. | Role strip + “Waiting on [City Planner name] to pick the lots.” No checkboxes. No legal-lot dashes. |
| Later individual and all team lot picks | Current City Planner’s phone **and** the shared laptop (live) | Same waiting copy. No checkbox input. |

Round 1 is never a member-phone picker. The facilitator acts on the screen the room is already watching.

**B. Zoning Manager is dealt and assigns (no timer)**

1. The Zoning Manager was already chosen at round start (§6.2). At lot lock the server deals *k* **unused** buildings from Pack A, uniformly at random, without replacement for the sitting (opening-cross tiles already consumed).
2. Zoning Manager’s phone: the **city map** with lettered lots plus a tray of *k* building tiles. They drag (click-and-hold) a building onto a lettered lot on the map. Tap-to-select then tap-lot is the fallback.
3. They drag each building onto A, B, C on the **map**. They may rearrange until lock. Dropping onto an occupied letter **swaps**. Taps update immediately on their device — do not wait for a server round-trip to show the tile.
4. When all *k* tiles are on a letter, **Lock in** becomes visible.
5. Lock persists the permutation. No other client receives it yet (see §12).
6. Everyone else sees the role strip plus “Waiting on [Zoning Manager name] to zone the lots.” Shared map still shows lettered empty lots, not buildings.
7. The Zoning Manager’s phone **immediately** replaces the tray with the off-camera prompt (§5.7). They stay on that screen through the guess (individual) or through discussion and team lock (team play). The platform cannot mute Zoom/Teams for them — honor system. They may keep watching the shared map. If they are also the session Lead, **keep sharing the laptop map**; turn off the webcam tile and mute the mic.

**C. Secret guess (60 seconds)**

1. Every guesser’s phone gets the **same *k* building names** and places them on the same lettered lots on the map. They do not see the Zoning Manager’s permutation. Placement is local until lock.
2. Shared laptop: city map with lettered lots, the building **list** (names only, not placed), and the timer. No live guesses.
3. Persistent copy on guesser phones (§5.7).
4. Two paths to a personal lock:
   - **Lock in** — visible only once all *k* buildings are placed. That guesser is done; they may not edit.
   - **Timer expiry** — server clock. Any guesser who has not placed all *k* has **no valid guess** (does not match).
5. Session Lead sees `N of M locked in`. Members do not see who has locked, other than themselves.
6. If every guesser has locked, the phase may close before 60s. Zoning Manager is not a guesser and does not block close.
7. When this phase ends (all locked or timer), the Zoning Manager’s phone tells them they can come back on camera and unmute. Reveal is next.

**D. Reveal (session Lead advances)**

1. Shared map places the Zoning Manager’s buildings on A, B, C.
2. Every phone shows the same true layout.
3. Display names of guessers whose permutation **equals** the Zoning Manager’s, in join-stable order. Exact match of all *k* letter→building pairs. **No partial credit.** Those names are the individual victory.
4. Incorrect guesses are **not** shown.
5. Lead-only: **Continue** (next individual round). After the 2nd completed individual round also **Move to team play**. After the 3rd completed individual round, **Continue** becomes **Another round**, and **Move to team play** remains (see §5.3).

### 5.3 After two individual rounds

Individual rounds 1–2 are mandatory before team play is available. The Lead cannot jump to team play after round 1.

On the reveal of individual round 2, Lead-only:

| Button | Effect |
|---|---|
| **Continue** | Individual round 3 (*k*=3). Previous Zoning Manager becomes City Planner. |
| **Move to team play** | Enter `TEAM_INTRO` (untimed note, Lead continues). |

On the reveal of individual round 3 (and every extra individual reveal after that), Lead-only:

| Button | Effect |
|---|---|
| **Another round** | One more individual round (*k*=3). Previous Zoning Manager becomes City Planner. New Zoning Manager dealt. Repeat 5.2. |
| **Move to team play** | Enter `TEAM_INTRO`. |

No cap on extra individual rounds other than Pack A remaining buildings (need *k* unused buildings to deal). If the pack cannot deal the next round, **Another round** is disabled and only **Move to team play** remains.

### 5.4 Team play

**TEAM_INTRO (no timer)**

Every device, including the shared laptop, shows this note **once**. Facilitator **Continue** starts the first team round. Do not auto-advance on a clock. Do not duplicate the sentence in a second headline.

> There are now 4 buildings at a time. Only one person (the Lead Developer) will choose for the team.

No map interaction. Later team rounds skip this intro and go straight to lot pick.

**Each team round (*k* = 4)**

1. **City Planner** picks exactly 4 legal lots and locks. Four letters **A, B, C, D**. Checkbox map on the planner’s phone and the shared laptop (not round-1-only).
2. **Zoning Manager** dealt 4 unused buildings, assigns in secret, locks. Same private tray. On lock, their phone shows the off-camera prompt (§5.7). They stay off camera and muted through discussion until reveal. They do **not** join the discussion.
3. Server picks this round’s **Lead Developer** (§6.4) when the Zoning Manager locks, so the room knows who is placing before discussion starts. Display the name on every screen except it is not a secret.
4. **DISCUSS (120 seconds).** Everyone except the Zoning Manager is in the discussion. Building **list** is visible. Lettered lots are visible. Zoning Manager’s permutation is not. The **Lead Developer** places A–D live on the map during these two minutes. Everyone else (including the facilitator, unless they are the Lead Developer) sees **the same map and remaining building list**, view-only — no placing, no taking buildings back, no **Lock it in**. The shared laptop mirrors that placement. Zoning Manager remains off camera, muted, no hints (honor system + on-screen rule). There is **no separate lock phase**. Copy (members):

> Discuss as a team. Zoning Manager is off camera — no hints. You can see the same map as [Lead Developer name]. Only they can place.

Copy (Lead Developer):

> Tap a building, then tap the lot. Tap the name on a lot to take it back. Lock it in when the team agrees, or wait for the timer.

5. When the 120s clock hits zero, **or** the Lead Developer taps **Lock it in** (visible once all four buildings are placed), the server commits the current `team_guess` (incomplete tray ≠ exact match) and goes to reveal. Zoning Manager stays on the off-camera prompt until that reveal.
6. **Reveal.** Zoning Manager is prompted they can come back on camera and unmute. True layout on the map. Each lettered lot gets a **large success check** if the team’s building matches, or a **signal-red X** if it does not. Shared copy is either **The team got it** (exact match of all 4) or **Not this time**. Misses also show the team’s chosen name under the true building. No per-person names — group victory or not.
7. Session Lead, after **each** team reveal (including the first): **Another round** (next team round, *k*=4) or **Wrap things up** (recap). No fixed team-round count. If fewer than 4 legal lots remain (or the pack cannot deal 4 more buildings), **Another round** is hidden and the session advances to wrap / recap.

### 5.5 Lettering lots

Letters are **not** the order the planner tapped.

On lot-lock, sort the selected cells **top-to-bottom, then left-to-right** (`row` ascending, then `col` ascending). Assign `A`, `B`, `C` (then `D` in team play) in that order.

The shared map paints the letter in the cell. That identity is stable for the rest of the round.

### 5.6 What “exact match” means

For lots `{A,B,C}` (or `{A,B,C,D}`) and buildings placed by the Zoning Manager as a function `z(letter) → buildingId`:

A guess `g` matches if and only if `g(letter) = z(letter)` for every letter. Order of dragging does not matter. Empty letters do not match.

Random baseline: 3! = 6 permutations individual; 4! = 24 in team play.

### 5.7 Persistent play instruction

Visible on every play screen for the whole session, not only in the lobby:

**Individual guesser:**

> Match the Zoning Manager exactly. All lots, or it does not count. Read the map on the shared screen.

**City Planner (lot pick):**

> Pick the next 3 lots to develop — then the Zoning Manager will place 3 buildings.

(Team lot pick uses 4 in both places. Plus live count: “Select *k* lots. *n* of *k* chosen.”)

**Zoning Manager (while assigning):**

> Tap the building you want to place, then tap the lot. Tap the name under a lot to take a building back.

If the session Lead is also this round’s Zoning Manager, add:

> Unshare your screen and make your selections in private.

Drag-and-drop may still work; do not mention it.

**Zoning Manager (after lock, until guesses / team timer are in):**

> Camera off. Mute yourself. Come back when everyone has locked in.

(Team discuss: **Come back when the two-minute timer ends.**)

**Zoning Manager (reveal):**

> You can come back on camera and unmute.

**Waiting on City Planner (everyone who is not picking lots):**

> Waiting on [City Planner name] to pick the lots.

**Waiting on Zoning Manager (everyone who is not the ZM, during assign):**

> Waiting on [Zoning Manager name] to zone the lots.

**Team intro:**

> There are now 4 buildings at a time. Only one person (the Lead Developer) will choose for the team.

**Team discuss (members, not LD):**

> Discuss as a team. Zoning Manager is off camera — no hints. You can see the same map as [Lead Developer name]. Only they can place.

**Team discuss (Lead Developer):**

> Place the team's four buildings on the map while you discuss. When the two-minute timer ends, whatever is on the map is the team's guess.

Do **not** show “No searching. No chat.” on play screens. These are not deterministic trivia questions.

### 5.8 Facilitator / shared screen vs phones

| Surface | Shows |
|---|---|
| Shared laptop (facilitator screen) | Full 5×7 map; occupied buildings; round 1 checkbox picker; later rounds’ live lot picks; lettered lots; building **names** once the Zoning Manager has locked; timer when guessing or discussing; **live Lead Developer placement** during `TEAM_DISCUSS`; reveal layout; names who got it / team result; join QR in lobby |
| City Planner phone | Round 1: no picker (facilitator screen only). Later rounds: map + checkboxes. After lock, same as a guesser (individual) or discuss/watch (team) |
| Zoning Manager phone | Map + building tray during assign (drag onto lettered lots); after lock, off-camera / mute prompt until reveal. Never their permutation on the shared map until reveal. Never other people’s **individual** guesses |
| Guesser phone | Map + building tray during individual guess; tap onto lettered lots |
| Lead Developer phone | Interactive map + building tray during `TEAM_DISCUSS` |
| Other players (not ZM, not LD) | Same map + remaining building list as the Lead Developer, **view-only** |
| Session Lead chrome | Locked-in counts, Continue / Another round / Move to team play / Wrap things up. Team tray is view-only unless the Lead is also this round’s Lead Developer. **No** skip-planner button. |

The Zoning Manager **must not** share their phone screen. After they lock, they go **off camera and mute** until the room has locked in (individual guesses) or the two-minute team timer ends. Honor system — the app cannot control the video call. If they are sharing the laptop map as session Lead, that share stays; the webcam tile and mic go off.

If the session Lead is Zoning Manager, the **shared map must stay letter-only** until reveal. Their private tray stays on the phone they are not projecting. Webcam off, mic muted; laptop map share stays up.

---

## 6. Role rotation and dealing

### 6.1 City Planner

| Round | City Planner |
|---|---|
| Individual 1 | Session Lead (facilitator) |
| Every later round (individual or team) | Previous round’s Zoning Manager |

If that participant has disconnected, fall back to the session Lead for that round’s lot pick only. They are still “City Planner” in the UI. If that fallback is individual round 1’s equivalent (Lead picking), use the facilitator screen only.

### 6.2 Zoning Manager eligibility

Chosen **when the round starts** (planner is already known), from **connected** participants, so the role strip can name them while lots are being picked. Buildings are still dealt at lot lock. If presence flags are empty, use the whole roster (see fallback above).

1. Exclude the current City Planner.
2. Exclude anyone who has already been Zoning Manager this sitting, **until everyone eligible has had a turn**. Then the exclusion set resets (still excluding the current planner).
3. Draw uniformly at random from the remainder.

The facilitator is in the pool. The City Planner is never Zoning Manager in the same round. **A participant holds at most one of City Planner / Zoning Manager / Lead Developer in a given round.** (The planner still guesses in individual play when they are not ZM — guessing is not a named exclusive role.)

If only one connected non-planner exists, they are Zoning Manager and the guesser set may be empty except the planner — legal at the start floor of 3 if someone dropped; a round with **zero guessers** still runs (ZM assigns, 60s may auto-close immediately, reveal shows no names). Prefer not to Start below 3 so this is a disconnect path, not the design.

If **nobody** on the roster is marked `connected` (presence is not always wired — same fallback as Talk Track), treat the whole roster as present for this pick. Never fail lot-lock solely because presence flags are empty.

### 6.3 Buildings

At **Start**: draw four for the opening cross; mark consumed.

Dealt at each Zoning Manager start: *k* unique remaining `active` buildings from the session’s `content_pack_id`. Consumed even if the round is later abandoned.

If fewer than *k* remain, the Lead cannot start that round. Individual extras disable; if this happens before team play, **Move to team play** stays available only if 12 buildings remain for three team rounds — otherwise Lead is forced to the recap (pack exhaustion). Pack A has 121 names; starvation is not the design case.

### 6.4 Lead Developer eligibility

Role exists **only in team play**. Chosen when the Zoning Manager locks (start of `TEAM_DISCUSS`), from **connected** participants (same empty-presence fallback as §6.2):

1. Exclude the current Zoning Manager.
2. Exclude the current City Planner (exclusive named roles — §6.2).
3. Exclude anyone who has already been Lead Developer this sitting, **until everyone eligible has had a turn**. Then the exclusion set resets (still excluding the current ZM and planner).
4. Draw uniformly at random from the remainder.

The facilitator **may** be Lead Developer only when they are neither this round’s City Planner nor Zoning Manager. The Zoning Manager never is, in the same round.

If the Lead Developer disconnects before T=0, re-roll from remaining eligible (not the ZM, not the planner). In-progress public placement is discarded; the new Lead Developer starts from an empty tray.

---

## 7. Scoring

Score is a recap. Do not run a live leaderboard. Do not award the Zoning Manager points for being read or unread.

### 7.1 Individual

- Exact match: that guesser is listed on the reveal. That is the victory.
- Incomplete or wrong: not listed. No per-lot credit.
- Recap may show a count of exact matches per person (rounds they guessed only). No ranking chrome, no “winner” label.

### 7.2 Team play

- One team guess per round. Exact match: **The team got it.** Else **Not this time.**
- Group victory. No individual +1s in team play.

### 7.3 Recap screen (end of protocol, before NPS)

Bucket layout:

1. **Individual rounds** — display names with exact-match counts (exclude rounds they were Zoning Manager). No highlight reel.
2. **Team play** — `h of n` group hits (`n` = team rounds actually played). No reflection questions on this screen.

Worked example (6 people, 3 individual rounds, 3 team):

- Round 1: Lead plans; Ana is ZM; Bo and Deb listed on reveal.
- Round 2: Ana plans; Cam is ZM; nobody listed.
- Round 3: Cam plans; Bo is ZM; Ana and Lead listed.
- Team rounds: hit, miss, hit → team 2 of 3.
- Recap: Deb 1, Bo 1, Ana 1, Lead 1, Cam 0, Ed 0. Team play 2/3. No crown.
- Recap does **not** show reflection questions. Those belong on the standard reflection screen after NPS.

### 7.4 Tie-breaking

None.

---

## 8. State machine

```
LOBBY
  → IND_PLANNER_PICK → IND_ZM_ASSIGN → IND_GUESS → IND_REVEAL
       ↑__________________________________________|
       |  (rounds 1–2 required before team play is offered; Continue may run round 3;
       |   then Another round loops here)
       |
       └── Move to team play (facilitator, after round 2+) →
             TEAM_INTRO (untimed; Lead Continue)
               → TEAM_PLANNER_PICK → TEAM_ZM_ASSIGN → TEAM_DISCUSS (120s; LD places live)
                 → TEAM_REVEAL
                    ↑______________________|  (Another round, or Wrap)
               → SCOREBOARD → NPS → REFLECTION
```

| Phase | Who acts | Timer | Advance |
|---|---|---|---|
| `LOBBY` | Join; Lead Start at ≥3 | none | Lead Start (also draws opening cross) |
| `IND_PLANNER_PICK` | City Planner (round 1: facilitator screen only) | none | Planner locks *k*=3 lots |
| `IND_ZM_ASSIGN` | Zoning Manager | none | ZM locks permutation |
| `IND_GUESS` | Each non-ZM. ZM is off camera / mute (prompt) | **60s** | All guessers locked, or server timer |
| `IND_REVEAL` | Session Lead | none | Continue / Another round / Move to team play |
| `TEAM_INTRO` | Everyone reads; session Lead continues | none | Lead Continue |
| `TEAM_PLANNER_PICK` | City Planner | none | Planner locks *k*=4 lots |
| `TEAM_ZM_ASSIGN` | Zoning Manager | none | ZM locks permutation; engine picks Lead Developer |
| `TEAM_DISCUSS` | Room talks except ZM (off camera / mute); Lead Developer places live on the map | **120s** | Server timer, or Lead Developer **Lock it in** once all four are placed |
| `TEAM_REVEAL` | Session Lead | none | Another round, or Wrap things up |
| `SCOREBOARD` | Session Lead Continue | none | Existing NPS route |
| NPS / reflection | Platform | — | Standard Season path |

Progress bar: expected total = 3 individual + intro + 3 team, counting each round as one unit after lobby. Extra individual rounds do not grow the denominator; the bar may sit full through extras until team play (same pattern as Talk Track extra cycles).

---

## 9. UI notes (mobile-first)

Protocol label: `font-mono uppercase tracking-widest text-[10px]` — `ZONING RIGHTS`.

### 9.0 Role strip (every play screen in a round)

Under the protocol label, a persistent **outlined** pair (or trio in team play) of role chips for the current round:

| Chip | When |
|---|---|
| **City Planner** + display name | From round start through that round’s reveal |
| **Zoning Manager** + display name | Same — assigned at round start |
| **Lead Developer** + display name | Team play only, once that role is chosen |

Navy border, `warm-white` fill, mono role label, `font-display` name. Waiting copy for the current actor sits directly under the strip (see §5.7). Do not hide the Zoning Manager chip during lot pick.

### 9.1 Map (shared + later-round planner)

- Portrait grid, cells as squares, generous gap, `cloud-grey` borders.
- City Hall: navy fill, `CITY HALL` in `font-mono` tiny caps, two-line wrap (`CITY` / `HALL`).
- Occupied buildings: tile face with name, **two-line wrap** allowed, `font-display` condensed. Opening-cross tiles use the same face as later buildings (they are the same deck).
- Legal empty lot during pick: **2px dashed navy**, cloud-grey wash, empty checkbox. Selected: 2px solid navy + checked box. Copy: pick *k* lots, *n* of *k* chosen.
- `TEAM_DISCUSS` in-progress: building face on the lettered cell as soon as the Lead Developer places it; rearranges live. Not amber fill.
- Amber is **not** a cell fill.

### 9.2 UI states (tiles and lots)

| State | Treatment |
|---|---|
| Empty legal lot | `warm-white` / cloud-grey wash, **2px dashed navy**, empty checkbox |
| Selected lot (planner, unlocked) | `warm-white`, 2px solid navy, check glyph |
| Lettered lot, no building yet | Letter centered, 2px solid navy |
| Building in tray | `warm-white`, 1px navy @ 20%, name |
| Building on a letter (unlocked) | Same tile, letter chip on the zone, 2px navy |
| Locked (personal or ZM) | Tile + letter; input disabled; opacity unchanged (do not grey out the map) |
| Team discuss in progress (public) | Building on the shared map cell; still movable by Lead Developer until T=0 |
| Reveal true | Building painted on the shared map cell |
| Team reveal lot | True building + large sunrise-gold check if the team matched that letter; signal-red X if not |
| Exact-match names | `font-display` names under a `GOT IT` mono label |

States are fill + border weight + glyph, not color-only.

### 9.3 Tray interaction

Primary: **click-and-hold / drag** a building from the tray onto a **lettered lot on the city map**. Swap if occupied. Placement paints immediately on the acting device.

Required fallback (phones, reduced motion): **tap building, then tap the lettered lot**. Tap a placed building on the map to return it to the tray.

There is no separate A/B/C drop-zone row. The map is the drop target.

Lock in: disabled / hidden until all *k* zones filled; then amber **Lock in**. Team play has no Lock-in-the-team button; T=0 commits.

### 9.4 Timer presentation

Follow moment-conventions §3 (`WaoPlayTimer`):

| Phase | Duration | Treatment |
|---|---|---|
| `IND_GUESS` | 60s | Arc; amber pulse final ~15s; 3-2-1 in final ~3s; then lock |
| `TEAM_INTRO` | — | No timer. Facilitator Continue. |
| `TEAM_DISCUSS` | 120s | Arc; urgency in last 15s; T=0 commits the live team placement |
| Planner / ZM assign / reveal | — | No timer |

**Server-authoritative.** Client arcs are display. Phase changes come from server timestamps / Lead or Lead Developer actions.

Urgent threshold 15s, numeric threshold 3s, no WAO-style 3s tap-settle (permutation is already persisted per client on each drag; lock or T=0 snapshots server state).

`TEAM_DISCUSS` live placement **is** realtime public state. Optimistic local → server write → ack. Retry twice, then non-blocking warning. Server truth at T=0.

### 9.5 Buttons

- Lock lots / Lock in: grey (unavailable) → **amber** when the precondition is met.
- Session Lead Continue: amber.
- Another round: navy.
- Move to team play: navy when Continue is also on screen (after round 2); amber after individual round 3+ (the mode switch is the one action on that screen; Another round is secondary navy).

### 9.6 Cards / chrome

Play cards: `warm-white`, `cloud-grey` border, `rounded-lg`, `p-6` minimum. Session Lead panel: `FACILITATOR` mono label. Lead Developer phone: `LEAD DEVELOPER` mono label during `TEAM_DISCUSS`.

---

## 10. Roles and visibility

| Role | Device | What they see | What they must NOT see |
|---|---|---|---|
| Session Lead (facilitator) | Phone + laptop | Map on laptop; round 1 lot picker on that laptop; Lead chrome; lock counts; public board state; live team lock on the laptop | Other participants’ in-flight **individual** guesses; ZM permutation until reveal (unless Lead **is** the ZM — then phone only, never the shared laptop until reveal) |
| City Planner | Phone (not round 1) | Checkbox map during later lot picks | ZM permutation until reveal |
| Zoning Manager | Phone | Dealt buildings; letter zones; after lock, off-camera / mute prompt until reveal | Anyone’s individual guess; do not mirror their permutation onto the shared map until reveal |
| Guesser | Phone | Building names + letter tray during individual guess; true layout at reveal; names who matched | ZM permutation before reveal; other individual guesses |
| Lead Developer | Phone | Interactive A–D tray during discuss; own placement mirrored on the shared map and on every other non-ZM phone | ZM permutation before reveal |
| Other players (not ZM) | Phone | Same map + remaining building list as the Lead Developer, view-only | Cannot place, return, or lock; ZM permutation before reveal |
| Shared laptop | — | Public map, letters, name list, timer, live team placement, reveal | Any secret ZM permutation before reveal; personal individual trays |

---

## 11. Edge cases

| Situation | Rule |
|---|---|
| Disconnect during lot pick | If planner gone: session Lead becomes City Planner for that pick (§6.1). No skip-planner button. Does not steal ZM. |
| Disconnect during ZM assign, before lock | Re-roll Zoning Manager from remaining eligible; **same *k* buildings** stay (already dealt). If no one left, abandon round, buildings stay consumed. |
| Disconnect during ZM assign, after lock | Keep the permutation. Round continues. Re-roll Lead Developer if that pick had landed on the dropped ZM (it cannot — ZM is excluded). |
| Disconnect during guess | Their guess is whatever was last persisted; incomplete ≠ match. Do not block the round. |
| Lead Developer disconnect before team commit | Re-roll LD. Discard in-progress public tray. |
| Timer expiry, zero complete guesses | Reveal still shows the true layout. Name list empty. |
| Guesser locks then wants to edit | No. Lock is final. |
| Planner selects 3, unselects, selects others | Allowed until **Lock lots**. |
| Legal lot set empty (board full) | Cannot start another round. Force recap. Unlikely with Pack A sizing. |
| Minimum players not met in lobby | Start disabled. Copy: “Need 3 to start.” |
| Headcount drops below 3 after Start | Continue with whoever is connected; empty guesser set is allowed. |
| Lead end-early | Session Lead may **End session** from reveal screens (confirm). Recap with rounds played, then NPS → reflection. |
| Late join | Closed after Start. |
| Double-submit lock | Idempotent. First valid lock wins for that participant. |
| Session Lead is ZM and laptop is shared | Server still sends permutation only to the ZM participant payload, never to the public play channel. Webcam off, mic muted; map share stays. |
| ZM ignores off-camera prompt | Honor system. No engine penalty. Facilitator may remind. |
| Session Lead is not Lead Developer | They cannot write the team placement. Continue after reveal remains Lead-only. |

---

## 12. Authorization boundary

The Zoning Manager permutation is Draw It By Ear’s image / Talk Track’s card words.

Every Zoning Rights route that uses a service-role client must, before touching it:

1. Verify caller participant identity from the cookie.
2. Confirm that participant belongs to the session.
3. For play-state reads: strip `zm_assignment` (and any equivalent) unless the caller **is** the current Zoning Manager **or** the phase is `IND_REVEAL` / `TEAM_REVEAL` or later.
4. Lot-lock: caller must be the current City Planner, or session Lead using the skip-planner control. Round 1 lot-lock: session Lead only.
5. ZM lock: caller must be the current Zoning Manager.
6. Guess writes: caller must be a guesser this round (not the ZM). Individual play only.
7. Team-guess writes (live in-progress placement): caller must be the current **Lead Developer**; phase must be `TEAM_DISCUSS` (legacy `TEAM_LOCK` rows may still accept writes).
8. Continue / Another round / Move to team play / End: session Lead.

Do **not** put `zm_assignment` on a Realtime channel subscribed by the whole session until reveal.

`team_guess` in `TEAM_DISCUSS` **is** public Realtime — that is the room watching the Lead Developer.

Acceptance bar includes a network-tab test: a guesser’s client never contains the live `zm_assignment`.

Optimistic tray edits may be local until lock; **server truth at lock and at T=0**. Retry twice on guess-sync failure, then non-blocking warning. Do not block the room on one phone.

---

## 13. Facilitator script beats

1. Phones in hand. Faces on the laptop. The **map is on this screen** — don’t hunt for it on your phone.
2. Round 1: “I’m picking the next three lots up here. Then one of you will zone them in secret. You will try to guess that person, not the ‘right’ city.”
3. Zoning Manager: “Don’t share your phone. After you lock, camera off and mute until everyone has chosen. Then come back.”
4. Before first guess: “Exact match — all three. You have a minute. Lock in if you’re sure.”
5. After round 2: “One more individual round, or we zone as a team?”
6. Team intro: read the 4-buildings / Lead Developer note. Facilitator continues when the room is ready. No timer.
7. Team discuss: “Two minutes. Everyone talks except the Zoning Manager — they are off camera. [Lead Developer name] is putting A through D on this screen while we talk. When time is up, that is the team’s guess.”
8. After wrap: recap, then NPS, then the two reflection questions.

Lead-only metrics: round index (individual *n* / team *n* of 3), current planner name, current ZM name, current Lead Developer name (team), `locked-in / guessers`, buildings remaining.

---

## 14. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | 121 buildings, list below. Opening cross = four random draws from this same list |
| Intra-session uniqueness | No building used twice in a sitting (opening cross counts). That is not a pack. |
| Engine | Load only through `sessions.content_pack_id` |

When this protocol ships, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §7.4.2. Do not do that until the engine exists.

**Capacity:** 4 opening + 3×3 individual = 13, plus extras, plus 3×4 team = 12. 121 is surplus on purpose.

### 14.1 Building shape

```ts
type ZoningRightsBuilding = {
  id: string;
  content_pack_id: string;
  name: string;
  active: boolean;
};
```

No `kind` in v1. Types are not mechanical. Provocative names are intentional — they are the judgment the Zoning Manager is making.

### 14.2 Pack A names (121)

Seed these as `active` rows. Display strings are exact.

Post Office, Castle, School, Nightclub, Hot Dog Stand, Stadium, Bookstore, Haunted Mansion, Safe Injection Site, Opera, French Restaurant, Rage Room, Tax Service Center, Buddhist Temple, Exhibition Center, Chocolate Factory, Excavation Site, Casino, Aquarium, Graffiti Tunnel, Medieval Tavern, Bakery, Printing Shop, Organic Supermarket, Dry Cleaner, Gas Station, Distillery, Outlet Mall, Pharmacy, College, Community Garden, Camp Ground, Dog Park, Yoga Retreat, Bus Terminal, Family Resource Center, Bank, Job Center, Coffee, Drive Through, Mini Golf, Visitor Center, Thrift Shop, Board Game Cafe, Five Star Hotel, Barbershop, Gym, Mermaid Pond, Library, Skyscraper, Public Toilets, Coal Mine, Local Newspaper, Condominiums, Comedy Club, Famous Statue, Botanical Garden, Public Housing, Daycare, Fancy Spa, Youth Hostel, Hourly Motel, Dive Bar, Animal Shelter, Cemetery, Retirement Home, Skate Park, Candy Shop, Recycling Center, Alien Abduction Site, Synagogue, Chinese Buffet, Police Station, Tattoo Parlor, Business School, Playground, Co-working Space, Mental Health Clinic, Community Center, Courthouse, Karaoke Bar, Arcade, Massage Parlor, Circus Park, Art Gallery, Movie Theatre, Farmers Market, Prison, Production Studio, Doomsday Bunker, Baseball Field, Jewelry Boutique, Robot Factory, Celebrity Residence, Fire Station, Modeling Agency, Military Museum, Gated Community, Mosque, Main Square, Consulate, Observatory, Soap Factory, 5G Cell Tower, Boxing Arena, Alcoholics Anonymous, Fish Shop, Garage Sale, Train Station, Catacombs, Ice Cream Truck, Hospital, Swimming Pool, Pottery Studio, Hardware Store, Research Lab, Church, Intelligence Agency, Cattle Ranch, Amusement Park, Nuclear Plant.

### 14.3 Authoring rules

- Unique within the pack.
- Two-line wrap in a cell is allowed. Do not silently rename to shorten.
- Keep authored spelling (`Movie Theatre`, `Camp Ground`, `Coffee`).
- No real client names, no real addresses.
- Do not require prior *Link City* knowledge.
- Lobby explainer must not use these 121 names.

---

## 15. Data model (protocol-specific)

Platform `sessions` + `session_participants` unchanged. Secrets do **not** live in `sessions.state_json` if that column is open RLS — follow Cover Story: service-role tables for permutation and guesses.

```
zoning_rights_buildings
  id, content_pack_id, name, active, created_at

zoning_rights_sessions
  session_id,
  phase,
  mode (individual | team),
  individual_round_index,  -- 1-based, includes extras
  team_round_index,        -- 0 until team play; then 1–3
  board_json,              -- 5×7 occupancy: hall, opening four, placed buildings
  created_at

zoning_rights_rounds
  id, session_id,
  mode, round_index,
  planner_id, zm_id, lead_developer_id,  -- lead_developer_id null in individual
  k,
  lots_json,               -- [{letter, col, row}]
  building_ids[],          -- dealt, length k
  zm_assignment_json,      -- letter → building_id; null until ZM lock
  team_guess_json,         -- letter → building_id; public in TEAM_DISCUSS
  guess_started_at, discuss_started_at, intro_started_at,
  ended_at, end_reason

zoning_rights_guesses
  id, round_id, participant_id,
  assignment_json,         -- letter → building_id
  locked_at,
  is_exact
```

`board_json` is public. `zm_assignment_json` is secret until reveal. Individual guesses are secret until reveal and **are not broadcast** even then (only `is_exact` names). `team_guess_json` is public during `TEAM_DISCUSS`.

---

## 16. Session end flow

```
Last team reveal → protocol recap (§7.3). Facilitator Continue advances **everyone** to NPS (`/session/[id]/feedback`). Completing NPS sends that person to reflection (`/session/[id]/reflection`).
```

Reflection is the final screen. Do not park on NPS thank-you.

NPS is the platform feedback step (1–10 + optional comment). This spec uses that existing path.

---

## 17. Locked decisions

| Topic | Locked as |
|---|---|
| Grid | 5 columns × 7 rows, portrait; Hall always at (2,3) |
| Opening four | Random from the **same** Pack A building deck; N/E/S/W; consumed; context only |
| Adjacency | Orthogonal only |
| Opening checkboxes | The eight legal lots in §4.3; later rounds = all current legal lots |
| *k* | 3 individual, 4 team |
| First planner | Facilitator, **facilitator screen only** |
| Later planner | Previous Zoning Manager; picker on their phone + shared map |
| ZM pick | At **round start**, not lot lock. Random, no repeat until the rest of the room has been ZM; never the current planner. If nobody is flagged connected, use the full roster. Planner / ZM / Lead Developer are exclusive in a round. |
| Lead Developer | Team play only; random each team round; exclude current ZM **and** current planner; no repeat until pool exhausted; public live placement on the shared map |
| Facilitator | Plays; is not automatically the team locker |
| Map on phones | Round 1 pick: facilitator screen only. Later planner: yes. ZM / guesser / Lead Developer: **map + tray**, drag onto lettered lots |
| Lettering | Top-to-bottom, then left-to-right |
| Match | Exact permutation; no partial credit; wrong individual guesses not shown |
| ZM after lock | Prompt: camera off + mute until the room has locked in; honor system; come back at reveal. If ZM is session Lead, keep map share, kill webcam + mic |
| Planner / ZM clocks | None |
| Guesser clock | 60s; early lock if tray full; close early if all guessers locked |
| Extra individual | Allowed after 3; unlimited until pack starve |
| Early team play | Allowed after 2 individual rounds (facilitator only). Not after round 1. |
| Team intro | Untimed note (4 buildings, Lead Developer chooses). Facilitator Continue. Skip on later team rounds. |
| Team discuss | 120s; Lead Developer places live; everyone except ZM talks |
| Team commit | T=0 of discuss; current map is the team's guess; incomplete ≠ match |
| Team round count | After the first team reveal, facilitator chooses **Another round** or **Wrap things up**. No fixed 3. |
| Scoring | Recap only. Individual names on reveal. Group hit/miss in team. ZM never scores |
| Buildings stay | Yes; city grows |
| Late join | Closed after Start |
| Start floor / cap | 3 / 20 |
| Pack | Required. **Single deck.** Pack A = 121 names in §14.2. Opening four are drawn from it |
| End path | Recap → NPS → reflection |
| Explainer | Coded lobby loop, **individual play only**, **fixed panel size** every beat; video file optional later |
| Building types | None in v1 |

---

## 18. Reflection close

Standard Season prompts, ninety seconds each, display-only:

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

**Facilitator prompt if the room is quiet:**

*“Who did you think you could read — and you couldn’t? When we moved to team play, did the room actually agree, or did the loudest zoning theory win?”*

---

## 19. Degraded fallback

Write this into facilitator notes before the first live run. Do not improvise it.

1. Print or sketch a 5×7 grid. Mark Hall in the center. Draw four building names from a hat onto N/E/S/W.
2. Remaining names in a cup. Sticky notes for lots.
3. Facilitator marks three legal adjacent lots on the shared sketch, labels A/B/C top-to-bottom then left-to-right.
4. Draw three names for the Zoning Manager. They write A/B/C on a folded slip. Facilitator holds it. Zoning Manager turns camera off and mutes until guesses are in (or leaves the camera frame in the room).
5. Everyone else writes A/B/C on paper in 60 seconds (phone timer, visible).
6. Reveal the slip. Stand up if you matched all three.
7. Zoning Manager becomes planner. Repeat twice more.
8. Team play: four lots, four names, two minutes of talk except the Zoning Manager (camera off). Randomly pick a Lead Developer; they place the team slip on the map during the two minutes; the timer is the lock; then the Zoning Manager comes back. Reveal. Repeat until wrap.
9. Two reflection questions. No app.

What is lost: private phones, lock-in counts, pack uniqueness enforcement. The payload still runs.

---

## 20. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain A/B/C vs the shared map.
2. Self-service QR join works without assistance.
3. Guesser network tab during `IND_ZM_ASSIGN` and `IND_GUESS` never contains `zm_assignment`. After reveal, it may.
4. Headcounts 3, 8, 20: Start gate at 3; ZM never equals planner; ZM rotation does not repeat until the pool is exhausted.
5. Opening board has eight checkboxes on the **facilitator screen** in round 1; member phones have no checkboxes. After round 1 lock+reveal, checkbox count equals the new legal-lot set (not still eight).
6. Start consumes four distinct Pack A buildings onto N/E/S/W; those four never appear in a later deal.
7. Team discuss: only the current Lead Developer can persist the public team guess; session Lead cannot place unless they are LD. T=0 commits whatever is on the map.
8. `TEAM_DISCUSS` placement is visible on the shared map **and** on inactive player phones (same map + remaining list, not interactive) before T=0; ZM assignment is still absent from other clients.
9. Throttled-network: double Lock in does not fork two permutations; T=0 snapshot matches last persisted tray.
10. Disconnect: ZM drop before lock re-rolls; LD drop re-rolls; guesser drop does not stall reveal.
11. Degraded fallback in the facilitator notes.
12. RLS / route checks: participant A cannot read participant B’s individual guess row.
13. After ZM lock, that participant’s phone shows the off-camera / mute prompt, not a guess tray; at reveal it tells them they can come back.

---

## 21. Conservative leftovers

Conversation resolved the open questions from the previous draft. These are recorded so build does not invent:

| Topic | Conservative lock |
|---|---|
| Honor-system hints | Copy + script only. No “void this round” control in v1. Off-camera / mute is the same: prompt, not call control |
| Explainer video file | Coded loop, four beats, fixed-size panel. A `/public` video may be added later without a mechanics change |
| Role strip | Planner + ZM named at round start on every device; waiting copy names who the room is waiting on |
| Lead Developer announced | At ZM lock / start of discuss, not hidden until T=0 |
| Recap counts | Quiet counts, no winner chrome |

---

## 22. Build sequence

One step at a time. Each independently testable.

1. Schema + migrations. Pack A id. Seed all 121 buildings. Start draws opening cross onto Hall’s N/E/S/W.
2. Legal-lot computation + lettering (unit tests for the opening eight and a post-round-1 set).
3. Lobby explainer (fake names only) + Start gate at 3.
4. Role-filtered play payload (ZM assignment strip). Load-bearing security step — do not defer.
5. Round 1 planner on facilitator screen only + lock lots.
6. Later-round planner phone picker.
7. ZM deal + tray drag/tap + lock.
8. 60s guess + per-person lock + reveal names.
9. Rotation: planner = previous ZM; ZM fairness pool.
10. Extra individual + Move to team play.
11. Team intro (untimed note), discuss 120s with live Lead Developer placement *k*=4, T=0 commits, then Another round or Wrap.
12. Recap → existing NPS → existing reflection. Facilitator prompt only.
13. Disconnect rules in §11.

---

## Spec checklist

- [x] § Lobby explainer — beat list + sample data
- [x] § Device context — phone + laptop video
- [x] § UI states — shape/weight table
- [x] § Timer — durations and presentation thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats
- [x] § Session end flow — recap → NPS → reflection
- [x] § Reflection — standard prompts + facilitator prompt
- [x] § Degraded fallback
- [x] § Acceptance bar
- [x] § Authorization boundary
- [x] § Content pack — required, Pack A = 121 buildings
- [x] § Build sequence
- [x] Mechanics locked for v1
