# Rank and File — Protocol Spec v1

**Status:** Build spec, locked for v1  
**Slug:** `rank-and-file`  
**Type:** Real-time (simultaneous secret clue write; facilitator-paced ranking on the shared screen; server-authoritative clocks)  
**Players:** 3–20 (optimal 6–12). Facilitator plays on their phone. The host laptop is **Shared screen**, not a player.  
**Envelope:** ~15–25 minutes at optimal headcount. Rounds 1–5 are the sitting; Wrap is first offered after round 5.  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is the 51-subject library in §12 and `docs/protocols/rank-and-file-pack-a.csv`.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Decisions from the spec conversation are in §16. Where this document needed a call the conversation did not make, the conservative option is recorded in place and in §19. Do not invent further mechanics at build time.

Own module: `app-platform/lib/protocols/rank-and-file/`, own `registerProtocol()` entry.

Surface inspiration: a numbered scale (1–99) with a topic from sad-to-glorious, in the family of *The Mind* / continuum party games. The Unmute payload is not “got the order.” It is whether a team shares a **calibrated sense of what words mean**, and whether they ask the question that would have settled the rank.

---

## 1. What this Moment is

Each round, a **subset** of the room is dealt one unique number from a shuffled deck of **1–99**. Everyone sees the same **subject** and its two poles (for example: Breakfast foods, **0** Sad → **100** Glorious). The people who were dealt a number have one minute to write an **example** that belongs at their place on that scale. They must not name numbers, values, or quantities. Then the whole room — including people who were not dealt a card — has three minutes to **rank those examples from low to high** on a shared rail that starts at **0** (top) and ends at **100** (bottom). Each tile shows **who wrote it**. The number stays secret until reveal.

If the top-to-bottom order matches the hidden numbers exactly (lowest at **0**, highest at **100**), the **team** scores +1. If even one tile is off, the round scores 0 and the truth is shown under the team’s row: the correct order with each number on the named tile.

Round 1 is a scored teaching round (Breakfast foods, three clue givers). Later rounds add more clue givers and, from round 5, subjects about how this team actually works.

**The examples are the surface. The payload is shared calibration.** People discover they do not mean the same thing by “urgent,” “good meeting,” or “worth escalating” — and that they ranked without asking.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who anchors the scale, who stays quiet, who had the question that would have settled it and did not ask.

**What gets revealed about a person:** whether their example is readable without the number, even with their name on it; whether they leak; whether the room ranks the example or the colleague.

---

## 2. Players, join, device

- **Start floor: 3 real players.** The shared-screen laptop does not count. Below 3 phones in the room, Start stays disabled. Copy: “Need 3 to start.”
- **Cap: 20.**
- **Optimal: 6–12.** Below 6, most of the room is clue-giving every round. Above 12, ranking eight named examples is still the work; do not grow the clue-giver cap past 8.
- **The facilitator is a player on their phone.** They are dealt numbers when selected, they write clues, they rank with the room. Ranking controls, Next round, and Wrap stay on the shared laptop.
- No auth. Same 6-character join code as every Moment. Phones join with a display name. The host laptop does not.
- **Phone is the primary controller; desktop works but is not optimized.** Video call stays on the laptop. The **shared laptop is the room display** (QR, then the public board / ranking rail). Phones carry private numbers during write — same split as SwitchCode’s room-display pin and I Know What You Meme’s “pick on your phone.”
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.

### 2.1 Shared screen (host laptop)

The facilitator always has this laptop on the projector. They do not enter clues here.

- Opening the host link **does not prompt for a name.** That browser auto-claims as **Shared screen**, auto-pins `localStorage` for this `sessionId`, and copy says **Join immediately on your phone.**
- **Shared screen is not a player.** It is excluded from the Start count, the lobby roster, Lead transfer, and the clue-giver pool. The three-player floor is three phones.
- A pinned browser **only ever mounts the public board** (§7.3). It never receives `dealt_number` in its play payload.
- The facilitator’s phone is the personal console: clue field when they are dealt in. During `RANK`, phones show talk copy only. The laptop is the ranking board (drag onto slots, up/down arrows to reorder).
- Start does **not** block on the pin. The host link pins automatically. If they forget the phone, the room-display payload is still stripped; the risk is they share a *phone* tab by mistake.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~20–25s, looping), same convention as Talk Track, Wrong Answers Only, SwitchCode, and I Know What You Meme. `useReducedMotion()` → static stacked panels. **Beat dots** under the stage (`LobbyExplainerDots`, five dots).

v1 teaches the first mode only (write an example, then rank). It does **not** teach Team Behaviors, clue-giver counts by round, or the 50/50 mix. The facilitator can still run those in the sitting.

The looping panel is **one fixed size for every beat** (CSS grid overlap). Do not grow/shrink the shell as captions change.

**No Pack A subjects in the loop.** Breakfast foods is round 1 of play. The explainer uses a fake scale that is not in the pack.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | To join, scan the QR with your phone. Play on your phone. Leave the laptop on the shared screen so nobody sees your number. | Phone + laptop with a video grid. QR lives in the lobby chrome beside this loop. **No numbers.** |
| 2 | Each of you gets a secret number. Write a clue for where that number sits on the scale. Keep the number to yourself. | Subject card *Kitchen gadgets* with poles **0** *Pointless* → **100** *Couldn't cook without it*. A **YOUR NUMBER** card showing `?`. |
| 3 | Your phone shows the number and the clue you are writing. Qualifiers and adjectives are fair game. No counts, numbers, or measures. | **YOUR NUMBER** `48` plus Priya writing *Whisk from IKEA*. |
| 4 | Then the team ranks the examples from 0 to 100 — not yet in the right order. Everyone talks. The facilitator moves the cards. | Vertical column: **0** at the top, **100** at the bottom; unranked named tiles on the right, aligned to empty slots. Four scrambled tiles: Jordan / *Twisting garlic press*, Maya / *Plastic crab cracker*, Sam / *Parmesan grater like Olive Garden’s*, Priya / *Whisk from IKEA*. |
| 5 | Exact order scores. The truth row shows each name and its number. | Correct low-to-high column with names and numbers: Maya 8, Priya 48, Jordan 72, Sam 92. |

**Sample data (obviously fake, not in Pack A):** theme *Kitchen gadgets*; low *Pointless*; high *Couldn't cook without it*; four named clues as above. Never show 1–99 in beats 1–2.

**Reuse:** subject card, one-line field, ranking rail with `0` and `100` anchors, named tiles — same visual language as §7, empty of real numbers.

---

## 4. Core mechanic

One team. Facilitator-paced. After rounds 1–4 the Lead taps **Next round** only. After round 5+, the Lead chooses **Another round** or **Wrap**.

### 4.1 A round

1. Server picks **k clue givers** from the connected **players** (§4.6) — never the Shared screen sentinel — shuffles the **1–99** deck, and deals each of those people **one unique number**. In the same action it draws the round’s **subject** (§4.7). Deal is one server action at round start. No client-side pick.
2. Everyone sees the subject and its two poles. Clue givers also see **only their own number**, on their **phone**. The room display and everyone else see no numbers.
3. **60-second** write clock. Clue givers type one example and tap **Lock in**. Grey → navy (field non-empty and not rejected) → amber (locked). Lock is final. People who were not dealt a card see the subject, the poles, who is writing (roster chips), and **Don’t help with examples.** They have no field.
4. Two paths to close write: every **connected** clue giver has locked, **or** the server timer expires. No 3-second tap-settle. Unlocked givers at T=0 contribute **nothing** — no tile, their number is unused this round.
5. Submitted clues become **named tiles** (clue text + author’s display name). The **number** stays secret until reveal.
6. **`RANK` (180 seconds).** Two columns: **N empty slots** in a **left** vertical rail (`0` top, `100` bottom), submitted tiles in a **random-order Unranked** column on the right, each unranked card aligned to an empty left slot. The whole room talks. **The shared laptop** (session Lead) drags a card onto a left slot, then uses **↑ / ↓** on a placed card. Every phone is read-only with talk copy. Commit is the score event and can fire before the clock ends.
7. **Commit** (Lead, amber, on the shared laptop) enables only when Unranked is empty (every submitted tile is on the rail). Commit is the score event. Drops apply on the laptop **immediately** (optimistic rail); the client serializes `setRail` so an earlier POST cannot overwrite a later layout.
8. Reveal (§4.4). Then: rounds 1–4 → Lead **Next round** only (laptop). Round 5+ → **Another round** (amber) or **Wrap things up** (navy), also on the laptop.

### 4.2 What a clue lock means

The participant is asserting: this example belongs at my secret number on this subject’s scale, and I am willing to have the room rank it **with my name on it**, without seeing the number.

Honor system on workplace fit and on spelled quantities the server cannot see (§5).

### 4.3 Ranking controls (facilitator)

The shared laptop is dropped straight into the ranking board. No extra pin/click to “start moving cards.”

- **Layout:** two columns. Left: **N empty slots** between **0** (top) and **100** (bottom), with the subject’s low/high words under those anchors. Right: submitted tiles in random order, one card per empty left slot so rows stay aligned. Right column labeled **Unranked**.
- **Place:** drag an Unranked card onto a left slot, or tap a card then tap an empty slot. The card appears in the slot immediately.
- **Reorder:** **↑ / ↓** on a placed card (↑ disabled on the top slot, ↓ on the bottom).
- **Return to Unranked:** drag a placed card back to the right column.
- **Commit:** amber once every left slot is filled. One tap, no confirm. Ends the round early.

Everyone else, including inactive players, sees:

> Talk to your teammates. The facilitator will put them in order on the shared screen.

The **180s** clock is pacing, not auto-commit. Commit stays facilitator-gated after T=0. Persistent copy during `RANK` on the facilitator board:

> Three minutes to agree. The facilitator moves the cards. Do not say your number.

### 4.4 Reveal

Everyone sees, top to bottom:

1. The team’s committed column (clue text + display name, **0** at the top = lowest, **100** at the bottom = highest). **No numbers yet.**
2. Hit: `IN ORDER` mono label, **Exact order** in `font-display` sunrise-gold, and a large check with expanding rings (`HitSoundwave`; static large check under `useReducedMotion`). Miss: no check. Copy: **One card off.** (Even if several are off.)
3. On a miss only: a **truth column directly under the team column** — same named tiles in correct numerical order, each now showing **the number**.
4. On a hit: numbers annotate the same named tiles (do not skip them). Names were already visible.
5. Running **team** total (`font-display` value, `font-mono` uppercase `ROUNDS IN ORDER`).

Do not show unused (unsubmitted) numbers.

### 4.5 Envelope and extra rounds

| Headcount | After Start | Lead guidance |
|---|---|---|
| 3–5 | Most people write every round | Play rounds 1–5. Wrap is first offered after round 5. |
| 6–12 | Default sitting | Same. Round 5 is the first Team Behaviors subject. Ask Wrap then. |
| 13–20 | Eight writers, everyone else ranks | Same. Do not “finish the pack.” |

**Rounds 1–5 are the sitting.** Wrap is **not** offered until the round 5 reveal. After that, every reveal is Another round or Wrap. There is no auto-end except **subject starve** (§4.7): Wrap is forced (even if that happens before round 5, which Pack A makes nearly impossible).

Round 1 is **scored**. It is the teaching subject, not a Talk Track-style unscored demo.

### 4.6 Clue-giver selection

`k` by round index (1-based). If fewer people are in the sitting than `k`, **everyone writes** — do not invent extra seats.

| Round | k (clue givers) | If n < k |
|---|---|---|
| 1 | 3 | Everyone writes |
| 2 | 4 | Everyone writes |
| 3 | 6 | Everyone writes |
| 4 | 8 | Everyone writes |
| 5+ | 8 | Everyone writes |

**Fairness:** after the cap, pick among connected players so that **no one has two more clue-giver turns than anyone else** (`max − min ≤ 1`). Algorithm:

1. Count clue-giver turns so far for every connected player (unsubmitted / disconnected deals still count as a turn if they were dealt).
2. Fill `k` seats from the lowest count bucket, uniformly at random inside the bucket, then the next bucket, until `k` are seated.
3. The facilitator (phone join) is in the pool. **Shared screen is never in the pool.**

Do **not** re-deal a dropped clue giver mid-write. Do not promote a spectator into a live write after numbers are out.

### 4.7 Subject dealing

Categories in Pack A:

| Category | Count | When |
|---|---|---|
| `example` | 1 (Breakfast foods) | **Always round 1.** Never drawn later. |
| `general_calibration` | 25 | Rounds 2–4: random unused. Round 6+: 50% branch. |
| `team_behaviors` | 25 | Round 5: **forced** unused. Round 6+: 50% branch. |

Rules:

- Once a subject is used in this sitting, it is **never** drawn again.
- Round 5 always draws from unused `team_behaviors`.
- Round 6+: with probability 1/2 draw unused `team_behaviors`, otherwise unused `general_calibration`. If the chosen deck is empty, draw from the other. If both are empty, Wrap is forced (no Another round).
- The CSV column **Earliest Week** is **ignored in v1.** All 25 Team Behaviors cards are eligible from round 5.

Number deck: **reshuffle 1–99 every round**, except **round 1 is fixed at 8, 48, and 92** (shuffled among the three clue givers) so the teaching round has broad gaps. Later rounds are random. Within a round, numbers are unique.

### 4.8 Persistent play instruction

Visible on every play screen for the whole session, not only in the lobby:

> Write an example at your number. Qualifiers and adjectives are fair game. No counts, numbers, or measures. Do not say your number.

During `RANK`, add:

> Everyone ranks. The facilitator moves the cards.

During write, people who were not dealt a card see instead of the field:

> You’re ranking this round. Don’t help with examples.

---

## 5. Clue rules

Typed. The platform cannot hear the call. Room rules + a small server reject.

### 5.1 Illegal (honor system)

- Saying or typing the secret number
- Any quantity, value, rank, price, percent, count, or measurement meant to encode position (`a dozen`, `three stars`, `top 1%`, `$8`, `90th percentile`)
- Searching, chat, or any extra channel
- Coaching other clue givers on what to write
- Pointing at the rail and claiming a slot while still in `WRITE`

**Legal:** ordinary examples. **Qualifiers and adjectives are encouraged** (“leftover,” “gas-station,” “that somehow still slaps”). Brand names. Workplace specifics. Funny or dry. The room will rank the meaning. Do not encode position with counts, numbers, or other measures.

### 5.2 Server rejects (hard)

Reject the lock and keep the field editable, with a short error on that phone only:

- Empty / whitespace-only
- After trim, empty
- Longer than **250** characters
- Any ASCII digit `0–9` anywhere in the string
- `$` or `%`

Cannot detect “a dozen eggs.” Those stay honor. Illegal-but-accepted clues **still become tiles**.

### 5.3 Normalize (display only)

Trim leading/trailing whitespace. Preserve internal spacing and case for display. Do not fold two players’ identical strings into one tile — two people can both write “oatmeal.”

---

## 6. Scoring

### 6.1 Math

**+1** to the **team** if the committed top-to-bottom order is exactly the dealt numbers, lowest at **0** to highest at **100**.  
**0** if any adjacent pair is inverted, or if Commit never happens (Wrap mid-rank is not a v1 path; see §9).

No partial credit. No leftover-time bonus. No individual leaderboard. Unsubmitted clue givers do not create a tile; the round is scored on the tiles that exist.

If **zero** tiles were submitted, the round is a miss (0). Copy: **No examples were locked in.** Advance as usual for that round index (Next round on 1–4; Another round / Wrap on 5+). Do not show an empty truth column.

### 6.2 Worked example

Round 1. Subject: Breakfast foods, Sad → Glorious. Clue givers: Maya 12, Jordan 41, Alex 88.

Tiles (named, numbers hidden): Maya “gas station burrito”, Jordan “hotel buffet”, Alex “Saturday pancakes.”

Lead commits: burrito → pancakes → buffet.

Truth order by number: 12 burrito (Maya), 41 buffet (Jordan), 88 pancakes (Alex).

The committed order is not that sequence → **0**. Truth row appears under the team row with 12 / 41 / 88 on those same named tiles. Team total stays 0.

If they had committed burrito → buffet → pancakes → **+1**, team total 1. Numbers annotate the same named row.

### 6.3 When scores are visible

| Moment | Visible? |
|---|---|
| Write | No |
| Rank | No |
| Reveal | This round hit/miss + running team total |
| Scoreboard | Hero **rounds in order / rounds played** and **percent in order** |

Percent = `hits / committed_rounds`, displayed as a whole percent (2 of 5 → **40%**). No individual stats.

---

## 7. UI notes (mobile-first)

Protocol label: `font-mono uppercase tracking-widest text-[10px]` — `RANK AND FILE`.

Play cards: `warm-white`, `cloud-grey` border, `rounded-lg`, `p-6` minimum. Session Lead panel: `FACILITATOR` mono label. Room display **does** host ranking controls, Next round, Wrap, and Continue (this is the point of the shared screen). It does **not** show anyone’s secret number. During write, keep laptop chrome to the public board. During rank, keep laptop chrome to the rail + Commit. Phones stay read-only on rank.

States cannot be color-only. Amber is reserved for Lock in, Commit, Another round, Continue to debrief, selected-tile treatment, and timer urgency.

### 7.1 UI states

| State | Treatment |
|---|---|
| Subject card | `warm-white`, 1px navy @ 20%, theme in `font-display`. Poles: **0** and **100** in `font-mono` above the low/high words |
| Number (clue-giver phone only) | `font-display` large, `font-mono` label `YOUR NUMBER`. Never on room display |
| Clue field, empty | `warm-white`, 1px navy @ 20% |
| Clue field, filled | 2px solid navy, navy left bar |
| Clue field, rejected | 2px `signal-red` border, error caption; not decorative red elsewhere |
| Clue field, locked | input disabled; check glyph |
| Roster chip, not locked | `warm-white`, `cloud-grey` border, display name |
| Roster chip, locked | navy fill, warm-white name |
| Spectator sit-write | navy panel, `font-mono` copy; no number; no field |
| Rail anchor `0` | `font-mono`, fixed **top** of the left column, not draggable. Low-end word as caption under it |
| Rail anchor `100` | `font-mono`, fixed **bottom** of the left column, not draggable. High-end word as caption under it |
| Slot, empty | dashed 2px navy, `cloud-grey` fill, copy `Drop here`. Same height as the Unranked card in that row |
| Tile in Unranked | `warm-white`, 1px navy @ 20%, clue text + display name, **no number**. Right column, aligned to empty left slots |
| Tile selected (Lead laptop) | 2px solid navy, navy left bar |
| Tile placed | same named card on the left rail; still no number; **↑ / ↓** beside it when the laptop can rank |
| Commit disabled | opacity-40 (Unranked not empty) |
| Reveal: hit | `IN ORDER` mono label, **Exact order** display headline, large sunrise-gold check with expanding rings |
| Reveal: miss | team column unchanged; truth column under it, 2px solid navy, number + display name on each tile |
| Scoreboard hero | `font-display` fraction and percent; `ROUNDS IN ORDER` / `IN ORDER` in `font-mono` uppercase |

### 7.2 Buttons

- Lock in: grey → navy (legal text) → amber (locked).
- Commit: grey until Unranked is empty, then **amber**. Lead laptop only.
- Next round: amber after reveals 1–4. The only action. No Wrap. Lead laptop.
- Another round: amber after reveal 5+. The one action if they keep playing. Lead laptop.
- Wrap things up: navy / ghost, **first offered after round 5**. Confirm on Wrap (SwitchCode). Next/Another round does not confirm. Lead laptop.
- Continue to debrief: amber on scoreboard. Lead laptop.
- Host laptop does not get a name field. Opening the host link auto-claims **Shared screen** and auto-pins. Lobby copy: **Join on your phone now.** A leftover **This is the shared screen** toggle remains only if a Lead browser is somehow unpinned.

Disabled: opacity-40, cursor-not-allowed.

### 7.3 Role screens

| Phase | Shared laptop (pinned room display / session Lead) | Phone |
|---|---|---|
| Lobby | QR + explainer + player roster (Shared screen hidden). Auto-pin. Copy: join on your phone. **Start** at ≥3 phones. | Join / wait. Facilitator’s phone is a player, not Lead. |
| Write | Subject + **0 / 100** poles + lock chips `n/k` + timer. **No numbers. No live clue text.** | Clue giver: number + field. Spectator: sit-write copy. |
| Rank | Left rail `0` (top) … tiles … `100` (bottom) + Unranked right + Commit. Named tiles. **No numbers.** Drops appear immediately. | All phones: talk copy only. **Move the cards on the shared screen.** |
| Reveal | Team column, Exact order / One card off, truth column if miss, running total. **Next round** (1–4) or Another round / Wrap (5+) | Same board, read-only. No Next / Wrap. |
| Scoreboard | Hero stats. Lead: Continue to debrief | Same. Waiting copy if not Lead |

If the facilitator is a clue giver: their **phone** is the number + field; the pinned laptop stays public.

### 7.4 Timer presentation

Follow moment-conventions §3 (`WaoPlayTimer`) on **both** clocks. Clients display; they do not decide expiry.

| Clock | Duration | Urgent | Numeric | Settle |
|---|---|---|---|---|
| Write | **60s displayed / 65s server** | last **10s** of the displayed minute: amber flash + pulse on the timer and the clue-giver card. Five extra seconds after the arc completes. `useReducedMotion` keeps the amber treatment, no pulse. | last ~3s 3-2-1 | none — lock already persisted or not |
| Rank | **180s** | last ~15s amber pulse | last ~3s 3-2-1 | none — Commit stays facilitator-gated after T=0 |

### 7.5 Session progress bar

`SessionProgressBar`, 3px navy on cloud-grey, no labels. Expected total = **5** (through the forced Team Behaviors round). Extra rounds do not grow the denominator; the bar sits full through those reveals and SCOREBOARD.

---

## 8. Roles & visibility

| Role | Device | What they see | What they must NOT see |
|---|---|---|---|
| Shared screen (session Lead) | Host laptop, auto-pinned | Public board per §7.3; rank controls; Start / Next / Wrap / Continue | Any `dealt_number` before reveal; in-flight clue text during write |
| Facilitator (player) | Phone | Own number if dealt in; clue field; then named tiles | Other people’s numbers until reveal; rank drag/Commit (those live on the laptop) |
| Clue giver | Phone | Own number, subject, field; then named tiles (including their own) | Other numbers until reveal |
| Spectator this round | Phone | Subject, chips, then talk copy during rank | Every number until reveal; in-flight clue text |
| Member (all) | Phone | Display names, not initials | Secrets listed above |

`dealt_number` is Talk Track’s card / Draw It By Ear’s image / Zoning Rights’ permutation / I Know What You Meme’s owner id / SwitchCode’s `word`. Same class.

---

## 9. Edge cases

Roster stays closed. Ghosts remain on the roster for naming; live connectivity is what the engine uses at round start.

| Situation | Rule |
|---|---|
| Clue giver drops **before** lock | No tile. Number unused. Round continues. |
| Clue giver drops **after** lock | Tile stays. Rank as usual. |
| All clue givers drop before any lock | Zero tiles → miss at timer expiry (§6.1). |
| Facilitator’s phone dies during write | Cookie rejoin on that phone. Clock keeps running. Shared screen is unaffected. |
| Shared laptop dies during rank | Reopen the host link (Shared screen Lead is reused). Ranking lives there. Phones cannot Commit. |
| n = 3 | Every round, everyone writes (`k` capped at n). |
| Duplicate clue strings | Two named tiles. Rank both. |
| Wrap during write or rank | **Not in v1.** Wrap exists on `REVEAL` **from round 5 on** (and is forced on subject starve before dealing). |
| Wrap on reveals 1–4 | **Not offered.** Lead has Next round only. |
| Late join | Closed after Start. |
| Rank clock hits 0 with tiles still Unranked | Lead may still place and Commit on the laptop. No auto-commit of a partial rail. |
| Subject starve at Another round | Another round disabled. Lead must Wrap (allowed even before round 5 if the pack is empty). |

---

## 10. Authorization boundary

If a service-role client is used: verify **before** every scoped read/write.

1. Caller participant identity from cookie.
2. Participant belongs to the session.
3. For play-state reads during `WRITE`: include `dealt_number` **only** if the caller is that clue giver **and** this browser is **not** the room-display pin. Strip all other numbers. Strip other people’s in-flight clue text. Room-display payload: subject, poles, chips, timer — nothing else.
4. For play-state reads during `RANK`: include named tiles (clue text + display name + deal id for ordering) + current rail order. Still strip every `dealt_number`. Rank mutations (`setRail`, `commit`) are **Lead-only** and accepted from the **room-display client** (the shared laptop). Reject those actions from phones. `setRail` applies immediately on that client (optimistic); later layouts must not be overwritten by earlier POSTs.
5. For play-state reads during `REVEAL` / `SCOREBOARD`: numbers, authors, and team total are public.

Room-display reads are authorized as the **Shared screen** Lead participant **plus** a display flag the client sends (cookie-backed). The server still strips secrets for that flag. Shared screen **is** a roster row, named exactly `Shared screen`. It is excluded from the lobby player list, the Start count, Lead transfer to a phone, and the clue-giver pool. It is not a second human.

Acceptance bar includes a network-tab test: a spectator client never contains `dealt_number` before `REVEAL`. The pinned room-display client never contains `dealt_number` before `REVEAL`. A clue-giver client contains **only their** number.

Do **not** put numbers on `session_state.state_json` if that column is open RLS, and do **not** put them on a session-wide Realtime channel.

---

## 11. Facilitator script beats

1. Phones in hand. Faces on the laptop. **This laptop is the shared screen** — it auto-pins. Join immediately on your phone; your number will be there, not here.
2. Name the mechanic: some of you get a secret number. Write one example at that place on the scale. Qualifiers and adjectives are fair game. No counts, numbers, or measures.
3. Name the ranking: everyone talks, including people who did not write. I move the cards on this screen, **0 at the top to 100 at the bottom**. We commit when the column looks right.
4. Name the leak rule: do not say your number, before or while we rank.
5. Start. Do not over-explain Breakfast foods — the poles are on screen with **0** and **100**.
6. After round 5 (first Team Behaviors subject): “Another round, or wrap?” Yes or No. No → scores, NPS, then the two reflection questions. Do not offer Wrap before that reveal.

Lead-only metrics: round index, `k`, `locked / k`, subjects remaining by deck, running team total **on reveal only**. Wrap available from round 5 reveal.

---

## 12. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | 51 subjects: 1 example + 25 general calibration + 25 team behaviors. Source CSV: `docs/protocols/rank-and-file-pack-a.csv` (Earliest Week column from the authoring file is dropped). |
| Intra-session uniqueness | No subject repeats in a sitting. That is not a pack. |
| Engine | Load only through `sessions.content_pack_id` |

When this protocol ships, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §8.4.2. Do not do that until the engine exists.

### 12.1 Subject shape

```ts
type RankAndFileSubject = {
  id: string;
  content_pack_id: string;
  pack_index: number; // 0–50, matches CSV id
  theme: string;
  low_end: string;
  high_end: string;
  category: "example" | "general_calibration" | "team_behaviors";
  active: boolean;
};
```

### 12.2 Pack A (exact copy)

Scale ends on the rail are **0** and **100** (fixed anchors, never dealt). The dealt cards are **1–99**. Low-end and high-end **words** caption those anchors.

**Example (round 1 only)**

| id | Theme | Low (0) | High (100) |
|---|---|---|---|
| 0 | Breakfast foods | Sad | Glorious |

**General calibration (rounds 2–4; 50% of 6+)**

| id | Theme | Low (0) | High (100) |
|---|---|---|---|
| 1 | Things you do when you're in a good mood | Don't do | Do |
| 2 | Things that are still fashionable today | Not at all | Absolutely |
| 3 | Things you'd do differently if nobody could see you | Same either way | Completely different |
| 4 | Things you'd cancel plans for | Wouldn't cancel | Cancel instantly |
| 5 | Things worth waking up early for | Not a chance | Set two alarms |
| 6 | Things you'd admit to a stranger on a plane | Never | Immediately |
| 7 | Ways people show they care | Doesn't land for me | Lands completely |
| 8 | Ways to spend an unexpected free hour | Wasted it | Perfect use of it |
| 9 | Things people pretend to enjoy | Genuinely enjoy it | Pure performance |
| 10 | Skills you'd want if you had to start over | Useless now | Would change everything |
| 11 | Compliments | Means nothing | Would make my month |
| 12 | Things worth paying extra for | Never worth it | Always worth it |
| 13 | Advice you were given growing up | Terrible | Held up perfectly |
| 14 | Things people are secretly competitive about | Nobody cares | Absolutely ruthless |
| 15 | Ways to be remembered | Forgotten in a week | Talked about for years |
| 16 | Things that are harder than they look | Exactly as hard as it looks | Far harder |
| 17 | Things you'd do to avoid making a phone call | Just make the call | Anything but that |
| 18 | Things worth waiting in line for | Walk away | Wait two hours |
| 19 | Music you'd admit to liking | Proud of it | Would deny it under oath |
| 20 | Ways to spend money you didn't expect | Irresponsible | Wise |
| 21 | Things you'd want to know in advance | Rather be surprised | Tell me right now |
| 22 | Things you'd never do again | Would do tomorrow | Never again |
| 23 | Ways to react to bad news | Underreacting | Overreacting |
| 24 | Things worth an argument | Let it go | Worth the fight |
| 25 | Things you'd want to be good at | Wouldn't help me | Would change my life |

**Team behaviors (forced round 5; 50% of 6+)**

| id | Theme | Low (0) | High (100) |
|---|---|---|---|
| 26 | Things that happen in our meetings | Never | Every single time |
| 27 | Reasons to message someone at work | Would feel odd | Completely normal |
| 28 | Ways to open a work message | Cold | Warm |
| 29 | Interruptions | Welcome | Costly |
| 30 | Phrases in a work message | No urgency at all | Drop everything |
| 31 | Ways to say no to a colleague | Soft | Final |
| 32 | Things you'd ask a colleague for help with | Would just ask | Would struggle alone first |
| 33 | Requests from a colleague | You'd do it today | You'd hope they forget |
| 34 | Ways people signal they're overloaded | Nobody would catch it | Impossible to miss |
| 35 | Ways to give someone critical feedback | Gentle | Blunt |
| 36 | Things teams say they'll do | Never happens | Always happens |
| 37 | Decisions at work | One person can make it | Needs everyone in the room |
| 38 | Things worth escalating | Handle it yourself | Escalate immediately |
| 39 | Ways people find out what's really going on here | Never works | Always works |
| 40 | Ways to know someone is finished with something | Ambiguous | Unmistakable |
| 41 | Things you'd need to cover someone's job for a week | Trivial | You'd be lost |
| 42 | Reasons to follow up with someone | Would feel like nagging | Completely normal |
| 43 | Reasons to turn your camera on | Doesn't matter | Would feel wrong not to |
| 44 | Things worth putting in writing | Just say it | Always write it down |
| 45 | Ways a decision gets communicated | Everyone missed it | Nobody could miss it |
| 46 | Ways to disagree in a meeting | Wouldn't register | Would stop the meeting |
| 47 | Unwritten rules on a team | Nobody would care | Real consequences |
| 48 | Questions you could ask in a meeting | No risk at all | Room goes quiet |
| 49 | Things people notice but don't say | Not worth mentioning | Everyone is thinking it |
| 50 | Feedback you've received | Didn't stick | Changed how I work |

---

## 13. Data model (protocol-specific)

Platform `sessions` + `session_participants` unchanged. Protocol tables:

```
rank_and_file_subjects
  id, content_pack_id, pack_index, theme, low_end, high_end,
  category (example | general_calibration | team_behaviors),
  active, created_at

rank_and_file_sessions
  session_id (FK), phase, round_index, current_round_id,
  hits, committed_rounds, created_at

rank_and_file_rounds
  id, session_id, round_index, subject_id, k,
  write_started_at, rank_started_at, committed_at,
  rail_order_json,   -- participant deal ids, left to right
  is_hit, end_reason (commit | zero_tiles | abandoned)

rank_and_file_deals
  id, round_id, participant_id, dealt_number (1–99),
  clue_text, locked_at
```

`dealt_number` and in-flight `clue_text` stay **off** open-RLS `state_json` and off session-wide Realtime. Public rank payload is named tiles (text + display name) + rail order, still without numbers. Hits and `committed_rounds` are derived or cached server-side. Clients never submit a new total.

---

## 14. Session end flow

```
LOBBY
  → WRITE → RANK → REVEAL   (rounds 1–4: Lead Next round)
  → WRITE → RANK → REVEAL   (round 5+: Lead Another round or Wrap)
  → SCOREBOARD → NPS → REFLECTION
```

| Phase | Who acts | Timer | Advance |
|---|---|---|---|
| `LOBBY` | Join on phones; host laptop auto-claims Shared screen; Lead Start at ≥3 phones | none | Lead Start |
| `WRITE` | Dealt players lock one example | **60s** | All connected givers locked, or server timer |
| `RANK` | Room talks; Lead on laptop places / reorders / Commit | **180s** (pacing) | Lead Commit (enabled when Unranked is empty) |
| `REVEAL` (rounds 1–4) | Session Lead | none | **Next round** only |
| `REVEAL` (round 5+) | Session Lead | none | Another round / Wrap things up |
| `SCOREBOARD` | Session Lead **Continue to debrief**. Everyone sees rounds in order, rounds played, percent | none | Existing NPS route |
| NPS / reflection | Platform | — | Standard Season path |

`startProtocol` is Lead-only, lobby-only. First round begins `WRITE` immediately (Breakfast foods).

Lead **Wrap things up** from the round 5+ `REVEAL` jumps to `SCOREBOARD` in one click (I Know What You Meme Wrap). Confirm on Wrap. Not shown before round 5 except subject starve.

Scoreboard hero:

- Rounds played (`committed_rounds`)
- Rounds in order (`hits`)
- Percent in order

Then Continue → `/session/[id]/feedback` (NPS 1–10 + optional comment) → `/session/[id]/reflection`. Do not park on the NPS thank-you. Reflection is the **final screen**.

---

## 15. Reflection close

**Opt-out of moment-conventions §8 standard Season prompts**, with rationale: this Moment’s payload is shared meaning and the unasked question. The two close prompts are the product, not a variant of “what did you assume.”

Register via `reflectionPrompts` on `registerProtocol()`. Ninety seconds each, display-only, nothing stored:

1. Were there instances in Rank & File where the team didn't have a shared understanding? When has this turned up in our work?
2. If you had one question you could have asked before ordering responses, what would it have been? As a team, do we appropriately ask clarifying questions on the things that matter most?

**Facilitator prompt if the room is quiet:**

*“Who had a more precise example and still got ranked wrong — and who didn’t ask what they meant by that word?”*

---

## 16. Locked decisions

| Topic | Locked as |
|---|---|
| Start floor | **3 phones.** Shared screen does not count. |
| Headcount cap | 20 |
| Clue-giver counts | Round 1 = 3, 2 = 4, 3 = 6, 4 = 8, 5+ = 8; if n < k, everyone writes |
| Round 1 subject | Breakfast foods, scored |
| Number deck | Round 1 fixed **8 / 48 / 92** among the three clue givers. Later rounds shuffle 1–99. Rail anchors **0** (top) and **100** (bottom) |
| Write clock | Looks like 60s; server expires at 65s. Last **10s** of the displayed minute flash + pulse; unsubmitted = dropped |
| Rank clock | **180s** pacing; facilitator still Commits after T=0; no auto-commit |
| Rank layout | Single left column, 0 top / 100 bottom; Unranked on the right, row-aligned; ↑/↓ to reorder |
| Rank latency | Optimistic `setRail` on the laptop; serialize POSTs so older writes cannot win |
| Who places | Shared laptop (session Lead), immediately on rank. Phones: talk copy only |
| Clue language | Qualifiers and adjectives encouraged. No counts, numbers, or measures. |
| Rank tiles | Display name + clue text during rank; numbers at reveal |
| Commit | Lead laptop; Unranked empty; exact order or 0 |
| Score | Team +1 / 0; no individuals |
| Hit treatment | **Exact order** headline + large check / rings. Miss copy: **One card off.** |
| Fairness | `max − min` clue-giver turns ≤ 1 |
| Subjects | No repeat; ignore Earliest Week |
| Round 5 | Forced Team Behaviors |
| Round 6+ | 50/50 Team Behaviors vs general calibration |
| Host laptop | Auto-claims display name **Shared screen**; auto-pins; no name prompt. Copy: join on your phone. |
| Shared screen sentinel | Roster row, not a player. Excluded from Start count, lobby roster, clue-giver pool, Lead transfer. |
| Facilitator | Plays on their phone as a normal participant. Ranking, Start, Next, Wrap stay on the laptop. |
| Late join | Closed after Start |
| End path | Scoreboard → NPS → reflection |
| Reflection | Protocol-specific pair in §15, not Season defaults |
| Wrap | First offered after round 5 reveal; forced on subject starve |

---

## 17. Degraded fallback

Write this into facilitator notes before the first live run. Do not improvise it.

1. Print or read Pack A subjects. Physical deck of 1–99 (or slips in a hat).
2. Round 1: Breakfast foods, deal three numbers. One minute, people write on paper and pass to the facilitator **face down**.
3. Facilitator writes the examples on a whiteboard in random order, **with names**, no numbers. Three minutes. The room orders them **top to bottom, 0 to 100**. Facilitator is the hands.
4. Flip the papers. Score +1 only if exact. Then next subject.
5. From round 5, pick a Team Behaviors card. After that, ask Wrap or another round.
6. Tally hits / rounds on the board. Then the two reflection questions without the app.

What is lost: secret numbers on a shared video grid; fairness tracking; pin/phone split. It still runs.

---

## 18. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain the rail.
2. Self-service QR join works without assistance.
3. Disconnect / ghost: a clue giver drops mid-write → no tile, round still ranks the rest; Lead laptop stays stripped of numbers.
4. Headcounts 3, 5, 8, 12, 20: `k` matches §4.6; at 3, everyone writes every round; at 20, round 4+ still deals 8.
5. RLS / route checks: spectator and pinned room-display network tabs contain **no** `dealt_number` before reveal; a clue giver sees only their number.
6. Throttled-network: double Lock in does not create two tiles; double Commit does not score twice.
7. Degraded fallback in the facilitator notes.
8. Rank reorder: a tile placed in the wrong slot can be moved with ↑/↓ without returning every other tile to Unranked.
9. Round 5 is a Team Behaviors subject. Round 1 is Breakfast foods. Wrap control is absent on reveals 1–4 and present on reveal 5.

---

## 19. Conservative leftovers

Calls this conversation did not make. Build must not invent further mechanics.

| Topic | Conservative option |
|---|---|
| Spelled quantities | Honor system. Server only rejects digits, `$`, `%`. |
| Wrap mid-round | **No.** Finish Commit or wait for zero tiles. |
| Individual “best calibrator” stats | **No.** Team fraction only. |
| Screen-share stop confirm (SwitchCode) | **No.** Pin + copy is enough; numbers never mount on the laptop. |
| Character limit | **250.** |
| Expected progress-bar denominator | **5.** |
| Empty chosen deck at 6+ | Spill to the other deck, then starve. |
| Practice unscored round | **No.** Round 1 is scored Breakfast foods. |
| Rank controls on Lead phone | **No.** Shared laptop only. If the laptop is gone, they reopen the host link. |
| Next round on 1–4 | Lead-gated (not auto). So the room can read the truth column. |
| Shared screen name collision | Sentinel is exact display name `Shared screen` (case-insensitive). A human must not join with that name. |
| Rank drop wait | **No.** Apply the new rail in the UI, then flush. |

---

## 20. Build sequence

One step at a time. Each independently testable.

1. Schema + migrations. Seed Pack A from the CSV. Pack id on the session.
2. Lobby explainer (fake kitchen-gadgets sample; beat dots) + Start gate at 3 phones + Shared screen auto-claim / auto-pin.
3. Role-filtered play payload (strip `dealt_number` for spectators and room display). Load-bearing security step — do not defer. Network-tab tests in §18.5.
4. Round-1 deal: Breakfast foods, k=3, 1–99 unique. 60s write, Lock in, digit reject.
5. Rank rail: 0 top / 100 bottom, named tiles, Unranked right column, ↑/↓, Lead-laptop Commit. 180s pacing clock. Optimistic `setRail`.
6. Reveal Exact order / One card off + truth column (numbers) + running total. Next round on 1–4; Another round / Wrap from 5.
7. Clue-giver fairness + k schedule + n < k cap. Subject uniqueness + round 5 force + 6+ 50/50.
8. SCOREBOARD percent → existing NPS → reflection prompts on the registry.
9. Disconnect rules in §9.
10. Subject starve → forced Wrap.

---

## 21. Open questions

None remaining from the spec conversation. The seven items below were answered 2026-09-20 and folded into §16.

| # | Asked | Locked as |
|---|---|---|
| 1 | Clue-giver schedule 3 / 4 / 6 / 8? | Yes. If n < k, everyone writes. |
| 2 | Rank timer vs Commit? | 180s pacing; Lead still Commits. |
| 3 | Names on tiles during rank? | Yes. Numbers stay hidden until reveal. |
| 4 | Who drags? | Lead only, on the shared laptop. |
| 5 | 100 on the rail? | Yes. Anchors are 0 (top) and 100 (bottom). |
| 6 | Missed write timer? | Dropped. No tile. |
| 7 | When is Wrap first offered? | After round 5. |

---

## Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator on phone; Shared screen sentinel; auto-pin
- [x] § Lobby explainer — beat list + sample data (fake / not Pack A); fixed panel size; beat dots
- [x] § Device context — phone + laptop video
- [x] § UI states — shape/weight table
- [x] § Timer — durations and presentation thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats — plus which Lead-only metrics appear
- [x] § Session end flow — scoreboard → NPS → reflection
- [x] § Reflection — protocol prompts + optional facilitator prompt (Season-default opt-out recorded)
- [x] § Degraded fallback
- [x] § Acceptance bar — includes network-tab secret test
- [x] § Authorization boundary
- [x] § Content pack — required, Pack A = 51 subjects
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence
- [x] Open questions in §21 answered — locked for v1
