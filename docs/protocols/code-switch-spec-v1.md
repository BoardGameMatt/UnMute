# SwitchCode — Protocol Spec v1

**Status:** Build spec, locked for v1  
**Slug:** `code-switch`  
**Type:** Real-time (simultaneous blind clue write; server-authoritative clocks; facilitator-paced rounds)  
**Players:** 4–20 (optimal 6–12). Facilitator is a player.  
**Envelope:** ~12–20 minutes at optimal headcount. Lead-gated rounds; recommend one full guesser rotation, then ask.  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is the 53-word library in §16.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Decisions from the spec conversation are in §18. Where this document needed a call the conversation did not make, the conservative option is recorded in place and in §21. Do not invent further mechanics at build time.

Own module: `app-platform/lib/protocols/code-switch/`, own `registerProtocol()` entry. Not a mode of Talk Track.

Surface inspiration: silent one-word clues with a duplicate filter, in the family of *Just One* / Codenames house rules. The Unmute payload is not “got the word.” It is whether a team can coordinate **without a channel**, under a code the guesser is not allowed to know.

---

## 1. What this Moment is

Each round, one person is the **guesser**. Everyone else is a **clue giver**. The clue givers see the same secret word and write **one English word**, in secret, at the same time. They cannot see each other’s clues. A server filter then decides which clues the guesser is allowed to see. The guesser types one guess on their phone. The team scores only if that guess is the word.

There are two filters. The server picks one at random each round:

- **Assemble** (`shared`) — a clue reaches the guesser only if at least two people wrote it. Label: **ASSEMBLE.** Rule: *Only clues provided by more than one participant will be shown to the guesser.*
- **Disperse** (`unique`) — a clue reaches the guesser only if exactly one person wrote it. Label: **DISPERSE.** Rule: *Only clues which are unique among participants will be shown to the guesser.*

Clue givers see which filter is running **before** they write. The guesser does not — not during the round, not after, not on the shared screen. They see a filtered list (sometimes empty) and type one word.

**The word is the surface. The payload is coordinating without a channel, under an unknown code.** Assemble asks whether the room independently converged. Disperse asks whether the room independently differentiated. The guesser is playing both games at once.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who assumes colleagues will think like them, who over-fits, who stays silent when the board comes back empty.

**What gets revealed about a person:** whether they write the obvious clue or a sideways one; whether they can hold a secret about *how* the round works, not only *what* the word is; whether the room can get a guesser home without talking.

---

## 2. Players, join, device

- **Start floor: 4.** One guesser + three clue givers. Shared is plausible at 3 clue givers. Below 4, Start stays disabled. Copy: “Need 4 to start.”
- **Cap: 20.**
- **Optimal: 6–12.** Below 6, Shared is tight. Above 12, Unique boards get long; the Lead wraps after a full guesser rotation rather than “finishing the pack.”
- **The facilitator is a player.** They write clues and rotate as guesser. They also get Lead-only chrome (Start, Another round, End). They are **one roster identity**, not two joins. A dummy “Room Display” join would pollute guesser rotation.
- No auth. Lobby: display name. Same 6-character join code as every Moment.
- **Phone is the primary controller; desktop works but is not optimized.** Video call stays on the laptop. The **shared laptop is the room display** (QR, then the public board). Phones carry private roles — same split as I Know What You Meme’s “pick on your phone / GIF on this screen” and Zoning Rights’ map-on-laptop / tray-on-phone.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.

### 2.1 Room display pin (Lead laptop)

Same participant cookie on laptop and phone would otherwise paint the secret word on the projector the moment the Lead is a clue giver. I Know What You Meme solves the equivalent leak with copy plus a collection view that never mounts the Lead’s Giphy grid on the laptop. SwitchCode needs the same split, and a **sticky pin**, because the secret is the target word itself.

- In lobby, the session Lead’s laptop shows **This is the shared screen** (navy / ghost). Toggling it pins `localStorage` for this `sessionId` on that browser.
- A pinned browser **only ever mounts the public board** (§9.3). It never receives `word` or `roundType` in its play payload.
- The Lead’s phone (unpinned) is the personal console: clue input or guess field, plus `FACILITATOR` chrome.
- Copy on the Lead laptop until pinned, and again under their personal console: **Pick on your phone. Leave this laptop on the shared screen.** (Same sentence as I Know What You Meme §4.1.)
- Start does **not** block on the pin. Facilitator script names it. If they forget, the room-display payload is still stripped; the risk is they share the *phone* tab by mistake.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~25–30s, looping), same convention as Talk Track, Wrong Answers Only, and I Know What You Meme. `useReducedMotion()` → static stacked panels. **Beat dots** under the stage (`LobbyExplainerDots`, five dots).

**No sample words or clues.** The lobby laptop is the room display for the whole sitting. The explainer must never show a target word, a clue string, or a fake filtered board — even obviously-fake Pack-A-adjacent samples (`MUSTARD`, `condiment`, `spicy`, …). Teach with empty fields, role chips, and Assemble / Disperse **labels** only.

v1 **does** teach both clue-phase types. The secret is which type is running *this round*, not that two types exist. Name Assemble vs Disperse in the loop, and say outright that the guesser is not told which one it is. Clue givers still see the live type on their phones during write. Guesser phones and the room display never name the type during play.

If a hosted video file is supplied later under `/public`, it may replace or sit above the loop. v1 does not block on a video file. A video, if used, must cover the same beats and must also show **no** target word or clue string.

The looping panel is **one fixed size for every beat** (CSS grid overlap so the stage is as tall as the tallest beat). Do not grow/shrink the shell as captions change.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | To join, scan the QR with your phone. Play on your phone. Leave the laptop on the shared screen so nobody sees your clue. | Phone + laptop. QR lives in the lobby chrome beside this loop. **No word. No clue.** |
| 2 | One player is chosen randomly as the Guesser. Every other player will provide a single word clue to help the guesser figure out the secret word. Clue givers cannot collaborate and must provide their clue independently. | One chip labelled guessing; other chips as clue givers; an **empty** one-word field. |
| 3 | The catch is that only some of the clues will be shown to the guesser. On Assemble rounds, only duplicated clues are shown to the guesser. On Disperse rounds, only unique clues are shown to the guesser. | Two labelled cards: `ASSEMBLE` and `DISPERSE`. No example clue strings. |
| 4 | The guesser does not know what kind of round it is. They only get one guess. All clue givers must stay silent. | Guesser chrome with a one-guess field; no Assemble / Disperse badge; no clue tiles with words. |
| 5 | The whole team scores when the guesser figures out the secret word. When the game is over, you will see which members of the team got their clues through the most. | Team-score treatment and a “shown the most” strip with display names only. No target word. |

**Sample data:** none. Role chips may use fake display names (Maya, Jordan, Steve, Alex). Never a target. Never a clue.

**Reuse:** one-word field, display-name chips, Assemble / Disperse mono labels — same visual language as §9, empty.

---

## 4. Core mechanic

One team. One guesser per round. Everyone else clues. Facilitator-paced: after each reveal the Lead chooses Another round or End.

### 4.1 A round

1. Server picks the **guesser** (§7) from connected roster, then draws an unused Pack A word with the **ease-first** weights in §16.4, and a round type `shared` | `unique` uniformly at random. Deal happens in **one** server action at round start. No client-side pick.
2. Remaining connected players are **clue givers**. Their phones show the word, the type, the persistent instruction for that type (§10), and a one-word field. The guesser phone and the room display show none of that.
3. Clue write is **blind and simultaneous**. No live clue list. Roster chips show who has locked (navy fill) vs not (cloud-grey border) — same chip language as I Know What You Meme collection. Chips show **display names**, not the clue.
4. Two paths to close write: every **connected** clue giver has locked, **or** the 30-second server clock expires. No 3-second tap-settle (a locked clue is already persisted, or it is not). Unlocked givers at T=0 contribute **nothing** (empty slot, not an empty string in the multiset).
5. Server normalizes the locked clues (§5.3), builds the multiset, then filters:
   - **Assemble (`shared`):** keep a clue iff its count ≥ 2. Emit each surviving string **once**.
   - **Disperse (`unique`):** keep a clue iff its count = 1.
6. Shuffle the surviving list. That list is what the guesser, the clue givers, and the room display all see during guess. No names. No ×N. No round type. Empty list is legal — copy: “No clues made it through.” Do not explain why.
7. **30-second** guess clock. Guesser types one word and taps **Lock in**. Grey → navy (field non-empty) → amber (locked). Lock is final. Clue givers see the same board and **Don’t help.** They have no guess control.
8. Two paths to resolve: guesser locked, **or** the server timer expires with no submit (miss).
9. Reveal (§4.4). Then Lead: **Another round** (amber) or **Wrap things up** (navy).

### 4.2 What a clue lock means

The participant is asserting: this one English word is a legal clue for the target, and I am willing to have it enter the filter. Honor system on proper nouns, other languages, rhymes, and the rest of §5. The server only rejects what it can prove (§5.2).

### 4.3 What a guess lock means

The guesser is asserting: this is the word. One try. Server compares after the same normalize as clues. No fuzzy. No “almost.” No human confirm.

### 4.4 Reveal

Everyone sees:

- The target word (`font-display`)
- The typed guess (or em dash if none)
- Hit: sunrise-gold check under a `GOT IT` mono label. Miss: no public dump of “close” spellings
- The **surviving** clue list (already shown)
- Running **team** total (`font-display` value, `font-mono` uppercase label)

**Guesser** and **room display** never see: round type, discarded clues, who wrote what.

**Clue-giver phones** after reveal (not before): the raw clue list with counts, which strings were filtered, and whether *their* clue survived. Faces can leak the filter if this lands *before* the guess — so it waits until reveal. Round type still does not appear on guesser or room-display surfaces. Clue givers already saw it during write; do not re-banner it on the shared screen.

Wrong-guess details stay off the public board (same as I Know What You Meme not listing wrong names). Miss is miss.

### 4.5 Envelope and extra rounds

| Headcount | After Start | Lead guidance |
|---|---|---|
| 4–5 | Tight Shared | Play at least one full guesser rotation if energy holds. |
| 6–12 | Default sitting | One full rotation, then ask. |
| 13–20 | Long Unique boards | One rotation or sooner. Do not “finish the 53.” |

There is no mandatory round count and no auto-end. Pack starve (no unused word left) forces Wrap.

---

## 5. Clue rules

Typed. The platform does not know if someone mouthed the word on camera. Room rules + server rejects.

### 5.1 Illegal (honor system)

- Not exactly one word
- The target, or a form of it (`run` / `running`)
- Proper nouns
- A word in another language, or a translation of the target
- Spelling, initials, “starts with…”
- Rhymes / “sounds like”
- Punctuation or emoji standing in for a word
- Gestures, holding objects up, coaching on the call
- Searching, chat, or any extra channel

**Legal:** common English words, including boring ones (`the` is a waste, not a void). Hyphenated tokens are one word after normalize (`ice-cream` → `icecream`).

### 5.2 Server rejects (hard)

Reject the lock and keep the field editable, with a short error on that phone only:

- Empty / whitespace-only
- Any whitespace in the raw string (multi-word)
- After normalize (§5.3), empty
- Exact match of the target after normalize
- Obvious suffix/prefix form of the target: if the longer normalized string starts with the shorter, and the remainder is one of `s`, `es`, `ed`, `ing`, `er`, `est`

Cannot detect proper nouns or other languages. Those stay honor. Illegal-but-accepted clues **still enter the multiset**. No void/review phase in v1 (conversation chose blind, not blind-then-review).

### 5.3 Normalize

Used for duplicate grouping **and** for the guess match:

1. Trim
2. Lowercase
3. Strip internal hyphen and apostrophe
4. Strip leftover non-letters
5. If empty → reject (clue) or miss (guess)

No stemming across different clue strings. `run` and `running` are different clues unless one is the target (then §5.2 rejects the form).

Guess hit iff `normalize(guess) === normalize(target)`.

---

## 6. Scoring

Two numbers. The **team** is hit-or-miss on the word. **Individuals** are ranked by how often their clue actually reached the guesser’s board.

### 6.1 Team math

**+1** to the **team** if the locked guess matches.  
**0** if they locked the wrong word, or they never locked.

No leftover-time bonus. No wrong-guess penalty beyond 0 on that round. Everyone shares the same team total, including the guesser.

### 6.2 Clue-shown stats (individual)

A clue is **shown** when that person was a clue giver, locked a clue, and the normalized string is in `filtered_clues_json` (it appeared on the guesser’s board).

| Stat | Definition |
|---|---|
| `clue_rounds` | Rounds they locked a clue (guesser rounds, no-locks, and `abandoned` do not count) |
| `shown_count` | Those clue rounds where the clue was shown |

The final scoreboard **leaderboard ranks by `shown_count`**. Display the count only — **no percentages**. Tie-break: display name A–Z. Shared first is allowed.

Call out the person with the highest `shown_count` as **shown the most**. If two people tie, both may share first; the callout is the first name after the sort.

Empty board: you wrote something and it was filtered → not shown. You never locked → that round is omitted from `clue_rounds`.

These stats are **not** shown during play. They land on the final scoreboard only.

### 6.3 Worked example

Round 1 Unique, target `OCEAN`. Clues: Maya `water`, Jordan `blue`, Steve `wave`, Alex `water`. Filter keeps `blue`, `wave`. Guesser (Priya) types `ocean` → team 1. Shown: Jordan, Steve. Not shown: Maya, Alex.

Round 2 Shared, target `COMPROMISE`. Clues: Maya `deal`, Jordan `middle`, Steve `agree`, Priya `deal`. No duplicates. Empty board. Guesser (Alex) types `treaty` → team still 1. Shown: nobody.

Round 3 Shared, target `PIZZA`. Clues: Maya `cheese`, Jordan `cheese`, Steve `slice`, Alex `cheese`. Filter keeps `cheese`. Guesser (Priya) types `pizza` → team 2. Shown: Maya, Jordan, Alex.

After three rounds (each person guessed once; Priya guessed twice so fewer clue rounds):

- Team total: **2**
- Jordan 2, Maya 1, Steve 1, Alex 1, Priya 0.
- Shown the most: Jordan (`shown_count` 2).

### 6.4 When scores are visible

| Moment | Visible? |
|---|---|
| Clue write | No |
| During the 60s guess | No |
| Reveal | This round hit/miss + running **team** total only. No personal shown-rate. |
| Scoreboard | Hero **team total**; then the clue-shown leaderboard (§6.2). `font-display` values, `font-mono` labels |

---

## 7. Guesser rotation

Chosen at **round start**, before the word is in anyone’s payload.

1. Draw **uniformly at random** from the eligible pool. Not round-robin order.
2. Eligible = connected roster (whole roster if presence flags are empty) **minus anyone who has already been guesser this sitting**, until **everyone eligible has had a turn**. Nobody is guesser a second time until that first rotation is complete.
3. After everyone has had a turn, anyone connected may be drawn again — including someone who just guessed. v1 does not force a second unique rotation.
4. Facilitator is in the pool.

Do **not** promote a clue giver to guesser mid-round. They have already seen the word.

If the only connected people are fewer than 2 clue givers after picking a guesser, still run the round (disconnect path, not the design). Prefer not to Start below 4.

---

## 8. Session flow

```
LOBBY
  → WRITE → GUESS → REVEAL   (loop: Lead Another round)
  → SCOREBOARD → NPS → REFLECTION
```

Lead **Wrap things up** from `REVEAL` jumps to `SCOREBOARD` in one click (I Know What You Meme Wrap). Confirm on Wrap. Another round does not confirm.

| Phase | Who acts | Timer | Advance |
|---|---|---|---|
| `LOBBY` | Join; Lead Start at ≥4; Lead may pin room display | none | Lead Start, then SwitchCode share-stop confirm |
| `WRITE` | Clue givers lock one word | **60s** | All connected givers locked, or server timer |
| `GUESS` | Guesser locks one word | **60s** | Guesser locked, or server timer |
| `REVEAL` | Session Lead | none | Another round / Wrap things up |
| `SCOREBOARD` | Session Lead **Continue to debrief**. Everyone sees team total + clue-shown leaderboard | none | Existing NPS route |
| NPS / reflection | Platform | — | Standard Season path |

`startProtocol` is Lead-only, lobby-only. It does not deal the first word until Start. First round begins `WRITE` immediately (no practice round in v1).

**Screen-share stop (required).** Start does not begin `WRITE` until the Lead clicks **I have stopped sharing** on a full-screen confirm. The secret word appears on clue-giver phones at the same moment play starts; a live share leaks it. Back returns to lobby without starting. There is no skip, timer, or checkbox. The confirm is Lead-only and SwitchCode-only.

Progress bar: `SessionProgressBar`, 3px navy on cloud-grey, no labels. Expected total = roster size at Start (one guesser rotation). Extra rounds after a full rotation do not grow the denominator; the bar sits full through those reveals and SCOREBOARD.

---

## 9. UI notes (mobile-first)

Protocol label: `font-mono uppercase tracking-widest text-[10px]` — `SWITCHCODE`.

Play cards: `warm-white`, `cloud-grey` border, `rounded-lg`, `p-6` minimum. Session Lead panel: `FACILITATOR` mono label. Room display does **not** show that panel.

States cannot be color-only. Amber is reserved for the primary action (Lock in / Another round / Continue to debrief), selected-field treatment, timer urgency, **and the Disperse type banner**. Do not use amber fill on chips or the scoreboard.

**Round-type color keys** (clue-giver phones and lobby explainer only; never on guesser or room display):

| Type | Key |
|---|---|
| Assemble | `unmute-navy` banner, `warm-white` **ASSEMBLE** in `font-display` large caps |
| Disperse | `signal-amber` banner, `deep-navy` **DISPERSE** in `font-display` large caps |

### 9.1 UI states

| State | Treatment |
|---|---|
| One-word field, empty | `warm-white`, 1px navy @ 20% |
| One-word field, filled | 2px solid navy, navy left bar |
| One-word field, locked | input disabled; check glyph; do not grey the board |
| Clue tile (guess board) | `warm-white`, 1px navy @ 20%, `font-display` word, shuffled order |
| Clue tile, empty board | Dashed 2px navy, copy “No clues made it through.” |
| Roster chip, not in | `warm-white`, `cloud-grey` border, display name |
| Roster chip, locked | navy fill, warm-white name |
| Guesser sit-write | navy panel, `font-mono` copy; no word; no type |
| Assemble type banner (clue-giver phone + lobby) | `unmute-navy` fill, large `font-display` **ASSEMBLE** in `warm-white` |
| Disperse type banner (clue-giver phone + lobby) | `signal-amber` fill, large `font-display` **DISPERSE** in `deep-navy` |
| Reveal: hit | `font-display` word under `GOT IT` mono label, sunrise-gold check |
| Reveal: miss | Target word; typed guess; no discarded-clue dump |
| Clue-giver breakdown (phone, reveal only) | Raw strings + counts; survived vs filtered; fill + border + glyph, not color-only |
| Scoreboard hero | Team total in `font-display`; `TEAM SCORE` / `HITS` in `font-mono` uppercase |
| Scoreboard row | Rank + display name + `shown_count` only. Idle: `warm-white`, 1px navy @ 20% |
| Scoreboard row, shown the most | 2px solid navy. Not amber fill. |
| Shown-the-most callout | Display name under `SHOWN THE MOST` mono label. Same person as rank 1. |

### 9.2 Buttons

- Lock in (clue or guess): grey (unavailable) → **amber** when the field is a non-rejected word.
- **I have stopped sharing** (Start confirm): amber. Full-screen `deep-navy`. Required. No skip.
- Another round: amber (the one action after reveal).
- Wrap things up: navy (secondary). Confirm.
- Scoreboard **Continue to debrief**: amber, Lead-only, advances **everyone** to NPS.
- This is the shared screen: ghost / navy, Lead laptop, lobby and persistent.

### 9.3 Shared laptop vs phone

Same table shape as I Know What You Meme §7.4.

| Phase | Shared laptop (pinned room display) | Phone |
|---|---|---|
| Lobby | QR + explainer + roster | Join / wait. Lead phone: Start + pin reminder |
| Write | Guesser **display name**, lock chips `n/N`, timer. **No word. No type. No live clues.** | Clue giver: word + type + field. Guesser: sit-write copy. Lead chrome on Lead phone only |
| Guess | Filtered clue tiles, timer, guesser name, **no typed characters** | Guesser: same tiles + text field. Clue givers: same tiles, no field. Lead chrome stays on phone |
| Reveal | Target, guess, hit/miss, surviving tiles, team total. **No type. No discarded. No who-wrote-what.** | Same public board. Clue-giver phones **add** the breakdown. Guesser phones do not. Lead: Another round / Wrap |
| Scoreboard | Team total (hero) + clue-shown leaderboard (§6.2) | Same; Lead Continue to debrief |

If the session Lead is the guesser: their **phone** is the guess field; the pinned laptop stays public. Lead chrome for Another round / Wrap still lands on the phone after reveal — it does not require showing `word` during write (they are the guesser; they never get `word` until reveal).

### 9.4 Timer presentation

Follow moment-conventions §3 (`WaoPlayTimer`) on **both** clocks. This is required, not optional. Clients display; they do not decide expiry.

| Phase | Duration | When it runs | Treatment |
|---|---|---|---|
| `WRITE` | **60s** | From round start until all connected clue givers lock, or T=0 | Depleting circular arc, **no numerals**. Track `cloud-grey`, fill `unmute-navy` |
| `GUESS` | **60s** | From the moment the filtered clue list is shown, until the guesser locks, or T=0 | Same chrome |
| Final ~15s of either clock | — | Arc shifts to `signal-amber`, subtle pulse (1s cycle) | |
| Final ~3s of either clock | — | Large numeric 3-2-1 (accessibility exception) | |
| T=0 / all locked | — | Numerals gone. Write → filter → guess, or guess → reveal. No settle window | |

Unsubmitted clue field at T=0 is discarded (not auto-submitted). Unsubmitted guess at T=0 is a miss.

Opt-out of WAO’s 3s tap-settle only: a lock is already persisted (same opt-out as Talk Track, Zoning Rights, I Know What You Meme). Do not opt out of the arc, the amber urgency, or the 3-2-1.

---

## 10. Persistent play instruction

Visible through write and guess (not only in lobby). Exact copy. One-time verbal instruction is not enough.

**Clue giver, Assemble (`shared`):**

> **ASSEMBLE.** Only clues provided by more than one participant will be shown to the guesser. Don’t say the type out loud.

**Clue giver, Disperse (`unique`):**

> **DISPERSE.** Only clues which are unique among participants will be shown to the guesser. Don’t say the type out loud.

**Clue giver, during guess** (add under the board):

> Don’t help. No searching. No chat.

**Guesser, during write:**

> You’re guessing. Stay on this phone. Don’t look at anyone else’s.

**Guesser, during guess:**

> One guess. Type the word. They cannot help. No searching. No chat.

**Room display, write and guess:**

> [Guesser display name] is guessing. Don’t help.

Do **not** put Assemble / Disperse language on the guesser phone or the room display.

---

## 11. Roles and visibility

| Role | Device | What they see | What they must NOT see |
|---|---|---|---|
| Session Lead | Phone + pinned laptop | Player UI for their current role **plus** Start / Another round / Wrap / `n/N` locks / round index / team total on reveal. Laptop = public board only | `word` / `roundType` on the laptop at any time; discarded clues on the laptop; other people’s in-flight clue text |
| Clue giver | Phone | Word + type during write; filtered board during guess; breakdown after reveal | Other people’s in-flight text; guesser’s typed characters until reveal |
| Guesser | Phone | Sit-write copy; filtered board + field during guess; target + own guess at reveal | `word` before reveal; `roundType` **ever**; discarded clues; who wrote what; in-flight clue text |
| Room display | Pinned Lead laptop | Public board per §9.3 | `word` before reveal; `roundType` ever; discarded clues; guess field keystrokes |

`word` is Talk Track’s card / Draw It By Ear’s image / Zoning Rights’ permutation / I Know What You Meme’s owner id. `roundType` is the same class **for the guesser and the room display**, for the whole sitting.

---

## 12. Edge cases

| Situation | Rule |
|---|---|
| Disconnect during write, before lock | Do not block. Advance when every **connected** clue giver has locked, or at T=0. Their slot is skipped. |
| Disconnect during write, after lock | Keep the clue. They can rejoin and watch guess. |
| Rejoin mid-write | If they have not locked and they are a clue giver, they still can. Guesser rejoin: sit-write / guess field, still no `word`. |
| Guesser drops **before** deal | Re-roll guesser from the eligible pool. |
| Guesser drops **after** deal | Abandon the round (`abandoned`). Word is **not** shown. Word is **not** consumed (return to unused). Do not promote a clue giver. Next Another round deals fresh. |
| Clue-giver drop after deal | Remaining clues still filter. Shared may empty. |
| Timer expiry, zero clues locked | Empty board. Guess still runs. |
| Timer expiry, zero guess | Miss. Reveal still shows the word. |
| Guesser locks then wants to edit | No. Lock is final. |
| Clue giver locks then wants to edit | No. Lock is final. |
| Minimum players not met in lobby | Start disabled. “Need 4 to start.” |
| Headcount drops below 4 after Start | Continue with whoever is connected. |
| Lead Wrap | Confirm. Scoreboard with rounds played so far → NPS → reflection. |
| Late join | Closed after Start. |
| Double-submit Lock | Idempotent. First valid write wins. |
| Rejected clue | Stays editable; does not count as locked. |
| Empty filtered list | Legal. Guess still runs. |
| Pack starve | Another round disabled. Lead is forced to Wrap. |
| Lead’s phone dies | Host-token / cookie rejoin. Write/guess clocks keep running — room can wait out the clock or the Lead rejoins. |
| Lead is guesser | Phone = guess console. Pinned laptop stays public. Never mount word/type on the laptop. |
| Round type inferred from list length | Known leak. v1 does not pad or disguise. |
| Someone announces the type on the call | Honor system. No engine penalty. |

---

## 13. Authorization boundary

Every SwitchCode route that uses a service-role client must, before touching it:

1. Verify caller participant identity from the cookie.
2. Confirm that participant belongs to the session.
3. For play-state reads during `WRITE`: include `word` and `roundType` **only** if the caller is a clue giver **and** this browser is **not** the room-display pin. Guesser payload strips both. Room-display payload strips both. Do not include other people’s in-flight clue text.
4. For play-state reads during `GUESS`: include the shuffled surviving list. Still strip `word` and `roundType` for guesser and room display. Clue givers may keep `word` (they already had it) but **not** a pre-guess survival breakdown. Do not include the guesser’s in-flight text on other clients.
5. For play-state reads during `REVEAL`: `word` and the guess string are public. `roundType` still stripped from guesser and room-display payloads. Discarded clues / per-person raw clues only on clue-giver phones.
6. For play-state reads during `SCOREBOARD`: public team total plus each participant’s `shown_count` and display name. Still strip `roundType`. Do not include percents or clue strings on the guesser or room-display payload.
7. Clue lock: caller must be a clue giver this round. Reject if caller is the guesser. Reject §5.2 strings.
8. Guess lock: caller must be the current guesser. Reject if caller is a clue giver.
9. Start / Another round / Wrap / End: session Lead.

Do **not** put `word` or `roundType` on a session-wide Realtime channel. Do **not** put them on `sessions.state_json` if that column is open RLS. Follow Cover Story / Talk Track / I Know What You Meme: service-role tables; role-filtered reads.

Room-display reads are authorized as the Lead participant **plus** a display flag the client sends (cookie-backed, same person). The server still strips secrets for that flag. The pin is not a second roster row.

Acceptance bar includes a network-tab test: the guesser’s client never contains `roundType`, and never contains `word` before `REVEAL`. The pinned room-display client never contains `roundType`, and never contains `word` before `REVEAL`.

Optimistic local UI on the clue field is allowed; **server truth at lock and at T=0**. Retry twice on lock failure, then non-blocking warning. Do not block the room on one phone.

---

## 14. Facilitator script beats

1. Phones in hand. Faces on the laptop. **This laptop is the shared screen** — pin it if you haven’t. You’ll write on the phone.
2. Name the mechanic: one person guesses; everyone else writes one secret word; only some clues get through; they type one guess on a clock; we score only if they get it.
3. Name Assemble vs Disperse once, the same way the lobby does: clue givers will see which kind before they write. **The guesser does not know which kind it is. Don’t tell them.**
4. Name the illegal list once: one word, not the target or a form of it, no proper nouns, no other languages, no spelling, no rhymes, no extra channel.
5. Start. Full-screen: **Stop sharing your screen.** Click **I have stopped sharing**. Don’t narrate people’s clues while they write. Don’t announce Assemble or Disperse on the call.
6. After a full guesser rotation (or when energy drops): Wrap. Don’t apologize — the payload already happened.
7. On the scoreboard: read the team total, then who got their clues through the most (the counts). Then NPS, then the two reflection questions.

Lead-only metrics: round index, guesser display name, `locked / clue givers`, words remaining, running team total **on reveal only**, Wrap available after first reveal.

---

## 15. Session end flow and reflection

```
Lead Wrap (or pack starve) → **scoreboard** (§6.2 / §6.4): hero team total, then the clue-shown leaderboard, plus the “shown the most” callout. Facilitator Continue to debrief advances everyone to NPS
(`/session/[id]/feedback`). Completing NPS sends that person to reflection
(`/session/[id]/reflection`).
```

Reflection is the final screen. Do not park on NPS thank-you. Do not reload the protocol as “Replay.”

NPS is the platform feedback step (1–10 + optional comment).

Standard Season prompts, ninety seconds each, display-only:

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

**Facilitator prompt if the room is quiet:**

*“When the board came back thin, did you assume other people would write what you wrote — or that they wouldn’t? Where do we do that on the job without a shared code?”*

Do not name which *round* was Assemble or Disperse on the scoreboard or in the reflection UI. The lobby already taught that both exist. If the room says a given round’s type out loud in debrief, that is the conversation, not a platform leak.

---

## 16. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | 53 single English words, three difficulty bands, list below |
| Intra-session uniqueness | No word repeats in a sitting. That is not a pack. |
| Engine | Load only through `sessions.content_pack_id` |

When this protocol ships, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §7.4.2. Do not do that until the engine exists.

**Capacity:** one rotation at cap 20 = 20 words. 53 is surplus for extras and for a later sitting that must **not** silently reuse the same pack (console defaults to the next unused pack; Pack B is not authored in v1).

### 16.1 Word shape

```ts
type CodeSwitchWord = {
  id: string;
  content_pack_id: string;
  word: string;
  band: "easy" | "medium" | "hard";
  active: boolean;
};
```

`band` is staff/authoring metadata. Participants never see it. Deal is **not** uniform — see §16.4.

### 16.2 Pack A words (53)

Seed these as `active` rows. Display strings are exact, uppercase in play UI (`font-display`). The lobby explainer does not use a sample target or clue strings.

Difficulty is about **clue-write**, not trivia knowledge. Easy words have one or two magnets everyone will reach for (so Shared is likely and Unique is a trap). Hard words have no single magnet (so Unique is likely and Shared is the interesting failure). Medium sits between.

**Easy (16)** — concrete, common object or animal. Independent writers often land on the same one or two clues (`yellow` for PIZZA, `water` for OCEAN):

APPLE, BALLOON, BICYCLE, BLANKET, CANDLE, COFFEE, ELEPHANT, GUITAR, HAMMER, LADDER, OCEAN, PENCIL, PIZZA, RAINBOW, SANDWICH, UMBRELLA

**Medium (18)** — still imageable, but several equally good angles (place, use, category). Shared takes a real coincidence; Unique has room without emptying the board:

ASTRONAUT, BACKPACK, COMPASS, DAYDREAM, ELEVATOR, FIREPLACE, HONEYMOON, LIBRARY, LIGHTHOUSE, MUSEUM, ORCHESTRA, PASSPORT, RECIPE, SCAFFOLD, SUBWAY, TELESCOPE, VOLCANO, WEDDING

**Hard (19)** — the word is familiar, but there is no single magnet. Unique is the natural filter; Shared often empties the board unless the room actually shares a model. Not physics, chemistry, or legal jargon — if you cannot imagine two people independently writing the same clue, it does not belong here.

ALGORITHM, BLACKMAIL, BURNOUT, CAMOUFLAGE, CHECKPOINT, CLIFFHANGER, COMPROMISE, DIPLOMACY, FLASHBACK, HEARTBREAK, LOOPHOLE, NOSTALGIA, RESILIENCE, SABOTAGE, SCAPEGOAT, SERENDIPITY, STALEMATE, SUPERSTITION, ULTIMATUM

### 16.3 Authoring rules (Pack B later)

- Unique within the pack. One token. US spelling. No proper nouns. No hyphenated display form in v1 (hyphen would normalize away).
- Workplace-readable. No target that is illegal to say in a workplace room. No real client names.
- Mix bands so Shared (converge) and Unique (differentiate) both have room.
- Lobby sample copy must not duplicate these strings.

### 16.4 Dealing (ease-first, then harder)

At **round start**, draw one unused `active` word from this session’s pack. Consume on deal. Never repeat in a sitting.

Let `r` be the 1-based `round_index`. Among unused words, each word’s draw weight is its band’s weight. A band with zero unused words has weight 0.

| Band | Weight |
|---|---|
| easy | `max(0, 6 - r)` — round 1 = 5, round 6+ = 0 |
| medium | `3` (constant, until the band is empty) |
| hard | `max(1, r)` — round 1 = 1, then climbs with `r` |

Pick a word with probability proportional to its weight. Uniform inside a tied weight.

**Round 1 is easy-only** if any unused easy word remains (ignore the table for that draw). If easy is empty, use the table (medium, then hard).

Worked shape (assuming all bands still have words):

- Round 1: easy.
- Round 2: easy 4 / medium 3 / hard 2 — still easy-leaning.
- Round 4: easy 2 / medium 3 / hard 4 — hard starts to dominate.
- Round 6+: easy 0 / medium 3 / hard 6+ — leftover medium, then hard.

If the round is `abandoned` because the guesser dropped, **return** the word to unused. If Another round cannot be dealt, Wrap is the only Lead action.

---

## 17. Data model (protocol-specific)

Platform `sessions` + `session_participants` unchanged. Secrets do **not** live in open-RLS `sessions.state_json`. Follow Cover Story / Talk Track / I Know What You Meme: service-role tables.

```
code_switch_words
  id, content_pack_id, word, band, active, created_at

code_switch_sessions
  session_id, phase, team_score, created_at

code_switch_rounds
  id, session_id, round_index,
  guesser_id, word_id, round_type (shared | unique),
  write_started_at, guess_started_at,
  filtered_clues_json,   -- shuffled surviving strings; public at GUESS
  guess_text,            -- null until lock / miss
  is_hit,
  ended_at, end_reason (guessed | timer | abandoned)

code_switch_clues
  id, round_id, participant_id, raw_text, normalized,
  survived,             -- true iff normalized is in that round's filtered list
  locked_at
  UNIQUE (round_id, participant_id)
```

`round_type` and `word_id` stay server-side for guesser / room-display reads until the rules in §13 say otherwise. `filtered_clues_json` is public during `GUESS`. Per-person `raw_text` is never on the guesser or room-display payload. `is_hit` and `guess_text` become public at `REVEAL`. `shown_count` becomes public on `SCOREBOARD` only — names and counts, not percents, not the clue strings.

---

## 18. Locked decisions

| Topic | Locked as |
|---|---|
| Module | Own protocol `code-switch`. Not a Talk Track mode |
| Facilitator devices | One identity, two devices. Laptop = room display (pinned). Phone = personal console + Lead chrome. Not two roster entries |
| Guess channel | Guesser types one word on their phone. Server judges. Shared screen shows the filtered list |
| Clue writing | Blind and simultaneous |
| Round type | Server picks Shared or Unique uniformly at random each round |
| Type visibility | Clue givers, in advance, on phones. Guesser never. Room display never. Including after the guess |
| Filter, Shared | Count ≥ 2 survives; emit once; no ×N; no names |
| Filter, Unique | Count = 1 survives |
| Empty board | Legal; guess still runs |
| Facilitator | Plays; rotates as guesser; Another round / Wrap |
| Wrap | Confirm, from reveal, to scoreboard |
| End copy | Scoreboard **Continue to debrief** (NPS) |
| Confirm / lock | Final; no edit |
| Clue clock | 60s write, WAO timer chrome (`WaoPlayTimer`), server timestamp. All-lock ends early. |
| Guess clock | 60s, starts when the filtered clues appear. Same chrome. T=0 with no submit = miss. |
| Team scoring | +1 on hit; 0 otherwise |
| Final scoreboard | Hero team total + leaderboard ranked by `shown_count`; count only, no percents |
| Wrong / discarded | Not on guesser or room display during play |
| Pre-guess survival breakdown | No. Clue-giver phones get it at reveal only |
| Late join | Closed after Start |
| Start floor / cap | 4 / 20 |
| Pack | Required. Pack A = 53 words in §16.2, three bands |
| Deal | Round 1 easy-only; then ease-first weights that climb toward hard (§16.4) |
| End path | Scoreboard → NPS → reflection |
| Explainer | Coded lobby loop, five beats, no target/clue strings; **does** name Assemble vs Disperse, and that the guesser does not know which |
| Guesser fairness | No repeat until the whole roster has guessed |

---

## 19. Degraded fallback

Write this into facilitator notes before the first live run. Do not improvise it.

1. 53 words (or this Pack A list) on slips in a cup. Sticky notes and pens.
2. Pick a guesser. They leave the camera frame or turn away from the laptop. Remaining people each write **one** word on a sticky, privately.
3. Facilitator collects the stickies face-down. Without showing the guesser, they have already flipped a coin: heads = keep only duplicates, tails = keep only singles. They do **not** announce the coin.
4. Write the surviving words on the shared screen. Thirty-ish seconds. Guesser types or says one word. (If the app is fully down, they say it; facilitator marks hit/miss.)
5. Reveal the slip. Tally team points on a whiteboard. Tick a mark next to whoever’s sticky made the board (clue-shown). Draw easier slips first, then mixed, then harder.
6. Repeat until energy drops. Read team total and who got through most often. Then the two reflection questions. No app.

What is lost: private typed guess, lock chips, pack uniqueness, role-filtered payloads. The payload still runs.

---

## 20. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain “write on your phone, don’t look.”
2. Self-service QR join works without assistance.
3. During `WRITE` and `GUESS`, a guesser’s network tab **never** contains `roundType`. During `WRITE` and `GUESS`, it **never** contains `word`. After reveal, `word` may; `roundType` still must not.
4. Pinned room-display client: same network-tab bar as the guesser for `word` / `roundType`. It never contains in-flight clue text or the guesser’s keystrokes.
5. During `WRITE`, participant A’s client does not contain participant B’s clue text.
6. Headcounts 4, 8, 20: Start gate at 4; guesser rotation does not repeat until the pool is exhausted; Shared/Unique both appear across a sitting (do not fake the RNG in rehearsal).
7. Guesser cannot lock a clue; clue giver cannot lock a guess; both return an error if forced.
8. Timer expiry with no clues: empty board, guess still runs. Timer expiry with no guess: miss; word still revealed.
9. Disconnect before clue lock does not stall the room. Guesser drop after deal abandons without revealing the word and without promoting a clue giver.
10. Throttled-network: double Lock does not write two clues or two guesses; first valid write wins.
11. Scoreboard Continue to debrief goes to existing NPS, then reflection — no Replay reload. Scoreboard shows team total plus a `shown_count` ranking; it does not print percents or `roundType` per round.
12. Degraded fallback in the facilitator notes.
13. Lobby explainer never shows a target word or clue string; panel size does not jump between beats; five beat dots. Beats name Assemble vs Disperse **and** that the guesser does not know which.
14. Lead laptop after pin never mounts the clue field. Copy “Pick on your phone. Leave this laptop on the shared screen.” is visible before Start.
15. Round 1 deals an `easy` word when any remain. Later rounds follow §16.4 weights (unit-testable).
16. Both clocks use WAO timer chrome: 60s write, 60s guess from clue-reveal; amber last ~15s; 3-2-1 last ~3s.

---

## 21. Conservative leftovers

Conversation resolved the load-bearing forks (devices, typed guess, blind write, random hidden type). These are recorded so build does not invent:

| Topic | Conservative lock |
|---|---|
| Team scoring extras | No miss penalty, no speed bonus, no individual points for the word |
| Leaderboard rank | `shown_count` only; no percents |
| Start floor | 4 |
| Sitting length | Lead-gated. Recommend one guesser rotation. No auto-end |
| Void / review phase | No in v1 |
| Pad / disguise list length | No. Length may weakly imply type |
| Survival breakdown timing | Reveal only, clue-giver phones only. Aggregates wait for SCOREBOARD |
| Abandoned-round word | Return to unused deck |
| Practice round | No (Talk Track has a demo; SwitchCode does not) |
| Fuzzy guess | No |
| Stemming for duplicate merge | No |
| Audio on timer | No. Amber pulse + 3-2-1 only |
| Pack B | Not authored. Reuse Pack A is a console override |
| Deal weights | Locked in §16.4. Do not invent a second curve at build time |
| Wrap confirm | Yes (End is destructive). Another round: no confirm |
| Explainer video file | Coded loop. A `/public` video may replace it later; same Unique/Shared + guesser-doesn’t-know beats |

No opt-outs from moment-conventions other than: no WAO tap-settle; room-display pin is a SwitchCode addition on top of the I Know What You Meme laptop/phone split. Lobby **does** teach the second mode (Assemble vs Disperse) because the conversation locked that the room should know both exist and that the guesser is not told which is live.

---

## 22. Build sequence

One step at a time. Each independently testable.

1. Schema + migrations. Pack A id. Seed all 53 words with `band`. Console pack row waits until this engine reads `content_pack_id`.
2. Normalize + filter + suffix-reject unit tests (Shared / Unique / empty / forms of the target / guess match). Ease-first deal unit tests (§16.4).
3. Lobby explainer (no target/clue strings; Assemble vs Disperse named; guesser doesn’t know; beat dots) + Start gate at 4 + room-display pin control.
4. Role-filtered play payload (strip `word` / `roundType` for guesser and room display). Load-bearing security step — do not defer. Network-tab tests in §20.3–20.5.
5. `WRITE`: blind field, roster chips, 60s WAO timer, connected-only advance, lock final / idempotent.
6. Filter → `GUESS`: shuffled surviving list, 60s WAO timer from clue-reveal, typed lock, empty-board copy.
7. `REVEAL`: hit/miss, team +1, clue-giver breakdown on phones only. Persist `survived` on each clue row.
8. Guesser fairness pool + Another round / Wrap.
9. Scoreboard: team total + `shown_count` leaderboard + shown-the-most callout. Continue to debrief → existing NPS → existing reflection. Delete any Replay impulse.
10. Disconnect rules in §12.
11. Tight RLS on `code_switch_*` tables.
12. Console pack row in `docs/unmute-console-spec-v1.md` §7.4.2 once this is on `main`.

---

## 23. Open items

- Pack B (new 50) is a separate workstream. Spec is not blocked.
- Whether a later version should pad the guess board so list length does not imply type. v1 does not.
- Whether abandoned-round words should stay consumed because clue givers saw them. v1 returns them (§21).

---

## Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator-as-player called
- [x] § Lobby explainer — five beats, no sample words/clues, beat dots, fixed panel size
- [x] § Device context — phone + laptop video
- [x] § UI states — shape/weight table
- [x] § Timer — durations and presentation thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats — plus which Lead-only metrics appear
- [x] § Session end flow — scoreboard → NPS → reflection
- [x] § Reflection — standard prompts + optional facilitator prompt
- [x] § Degraded fallback
- [x] § Acceptance bar — includes network-tab secret test
- [x] § Authorization boundary
- [x] § Content pack — required, Pack A = 53 words
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence — one step at a time, independently testable
