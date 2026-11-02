# Unmute Labs — Bugbot Review Rules

Apply these rules when reviewing PRs in the UnMute monorepo. App code lives in `/app-platform/`.

## Architecture

- All protocol state transitions must go through `sendAction()` → `app/api/session/[id]/action/route.ts`. Flag any direct mutation of `state_json` on the client.
- Protocol engines in `lib/protocols/*/engine.ts` must be pure TypeScript (no React, no browser-only APIs).
- New protocols must call `registerProtocol()` in their `index.ts` and be imported from `lib/protocols/index.ts`.

## Security & role visibility

- **Draw It By Ear:** image data must never be sent to participants in the Drawer role. Verify server-side role checks, not just UI hiding.
- Lead-only actions must be enforced in the action route (see `DIBE_LEAD_ONLY_ACTIONS` pattern), not only hidden in the UI.
- Join codes are 6 characters, uppercase alphanumeric.

## Realtime & timers

- Timers may display client-side, but phase transitions must be server-authoritative.
- Realtime tap/selection state must reconcile to server truth on lock or timer expiry — flag client-only intersection logic that bypasses the server.
- **Liveness (`docs/protocols/moment-conventions.md` §3.1).** Flag any change that lets one screen, one player, or one failed write stop the room:
  - A timed phase with no server default when nobody acts.
  - A play read or action route that does not advance overdue state first.
  - Client code that advances only on realtime pokes or timer completion, with no check-in interval while a deadline is pending.
  - Timer completion driven only by `requestAnimationFrame`.
  - A facilitator control on a state the server cannot reach without player input.
  - Event, log, or analytics writes placed before the public state update.
  - Concurrent advances without a version check.

## Design system

- No hardcoded hex colors or font-family strings in components. Use Tailwind tokens: `unmute-navy`, `deep-navy`, `signal-amber`, `warm-white`, `cloud-grey`, etc.
- Protocol labels: DM Mono (`font-mono`), uppercase, wide tracking.
- Timers: visual arc only — no numeric countdown display.
- Animations: fade/slide/scale only. Flag bounce, shake, confetti, or pulse (except live indicators).

## Protocol specs

- When implementing or changing protocol mechanics, verify behavior matches the spec in `docs/protocols/`. Flag invented mechanics not present in the spec.
- If a spec is ambiguous, the conservative interpretation should be used.
- Every protocol must comply with `docs/protocols/moment-conventions.md` unless the spec explicitly opts out with rationale.

## Moment platform conventions

- **Lobby explainer required:** every protocol registers `lobbyExplainer` via `registerProtocol()`. Flag protocols missing a lobby teaching component.
- Lobby explainer must include device-setup beat (phone + laptop video), core action, key constraint, scoring upside, and penalty/zero rule.
- Lobby explainer must respect `useReducedMotion()` — static fallback when reduced motion is preferred.
- **Session end flow:** protocol complete → scoreboard → NPS → reflection (reflection is final screen).
- **Persistent play instruction** must remain visible during play, not only in lobby/rules.
- Timer: arc-based, no numerals except final ~3 seconds; server-authoritative phase transitions.
- When pairs exist: display names required on play/reveal — initials alone are insufficient.

## Data model

- **Person** = email identity (persists across teams)
- **Participant** = team membership (nullable `person_id` for guests)
- Do not conflate Person and Participant in queries or state.

## Scope

- Do not modify files outside `/app-platform/` unless the PR explicitly requires marketing site changes.
- Flag drive-by refactors unrelated to the PR's stated purpose.
