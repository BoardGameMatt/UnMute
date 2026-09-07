# I Know What You Meme — Protocol Spec v1

**Status:** Build spec, mechanics locked for v1 (polish contract)  
**Branch:** `ikwym-v1` (existing implementation; this spec is the Season-aligned rewrite)  
**Slug:** `i-know-what-you-meme`  
**Type:** Turn-based (simultaneous collection; facilitator-paced reveal)  
**Players:** 3–20 (optimal 6–10). Facilitator is a player.  
**Envelope:** ~15–20 minutes at 6–10 people. Above 10, the Lead should wrap reveal before the queue is empty (see §4.4).  
**Owner:** Matt Hendricks  
**Pack mode:** `required`. Pack A is the check-in + stimulus banks in §12. GIFs are player-authored via Giphy — not a pack.

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

An implementation already exists on `ikwym-v1` (engine v2, Giphy `rating=g`, two simultaneous collection rounds, 30s guess, +1 scoring). It was built from a chat prompt against The Truth Is, before moment-conventions, lobby explainers, content packs, role-filtered payloads, and the scoreboard → NPS → reflection path. **This document is the contract for polish.** Where it conflicts with `ikwym-v1`, this document wins.

Locked decisions are in §15. Conservative calls (the original prompt and the later Season moments did not specify) are in §19. Do not invent further mechanics at polish time.

---

## 1. What this Moment is

Everyone answers the **same two prompts**, searches Giphy, and locks one GIF. Then the room sees those GIFs one at a time and tries to name who picked each one.

The GIFs are the surface. **The payload is whether you can read how a specific colleague translates a shared prompt into an image** — and whether they can sit quietly while the room argues about them.

Two prompts per round:

1. A check-in (“How are you showing up today?”).
2. A stimulus (“Name a food”).

Both answers become one search query. The GIF is the compressed artifact. Guessing is the read.

**Primary target dimensions:** D3 (Shared Collaborative Understanding), D8 (Peer Interaction Frequency)  
**Secondary:** D2 (Fulfillment of Relational Needs) — who is legible, who is idiosyncratic, who over-performs “funny.”

**What gets revealed about a person:** whether colleagues can predict their taste and tone; whether they pick something safe or something that is actually them; whether they leak which GIF is theirs.

The original build collected GIFs **one person at a time**. That is withdrawn. Simultaneous collection on shared prompts is the Season learning: the comparison is the point, and sequential collection blows the envelope at eight people.

---

## 2. Players, join, device

- **Start floor: 3.** Two guessers plus one owner on a reveal. Below 3, Start stays disabled.
- **Cap: 20.**
- **Optimal: 6–10.** Reveal is one GIF at a time. Two rounds × *N* people is the queue. At 12+, the Lead wraps early rather than playing 24×30s of guessing.
- **The facilitator is a player.** They answer both prompts, pick GIFs, and guess. They also get Lead-only chrome (broadcast prompts, Next GIF, Wrap, End).
- No auth. Lobby: display name. Same 6-character join code as every Moment.
- **Phone is the primary controller; desktop works but is not optimized.** Video call stays on the laptop. During reveal, the **shared laptop shows the GIF** so faces stay on the video grid. Phones are for guessing.
- **New names close at Start.** Cookie / tap-your-name rejoin works for people already on the roster. No Admit late in v1.

---

## 3. Lobby explainer

Registers as `lobbyExplainer` on `registerProtocol()`. Renders below the join QR, above the roster.

**Approach:** coded animated teaching loop (~16s, looping), same convention as Talk Track and Wrong Answers Only. `useReducedMotion()` → static stacked panels. Easy sample data only — **never a Pack A check-in or stimulus.**

The looping panel is **one fixed size for every beat** (CSS grid overlap). Do not grow/shrink the shell as captions change.

v1 explainer teaches collection + one guess. It does not teach “two rounds” as a separate mode.

### Beats

| # | Caption | What they see |
|---|---|---|
| 1 | Play on your phone. Keep everyone's video up on your laptop. | Phone + laptop with a video grid. |
| 2 | Same two prompts for everyone. Search. Pick one GIF. | Two prompt cards (fake copy) + a 3×3 grid with one cell selected (amber border). |
| 3 | Don’t say which one is yours. | Named chips (Maya, Jordan, Steve); mouths closed. |
| 4 | Then we guess who picked it. Reading them is the score. | Full-width GIF; display-name list; one name selected. |
| 5 | The person who picked it sits this one out. Guessing yourself doesn’t count. Pick something you’d show this team. | Owner chip dimmed; workplace-notice strip. |

**Sample data (obviously fake, not in Pack A):** check-in *“If this meeting were a sandwich, what would it be?”* stimulus *“Name a kitchen appliance.”* Answers *“too much mustard”* + *“toaster”*. Fake GIF is a still illustration, not a live Giphy fetch.

**Reuse:** prompt cards, 3×3 grid cell (selected vs not), display-name chips, lock-in button — same visual states as §7.

---

## 4. Core mechanic

Two **collection rounds**, then a **reveal queue**. Collection is simultaneous. Reveal is one GIF at a time.

### 4.1 A collection round

1. Server draws one unused **check-in** and one unused **stimulus** from this session’s pack (§12). The whole room gets that pair. (Not a unique pair per person.)
2. Lead sees both prompts and taps **Send to team**. Members see “Stand by — your lead is sending the prompts.” Nothing is searchable until that tap. `broadcast` is Lead-only, lobby-complete only in the sense that the session is already `active`.
3. Every phone shows the two prompts with text fields (120 characters each). Persistent copy (§4.5).
4. Both fields filled → **Search GIFs** (navy). The client concatenates `check-in answer + " " + stimulus answer` and calls Giphy with `rating=g` (not configurable).
5. Before the grid: content notice (§4.6). Then a **3×3** of nine GIFs. Tap selects (2px amber border). **Confirm GIF** (amber) is disabled until a cell is selected.
6. Confirm persists that participant’s GIF for this round. They cannot change it. Waiting screen + roster chips (submitted = navy fill).
7. When every **connected** participant has confirmed, the engine advances: round 1 → generate round 2 prompts (Lead broadcasts again); round 2 → build the reveal queue and start the first guess.

Empty Giphy result or missing API key: grid copy **Search unavailable**. They change an answer and search again. They cannot Confirm without a GIF.

### 4.2 What a Confirm means

The participant is asserting: this image is how I would answer those two prompts, and I am willing to have the room attribute it to someone.

Honor system on workplace fit. `rating=g` is a floor, not a guarantee. The notice stays.

### 4.3 Reveal (one GIF at a time)

Queue construction (server, once, when round 2 collection completes):

1. Shuffle all round-1 GIF owners. Then shuffle all round-2 GIF owners. Concatenate. People who missed a round are simply absent from that half.
2. Do **not** put `participantId` of the owner on any payload the guessers receive until that GIF is resolved.

For each queue item:

1. Everyone sees the GIF (phones + shared laptop), the round label, and both prompt strings — **not** the owner’s written answers (those would give the search query away).
2. **30-second** server clock. Presentation follows moment-conventions §3 (`WaoPlayTimer`).
3. Guesser phones: display-name list of everyone **except themselves**. They tap one name, then **Lock in**. Grey → navy (name selected) → amber (locked). Lock is final.
4. **Owner** (the person whose GIF this is): no name list. Copy: “Your GIF is up — stay quiet. See if they can figure it out.” They have no guess control and cannot score on this item.
5. Two paths to resolve: every eligible guesser has locked, **or** the server timer expires. No 3-second tap-settle (a lock is already persisted, or it is not). Unlocked guessers score 0 for this GIF.
6. Reveal: owner’s **display name**, then the names of people who got it. Running totals stay off the guess screen (see §5.3).
7. Lead: **Next GIF** (amber). After the last GIF, that control is **See scores**. Lead may **Wrap things up** from any post-resolve screen (confirm) and skip the rest of the queue.

Self-guess is blocked **server-side**, not only hidden in the dropdown. Owner submitting a guess is rejected.

### 4.4 Envelope and early wrap

| Headcount | Queue if both rounds complete | Lead guidance |
|---|---|---|
| 3–5 | 6–10 GIFs | Play the queue. |
| 6–10 | 12–20 GIFs | Default: play the queue; wrap if energy drops. |
| 11–20 | 22–40 GIFs | Wrap after roughly one GIF per person, or sooner. Do not “finish the content.” |

Collection still runs both rounds at every legal headcount. The cut is on **reveal**, not on skipping round 2. Round 2 GIFs that are never shown are still stored; they simply never enter play.

### 4.5 Persistent play instruction

Visible through collection and guess (not only in lobby):

> Same prompts for everyone. Don’t say which GIF is yours. Guess on your phone — not out loud.

During guess, add under that:

> The person who picked it is sitting this one out.

### 4.6 Content notice (collection, after Search)

Exact copy:

> Search results are unfiltered. Please select only responses that are appropriate for your team and align with your workplace standards.

`rating=g` is still enforced on the request. The notice is not a lie: Giphy `g` is not a workplace filter.

### 4.7 Giphy attribution (required)

Giphy’s API terms require a conspicuous **Powered By GIPHY** mark wherever Giphy content is shown. This is a ToS requirement and a **production-key** requirement (they ask for a screenshot or screen recording of the mark). Plain text “Powered by Giphy” is **not** enough — they have rejected that.

**Asset:** official mark from Giphy’s attribution pack, not a typeset label, not a redesigned logo, not the word “Jiffy” / “Giffy” / similar. Host the file in `/public` (do not hotlink Giphy’s CDN for the mark). Use the **dark-on-light** version on `warm-white`. Do not recolor it into navy or amber.

**Where it appears**

| Screen | Mark |
|---|---|
| Collection, once Search has returned (grid **or** “Search unavailable”) | Under the 3×3 / empty state, above Confirm |
| Reveal guess and reveal show (phones + shared laptop) | Directly under the GIF |
| Lobby explainer | **No.** Sample art is fake, not a Giphy fetch. |
| Waiting / GIF locked / scoreboard | **No.** No Giphy content on screen. |

The mark is environmental, not a CTA. It does not use amber. It does not animate. `useReducedMotion()` does not hide it.

Tapping the mark may open `https://giphy.com` in a new tab. It must not submit, search, or advance the phase.

### 4.8 Production API key

Season / production sittings use a **production** Giphy API key, not a beta key (beta is ~100 searches/hour for the whole room). Env var: `NEXT_PUBLIC_GIPHY_API_KEY`. Set on Vercel project **unmute-app** and redeploy — `NEXT_PUBLIC_` is baked in at build time. How to mint and upgrade the key: Giphy Developer Dashboard (steps live with the facilitator/ops notes, not in this mechanic spec).

---

## 5. Scoring

### 5.1 Math

**+1** to a guesser if their locked name is the owner.  
**0** if they locked the wrong name, or they never locked.  
Owner scores **nothing** on their own GIF. They score normally on everyone else’s.

No partial credit. No bonus for leftover time. No penalty for a wrong guess beyond 0 on that item.

### 5.2 Worked example

Round 1 GIF is Maya’s. Jordan locks Maya (+1). Steve locks Jordan (0). Maya sits out.  
Round 1 GIF is Jordan’s. Maya locks Jordan (+1). Steve locks Maya (0). Jordan sits out.

After those two items: Maya 1, Jordan 1, Steve 0.

### 5.3 When scores are visible

| Moment | Visible? |
|---|---|
| Collection | No |
| During the 30s guess | No |
| After resolve (this GIF) | Correct guessers’ **names**, not a running table |
| Scoreboard | Rank, display name, total. `font-display` names, `font-mono` scores |

No tie-breaker. Shared first is allowed.

---

## 6. State machine

```
LOBBY
  → R1_PROMPTS → R1_SELECTING
  → R2_PROMPTS → R2_SELECTING
  → REVEAL_GUESS → REVEAL_SHOW  (loop Next GIF)
  → SCOREBOARD → NPS → REFLECTION
```

Lead **Wrap** from `REVEAL_SHOW` jumps to `SCOREBOARD`.

| Phase | Who acts | Timer | Advance |
|---|---|---|---|
| `LOBBY` | Join; Lead Start at ≥3 | none | Lead Start |
| `R1_PROMPTS` / `R2_PROMPTS` | Lead Send to team | none | Lead broadcast |
| `R1_SELECTING` / `R2_SELECTING` | Everyone connected confirms a GIF | none | All connected confirmed |
| `REVEAL_GUESS` | Non-owners lock a name | **30s** | All eligible locked, or server timer |
| `REVEAL_SHOW` | Session Lead | none | Next GIF / See scores / Wrap |
| `SCOREBOARD` | Session Lead Continue | none | Existing NPS route |
| NPS / reflection | Platform | — | Standard Season path |

Progress bar: only during reveal. Expected total = length of the queue **at the moment reveal starts**. Wrap does not resize the bar; it may sit unfilled.

`ikwym-v1` phase names (`round1_prompts`, …) may stay in code if mapped 1:1. Do not add a sequential `collectionOrder` / `currentCollectionIndex` back.

---

## 7. UI notes (mobile-first)

Protocol label: `font-mono uppercase tracking-widest text-[10px]` — `I KNOW WHAT YOU MEME`.

### 7.1 UI states

States cannot be color-only. Amber is the primary action (Confirm / Lock in / Next) and the **selected GIF border**, plus timer urgency. Not a fill on chips or the scoreboard.

| State | Treatment |
|---|---|
| Prompt card | `warm-white`, `cloud-grey` border, `rounded-lg`, `p-6` |
| GIF cell, unselected | 1:1, `rounded-md`, 2px `cloud-grey` |
| GIF cell, selected | 2px `signal-amber` |
| Roster chip, not in | `warm-white`, `cloud-grey` border, display name |
| Roster chip, confirmed | navy fill, warm-white name |
| Guess name, idle | `warm-white`, 1px navy @ 20% |
| Guess name, selected | 2px solid navy, navy left bar |
| Guess name, locked | input disabled; check glyph; do not grey the GIF |
| Owner sit-out | navy panel, `font-mono` copy; no name list |
| Resolve: owner | `font-display` name under `IT WAS` mono label |
| Resolve: hit | display names + sunrise-gold check |
| Resolve: miss | no public dump of wrong names |
| Powered By GIPHY | Official mark, dark-on-light, under grid / under GIF. Not a typeset caption. Not amber. |

### 7.2 Timer presentation

Follow moment-conventions §3 (`WaoPlayTimer`), **30s**:

| Phase | Treatment |
|---|---|
| Most of the guess | Depleting circular arc, no numerals. Track `cloud-grey`, fill `unmute-navy` |
| Final ~15s | Arc `signal-amber`, subtle pulse (1s cycle) |
| Final ~3s | Large numeric 3-2-1 |
| T=0 / all locked | Numerals gone. Resolve. No settle window |

**Server-authoritative.** `ikwym-v1` uses `TimerArc` + client `guess_timer_expired`. Polish replaces that with the WAO timer component and a server timestamp (`guess_started_at`). Clients display; they do not decide expiry.

Opt-out of WAO’s 3s tap-settle: a name lock is already persisted.

### 7.3 Buttons

- Search GIFs: navy.
- Confirm GIF / Lock in / Send to team / Next GIF / See scores: grey (unavailable) → **amber** when the precondition is met.
- Wrap things up: navy (secondary to Next).
- Scoreboard Continue: amber, Lead-only, advances **everyone** to NPS.

Withdrawn from `ikwym-v1`: **Replay** (reload) and **Debrief** as the end CTAs.

### 7.4 Shared laptop vs phone

| Phase | Shared laptop | Phone |
|---|---|---|
| Lobby | QR + explainer | Join / wait |
| Collection | Roster + “searching on your phones” | Prompts, search, grid |
| Guess | GIF large, timer, prompt labels, Powered By GIPHY under the GIF, **no names selected** | GIF + mark + name list (or owner sit-out) |
| Resolve | Owner name + who got it | Same |
| Scoreboard | Ranked list | Same; Lead Continue |

---

## 8. Roles and visibility

| Role | Device | What they see | What they must NOT see |
|---|---|---|---|
| Session Lead | Phone + laptop | Player UI for their own GIF/guess **plus** Send / Next / Wrap / submitted `n/N` / GIF `i` of `M` | Other people’s in-flight typed answers; owner id before resolve; other people’s unrevealed `gif_url`s |
| Member | Phone | Own prompts; own grid; public GIF at guess | Owner id before resolve; others’ GIFs still in the queue; others’ locks until resolve |
| Owner (this GIF) | Phone | The GIF, sit-out copy | Name list; any guess counts until resolve |
| Shared laptop | — | Public GIF, timer, resolve names | Guess lists, typed answers, owner id before resolve |

Written answers (`open_response`, `stimulus_response`, `search_query`) are **never** shown at reveal. They would leak the query and often the owner.

---

## 9. Edge cases

| Situation | Rule |
|---|---|
| Disconnect during collection, before Confirm | Do not block the round. Advance when every **connected** participant has confirmed. Their slot is skipped (no GIF in that round’s half of the queue). |
| Disconnect after Confirm | Keep the GIF. They can rejoin and guess later. |
| Rejoin mid-collection | If they have not confirmed this round, they still can. |
| Giphy empty / down | Search unavailable. They retry with different words. If the whole room is stuck, Lead **Skip remaining** on collection is **not** in v1 — use degraded fallback or End session. |
| Timer expiry, zero locks | Resolve anyway. Name list of hits is empty. Owner still revealed. |
| Guesser locks then wants to edit | No. Lock is final. |
| All eligible guessers disconnected | Timer still resolves. |
| Minimum players not met in lobby | Start disabled. Copy: “Need 3 to start.” |
| Headcount drops below 3 after Start | Continue; a reveal with zero guessers just shows the owner. |
| Lead end-early | Confirm. Scoreboard with GIFs revealed so far → NPS → reflection. |
| Late join | Closed after Start. |
| Double-submit Confirm or Lock | Idempotent. First valid write wins. |
| Owner id in the client before resolve | Bug. See §10. |
| Duplicate Giphy pick (two people confirm the same URL) | Allowed. The room can still name a person. |
| Lead’s phone dies | Host-token / cookie rejoin. Collection has no clock, so the room can wait. |

---

## 10. Authorization boundary

The GIF **owner** is Draw It By Ear’s image / Talk Track’s card words / Zoning Rights’ permutation.

Every I Know What You Meme route that uses a service-role client must, before touching it:

1. Verify caller participant identity from the cookie.
2. Confirm that participant belongs to the session.
3. For play-state reads during collection: return **only the caller’s** GIF/answers for in-progress rounds. Other `gif_url`s are omitted until that item is the current reveal.
4. For play-state reads during `REVEAL_GUESS`: include `gif_url` + prompt labels for the current index; **strip `owner_id`**. Include the caller’s own lock if any. Do not include other people’s locks.
5. For play-state reads during `REVEAL_SHOW` and after: owner id and correct-guesser names for **resolved** indices only. Still omit unread queue owners.
6. Broadcast / Next / Wrap / End: session Lead.
7. Confirm GIF / Lock in: caller must be that participant. Lock in rejected if caller is the current owner.

Do **not** put `owner_id` or other people’s `gif_url`s on a session-wide Realtime channel. `ikwym-v1` currently stores `revealQueue[].participantId` and all responses on `state_json` — that is a spec violation and a polish item.

Acceptance bar includes a network-tab test: during `REVEAL_GUESS`, the guesser’s client never contains the current owner id.

Giphy is called **from the participant’s browser** with `NEXT_PUBLIC_GIPHY_API_KEY`. That key is public by nature. Do not proxy search in v1. Do not log search queries to a place other participants can read.

Production sittings require a **production** key on unmute-app (see §4.8). The Powered By GIPHY mark in §4.7 is what you screenshot for Giphy’s upgrade form.

---

## 11. Facilitator script beats

1. Phones in hand. Faces on the laptop. You’ll search on the phone; we’ll look at GIFs on this screen later.
2. Name the mechanic: same two prompts, pick a GIF, then we guess who picked it. Don’t announce yours.
3. Pre-empt the workplace objection: “Giphy is a floor, not a filter. Pick something you’d put on a slide in this room.”
4. Send round 1. Don’t narrate people’s answers while they search.
5. After both rounds: “One at a time. Guess on your phone. If it’s yours, stay quiet.”
6. If the room is large or energy drops: Wrap. Don’t apologize — the payload already happened.
7. After scores: NPS, then the two reflection questions.

Lead-only metrics: collection `confirmed / connected`, reveal `i / M`, locks this guess `n / eligible`, Wrap available after first resolve.

---

## 12. Content pack

| Field | Value |
|---|---|
| Pack mode | `required` |
| Pack A | 5 check-ins + 6 stimulus categories (lists below). This is the `ikwym-v1` `prompts.ts` bank, now a named pack. |
| Intra-session uniqueness | No check-in or stimulus label repeats across the two rounds. That is not a pack. |
| Engine | Load only through `sessions.content_pack_id` |
| Not a pack | The GIFs. Player-authored via Giphy. |

When this Moment ships on `main`, add a row to the console pack table in `docs/unmute-console-spec-v1.md` §7.4.2. Do not do that until the engine on `main` reads `content_pack_id`.

### 12.1 Pack A check-ins (5)

Exact strings:

1. How are you showing up today?
2. Describe last week in one word
3. How are you expecting this week to go?
4. What's your energy level right now?
5. If today were a weather pattern, what would it be?

### 12.2 Pack A stimulus categories (6)

| Label | Prompt |
|---|---|
| Pop culture | Name a pop culture figure |
| Historical | Name a historical figure |
| Animal | Name an animal |
| Movie character | Name a movie character |
| Food | Name a food |
| TV character | Name a TV show character |

Draw uniformly from unused rows. Two rounds consume 2 check-ins + 2 stimuli. Five and six is surplus on purpose so a replay on Pack A still has unused lines **inside** one sitting; a **second sitting** with the same team should get Pack B (not authored in v1). If Pack B does not exist, staff reuse Pack A explicitly in console.

### 12.3 Authoring rules (Pack B later)

- Workplace-readable. No prompt that forces a medical, legal, or HR disclosure.
- Check-ins are about today / this week, not biography.
- Stimulus is a concrete noun people can type in a few words.
- Lobby sample copy must not duplicate these strings.

---

## 13. Data model (protocol-specific)

Platform `sessions` + `session_participants` unchanged. Secrets do **not** live in open-RLS `sessions.state_json`. Follow Cover Story / Talk Track: service-role tables.

`ikwym-v1` migrations `004` / `005` (`ikwym_responses` with `round`) stay the seed. Polish adds session/reveal tables and tightens RLS. Permissive `USING (true)` on `004` is not acceptable for a Season run.

```
ikwym_prompts
  id, content_pack_id, kind (checkin | stimulus), label, prompt, active, sort_order

ikwym_sessions
  session_id, phase, round_index (1|2),
  r1_checkin_id, r1_stimulus_id, r2_checkin_id, r2_stimulus_id,
  created_at

ikwym_responses
  id, session_id, participant_id, round (1|2),
  gif_url, open_response, stimulus_response, search_query,
  created_at
  UNIQUE (session_id, participant_id, round)

ikwym_reveal_items
  id, session_id, sort_index, round, owner_id, gif_url,
  resolved_at

ikwym_guesses
  id, reveal_item_id, participant_id, guessed_participant_id, locked_at
```

Public during `REVEAL_GUESS`: current item’s `gif_url` and prompt **strings** (not ids that join to owner). `owner_id` stays server-side until `resolved_at`.

Giphy search is not persisted except as `search_query` on the owner’s own row.

---

## 14. Session end flow

```
Last resolve (or Wrap) → scoreboard. Facilitator Continue advances everyone to NPS
(`/session/[id]/feedback`). Completing NPS sends that person to reflection
(`/session/[id]/reflection`).
```

Reflection is the final screen. Do not park on NPS thank-you. Do not reload the protocol as “Replay.”

NPS is the platform feedback step (1–10 + optional comment).

---

## 15. Locked decisions

| Topic | Locked as |
|---|---|
| Collection | Simultaneous, whole room, after Lead broadcast |
| Prompts | **Shared** pair per round, not unique per person |
| Sequential one-at-a-time collection | **Withdrawn** (original chat spec) |
| Rounds | Two collection rounds, then reveal |
| Facilitator | Plays; also broadcasts / Next / Wrap |
| Search query | `check-in answer + space + stimulus answer` |
| Giphy | `rating=g` always; 9 results; 3×3; browser-side `NEXT_PUBLIC_GIPHY_API_KEY` |
| Giphy key (prod) | Production key on unmute-app, not beta |
| Giphy attribution | Official Powered By GIPHY mark under search results and under the reveal GIF; not typeset text |
| Workplace fit | Honor system + notice; no extra filter in v1 |
| Confirm | Lock; no edit |
| Reveal order | Shuffle round 1 owners, then shuffle round 2 owners |
| Guess clock | 30s; WAO timer chrome; server timestamp |
| Owner | Sits out; cannot guess; cannot score on that GIF |
| Self-guess | Server reject |
| Scoring | +1 correct lock; 0 otherwise; no tie-break |
| Wrong guesses | Not shown publicly |
| Owner’s typed answers | Never shown |
| Early wrap | Lead, after any resolve |
| Late join | Closed after Start |
| Start floor / cap | 3 / 20 |
| Pack | Required. Pack A = §12.1–12.2. GIFs are not a pack |
| End path | Scoreboard → NPS → reflection |
| Explainer | Coded lobby loop, fixed panel size |
| Existing branch | `ikwym-v1` is the starting code, not the spec |

---

## 16. Reflection close

Standard Season prompts, ninety seconds each, display-only:

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

**Facilitator prompt if the room is quiet:**

*“Who did you think you could read from a GIF — and you couldn’t? Who picked the safe one, and who picked the true one?”*

---

## 17. Degraded fallback

Write this into facilitator notes before the first live run. Do not improvise it.

1. Two prompts on a slide (from Pack A, or the sandwich / toaster sample if the pack isn’t in the room).
2. Everyone writes both answers on paper, then finds **one** workplace-safe image on their phone (Giphy in the browser is fine). They do not share yet.
3. Facilitator collects phones face-down, or has people AirDrop/email images to the laptop one at a time with names stripped.
4. Show one image on the shared screen. Thirty seconds on a visible phone timer. Everyone writes a name. Owner stays quiet.
5. Reveal the owner. Hands up if you got it. Tally on a whiteboard.
6. Repeat until energy drops. Then the two reflection questions. No app.

What is lost: simultaneous lock, private guesses, pack uniqueness, scoring without argument. The payload still runs.

If Giphy is down **in the product** but the rest of the app works: same paper/phone-browser path, then continue reveal in-app only if GIFs were already confirmed — otherwise End and use this fallback.

---

## 18. Acceptance bar

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention to explain “don’t say which is yours.”
2. Self-service QR join works without assistance.
3. During `REVEAL_GUESS`, a guesser’s network tab **never** contains the current `owner_id`. After resolve, it may.
4. During collection, participant A’s client does not contain participant B’s `gif_url`.
5. Headcounts 3, 8, 12: Start gate at 3; at 12, Wrap skips remaining GIFs and still reaches NPS → reflection.
6. Owner cannot lock a guess; self-guess returns an error if forced.
7. Giphy missing key / empty array: Search unavailable; Confirm stays disabled; retry after editing an answer works.
8. Timer expiry with no locks: owner still revealed; scores unchanged.
9. Disconnect before Confirm does not stall the room; that person has no GIF in that round.
10. Throttled-network: double Confirm does not write two rows; double Lock does not change the first name.
11. Scoreboard Continue goes to existing NPS, then reflection — no Replay reload.
12. Degraded fallback in the facilitator notes.
13. After Search, the official Powered By GIPHY mark is visible under the grid (and under the GIF on reveal). Typeset “Powered by Giphy” alone fails this item.

---

## 19. Conservative leftovers

Conversation + Season learnings resolved the original prompt’s gaps. These are recorded so polish does not invent:

| Topic | Conservative lock |
|---|---|
| Third collection round | No. Two. |
| Unique prompts per person | No. Shared pair. |
| Show search query at reveal | No. |
| Lead skip during collection | No in v1. Disconnect skip only. |
| Audio on timer | No. Same as Cover Story’s quiet clock, but IKWYM **does** use the amber pulse + 3-2-1 (guessing is a group beat, not a silent mission). |
| Pack B | Not authored. Reuse Pack A is a console override. |
| Proxy Giphy server-side | No in v1. |
| Persist GIFs into Supabase Storage | No. Store the Giphy URL. |
| Extra cycle of new prompts after reveal | No. Wrap or scores. |

No opt-outs from moment-conventions other than: no WAO tap-settle; collection has no timer.

---

## 20. Build sequence (polish `ikwym-v1`)

One step at a time. Each independently testable. Do not greenfield a third engine.

1. Spec locked (this file). Map `ikwym-v1` phases to §6 names.
2. Official Powered By GIPHY mark on collection (post-search) and reveal (§4.7). Screenshot this before applying for a production key.
3. Role-filtered play payload: strip owner and other people’s GIFs. Load-bearing security step — do not defer it. Network-tab test in §18.3–18.4.
4. Server `guess_started_at` + WAO timer chrome. Remove client-authoritative `guess_timer_expired` as the source of truth.
5. Lobby explainer (fake sandwich / toaster only) + Start gate at 3.
6. Persistent instruction copy + owner sit-out copy. Display names everywhere (no initials-only).
7. Shared-laptop reveal treatment vs phone guess list.
8. Wrap + scoreboard Continue → existing NPS → existing reflection. Delete Replay / Debrief.
9. Pack A rows + `sessions.content_pack_id`. Stop reading prompts from a hardcoded module as the source of truth (a fixture module for tests is fine).
10. Disconnect / connected-only collection advance (§9).
11. Tight RLS on `ikwym_*` tables (replace `USING (true)`).
12. Console pack row in `docs/unmute-console-spec-v1.md` §7.4.2 once this is on `main`.
13. Production Giphy key on unmute-app + redeploy (`NEXT_PUBLIC_GIPHY_API_KEY`).

---

## 21. Open items

- Pack B (new check-ins / stimuli) is a separate workstream. Spec is not blocked.
- Whether a later version should cap the reveal queue automatically at *N* GIFs instead of relying on Lead Wrap. v1 is manual Wrap.

---

## Spec checklist

- [x] Header — slug, type, players, envelope, pack mode, follows-conventions line
- [x] § What this Moment is — surface vs payload
- [x] § Players, join, device — facilitator-as-player called
- [x] § Lobby explainer — beat list + sample data (fake / not Pack A); fixed panel size
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
- [x] § Content pack — required, Pack A = 5 check-ins + 6 stimuli
- [x] § Locked decisions + conservative leftovers
- [x] § Build sequence
