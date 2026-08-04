# Moment Contract

Normative structural spec. Every new Moment must satisfy every requirement in
this document before merge. This is a contract, not a tutorial: it states what
must be true, and for each rule, why it exists. Rules with a stated cause
survive review. Rules without one get deleted by the next person.

Known gaps between these requirements and the current code are recorded in
`docs/known-limitations.md`. That file is the place to look before assuming an
existing Moment is a good example to copy.

## Authority boundary

Two documents govern new work. They do not overlap.

- `.cursorrules` is authoritative for the **design system**: colour tokens,
  type tokens, spacing, border radius, shadows, animation philosophy, and
  component styling patterns.
- This document is authoritative for **structure**: session lifecycle, lobby
  rules, actor model, state and timing, and cross-Moment continuity.

Where `.cursorrules` previously stated a structural rule that this document
also covers, that line has been replaced with a pointer here. If the two
documents ever appear to conflict on a structural question, this document wins
and the conflicting line in `.cursorrules` should be removed rather than
reconciled.

## Vocabulary

"Protocol" is the code term. It stays in table names, slugs, registry
functions, directory paths, and route segments. Do not rename any of it.

"Moment" is the product and client-facing term. Every user-visible string,
every piece of copy, and all documentation written for a non-engineering
reader says "Moment."

Practical consequence: a file at `lib/protocols/the-truth-is/` implements a
Moment called "The Truth Is". Both names are correct in their own context.

## 1. Session lifecycle

**1.1** Lead is claimed only by opening `/host/<host_token>`. There is no
other path to lead. `sessions.host_token` is 64 hex characters, `NOT NULL`,
carries a unique index, and defaults at the database level to
`encode(gen_random_bytes(32), 'hex')`.

**1.2** On first claim, when the browser holds no participant cookie for that
session, the facilitator types a display name. It is trimmed and capped at 40
characters (`DISPLAY_NAME_MAX_LENGTH` in `lib/constants.ts`), and a lead row
is written exactly the way a normal join writes one. If the cookie already
maps to a participant in that session, lead transfers to that existing row and
its `display_name` is kept rather than replaced.

**1.3** Re-opening the host link transfers lead: promote the new browser and
demote the previous one in a single operation. This is the intended recovery
path when a facilitator's browser dies mid-session. Cause: lead was previously
assigned by join order, which handed session control to whoever happened to
load the page first, and gave a facilitator who reconnected no way to get it
back.

**1.4** Exactly one lead per session, enforced by a unique partial index on
`session_participants` where `role_in_session = 'lead'`. Application logic
alone is not sufficient. Cause: two promotions arriving close together can
both pass an application-level check and both write, leaving a session with
two leads and no deterministic owner.

**1.5** Anyone who joins by entering a join code is `member`, always,
regardless of join order. Join order carries no authority.

**1.6** The host link is a bearer credential. Anyone holding the URL can take
lead. Two operating rules follow, and both belong in facilitator-facing
material:

- Never screen-share with the address bar visible.
- Never forward the host link into a shared thread or channel.

## 2. Lobby rules

Every requirement in this section exists because a live client session died in
the lobby. They are recovery-shaped for that reason.

**2.1** Pressing Start must never permanently close joins. Joins are accepted
while `sessions.status` is `lobby` or `active`, and rejected only for
`completed` or `cancelled`. Cause: a lobby that closes on Start strands
everyone who was still typing their name, with no way in and no way for the
facilitator to reopen it.

**2.2** A participant who joins after the roster snapshot lands in the
spectator state. A late joiner must never see a hard error or a dead screen.
Cause: engines snapshot their roster at initialization, so a later arrival has
no team, no rotating-role slot, and no scoring slot, and any view built around
those will fail rather than degrade.

**2.3** Start is disabled below the minimum participant count, with helper
copy driven off the same boolean that drives the disabled state, plus a
separate in-flight flag to block double-submit. Prevention at the button, not
recovery after the fact. Cause: a facilitator pressed Start below the minimum,
the engine threw, and the session had no path forward. Driving copy and
disabled state from one boolean is what keeps the button and its explanation
from contradicting each other.

**2.4** Every error branch and every waiting branch a lead can reach must
render a lead-gated recovery control that actually resets state. Returning to
lobby must reset `session_state` to its pre-init shape **before** flipping
`sessions.status` back to `lobby`, and must suppress protocol auto-init for
the duration of the navigation. Cause: order matters in one direction only. A
session left active with intact state is recoverable. A session with cleared
state and active status is not, so the reset has to be the operation that is
allowed to fail.

The pre-init shape is `state_json = {}` (the column is `NOT NULL`, so it is
never null), `phase = 'waiting'`, and `current_round = 0`.

**2.5** Anti-pattern, named so it is not reproduced: a "back to lobby" link
that navigates without resetting `sessions.status` loops forever. The lobby
route redirects to the session whenever status is not `lobby`, so the link
returns the user to the screen they were escaping. A recovery control that
does not reset state is not a recovery control.

**2.6** Join codes are exactly 6 characters, enforced by a database check
constraint, drawn from the unambiguous alphabet that excludes `0`, `O`, `1`,
`I`, and `L`. Cause: a code rendered as `C1SMO8` was read back as `c1sm08`.
Code entry must accept any case and strip whitespace and hyphens before
lookup.

## 3. Actor model

Three distinct actor types exist. Every Moment must state, in its own spec,
which of its screens belongs to which actor. Ambiguity here is what produces
screens that show the wrong person the wrong control.

**3.1 Lead / facilitator.** Session control: starting the session, advancing
gates, overriding timers, and any host-only instruction surface. A lead needs
a manual advance on every gated and every timed phase.

**3.2 Participant.** The played experience. No session control.

**3.3 Rotating in-Moment role.** A participant holding a temporary role for
one round, such as the Describer in Draw It By Ear or the Reader in The Truth
Is. A rotating-role holder is **not** a facilitator and must not receive
session control. Where such a holder does not submit, they are excluded from
submission-completion counts. Cause: counting a participant who has nothing to
submit means the gate can never reach completion, and the round hangs.

**3.4** Lead authority is enforced server side, checked against
`session_participants.role_in_session` on every lead-only action. Hiding the
UI is never the control. Cause: a hidden button is still callable, so a
client-side gate is a presentation choice, not a permission.

**3.5** Lead override controls are visually secondary. They are a recovery
path, not the expected flow.

## 4. State and timing

**4.1** All phase changes persist to `session_state` and broadcast over the
existing Realtime channel. Never drive a phase from client-local state. Cause:
a phase held in one client's memory is invisible to everyone else, so the room
desynchronizes with no way to tell which client is right.

**4.2** Every timer-expiry handler carries a phase-scoped `armedPhase` guard.
The client sends the phase it observed when the timer was armed, and the
handler returns state unchanged if that phase no longer equals the current
phase. Cause: a stale `SHOW_DRAWINGS` expiry consumed a freshly opened scoring
tier 139 milliseconds after it opened, advancing through two tiers with no
submissions recorded.

A window guard keyed only on timer start time does not satisfy this
requirement on its own. It collapses duplicate posts inside one timer window,
but it cannot tell which timer expired, because a stale post arriving during a
later phase sees a fresh start time and passes. That is precisely how the
incident above happened. Keep both guards: the window guard for duplicates, the
phase guard for staleness.

**4.3** Durations are named constants. No inline millisecond or second
literals at the call site. Cause: the image reveal delay sat as a bare `4000`
in a `setTimeout`, which hid both its value and the fact that it was
client-side only.

**4.4** Completion gates count only participants who can actually submit. See
3.3.

**4.5** Do not add a wall-clock comparison to an expiry handler. Cause: an
earlier handler compared server time against the timer start and rejected
valid expiries whenever the server clock trailed the client's, which hung the
round because the client posts only once.

## 5. Cross-Moment continuity

**5.1** `lib/protocols/the-truth-is/` is the canonical reference for reveal
sequencing and owner-framing copy. New Moments replicate that voice rather
than inventing a new one.

**5.2** The established shape is: simultaneous submission by all participants,
gated advance when either all have submitted or the timer expires, then
one-at-a-time reveal with guessing.

**5.3** Registration. Each Moment calls `registerProtocol` from its own
`lib/protocols/<slug>/index.ts`, and `lib/protocols/index.ts` imports that
module so the registry Map is populated at load time. `registerProtocol` and
the `ProtocolDefinition` shape live in `lib/protocols/registry.ts`.

**5.4** Directory layout. Everything for a Moment lives in
`lib/protocols/<slug>/`: `index.ts` for registration, `<Name>Protocol.tsx` as
the shell that switches on phase, `engine.ts` as a pure reducer plus its
client-payload mapper, `types.ts` for the phase union and state interface and
its type guard, and `components/` for per-phase views. Genuinely shared UI
primitives belong in `components/ui/` (`TimerArc`, `SessionProgressBar`), not
inside another Moment's folder.

**5.5** Design tokens per `.cursorrules`. No hardcoded hex values and no
hardcoded font names in components.

## 6. Verification

Twenty items. The split is by how each one can be checked, not by importance.

### 6.1 Pre-merge checklist

Every item here is verifiable by reading a diff or running one command. Verify
all twelve before merge.

1. Start is disabled below the minimum participant count, and its helper copy
   and disabled state derive from one boolean.
2. Every lead-reachable error and waiting branch offers a recovery control
   that resets state, and the reset runs before the status flip.
3. No "back to lobby" navigation exists that leaves status unchanged.
4. Every screen is attributed to lead, participant, or rotating role in the
   Moment's own spec.
5. Every gated and every timed phase exposes a lead manual advance.
6. Rotating-role holders who do not submit are excluded from completion
   counts.
7. Every timer-expiry handler takes `armedPhase` and no-ops on mismatch.
8. No expiry handler compares wall-clock time.
9. Every duration is a named constant.
10. The Moment registers through `registerProtocol` and is imported by
    `lib/protocols/index.ts`.
11. No hardcoded hex values and no hardcoded font names in any component.
12. `npm run lint` and `npx tsc --noEmit` both pass from `app-platform/`.

### 6.2 Pre-client rehearsal script

None of these eight items can be verified by reading code, and no harness
currently exists to run them. They require a live session and, for most of
them, two browsers. They must be exercised in a rehearsal session before any
client run.

1. Opening the host link on a second browser transfers lead, and the first
   browser loses session control.
2. The session has exactly one lead after that transfer, confirmed in
   `session_participants`, not just in the UI.
3. A participant joining by code receives `role_in_session = 'member'`.
4. A join attempted while the session is `active` succeeds.
5. A participant who joins after the roster snapshot renders the spectator
   state, with no error and no blank screen.
6. Start cannot be double-submitted.
7. Every lead-only action is rejected server side when called by a member,
   tested by calling it as a member rather than by inspecting the UI.
8. Every phase change lands in `session_state` and arrives over Realtime on a
   second client.
