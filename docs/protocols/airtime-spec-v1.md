# Airtime — Protocol Spec v1

**Status:** Draft — mechanics decided, tuning simulation pending (§17)  
**Slug:** `airtime`  
**Type:** Real-time (simultaneous turns inside a dive; one server-authoritative 22s turn clock shared by every boat; facilitator-paced between dives)  
**Players:** 2–16 (optimal 6–12). Facilitator plays on their phone. The host laptop is **Shared screen**, not a player.  
**Envelope:** ~15 minutes: two dives, final score, five-minute debrief  
**Owner:** Matt Hendricks  
**Pack mode:** `none`. The treasure deck is part of the tuned mechanic (§6), not a swappable library.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Source documents: *Airtime: App Spec* (Oct 11, 2026) and *Airtime Leader Brief* (facilitator only). Where they disagree with house conventions, this file wins and the choice is recorded in §22–§23. Do not invent further mechanics at build time.

---

## 1. What this Moment is

A push-your-luck diving game. Players are split into **boats**. Each boat shares **one oxygen tank**. Every turn, each diver underwater chooses **Dive Deeper** or **Swim back up**. Deeper treasure is worth much more, deeper divers burn more air, and if the boat's tank runs dry while you are underwater you lose that dive's treasure.

Underwater divers are muted and see only a rough air gauge. Divers who surface become **crew**: they see the exact tank and every boatmate's depth, and they can unmute and talk.

The stated goal is only: **"Bring up as much treasure as you can."** Nobody is told how it is scored. When the facilitator presses **Final score**, the game ends and reveals: **boats win, not individuals.**

**Payload.** Two behaviors, from the leader brief:

1. **Weigh the shared tank before your own treasure.** Personal wins that drain something shared cost the whole team. The best boat plan sends one diver up early as crew, which costs that person their own haul.
2. **Say what you can see.** Crew see what divers can't. That view only helps if they speak early and plainly. The app measures the *conditions* around speaking (blind turns, danger with crew present); the facilitator debriefs the speech itself.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who gives up a personal win so the boat can score, who sees trouble and says it, who hears a warning and trusts it.

**What gets revealed about a person:** whether they assumed scoring was individual; whether they surface early to become crew; whether, as crew, they speak up when the margin goes negative; whether, as divers, they act on a warning.

---

## 2. Players, join, device

- **Start floor: 2 phones. Cap: 16 phones.** The Shared screen does not count. Start is disabled below 2 ("Need 2 to start"). A 17th name is refused: "This moment is full."
- **The facilitator is a player on their phone, with the same experience as everyone else.** Their phone has no Lead controls and sees exactly what any diver or crew member on their boat sees. All Lead controls live on the Shared screen (§2.1, §11). Same split as Rank and File.
- No auth. Phones join with a display name. Same 6-character uppercase join code as every Moment. The facilitator posts the join link (`/join/[code]`) in the Teams chat; the Shared screen also shows the QR.
- **New names close at Start.** Tap-your-name rejoin works for people already on the roster. **No late joiners** (overrides the source spec; §22).
- **Phone is the primary controller; desktop works but is not optimized.** The Teams call stays on the laptop with **cameras on**: hand signals are the only way underwater divers can communicate. The facilitator shares the Shared screen into the call.

### 2.1 Shared screen (host laptop)

The facilitator opens the host link on their laptop and screen-shares it in Teams for the whole session. They play on their phone.

- Opening the host link **does not prompt for a name.** That browser auto-claims as **Shared screen**, auto-pins `localStorage` for this `sessionId`, and its lobby copy says **Join on your phone now.**
- **Shared screen is not a player.** It is a roster row named exactly `Shared screen`, excluded from the Start count, the lobby roster, boat assignment, and every metric. A human may not join with that name.
- The Shared screen is the **session Lead**. Every facilitator control is here (§11).
- **Everyone can see it**, so it **only ever shows public information** (§10). It never receives a tank, a depth, an item, or (before Final score) a boat total.
- Its centerpiece is the **boats graphic** (§12.2): every boat, its name, and the names of the people on it.

### 2.2 Boat sizing

At most **4 people per boat**.

| Players (phones) | Boats | Notes |
|---|---|---|
| 2–3 | 1 boat + **The Orca** (rival boat, no players) | §8.4 |
| 4 | 2 boats of 2 | |
| 5–8 | 2 boats | sizes differ by at most 1 |
| 9–12 | 3 boats | sizes differ by at most 1 |
| 13–16 | 4 boats | sizes differ by at most 1 |

Boats are assigned at random at Start, balanced by size. The facilitator may swap players before dive 1 (§9), always within the 4-person maximum. Boats are fixed after that; there is no rebalancing between dives.

**Boat names (player boats), assigned in this order:** *Calypso*, *Nautilus*, *RV Belafonte*, *Jenny*. The rival boat is always *The Orca*.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster, on phones and on the Shared screen.

**Approach:** coded animated teaching loop (~50s, 10s per beat), same convention as Wrong Answers Only and Zoning Rights. One fixed panel size for every beat (CSS grid overlap). Five beats, five `LobbyExplainerDots`. `useReducedMotion()` → static stacked panels, no dots.

**The explainer must not say or imply how scoring works.** No "your score," no "team score," no "boats win." It teaches the shared tank, not the scoring. "Highest score wins" (beat 5) is allowed because it doesn't say whose score. The explainer never shows the crew's exact tank number.

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep the call on your laptop with cameras on. No talking while you're diving, but you can use hand signals. | Phone + laptop with a video grid. |
| 2 | You'll be on a boat with up to three others from your team, sharing one oxygen tank for the dive. Everyone underwater uses air every turn, and deeper levels use more. | Scuba-tank glyph labeled `SHARED OXYGEN TANK` with a meter; four diver chips. |
| 3 | The deeper you dive, the more valuable the treasure you'll find. Once you're back at the surface, you're done for that dive. | Three item cards with icons, no values: *Rubber duck* (L1, sample), *Pocket watch* (L3), *Handful of gold doubloons* (L5), with "Deeper, more valuable." |
| 4 | Every turn, choose Dive Deeper or Swim back up. Once you're back in the boat, you'll have full access to the instruments and can talk to the other members of your team. | Diver's air gauge ("Low," four segments) and the two buttons. |
| 5 | If your boat's air runs out while you're underwater, you lose your treasure from that dive. Your treasure's value is revealed when you make it back to the boat. Highest score wins. | *Handful of gold doubloons* card greyed with the `LOST` stamp, no value. |

**Explainer items:** *Rubber duck* is an obviously fake sample (`items/sample-rubber-duck.svg`), not in the deck. The L3 and L5 cards are real deck items, shown without values.

**Reuse:** `AirtimeItemCard`, `AirtimeAirGauge`, and the choice buttons from play UI, with the §12 states.

**Attribution:** small caption at the very bottom of the lobby page (the `lobbyFooter` registry slot), on phones and the Shared screen; not inside the explainer and not on any other screen. "Icons from game-icons.net, CC BY 3.0," followed by the authors of the icons actually used (§6.3).

---

## 4. Session flow

```
LOBBY → BOATS → DIVE_ACTIVE → DIVE_RESULTS ─┬─ Next dive → DIVE_ACTIVE
                                                    └─ Final score → FINAL → NPS → REFLECTION
```

1. **Lobby.** Phones join; the Shared screen shows QR, explainer, roster. Shared screen **Start** (≥2 phones).
2. **Boats.** Boats are drawn. The Shared screen shows the boats graphic; every phone shows its boat name and boatmates. The facilitator may swap players on the Shared screen, then taps **Start dive 1**. There is no separate rules screen; the lobby explainer (§3) teaches the rules.
3. **Dive.** The turn loop (§5) runs until the dive ends.
4. **Dive results.** Personal hauls. Boat totals stay hidden.
5. **Facilitator choice** on the Shared screen: Next dive (repeatable, up to dive 5) or Final score. After dive 5, only Final score. Final score ends the game; no more dives.
6. **Final results.** The reveal line, boat standings summed over every dive, winner, dive-by-dive trend, personal totals beside boat totals.
7. **NPS → Reflection.** The reflection screen carries the two Airtime debrief questions (§15). The facilitator runs the five-minute debrief there.

### 4.1 Time budget (15 minutes)

| Segment | Time |
|---|---|
| Join, explainer, boats | ~1:30 |
| Dive 1 | ≤5:36 (14 turns × 22s window + 2s beat; a level-6 round trip is 11 turns, ≤4:24). Windows close early once every underwater diver has chosen, so real dives run shorter |
| Results + final score | ~1:00 |
| Boats plan out loud | 0:30 |
| Dive 2 | ≤5:36 |
| Final score + NPS | ~0:45 |
| Debrief | 5:00 |

At the 22s turn, two full-length dives exceed 15 minutes; one dive always fits, and a second fits when windows close early. Five dives is a hard ceiling, not a target. The brief's cue is "About 10:00, go to Final score."

---

## 5. Dive rules

### 5.1 Diver states

A diver is always one of: **underwater** (depth 1–6), **surfaced** (banked), **lost** (tank ran out), **forfeit** (still underwater when the dive was ended), or **waiting** (their boat's dive is over).

Each dive starts with every player on every boat at **depth 1**, carrying a level-1 item card, with the boat's tank full. No air is drained at the start.

**Haul:** the one item a diver is carrying, always the card from the deepest level reached this dive. Its value stays hidden until the diver surfaces.

### 5.2 Turn resolution

One turn clock for the whole session. Every boat's divers decide in the same window.

1. The decision window opens (22s) for every underwater diver on every boat. Choices: **Dive Deeper** (+1 level; disabled at depth 6) or **Swim back up** (−1 level). There is no "stay." Swim back up moves one level per turn; a diver at depth 1 who swims back up reaches the surface.
2. A tap commits. It cannot be changed. The window closes when **every underwater diver in the session** has chosen, or when the server clock hits zero. A missing choice becomes **Swim back up**. Phones lock the buttons at zero, but the server keeps accepting taps for a **4-second grace** (`lateChoiceGraceSeconds`) before resolving a timed-out turn, so a tap made in time on a slow connection still counts. The grace only applies when someone hasn't chosen; a turn where everyone has chosen still closes at once.
3. All moves apply at once.
4. Any diver who reached a new deepest level draws that level's card (§6.2), sees its name only, and swaps it for the item they were carrying.
5. Any diver now at depth 0 is **surfaced**: their item's value is revealed and banked.
6. **Air drain.** Each boat's tank drops by `airByDepth` for each of its divers still underwater, at their new depth.
7. **Out of air.** If a tank is now **below 0**, set it to 0. Every diver still underwater on that boat is **lost** and scores 0 for this dive; each lost diver sees the item and value they lost. That boat's dive is over. A tank at exactly 0 is not out of air: divers who reach the surface without another drain keep their haul.
8. **Dive end check.** The dive ends when no boat has divers underwater, when `maxTurnsPerDive` is reached (anyone underwater **forfeits**, scores 0), or at the end of the turn in which the facilitator ordered "End dive after this turn" (anyone underwater forfeits).

Surfacing (step 5) resolves before drain (step 6). A diver who reaches the surface on the last possible turn keeps their haul.

A boat whose divers are all back sees: **"Your boat is back. Waiting for the other boats."**

After each resolution, phones show the turn's result (new depth, new item name, gauge) for **2 seconds** before the next window opens. The 2-second beat is not part of the 22s window.

### 5.3 Air needed to surface

A diver at depth *d* who swims back up every turn uses the air for each level they pass on the way up:

| Depth | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Air to surface | 0 | 1 | 2 | 3 | 5 | 7 |

**Air needed now** = sum across the boat's underwater divers. **Margin** = tank − air needed now. A margin of 0 is safe if everyone swims back up from now on. A negative margin means the boat cannot bring everyone back.

### 5.4 Worked example (boat of 3, tank 23)

A round trip from level 1 to level *D* costs 0, 2, 4, 7, 11, or 16 air for *D* = 1 to 6.

- One diver surfaces on turn 1 to become crew: 0 air, 1.0 points on average.
- One goes to level 4: 7 air, 8.0 points.
- One goes to level 6: 16 air, 20.0 points.

That uses all 23 air and averages **29**. Everyone diving to the same depth averages at most **24** (all to level 4, 21 air). Everyone diving to level 6 needs 48 air and scores 0. The plan has no slack: one extra Dive Deeper anywhere on the boat costs someone their haul. That is what the crew is watching.

---

## 6. Treasure deck

### 6.1 Cards

| Level | Treasure | Value |
|---|---|---|
| 1 | Lost flip-flop | 0 |
| 1 | Tangled fishing line | 0 |
| 1 | Scallop shell | 1 |
| 1 | Piece of sea glass | 1 |
| 1 | Pair of sunglasses | 2 |
| 1 | Message in a bottle | 2 |
| 2 | Conch shell | 2 |
| 2 | Ship's spoon | 2 |
| 2 | Brass key | 3 |
| 2 | Pewter cup | 3 |
| 2 | Stoneware jug | 3 |
| 2 | Old brass compass | 4 |
| 2 | Barnacle-covered ship's bell | 4 |
| 3 | Captain's logbook | 4 |
| 3 | Ship's lantern | 5 |
| 3 | Pocket watch | 6 |
| 3 | Silver locket | 6 |
| 3 | Sextant | 7 |
| 4 | Pouch of silver coins | 6 |
| 4 | Bronze figurine | 7 |
| 4 | Gold ring | 8 |
| 4 | Jade pendant | 8 |
| 4 | Pearl necklace | 9 |
| 4 | Navigator's astrolabe | 10 |
| 5 | Silver candelabra | 10 |
| 5 | Pearl-inlaid music box | 11 |
| 5 | Handful of gold doubloons | 12 |
| 5 | Emerald brooch | 13 |
| 5 | Ruby ring | 14 |
| 5 | Admiral's medal of honor | 15 |
| 6 | Black pearl | 17 |
| 6 | Bar of sunken bullion | 18 |
| 6 | Queen's tiara | 20 |
| 6 | Diamond necklace | 21 |
| 6 | Chest of gold coins | 21 |
| 6 | Royal jeweled crown | 23 |

36 cards. Average value by level: 1.0, 3.0, 5.6, 8.0, 12.5, 20.0.

### 6.2 Drawing

**Each boat has its own copy of each level's deck**, shuffled at the start of every dive and drawn without replacement. Every level has at least 5 cards and a boat has at most 4 players, so two divers on the same boat never hold the same card in a dive and no reshuffle is ever needed. Divers on different boats may hold the same item; nobody can see another boat during a dive.

(The source spec shared one deck per level across the session and reshuffled on exhaustion, which contradicts "never the same card" at 7+ players. Per-boat decks keep both the uniqueness and the averages.)

### 6.3 Item graphics

| Requirement | Spec |
|---|---|
| Source (v1) | game-icons.net, CC BY 3.0. Credit in the lobby (§3), naming the license and the authors of the icons used. Check every item has a usable glyph before committing; record any substitutes in the build PR |
| Format | SVG, `viewBox="0 0 64 64"`, one file per item, named by level and item (`l6-royal-jeweled-crown.svg`), in `public/protocols/airtime/items/` |
| Style | Single-color glyph tinted with a design token, set on the level-colored card |
| Legibility | Readable at 48px on a phone; no text inside icons |
| Depth cue | Card background darkens by level using existing tokens only: L1 `warm-white`, L2 `cloud-grey`, L3 `steel-blue`/20, L4 `steel-blue`, L5 `unmute-navy`, L6 `deep-navy` with a 2px `sunrise-gold` border. Glyph and text flip to `warm-white` from L4 |
| Themes | Works on light and dark backgrounds |

(The source spec's sea-glass teal is not a design token. No new color tokens in v1.)

---

## 7. Copy that must be on screen

### 7.1 Rules (deprecated screen)

The rules screen was removed; the lobby explainer (§3) covers this content. The list is kept for reference only and does not render:

1. Bring up as much treasure as you can.
2. Your boat shares one oxygen tank. Divers underwater use air every turn, and the deeper you are, the more you use.
3. Each turn, dive deeper or swim back up. Deeper treasure is worth much more.
4. If your boat's air runs out while you're underwater, you lose your treasure from that dive.
5. Underwater, no talking (hand signals are fine), and you only see a rough air gauge. Once you surface, you can talk.

### 7.2 Persistent play instruction

Visible for the whole dive, not just in the lobby.

| Screen | Banner |
|---|---|
| Diver (underwater) | **You're underwater. Stay on mute. Hand signals only.** |
| Crew (surfaced) | **You're on the surface. You can unmute and talk to your divers.** |
| Waiting (boat back) | **Your boat is back. Waiting for the other boats.** |
| Shared screen, during a dive | **Underwater: stay on mute, hand signals only. On the surface: talk to your divers.** |
| Dive results, final (all) | **Everyone can unmute.** |

Under the protocol label on every dive screen, phones and Shared screen: **Bring up as much treasure as you can.**

Do not show "No searching. No chat." It does not apply.

### 7.3 What no screen may say

No screen claims scoring is individual, and no screen says who wins, until the final screen. The ambiguity is the design; a false statement would undercut the debrief. "Your haul" is allowed; "your score" is not, until the reveal line. The Shared screen's button is labeled **Final score**, never "Reveal scoring," because everyone can see it.

---

## 8. Scoring, reveal, final standings

### 8.1 Dive results

- During a dive, each player sees only their own haul.
- Dive results (phones and Shared screen) list every player's haul for that dive in **alphabetical order**: name, item icon, item name, value. Lost and forfeit divers show 0 with the `LOST` / `FORFEIT` label. No ranks, no boat totals, no rival boat.

### 8.2 The reveal (Final score)

There is no separate Reveal button. **Final score** on the Shared screen (confirm required) ends the game and takes every phone and the Shared screen straight to the final screen, which opens with:

> **Boats win. Your score is everything your boat brought up.**

There is no intermediate per-dive boat-totals screen, and no dive can follow.

### 8.3 Final standings

- **Boat score:** sum of all members' banked hauls across all dives played.
- **Winner:** highest boat score. Ties are shared ("Calypso and Nautilus tie").
- **Display:** the reveal line, then boat ranking with a `WINNING BOAT` mono label, each boat's dive-by-dive totals as a small trend, and each player's personal total beside their boat's total.

### 8.4 The Orca, rival boat (2–3 player sessions)

With one player boat, the rival is **The Orca**, a boat with no players.

- The Orca scores a uniformly random whole number from **10 to 13** each dive (expected 11.5), independent of the player boat's size.
- It appears only on the final screen. It is not in the boats graphic and never appears during a dive or on dive results.
- Winner is decided exactly as §8.3. The Orca's row shows its dive-by-dive totals like any boat, with no members.
- For "Enablers" (§14), The Orca counts toward the average boat score.

---

## 9. State machine

All advances are Shared screen (session Lead) actions unless noted.

| Phase | Who acts | Timer | Advance |
|---|---|---|---|
| `LOBBY` | Phones join; Shared screen auto-claims | none | **Start** at ≥2 phones (assigns boats) |
| `BOATS` | Everyone sees their boat; facilitator may swap players | none | **Start dive 1** |
| `DIVE_ACTIVE` | Underwater divers choose each turn on their phones | 22s per turn | Dive end check (§5.2 step 8) |
| `DIVE_RESULTS` | Facilitator | none | **Next dive** (if dives < 5) · **Final score** (confirm; ends the game) |
| `FINAL` | Facilitator | none | **Continue** → NPS for everyone |
| NPS / reflection | Platform | — | Standard Season path (§15) |

- Every dive resets positions and refills tanks. Boats stay the same for the whole session.
- After dive 5, **Next dive** is disabled and the Shared screen shows "Final dive complete."
- **End dive after this turn** (`DIVE_ACTIVE`, confirm required): every phone and the Shared screen show a 5-second banner, "The dive ends after this turn." At the end of the current turn, anyone underwater forfeits.
- Tank size is set from the boat's roster size at the start of each dive.

**Progress bar:** units = dive 1, dive 2, final. Extra dives do not grow the denominator; the bar sits full through them.

---

## 10. Information and visibility

The information gap between divers and crew is the game. The facilitator gets no extra information: their phone follows the same rules as every other phone, and the Shared screen is public.

| Information | Underwater diver | Surfaced crew / waiting | Shared screen (everyone sees it) |
|---|---|---|---|
| Own depth and item name | Yes | Yes (banked haul, value shown) | — |
| Own item value | No, until surfacing | Yes | — |
| Boat tank (crew label: `OXYGEN TANK`) | Gauge band only | Exact number | No |
| Boatmates' depths | Underwater / surfaced only | Exact per diver | No |
| Air per turn and air to surface, per diver | No | Yes, plus boat total and margin | No |
| Boatmates' item names and values | No | No | No |
| Other boats | No | No | Names and members only (boats graphic) |
| Hauls | Own only | Own only | On results screens only |
| Boat totals | Final screen only | Final screen only | Final screen only |

**Gauge bands** (percent of the boat's starting tank): Plenty > 60%, Half 35–60%, Low 15–35%, Critical < 15%. Divers see the band label and a four-segment meter that drops one segment only when the band changes, never a continuous bar.

**No live all-boats view.** The source spec gave the facilitator a live view of every boat's tank, depths, and margin. With the facilitator playing on equal terms and the Shared screen public, there is nowhere private to show it. The planned after-the-fact view is the highlight card (§14), deprecated in v1.

**Mute rule (honor system).** Underwater divers stay muted and may use hand signals on camera. Surfaced crew may unmute. All boats share one Teams call, so every crew is heard by every boat. That is acceptable: another boat's depths are useless to you. The app cannot enforce any of this, so it states the rule in the banners (§7.2).

---

## 11. Shared screen controls

The Shared screen is the session Lead. Controls sit under a `FACILITATOR` mono label, below the main content. Phones never show these controls, including the facilitator's phone.

| Phase | Shared screen shows | Controls |
|---|---|---|
| `LOBBY` | QR, join code, explainer, player roster (Shared screen hidden), "Join on your phone now" | **Start** (amber, ≥2 phones) |
| `BOATS` | Boats graphic | Swap two players (tap a name, tap another); **Start dive 1** (amber) |
| `DIVE_ACTIVE` | Boats graphic, `DIVE n` label, turn timer, dive banner (§7.2) | **End dive after this turn** (ghost, confirm) |
| `DIVE_RESULTS` | §8.1 | **Next dive** (navy; hidden after dive 5) · **Final score** (amber, confirm) |
| `FINAL` | §8.3 standings | **Continue** (amber) |

During a dive the Shared screen shows **no** per-boat status: no tank, no depths, no "boat is back," no count of who has chosen. Any of those would tell one boat about another.

---

## 12. UI notes (mobile-first phones, desktop Shared screen)

Protocol label: `font-mono uppercase tracking-widest text-[10px]` — `AIRTIME`.

### 12.1 Screens

| Screen | Who | Contents |
|---|---|---|
| Boats | Phones | Boat icon, boat name, boatmates, "The facilitator will start the first dive." |
| Diver view | Underwater players | Depth gauge (1–6, current level filled), item card (value `?`), air gauge (band + four segments), boatmate chips (underwater / surfaced), **Dive Deeper** and **Swim back up** buttons, turn timer, diver banner |
| Crew view | Surfaced players | Exact tank (labeled `OXYGEN TANK`), one row per boatmate (name, depth, air per turn, air to surface), boat air needed and margin, own banked haul, crew banner |
| Waiting view | Boat finished | "Your boat is back," plus your haul |
| Dive results | Phones + Shared screen | §8.1 |
| Final results | Phones + Shared screen | §8.2 reveal line, then §8.3 |
| Shared screen | Laptop, screen-shared | §11 |

### 12.2 Boats graphic (Shared screen)

The Shared screen's main visual from `BOATS` through every dive.

- One card per player boat, side by side (2–4 across, equal width). Order: Calypso, Nautilus, RV Belafonte, Jenny.
- Each card: the boat's own glyph (single-color, same style rules as §6.3; Calypso = schooner, Nautilus = submarine, RV Belafonte = research vessel, Jenny = sailboat; `public/protocols/airtime/boats/`, unknown names fall back to `boat.svg`), the boat name in `font-display` H3, and the members' display names stacked beneath in `font-body`. Full display names, not initials.
- `warm-white` card, `cloud-grey` border, `rounded-lg`, `p-6`. A thin `steel-blue` waterline under the boat glyph. No amber.
- The facilitator appears on their boat like anyone else. No crown or Lead marker.
- The Orca is never shown here.
- In swap mode (`BOATS` only): tap one name, then a name on another boat, to swap them. Selected name gets a 2px navy border. A boat can't exceed 4.
- Must stay legible at screen-share resolution with 16 names: names at least 18px on a 1280px-wide window.

### 12.3 UI states

States are fill + border + glyph, never color alone.

| Element | State | Treatment |
|---|---|---|
| Item card | Underwater | Level-colored card (§6.3), icon, name, `L3` mono badge, value `?` |
| Item card | Surfaced | Same card, value in `font-display`, ✓ glyph |
| Item card | Lost | Icon greyed, dashed border, `LOST` stamp in `signal-red`, value lost shown struck through |
| Item card | Forfeit | Icon greyed, dashed border, `FORFEIT` mono label (no red; not an error) |
| Boatmate chip | Underwater | Outlined, dashed navy border, ↓ glyph |
| Boatmate chip | Surfaced | Solid navy fill, `warm-white` name, ↑ glyph |
| Boatmate chip | Lost | Outlined, greyed, × glyph |
| Margin (crew) | ≥ 0 | Navy number |
| Margin (crew) | < 0 | `signal-red` number with minus sign, plus text "Not enough air to bring everyone up" |
| Choice button | Open | Ghost: `cloud-grey` border, navy label |
| Choice button | Tapped | Solid navy, `warm-white` label, ✓; the other button goes to opacity-40 |
| Dive Deeper at depth 6 | Disabled | opacity-40 |

**Dive Deeper and Swim back up have equal visual weight.** Neither is amber; an amber Dive Deeper would nudge the choice. Dive Deeper sits on the left with a ↓ glyph; Swim back up on the right with a ↑ glyph.

### 12.4 Timer

Follow moment-conventions §3 (`WaoPlayTimer`), adjusted for a 22s window. Same arc on phones and the Shared screen.

| Phase | Duration | Treatment |
|---|---|---|
| Decision window | 22s | Arc, no numerals; amber with subtle pulse in the final **5s**; numeric 3-2-1 in the final 3s |
| Result beat | 2s | No timer |

**Server-authoritative.** The server stores the window's end time; resolution is idempotent and runs when the last underwater diver commits or on the first request after the deadline. Client arcs are display only.

### 12.5 Motion

Depth change: slide 4–8px, 300ms. Item swap: crossfade. Reveal line: fade, 500ms. Results list: stagger 100ms. Boat swap: names crossfade, 200ms. No bounce, no confetti, no shake.

---

## 13. Data model and event log

Platform `sessions` + `session_participants` unchanged. The Shared screen is a `session_participants` row (Rank and File sentinel pattern). Public `state_json` carries only `phase`, `current_dive`, `current_turn`, `turn_ends_at`, `revealed`. Everything else lives in service-role tables (Cover Story / Zoning Rights pattern). Migration `030_airtime.sql`; RLS on, service role only.

```
airtime_sessions
  session_id, phase (boats | rules | dive_active | dive_results | final),
  revealed, revealed_after_dive, current_dive, current_turn,
  rules_ends_at, window_opens_at, turn_ends_at,
  end_after_turn (bool), end_banner_until,
  show_highlight, show_names,             -- unused while the highlight card is deprecated (§14)
  dive_state_json,                        -- live dive: tanks, depths, items, decks; secret
  version,                                -- compare-and-set guard; one winner per resolution
  config_json, created_at

airtime_boats
  id, session_id, name, is_rival (The Orca), sort_order

airtime_boat_members
  session_id, boat_id, participant_id     -- assignment; swaps edit this before dive 1

airtime_dives
  session_id, number, started_at, ended_at,
  end_reason (all_back | max_turns | facilitator)

airtime_boat_dives                        -- written at dive end
  session_id, dive_number, boat_id, tank_start, tank_by_turn[],
  result                                  -- boat total; rival rows carry its random 10–13 score

airtime_diver_dives                       -- written at dive end
  session_id, dive_number, participant_id, boat_id,
  path[], deepest, item_id,
  status (surfaced | lost | forfeit), surfaced_turn, haul

airtime_choices                           -- one row per diver per turn; first tap wins
  session_id, dive_number, turn, participant_id, choice (deeper | up)

airtime_events                            -- append-only
  session_id, dive_number, turn, created_at, type, payload_json
```

The live dive is one JSON document on `airtime_sessions` so a turn resolves in a single compare-and-set write. Only the request that wins that write appends events and dive results.

**Event types:**

| Type | Payload |
|---|---|
| `choice` | participant_id, choice (`deeper` \| `up`), timed_out, depth_before, depth_after, margin_at_choice, crew_present |
| `surfaced` | participant_id, boat_id, haul |
| `air_drain` | boat_id, amount, tank_after, air_needed_now, margin |
| `out_of_air` | boat_id, lost_participant_ids, lost_hauls |
| `forfeit` | boat_id, participant_ids |
| `dive_end` | end_reason |
| `reveal` | after_dive (written by Final score) |
| `facilitator_action` | action |

The event log is the only input to the debrief metrics. Compute them from it; don't track them separately.

### 13.1 Config (one object, `lib/protocols/airtime/config.ts`)

| Key | Default | Notes |
|---|---|---|
| `airPerDiver` | 4, base 11 | Tank = 4 × boat size + 11, refilled every dive. Boats of 2/3/4 start with 19/23/27 |
| `airByDepth` | `[1, 1, 1, 2, 2, 3]` | Air per underwater diver per turn at levels 1–6 |
| `turnSeconds` | 22 | Raised from 15 after playtest feedback |
| `resultBeatSeconds` | 2 | |
| `lateChoiceGraceSeconds` | 4 | Server waits this long past zero for in-flight taps before resolving a timed-out turn |
| `maxTurnsPerDive` | 14 | |
| `maxDives` | 5 | |
| `maxBoatSize` | 4 | |
| `boatNames` | Calypso, Nautilus, RV Belafonte, Jenny | Rival: The Orca |
| `gaugeBands` | 60 / 35 / 15 | Percent of starting tank |
| `timeoutChoice` | `up` | |
| `rivalScoreMin` / `rivalScoreMax` | 10 / 13 | The Orca scores a uniform whole number in this range each dive (mean 11.5) |
| `treasureDeck` | §6.1 | |

v1 locks scoring to **sum** and early end to **forfeit**. The source spec's `best` and `bank` alternatives are not built.

---

## 14. Debrief metrics and highlight card

**Deprecated in v1.** The highlight card and its Show names toggle are not shown; the Shared screen's final screen has only **Continue**. The metrics code (`metrics.ts`) and the event log stay in place so the card can return, likely on a private facilitator surface. The rest of this section records the intended design.

The app can't hear the crew, so metrics show the conditions around speaking, not the speech.

| Metric | Definition | What it prompts |
|---|---|---|
| First to surface | Per boat per dive, the turn the first diver surfaced | Who gave up their dive to become crew, and how early |
| Blind turns | Turns where a boat had divers underwater and no surfaced crew | Stretches where no one could see the whole picture |
| Danger with crew present | Dive Deeper choices made while the boat's margin was negative and at least one crew member was surfaced | A warning could have been given; did it come, and was it heard? |
| Lost divers | Divers lost when a tank ran out | The cost of the shared tank |
| Enablers | Divers whose haul was 2 or less on a boat that beat the average boat score for that dive | Contributions that don't show in personal totals |
| Trend | Boat total, first-surface turn, and lost divers, dive by dive | Did the team change strategy from dive to dive? |

**Highlight card**, on the Shared screen at `FINAL` only, when the facilitator toggles it on. Names off by default. It covers every dive played. Template sentences per dive, in this order, omitting any that don't apply:

> Dive 1: no boat had crew on the surface until turn 4. Divers chose Dive Deeper 7 times while their boat's air couldn't bring everyone back, 5 of those with crew on the surface. 3 divers lost their treasure. Dive 2: first crew surfaced on turn 1, nobody was lost, and the winning boat scored 24, with 2 divers bringing up 1 point each.

The last sentence matters most: it names the enablers' contribution without naming them. With names on, it reads "…with Ana and Bo bringing up 1 point each."

(The source spec also generated a card after each dive for the facilitator. With no private facilitator surface, a per-dive card would either be public before the reveal, which spoils the twist, or give the facilitator's phone extra information. v1 shows it at the final only.)

---

## 15. Session end flow

```
FINAL → Shared screen Continue → NPS (/session/[id]/feedback) → Reflection (/session/[id]/reflection)
```

Reflection is the final screen and is where the debrief runs. Airtime registers `reflectionPrompts`:

1. **Nobody said scoring was individual. Who assumed it was, and how did that change your dive?**
2. **Have there been times in our work as a team where it's been challenging to voice a difficult truth?**

**Facilitator prompts if the room is quiet** (from the brief's follow-ups):

- Crew: what could you see that divers couldn't? Did you say it?
- Divers: did you get a warning? What made you trust it, or not?

---

## 16. Facilitator script beats

Condensed from the leader brief, which is the full version.

1. **Before.** Cameras on in the invite (hand signals). Open the host link on your laptop and share that screen in Teams. Post the join link in the Teams chat. Join on your phone yourself.
2. **Start.** Say only: "Bring up as much treasure as you can." Never say how it is scored.
3. **Dive 1.** Play on your boat like everyone else. Note who surfaced first, who unmuted, who stayed quiet.
4. **After each dive.** Let boats talk for 30 seconds, then **Next dive** if there's time. Don't say how it is scored. Watch what changed.
5. **About 10:00.** **Final score** ends the game and reveals "boats win." Let the room react.
6. **Continue.** Everyone gives a quick 1–10 rating, then the debrief questions appear.
7. **Debrief (5 minutes, MUST items).** Your opening story (30s). Question 1: everyone types in chat and sends on "go"; call on two people. Question 2, same way. One bridge to work.
8. **"That was a trick."** "Nobody said it was individual. Where else do we assume how we're scored?"
9. **Close.** "[Your why-it-matters sentence.] Bring one thing you can see but haven't said to your next 1:1. I'll do the same."

---

## 17. Tuning (before build is final)

Run `scripts/airtime-sim.ts` for boat sizes 2–4 under three strategies: everyone to the same middle depth; one diver deep while the rest surface early; everyone deep. Adjust `airPerDiver`, `treasureDeck`, and `airByDepth` until, at every size:

1. The boat's best plan has one diver going to level 6 and the rest shallow, with one surfacing early as crew.
2. That plan beats everyone diving to the same depth by at least 15%.
3. Everyone diving deep runs the tank dry.

**Average-value check at the current defaults** (lost only below 0):

| Boat | Tank | Best plan (deepest level per diver) | Avg | Best same-depth | Gap |
|---|---|---|---|---|---|
| 2 | 19 | 6, 2 | 23.0 | 16.0 (L4) | +44% |
| 3 | 23 | 6, 4, 1 | 29.0 | 24.0 (L4) | +21% |
| 4 | 27 | 6, 4, 3, 1 | 34.6 | 22.4 (L3) | +54% |

Conditions 2 and 3 hold at every size. Condition 1 holds at sizes 3 and 4; at size 2 the partner reaches level 2 and surfaces on turn 3 rather than turn 1. The simulation must confirm with real card draws and the 14-turn cap, not just averages.

**Known soft spot:** The Orca (10–13 per dive, mean 11.5) is easy for a boat of 3 to beat; a cautious boat of 3 that all go to level 3 averages 16.8. A boat of 2 has to play reasonably well. Revisit after playtests.

**Playtest checks:**

- A dive averages 4:30 or less.
- At least one boat loses a diver in dive 1. If not, tighten the tank.
- Boat totals rise from dive 1 to dive 2 as boats talk between dives. If not, the gap between personal-best and boat-best play is too small.

---

## 18. Edge cases

| Situation | Rule |
|---|---|
| Player disconnects mid-dive | Swim back up applies each turn until they reconnect. They rejoin in their current state |
| Disconnected player still counts toward tank | Yes; tank uses roster size. Boats don't change after dive 1 |
| Facilitator's phone dies | Same as any player: tap-your-name rejoin. The Shared screen is unaffected |
| Shared screen laptop dies or tab closes | Turns keep running on the server clock. Reopen the host link; the Shared screen Lead row is reused. Between-dive controls wait for it |
| Whole boat disconnected | Every member swims back up on turn 1 and surfaces with a level-1 item |
| Simultaneous surfacing and out of air | Surfacing resolves first (§5.2) |
| Tank exactly 0 | Not lost. Lost only below 0 |
| Diver at depth 6 | Dive Deeper disabled; only Swim back up |
| Double tap / retry | Idempotent; first committed choice per turn wins |
| End dive ordered in the last second of a turn | Applies to that turn; banner still shows for 5s |
| Final score pressed by mistake | Confirm step first; once confirmed the game is over and Next dive is refused |
| Talking between dives | Allowed on results screens. All boats hear each other |
| Late join | Closed after Start |
| Headcount above 16 | Join refused |
| Someone joins as "Shared screen" | Refused; that name is reserved (case-insensitive) |
| Pre-dive swap would put 5 on a boat | Swap only, so sizes never change; the 4 cap holds |
| Ties | Shared |

---

## 19. Authorization boundary

Airtime has more secrets than any earlier Moment. They are the same class as Draw It By Ear's image: **stripped server-side**, never hidden only in the UI, never on a session-wide Realtime channel.

| Secret | Who may receive it |
|---|---|
| A diver's item value | Nobody, until that diver surfaces or is lost. Then that diver; on results screens, everyone |
| A boatmate's item name | Nobody during the dive. Results screens: everyone |
| Exact tank, boatmates' depths, air needs, margin | Surfaced or waiting members of that boat only |
| Other boats' state | Nobody |
| Boat totals before Final score | Nobody |
| Deck order | Nobody |

The Shared screen is treated as the most public client: it receives boat names, members, phase, timer, and results only.

Every route using the service-role client must first:

1. Verify the caller's participant identity from the cookie.
2. Confirm the participant belongs to the session.
3. Build the play payload from the caller's **current diver state**, applying the table above. The facilitator's phone gets no special treatment; being the session's creator grants nothing on a phone.
4. Shared screen reads: authorized as the Shared screen Lead participant plus the display flag (Rank and File pattern). Payload is public-only.
5. Choice writes: caller is a phone participant underwater on a boat, phase is `DIVE_ACTIVE`, turn matches, no choice yet this turn. The Shared screen can never write a choice.
6. Lead actions (start, swap, start dive, end after turn, next dive, final score, continue): Shared screen Lead only.

The session-wide Realtime channel carries only `phase`, `current_turn`, `turn_ends_at`, and a "state changed" ping. Clients refetch their role-filtered payload.

Choice taps: optimistic local state → server write → ack. Retry twice, then a non-blocking warning. Server truth at window close.

---

## 20. Degraded fallback

Write into facilitator notes before the first live run.

1. Facilitator is dive master and does not play. Boats are Teams breakout groups (or named groups in the main call).
2. Facilitator keeps a sheet per boat: tank, each diver's depth. The 36-card list (§6.1) is numbered by level; draw with a dice app.
3. Each turn (30s), divers privately chat the facilitator **D** (dive deeper) or **U** (swim back up). Missing = U.
4. Facilitator applies moves, tells each diver their new item name privately, drains air, and posts each boat's gauge band (Plenty / Half / Low / Critical) in the boat chat.
5. Surfaced divers get the exact tank and depths from the facilitator and may unmute.
6. Run one dive. Reveal "boats win." Debrief with the two questions.

What is lost: speed (30s turns, one dive), automatic margin math, the highlight card, facilitator parity. The payload still runs.

---

## 21. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain the diver vs crew views.
2. Self-service join from the Teams-chat link and the Shared screen QR. Host link auto-claims Shared screen with no name prompt.
3. **Network-tab tests:** an underwater diver's client never contains their own item value, the exact tank, boatmates' depths, or any other boat's state. A surfaced crew client never contains another boat's state or boatmates' item values. The Shared screen client never contains a tank, depth, item, or margin, and contains no boat total before Final score. The facilitator's phone payload matches any other player's in the same diver state.
4. Headcounts 2, 3, 4, 5, 8, 9, 12, 13, 16: boat sizing matches §2.2; no boat exceeds 4; The Orca appears only at 2–3 and only on the final screen. Shared screen is never counted or placed on a boat.
5. Boats graphic on the Shared screen shows every boat name and every member's full name, legible over a Teams screen share at 16 players.
6. One shared turn clock: the window closes early only when every underwater diver in the session has chosen.
7. Resolution order: a diver reaching the surface on the turn the tank would go negative keeps their haul; a tank ending at exactly 0 loses nobody.
8. Disconnect mid-dive: Swim back up is applied; rejoin restores state; the dive does not stall. Shared screen tab closed mid-dive: dive finishes; reopening the host link restores controls.
9. Throttled network: double-tap does not create two choices; the server's resolution matches the last persisted choice.
10. Dive time ≤ 5:36 with 14 turns.
11. No Lead control renders on any phone, including the facilitator's.
12. Degraded fallback in the facilitator notes.

---

## 22. Locked decisions

| Topic | Locked as |
|---|---|
| Players | 2–16 phones; facilitator plays on their phone |
| Facilitator parity | Facilitator's phone is an ordinary player phone: no Lead controls, no extra information |
| Shared screen | Host laptop auto-claims `Shared screen`; session Lead; not a player; public information only; screen-shared in Teams |
| Boats graphic | Shared screen shows every boat, its name, and its members, from `BOATS` through every dive |
| Boats | Random, balanced, at most 4 per boat. 2–3 = one boat vs The Orca; 4 = 2×2; 5–8 = 2; 9–12 = 3; 13–16 = 4 |
| Boat names | Calypso, Nautilus, RV Belafonte, Jenny; rival The Orca |
| Buttons | **Dive Deeper** (+1 level), **Swim back up** (−1 level per turn) |
| Turn length | 22s, one clock for every boat |
| Early close | When every underwater diver in the session has chosen |
| Out of air | Tank below 0. Exactly 0 is safe |
| Live all-boats view | Not built (no private facilitator surface) |
| Join | Link or QR, same join code; names close at Start; no late joiners |
| Scoring | Sum across dives. No `best` mode |
| End early | Forfeit. No `bank` mode |
| The Orca (rival) | Random 10–13 per dive (mean 11.5); shown only on the final screen |
| Reveal | No separate button. **Final score** ends the game and the final screen opens with the reveal line |
| Debrief questions | The two in §15, on the reflection screen via `reflectionPrompts` |
| End path | Final → NPS → reflection |
| Icons | game-icons.net, CC BY 3.0, credited in the lobby |
| Pack | None |

---

## 23. Conservative leftovers

Calls the conversation did not make. Build must not go further.

| Topic | Conservative lock |
|---|---|
| Choice change | First tap commits; no changing |
| Result beat | 2s between turns, outside the 22s window |
| Timer urgency | Amber at 5s, numerals at 3s (house thresholds kept for the 22s window) |
| Deck | Per-boat decks per level, no reshuffle (§6.2) |
| Card depth colors | Existing tokens only; no teal |
| Choice buttons | Equal weight, neither amber |
| Highlight card | Deprecated in v1 (§14); metrics code retained |
| Shared screen during a dive | Boats graphic, dive number, timer, banner. No per-boat status |
| Tank on dropouts | Roster size, not connected count |
| Boat changes | Swaps before dive 1 only; no rebalancing between dives |
| Hold / stay choice | Not in the source; not built |

---

## 24. Build sequence

One step at a time. Each independently testable.

1. `config.ts` + pure engine: boat sizing (max 4), tank, turn resolution, per-boat decks, rival boat. Unit tests for §5.4, §17's table, §2.2 sizing at every headcount 2–16, and every §18 row that touches resolution.
2. `scripts/airtime-sim.ts` tuning run (§17). Do not build UI until the defaults pass or are retuned.
3. Schema + migrations (§13).
4. Role-filtered play payload (§19), including the public-only Shared screen payload. Load-bearing security step; do not defer.
5. Shared screen auto-claim + auto-pin (Rank and File pattern); lobby explainer; Start gate at 2 phones; cap at 16; icon attribution.
6. Boats graphic + `BOATS` swap mode + Start dive 1.
7. Dive loop: 22s server clock, choice writes, resolution, diver view.
8. Crew view + waiting view.
9. Shared screen dive view + End dive after this turn.
10. Dive results + Next dive + Final score.
11. Final standings + The Orca + trend.
12. Event log → metrics (highlight card deprecated in v1).
13. NPS → reflection with Airtime prompts.
14. Icons: verify coverage, SVG set, depth-colored cards, per-boat glyphs.
15. Disconnect paths (§18).

---

## Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator plays on phone; Shared screen sentinel
- [x] § Lobby explainer — five beats, fake sample data, fixed panel
- [x] § Device context — phone + laptop video, cameras on, Shared screen shared
- [x] § UI states — shape/weight table
- [x] § Timer — 22s window, thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats + Shared screen controls
- [x] § Session end flow — final → NPS → reflection
- [x] § Reflection — Airtime prompts + facilitator prompts
- [x] § Degraded fallback
- [x] § Acceptance bar — network-tab secret tests
- [x] § Authorization boundary
- [x] § Content pack — none
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence
- [x] Tuning simulation passed (§17) — `npm run sim:airtime`, defaults unchanged
