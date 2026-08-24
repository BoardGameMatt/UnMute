# Talk Track — Protocol Spec v1

**Status:** Draft for review  
**Slug:** `talk-track`  
**Type:** Real-time (one active team; server-authoritative 60s clock)  
**Players:** 4–20 (optimal 8–12). Facilitator is a player.  
**Envelope:** ~12–20 minutes depending on headcount and extra cycles  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is 30 cards, authored separately (see §14).

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Decisions from the spec conversation are in §16. Where this document needed a call the conversation did not make, the conservative option is recorded in place.

---

## 1. What this Moment is

A team is a **Talk Track**: a spoken sentence built one word at a time, in order, under a shared minute, so a teammate who cannot see the card can name the word.

Five words sit on the card. They do not relate to one another. They get harder, and they are worth 1, 2, 3, 4, then 5. The train hits Stop when the sentence is a clue. The guesser guesses out loud. The train goes silent until Got it or Pass. Then the next word. Then the next team.

**The railroad metaphor is the surface. The payload is sequential constraint.** You cannot dump the clue. You cannot skip the person next to you. You have to leave a grammatical sentence the next person can add to, without saying the thing you are trying to say.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who hogs the Stop button, who builds a sentence someone else can finish, who guesses too early.

**What gets revealed about a person:** whether they can add one useful word without breaking the chain; whether they stop too soon or too late; whether the room can stay quiet while another team is live.

---

## 2. Players, join, device

- **Start floor: 4.** One team is legal (rehearsal / tiny room). They play timed turns against the card and their own previous score. Competitive “against one another” begins at 8 (two teams).
- **Cap: 20**, which is at most **5 teams** (see §5). Eight language names exist so assignment has variety, not so a room can have eight teams.
- **The facilitator is a player.** They are assigned to a team and take turns. They also get Lead-only controls (pause the auto-advance, nudge totals, Another Round, End).
- No auth. Lobby: display name. Same 6-character join code as every Moment. Phone is the primary controller; desktop works but is not optimized. Video call stays on the laptop.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.
- All play stays in the **main video room**. No breakouts. Sitting-out teams watch.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~20s, looping). `useReducedMotion()` → static stacked panels. Easy sample data only — never a real Pack A card.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep everyone's video up on your laptop. | Phone + laptop with a video grid. |
| 2 | One word each. Build a real sentence. Hit Stop when the clue is done. | Three named train cars adding SOCK → “The / missing / sock” then a Stop control. |
| 3 | Do not say the word. After Stop, the Talk Track goes silent. | Guesser face; train mouths closed; Stop already pressed. |
| 4 | Five words. Harder as you go. 1, 2, 3, 4, then 5. | Sample ladder with SOCK 1pt highlighted, then LADDER, MUSTARD, ASTRONAUT, PHOTOSYNTHESIS dimmed. |
| 5 | Other teams can see the card. Watch. Don't help. | Second team labelled “watching” with no mic. |

**Sample data (obviously fake):** `SOCK / LADDER / MUSTARD / ASTRONAUT / PHOTOSYNTHESIS`

**Reuse:** the five-word ladder and Stop control from play UI, with the same visual states as §9.

---

## 4. Core mechanic

### 4.1 A turn

Exactly one team is live. Everyone else watches.

1. Server picks the **guesser** (see §6) and a **fresh card** (see §14). Remaining teammates are the **Talk Track**, in a random order that stays fixed for the turn.
2. The 60-second clock starts for the whole room. It **does not pause** for guessing.
3. Word 1 is current. The person listed first in the train **starts** this word. Each Talk Track member, in order, adds **exactly one spoken word**. The train **cycles** until someone hits Stop.
4. Stop is available on every Talk Track phone from the moment the turn starts. The app cannot hear the room (honor system). Hitting Stop does not require it to be “your” spoken turn.
5. On Stop: Talk Track **cannot add anything** — no extra words, no coaching. The guesser guesses **out loud** on the video call, as many tries as they want.
6. Any Talk Track member taps **Got it** or **Pass**. **First tap wins.** The guesser has no confirm control.
7. Got it → that slot’s points hit the team total. Pass → 0 for that slot. Either way, the **next word** highlights and a **new sentence** starts.
8. Repeat until all five are resolved, or the clock hits zero.

### 4.2 Who starts the next word

Starter **rotates each word**, even if Stop landed mid-cycle.

Train of Matt → Claudia → Alex, Ed guessing:

| Word | Starter | Then |
|---|---|---|
| 1 | Matt | Claudia, Alex, Matt, … until Stop |
| 2 | Claudia | Alex, Matt, Claudia, … until Stop |
| 3 | Alex | Matt, Claudia, Alex, … until Stop |
| 4 | Matt | … |
| 5 | Claudia | … |

Phones show the train as an ordered name list and **badge the starter for the current word**. They do **not** highlight whose spoken turn it is right now — the app does not know. Honor system for passing the word.

### 4.3 All five before time

Turn **ends immediately**. Points for that turn are in the bank (max 15). Short hold, then the next team. No leftover-time bonus in v1.

### 4.4 Time’s up

When the server clock hits zero:

- All input disables immediately (Stop, Got it, Pass).
- Every screen goes to the **Time’s up** hold — including the live team and the guesser. The card is gone.
- The current word, if not yet marked, scores **nothing**. No in-flight Got it beat.
- If it was clearly in and the clock won the race, the Lead **nudges the team total** on the hold (§8.2).

### 4.5 Clue rules (honor system + Lead nudge)

The sentence is spoken. The platform does not transcribe it. These are room rules. Breaking them voids that word; the Lead subtracts the slot value from the team total.

**Illegal**

- Saying the target word, or a form of it (`run` / `running`)
- Spelling, initials, or “starts with…”
- Rhymes / “sounds like”
- A foreign-language equivalent of the word
- Gestures, holding objects up, drawing in the air
- Breaking grammar — the running sentence must remain a grammatically correct English sentence. If it breaks, that clue is void.

**Legal**

- Proper nouns and real names, if they are not the target word
- One English word per person, including articles and prepositions (`the`, `of`, `toward`)
- Stopping after a single word, or cycling many times, as long as Stop is hit before the guesser is supposed to guess

**Spectator rule:** sitting-out teams can **see the card**. They must not clue, mouth, chat, or react in a way that names the word. Persistent copy on their phones: “Watch. Don't help.”

### 4.6 Persistent play instruction

Visible on every play screen for the whole session, not only in the lobby:

> One word each. Keep it grammatical. Do not say the word. After Stop, the Talk Track is silent.

Sitting-out screens add:

> Watch. Don't help.

---

## 5. Teams

### 5.1 Formation

Computed at Start. Randomized assignment — not alphabetical, not join order.

**Algorithm**

1. `teamCount = floor(n / 4)`
2. Partition `n` into `teamCount` sizes **as even as possible**, each at least 4.

Remainder is **spread**, not dumped onto one team.

| n | Teams | Sizes |
|---|---|---|
| 4 | 1 | 4 |
| 5 | 1 | 5 |
| 6 | 1 | 6 |
| 7 | 1 | 7 |
| 8 | 2 | 4, 4 |
| 9 | 2 | 5, 4 |
| 10 | 2 | 5, 5 |
| 11 | 2 | 6, 5 |
| 12 | 3 | 4, 4, 4 |
| 13 | 3 | 5, 4, 4 |
| 14 | 3 | 5, 5, 4 |
| 15 | 3 | 5, 5, 5 |
| 16 | 4 | 4, 4, 4, 4 |
| 17 | 4 | 5, 4, 4, 4 |
| 18 | 4 | 5, 5, 4, 4 |
| 19 | 4 | 5, 5, 5, 4 |
| 20 | 5 | 4, 4, 4, 4, 4 |

Start is disabled below 4. Above 20 is out of scope for v1.

### 5.2 More than four on a team

**1 random guesser + everyone else in the train.** A five-person team is four clue-givers. Nobody sits out of their own team’s turn.

### 5.3 Names

Each team gets a distinct name from this pool, assigned at random without replacement for the session. Unused names stay unused.

| # | Name |
|---|---|
| 1 | The Openers |
| 2 | The Anchors |
| 3 | The Last Words |
| 4 | The Closers |
| 5 | The Throughlines |
| 6 | The Q's |
| 7 | The Asides |
| 8 | The Prompts |

These names are **language**, not locomotives. They teach the mechanic: who starts, who holds, who stops, who leaves a line someone else can finish. Eight is enough — a room never has more than five teams.

Do not invent names at runtime.

### 5.4 Turn order

Random team order, persisted for the session. Every cycle uses the same order.

---

## 6. Guesser rotation

Guesser is chosen at the **start of the turn**, before the card is in anyone’s payload.

**Fairness:** do not repeat a guesser on that team until everyone on the team has been guesser once. Then the pool resets. Pure random inside the eligible pool.

Do **not** promote a Talk Track member to guesser mid-turn. They have already seen the card.

---

## 7. Session flow

```
LOBBY → TEAM_REVEAL → TURN → HOLD → TURN → … → (cycle 2, auto)
      → HOLD after last turn of cycle 2+ → ANOTHER_ROUND?
      → [Yes: another full cycle] [No: FINAL_SCORES]
      → NPS → REFLECTION
```

A **cycle** is each team taking exactly one turn.  
A **round** in facilitator copy = one cycle.

### 7.1 LOBBY

Standard session shell. Explainer as §3. Lead Start enabled at 4 players.

`startProtocol` is Lead-only, lobby-only. It assigns teams, names, and turn order in one server action. No client-side assignment.

### 7.2 TEAM_REVEAL

Everyone sees named teams and display names (not initials). Lead copy: “Stay in this room. We are not splitting into breakouts.” Short hold, then the first turn starts. Lead can pause.

### 7.3 TURN (60 seconds)

See §4. Server clock (`turn_started_at`) is authoritative. Clients display; they do not decide expiry.

### 7.4 HOLD (~5 seconds, auto-advance)

Turn-over reason is one of: `all_five` | `timer` | `abandoned`.

Everyone sees:

- That turn’s points (e.g. The Openers +6)
- Running totals for every team (first time scores appear this cycle — **hidden during the 60 seconds**)
- Time’s up treatment when `timer`; otherwise the last word resolved and the turn ended

Then auto-start the next team. **Lead can Pause** (stops the auto-advance) and Resume.

### 7.5 Mandatory two cycles

After cycle 1’s last HOLD, cycle 2 starts automatically (same team order, new guessers, new cards). No Yes/No yet.

### 7.6 ANOTHER_ROUND?

After every team has finished cycle 2 (and after every extra cycle):

- Members: waiting copy, last-cycle totals visible.
- Lead: **Another round?** Yes / No. Yes = one more full cycle (every team gets one more turn). Repeat until No, or until the pack cannot deal a unique card to the next team (§14.3).

Facilitator copy: “One more round for every team — not just the team that just played.”

### 7.7 FINAL_SCORES → NPS → reflection

Standard Season path. Scoreboard Continue → `/session/[id]/feedback` (NPS 1–10 + optional comment) → `/session/[id]/reflection`. Do not park on the NPS thank-you. “MPS” in the original brief is this NPS step.

---

## 8. Scoring

### 8.1 Math

| Slot | Points if Got it |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |

Pass = 0. Expired unmarked = 0. Max per turn = 15. Team total = sum of its turns. No individual leaderboard in v1. No bonus for leftover time.

### 8.2 Lead override

Lead can **nudge a team’s running total by ±1**, repeatable, on HOLD and on FINAL_SCORES. Not during the live 60 seconds. Not a per-word flip.

Used when the clock beat a clear Got it, when a clue was illegal, or when first-tap Got it/Pass was wrong. Subtract or add the slot value by tapping ±1 that many times.

Show a small `FACILITATOR` label and the current totals. Members never see the nudge controls.

### 8.3 When scores are visible

| Moment | Visible? |
|---|---|
| During the 60 seconds | No |
| HOLD / ANOTHER_ROUND? / FINAL_SCORES | Yes |

---

## 9. UI states

States cannot be color-only. Amber is reserved for the primary action (Stop, then Got it) and timer urgency.

### 9.1 Word ladder (Talk Track + sitting-out teams; **never the guesser**)

| State | Treatment |
|---|---|
| Upcoming | `warm-white`, 1px navy @ 20% opacity, points in `font-mono` |
| Current | `warm-white`, 2px solid navy, navy left bar, word + points |
| Scored | navy check glyph, slot points shown, no extra amber fill |
| Passed | 2px dashed navy, em dash / “Passed” |
| Expired | dimmed upcoming treatment, no check |

### 9.2 Controls

| Control | Who | Treatment |
|---|---|---|
| Stop | Talk Track, until pressed or timer | Primary amber while the sentence is live |
| Got it | Talk Track, only after Stop | Primary amber |
| Pass | Talk Track, only after Stop | Ghost |
| Disabled after first confirm | — | opacity-40 |

Guesser never sees Stop / Got it / Pass.

### 9.3 Role screens (same clock, different payload)

| Role | Sees |
|---|---|
| **Guesser** | Clock, own team name, train names (starter badge), “Listen.” After Stop: “Guess. They cannot help.” **No words.** |
| **Talk Track** | Clock, ladder, Stop → Got it/Pass, persistent instruction |
| **Sitting-out** | Clock, ladder, “Watch. Don't help.” No Stop |
| **Lead** (in addition to their player role) | Pause on HOLD, ±1 totals, Another Round, End |

Display names on play and hold screens. Initials alone are insufficient.

### 9.4 Timer presentation

Follows the WAO pattern (`WaoPlayTimer.tsx`). Duration **60s**.

| Phase | Treatment |
|---|---|
| Most of the turn | Depleting circular arc, no numerals. Track `cloud-grey`, fill `unmute-navy` |
| Final ~15s | Arc `signal-amber`, subtle pulse (1s cycle) |
| Final ~3s | Large numeric 3-2-1 (accessibility exception) |
| T=0 | Numerals gone. **Blank hold: “Time’s up.”** No settle window for taps — Stop/Got it/Pass already disabled at T=0 |

Opt-out of WAO’s post-timer tap settle: there is no in-flight clue text to reconcile. First-tap Got it/Pass is already persisted or it is not.

### 9.5 Session progress bar

`SessionProgressBar`, 3px navy on cloud-grey, no labels. Expected total = turns in **two** cycles (`2 × teamCount`). Extra cycles do not grow the denominator; the bar sits full through ANOTHER_ROUND? and FINAL_SCORES.

---

## 10. Disconnects and ghosts

Roster stays closed. Ghosts remain on the team for naming; live connectivity is what the engine uses at turn start.

| Situation | Rule |
|---|---|
| Talk Track member drops **mid-turn** | Drop them from the remaining train. Starter rotation uses who is still connected. |
| Guesser drops **before** the card is dealt | Re-roll guesser from the eligible pool. |
| Guesser drops **after** the card is dealt | Abandon the rest of the turn (`abandoned`). Keep points already banked this turn. Do not promote a clue-giver. |
| Team has **fewer than 4 connected** at turn start | Skip the turn (0). They return in later cycles if people rejoin. |
| Lead’s phone dies | Host-token / cookie rejoin. Pause exists so the room can wait. |

---

## 11. Authorization boundary

Card words are the DIBE image. **The guesser must never receive the five words** — not in the initial play payload, not in a Realtime event, not in an error toast.

Every Talk Track route that uses a service-role client must, before touching it:

1. Verify caller participant identity from the cookie.
2. Confirm that participant belongs to the session.
3. For card reads: if the caller is the live guesser, strip `words` (and any equivalent) from the response. Sitting-out participants **are** allowed to see words.
4. For Stop / Got it / Pass: caller must be on the live team’s Talk Track (not the guesser, not another team).
5. For Lead nudge / Another Round / Pause: caller must be the session Lead.

Acceptance bar includes a network-tab test: guesser’s client never contains the current card’s words.

Session-wide Realtime is acceptable (one live team, spectators supposed to see the card). Do **not** put `words` on a channel the guesser is subscribed to. Either:

- two payloads (guesser vs everyone else), or
- words only on a team+spectators channel that excludes the guesser id.

---

## 12. Facilitator script beats

1. Stay in this room. Phones in hand. Faces on the laptop.
2. Name the mechanic: one word each, a real sentence, Stop, then the guesser talks and you do not.
3. Name the illegal list once: don’t say the word, don’t spell, don’t rhyme, don’t gesture, don’t break the sentence.
4. Name the spectator rule: you will see the other team’s card. Watch. Don’t help.
5. Start. Do not over-explain the train — the starter badge and the ordered names are enough.
6. After cycle 2: “Another round for every team?” Yes or No. No → scores, then the two reflection questions.

Lead-only metrics: cycle `k` of 2 (then “extra”), whose turn, cards remaining, team totals on HOLD.

---

## 13. Reflection close

Standard Season prompts, ninety seconds each, display-only:

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

**Facilitator prompt if the room is quiet:**

*“Who stopped the sentence too early? Who kept adding words after the clue was already there? That’s the same as a handoff that is either a stub or a novel.”*

---

## 14. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | 30 cards, five unrelated English words each, difficulty ascending by slot |
| Intra-session uniqueness | No card repeats in a sitting. That is not a pack. |
| Engine | Load only through `sessions.content_pack_id` |

Pack A authoring is a **separate workstream**. Do not block the build on the finished 30. Seed **3 fixture cards** (including the lobby sample set, marked non-playable) so Start works in rehearsal.

When this protocol ships, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §8.4.2. Do not do that until the engine exists.

### 14.1 Card shape

```ts
type TalkTrackCard = {
  id: string;
  content_pack_id: string;
  words: [string, string, string, string, string]; // slots 1–5
  active: boolean;
};
```

Points are implied by slot index, not stored on the card.

### 14.2 Authoring rules for Pack A (when that work starts)

- The five words on a card **do not relate**. No theme, no category, no obvious pair (`salt` then `pepper`).
- Slot 1: common concrete noun. Slot 5: hard to clue one word at a time without saying it (abstract, precise, or easy to “just say the thing”).
- No word appears twice inside Pack A.
- No target word that is illegal to say in a workplace room.
- English, US spelling, one or two tokens max per slot (`fire box` is a miss — use `firebox` or a different word).
- Write so a grammatical sentence can exist. Avoid words that only work as a punchline with a gesture.

### 14.3 Dealing

Random draw from unused `active` cards in the session’s pack at **turn start**. Consume even if the turn is later abandoned. If the next turn cannot be dealt, ANOTHER_ROUND? Yes is disabled and the Lead is forced toward FINAL_SCORES.

Capacity check: 5 teams × 2 mandatory cycles = 10 cards. 30 cards allow several extra cycles at 20 people; one team could theoretically eat the pack — the Lead’s No is the intended stop.

---

## 15. Data model (protocol-specific)

Platform `sessions` + `session_participants` unchanged. Protocol tables:

```
talk_track_cards
  id, content_pack_id, word_1 … word_5, active, created_at

talk_track_sessions
  session_id (FK), phase, cycle_index, team_order[],
  current_turn_id, paused (bool), created_at

talk_track_teams
  id, session_id, name, member_ids[], score, sort_index

talk_track_turns
  id, session_id, team_id, cycle_index, card_id,
  guesser_id, train_ids[], started_at, ended_at,
  end_reason (all_five | timer | abandoned | skipped)

talk_track_word_results
  id, turn_id, slot (1–5), outcome (scored | passed | expired | unset),
  decided_by, decided_at

talk_track_score_nudges
  id, session_id, team_id, delta (±1), created_by, created_at
```

`talk_track_teams.score` is derived at read time from word results + nudges, or maintained server-side as a cache that those two streams always update. Do not let the client send a new total.

Team assignment lives on `talk_track_teams.member_ids`. Do not invent a second roster.

---

## 16. Locked decisions

| Topic | Locked as |
|---|---|
| Start floor | 4; one team is legal |
| Headcount cap | 20 → at most 5 teams |
| Remainder | Spread evenly |
| Extra teammates | All in the train |
| Sentence | Spoken; honor system; no live whose-turn highlight |
| Contribution | Exactly one word, then the next person |
| Word visibility | Everyone except the live guesser |
| Facilitator | Plays on a team |
| Confirm | Any Talk Track member; first tap wins |
| Clock | 60s, keeps running during guesses |
| Next-word starter | Rotates each word |
| All five early | Turn ends immediately |
| Time’s up mid-guess | No credit; Lead may nudge |
| Guesser fairness | No repeat until the whole team has guessed |
| Illegal clues | Word / form, spell, rhyme, translation, gestures, broken grammar; proper nouns OK if not the target |
| Next team | ~5s auto HOLD; Lead can pause |
| Override | ±1 on the running total |
| Late join | Closed after Start |
| End path | Scoreboard → NPS → reflection |
| Scores on screen | HOLD and after, not during the minute |
| Team names | The Openers, The Anchors, The Last Words, The Closers, The Throughlines, The Q's, The Asides, The Prompts |

---

## 17. Degraded fallback

Write this into facilitator notes before the first live run. Do not improvise it.

1. Pre-print 30 cards (or as many as you have) as five-line lists.
2. Split the room into teams of 4+ on a whiteboard. Use the name list above.
3. Phone timer, 60 seconds, visible to the room. Facilitator watches the clock.
4. Guesser turns away from any shared screen that shows the card. Talk Track stands or sits in view of the rest of the room.
5. Facilitator holds the card, points at the current line, and listens for Stop. Guesser speaks. Facilitator marks Got it / Pass on paper (1–5).
6. Spectator rule spoken every turn: if you can see the card, you are not helping.
7. After two cycles, ask the room Another round? Score on a whiteboard. Then the two reflection questions without the app.

What is lost: starter rotation is facilitator-policed; first-tap races do not exist; the guesser can accidentally see a laptop. It still runs.

---

## 18. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain the train.
2. Self-service QR join works without assistance.
3. Guesser disconnect after the card is dealt: turn abandons; a clue-giver is **not** promoted; guesser’s network tab never showed `words`.
4. Headcounts 4, 7, 9, 11, 20: formation matches the table in §5.1; 4-person room can complete two turns.
5. RLS / route checks: guesser cannot read the current card; sitting-out team **can**; another team cannot Stop.
6. Throttled-network: first-tap Got it still records once; double-submit does not Got it **and** Pass.
7. Degraded fallback in the facilitator notes.

---

## 19. Build sequence

One step at a time. Each independently testable.

1. Schema + migrations. Three fixture cards. Pack A id on the session.
2. Team formation + name assignment + turn order (unit tests for the §5.1 table).
3. Lobby explainer + Start gate at 4.
4. Role-filtered play payload (guesser strip). This is the load-bearing security step — do not defer it.
5. 60s server clock, timer presentation, Time’s up hold.
6. Stop → Got it/Pass, first tap wins, word ladder states, starter rotation.
7. Scoring + HOLD score strip + Lead ±1 nudge.
8. Two-cycle auto, then Another Round Yes/No, card exhaustion path.
9. FINAL_SCORES → existing NPS → existing reflection. Protocol-specific facilitator prompt only.
10. Disconnect rules in §10.
11. Load Pack A (30) when authored.

---

## 20. Open items

- Pack A: 30 cards. Separate workstream. Spec is not blocked.
- Whether a later pack wants themed cards. v1 forbids a relationship among the five words. Do not quietly add one.

---

## Spec checklist

- [x] § Lobby explainer — beat list + sample data
- [x] § Device context — phone + laptop video
- [x] § UI states — shape/weight table
- [x] § Timer — durations and presentation thresholds
- [x] § Persistent play instruction — exact copy
- [x] § Facilitator script beats
- [x] § Session end flow — scoreboard → NPS → reflection
- [x] § Reflection — standard prompts + facilitator prompt
- [x] § Degraded fallback
- [x] § Acceptance bar
- [x] § Authorization boundary
- [x] § Content pack — required, Pack A = 30 cards (authored separately)
- [x] § Build sequence
