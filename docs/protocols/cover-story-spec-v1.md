# Cover Story — Protocol Spec v1

**Status:** Build spec, locked for v1 (updated after first playtest)  
**Branch:** `cover-story-v1`  
**Target run:** NAFA Sitting B on-site 10 September 2026  
**Slug:** `cover-story`  
**Type:** `async` (two live sittings with a multi-week field period)  
**Envelope:** Sitting A ~15 minutes. Field period = facilitator-set reveal date minus deal date. Sitting B ~5 minutes per participant after a shared mission-report form.  
**Owner:** Matt Hendricks  
**Playable library:** `app-platform/supabase/seed-data/cover-story-agencies-v1.json` (50 agencies, aliases included).

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.

Oasis is **teaching-only**. It is never a playable agency.

---

## 1. What this Moment is

A short silent reading, then weeks of sneaking spoken cover words into real meetings, then a scored on-site reveal.

The product feeling is a **mission**, not a homework log. Sitting A deals the cover. The field is lived, not administered. Sitting B is where agents file proof and the room guesses.

---

## 2. Players

- The **facilitator is a player**. They take a cover. They must not share that screen while picking.
- Start floor: **2 members plus the facilitator**.
- Cap: **15 agents** including the facilitator.
- Unique agencies per session. Each agent is shown **3 agencies nobody else is shown**. All 3 are burned even if unpicked.
- Lead is claimed only via the **host token**. Tap-name rejoin lists members only. Anyone with the join code can still impersonate a member (accepted v1 hole). They cannot claim lead from the join roster.

---

## 3. Identity and join

- No auth. Sitting A lobby: display name.
- Same 6-character join code for weeks. `sessions.status` stays `active` until Sitting B completes.
- After Start, `/join/{code}` is **tap your name** (members only). New names close except **Admit late**.
- Cookie lasts 30 days; tap-name is the real rejoin.

---

## 4. Lobby explainer

Sitting A lobby teaches only: read a short passage, then discuss. Real mission rules after insights.

Beats: device (phone + laptop video), core action (five silent screens), constraint (no talking until the lead opens discussion), upside (one insight for the team), no score yet.

Sitting B uses a separate reveal explainer (guess silently, ninety seconds).

---

## 5. Sitting A

1. Facilitator sets **reveal date** before Start.
2. Silent five-screen Oasis briefing (copy in `lib/cover-story/briefing.ts`).
3. Lead gates discussion, playback, then **Show insights** (body navy, song titles bold amber).
4. **Deal cover cards** assigns every agent a disjoint hand of three in one server action. No client-side deal. No overlapping agencies.
5. **While picking**, every agent sees the mission brief (not only after lock):
   - This is a mission.
   - It runs until **[reveal date]**.
   - Speak each word in a meeting with at least two other people from this session (spoken words only; virtual meetings count; do not name the agency).
   - Keep a private record of **the date, who was there, and a little context**. They will file that proof at Sitting B — there is no field logger in the product.
6. Lock one card. After lock: copy-to-clipboard (agency + words), half-the-room characterization, **See you on [reveal date].** Facilitator roster shows **Ready** vs **Choosing** (deal) or **No pick yet** (field). Lead-only roster also shows **locked agency names** for the facilitator’s record. Members must not see others’ covers.
7. **Start the mission** parks the session in `field`. Session stays `active`.

**Absent / lock-on-behalf:** Each deal gets an unguessable `pick_token`. Private URL `/cover-story/pick/[token]` shows that agent’s three agencies (five words each) and locks one — usable by the absent agent or by the facilitator on their behalf. Lead field dashboard: **Copy private pick link** and **Lock for them** (inline picker). Tokens are minted on deal and backfilled on first access if missing.

`startReading` is lead-only, lobby-only. It does not auto-fire. It may clear leftover play data only when leaving lobby (replay). It must not wipe field or reveal data.

---

## 6. Field period

No persistent in-app log. There is no interface during the weeks to enter dates, witnesses, or notes. Phones may still show the locked cover and copy sheet so agents can remember words.

Facilitator dashboard: roster with locked agency names (lead only), admit late (deals leftover unused agencies), reminder copy-paste (T−7 / T−2), private pick links for agents without a lock, **Start Sitting B on reveal day** (disabled until `reveal_on`; server rejects early start), **Skip to discussion** (ends session → reflection, skips NPS). No planted counts during field (those do not exist until Sitting B).

**Start Sitting B:** Button copy makes clear this opens the mission-report / guessing flow on the scheduled reveal date — it does not reveal anyone’s cover early. Disabled until local calendar date ≥ `reveal_on`; enforced server-side in `startReveal`.

**Skip to discussion:** Lead-only during `field` and `reveal`. Confirmation if before natural end. Sets `sessions.status = completed`, `cover_story_sessions.phase = complete`; everyone redirects to `/session/[id]/reflection` (not feedback / NPS).

---

## 7. Mission proof (start of Sitting B)

The first Sitting B beat is a **mission report**, not a guess. Proof is filed here, once, for all five words.

Each agent (including the facilitator) fills **one form**. Each word:

| Field | Rule |
|---|---|
| Didn’t plant | Checkbox. Use this if they could not get the word in. If on, date and who are not required. |
| Date | Native calendar (`<input type="date">`). Required if planted. Must be **before** the reveal date. |
| Who was there | Yes/no toggle for **every other person in the session, including the facilitator**. The agent does not toggle themselves. Planted words need **at least two** yeses. If they cannot name two other people from this session, they must check Didn’t plant. |
| Context | Optional, max 50 characters. |

One **Submit** for the whole form. Incomplete words stay `open` until submit. After submit, logs are `planted` or `not_planted`.

Mission +15 is all-or-nothing if all five are `planted`.

Facilitator sees a roster of who has filed. They may begin guessing before everyone is in (same pattern as other lead gates). Prefer waiting.

---

## 8. Sitting B — per person (facilitator-paced)

After mission reports, reveal order is a persisted random shuffle of agents who locked a cover.

For each person, the lead advances manually. Sequence:

1. **Guess (90s, silent).** The room does not talk. The timer has **no audio**, no 3-2-1 numerals, and no urgency pulse — only the depleting time-timer disc. Facilitator sees **who has submitted** and `N of M guesses in`, and may **advance / close guesses** early. Members cannot close the window. Server clock (`guess_started_at`) is authoritative. When time expires, guessing is closed even if someone left the form blank. If everyone has submitted, the window closes without waiting out the clock.
2. **Show guesses.** Wall of agency + why. No truth yet. No scoring yet.
3. **Reveal the cover.** Official agency, five words, planted / didn’t plant, plus date, who was there, and note as filed. A beat to talk. Facilitator holds; no auto-advance.
4. **Score.** **Only the facilitator** marks which guesses are correct. Members wait. The alias suggester is a hint on the facilitator’s screen, not the score. Then **Show points**.
5. **Points just awarded** strip (not a running leaderboard). Next person. After the last person, **final board** (bars fill, settle, reorder; Unmute-legal motion). Then existing NPS → reflection.

Guessing evidence stays 250 characters. Mission context stays 50.

This Moment opts out of the moment-conventions 15s amber pulse and 3-2-1 numerals for the guess timer: the clock is silent so it does not run the room.

---

## 9. Scoring (unchanged math)

Let `n` = number of other agents (everyone except the target). `k` = guesses the lead marked correct.

- **Type 1** (being guessed): `k * (n - k)`. Zero if nobody or everybody is right. Peak near half the room.
- **Type 2** (a correct guess): `n - k` per correct guesser, not split.
- **Mission:** +15 all-or-nothing if all five words are planted.

Characterization at deal: the best agents get caught by about half the room. Too obvious, everyone sees it. Too opaque, nobody does.

---

## 10. Spoken-word rules

Spoken words only. Virtual meetings count. At least three people including the agent; the other two **must be in this session** (toggles). Several words may be planted in one meeting. Do not name the agency.

---

## 11. Reminders

Product does not email. Facilitator copy-paste T−7 and T−2.

---

## 12. Progress / NPS

No session progress bar. NPS + reflection only after Sitting B completes (same Season end path as WAO: final board → NPS → reflection close).

---

## 13. Data

Agencies, words, deals, logs, guesses, scores, and `cover_story_sessions` live in service-role tables — never in `state_json` (open RLS). `cover_story_sessions` holds phase, reveal date, reveal order, and `reveal_subphase` (`mission` → `guess` → `gallery` → `board` → `mark` → `points` → `final`). `cover_story_deals.pick_token` powers private pick links. `cover_story_word_logs.note` is ≤50 characters. Migration `016_cover_story_mission_report.sql` adds the note column and the `mission` subphase. Migration `017_cover_story_sessions_rls.sql` locks session metadata to service_role. Migration `018_cover_story_pick_token.sql` adds `pick_token` on deals.

---

## 14. Opt-outs from moment-conventions

| Convention | Opt-out | Rationale |
|---|---|---|
| Lead is not a player | Facilitator plays | Locked after playtest; they take a cover off the shared screen. |
| Live scoreboard | Points strip per person; board at the end | Avoids mid-reveal horse-race energy. |
| Field telemetry | No in-week logger | Proof is filed at Sitting B so the weeks feel like a mission. |
| Timer 15s pulse + 3-2-1 | Visual disc only; no audio | Guessing is a silent beat; the facilitator advances. |
| Shared scoring | Facilitator-only marks | Only the lead scores; members wait. |

---

## 15. Conservative defaults recorded

- Min 2 members + facilitator (was 6 members, lead not playing).
- Max 15 including facilitator.
- Impersonating a **member** via tap-name is accepted v1. Impersonating **lead** is not.
- Native date input is the calendar control (no custom game-show picker).
- No persistent field-week entry UI. Dates, witnesses, and notes are collected only on the Sitting B mission form.
- Planted words require at least two other people from this session (toggles include the facilitator). Otherwise: Didn’t plant.
- Guess timer: 90s, silent (no audio, no numerals). Lead sees submissions and may close early.
- Only the facilitator marks guesses correct.
