---
name: new-unmute-protocol
description: >-
  Scaffold and implement a new Unmute protocol from an approved spec in
  docs/protocols/. Use when starting a new protocol, unmute moment, or game
  module; when the user says "new protocol" or invokes /new-unmute-protocol.
disable-model-invocation: true
---

# New Unmute Protocol

## Prerequisite — spec first

**Do not scaffold code until a spec exists in `docs/protocols/`.**

1. Read the spec file completely. Treat it as authoritative.
2. If no spec exists, stop and help the user draft one using [reference.md](reference.md).
3. If the spec is ambiguous, choose the conservative option and note the choice in the spec or a short comment — do not invent mechanics.

Existing spec examples:
- `docs/protocols/wrong-answers-only-spec-v1.md`
- `docs/Protocol_Spec_The_Truth_Is.md`
- `docs/Protocol_Spec_Draw_It_By_Ear.md`

**Platform conventions (required for every Moment):** `docs/protocols/moment-conventions.md` — lobby explainer, timer, session end flow, reflection, acceptance bar, etc. Specs must comply unless they explicitly opt out with rationale.

## Implementation workflow

Copy this checklist and track progress:

```
Protocol build:
- [ ] Spec read and slug confirmed
- [ ] Folder scaffolded under app-platform/lib/protocols/[slug]/
- [ ] types.ts — state shape + guards + JSON helpers
- [ ] engine.ts — pure state transitions (no React)
- [ ] [Name]Protocol.tsx — shell component
- [ ] Phase/view components in components/
- [ ] index.ts — registerProtocol()
- [ ] Import added to app-platform/lib/protocols/index.ts
- [ ] Action route wired in app/api/session/[id]/action/route.ts (if engine-backed)
- [ ] Mobile-first participant views verified
- [ ] /review-bugbot run before PR
```

### Step 1: Confirm spec metadata

Extract from the spec before writing code:

| Field | Source |
|-------|--------|
| `slug` | Spec header (kebab-case, e.g. `wrong-answers-only`) |
| `name` | Display name |
| `type` | `realtime` or `turnbased` |
| `minPlayers` / `maxPlayers` | Spec player range |
| Phases | State machine diagram in spec |
| Role visibility | What each role can/cannot see |
| Timer rules | Durations; server-authoritative transitions |
| Scoring | Rules, edge cases, zero/partial credit |

### Step 2: Scaffold folder

Create under `app-platform/lib/protocols/[slug]/`:

```
[slug]/
├── index.ts              # registerProtocol()
├── [Name]Protocol.tsx    # default export shell
├── engine.ts             # pure reduce/state functions (if stateful)
├── types.ts              # state types, phase enum, JSON guards
└── components/           # one component per major phase/view
```

Reference implementations:
- **Turn-based with engine:** `the-truth-is/` (engine.ts + types.ts + phase components)
- **Realtime:** `wrong-answers-only/` (components + server state)
- **Complex multi-phase:** `draw-it-by-ear/` (engine + many phase views)

### Step 3: Register the protocol

In `[slug]/index.ts`:

```typescript
import [Name]Protocol from "./[Name]Protocol";
import { registerProtocol } from "../registry";

registerProtocol({
  slug: "[slug]",
  name: "[Display Name]",
  description: "[One line from spec]",
  type: "realtime" | "turnbased",
  minPlayers: N,
  maxPlayers: N,
  component: [Name]Protocol,
  lobbyExplainer: [LobbyExplainerComponent],  // REQUIRED — see docs/protocols/moment-conventions.md
});
```

Add `import "./[slug]";` to `app-platform/lib/protocols/index.ts`.

### Step 4: Engine pattern (when spec has game state)

`engine.ts` must be **pure TypeScript — no React, no browser APIs** (safe on server).

Follow `the-truth-is/engine.ts`:
- `initializeGame()` — build initial state from participants
- `reduce[Protocol]State(state, action)` — all transitions
- Export action types the client can send
- `clientPayloadToEngineAction()` if payload mapping is non-trivial

`types.ts`:
- Phase enum matching spec state machine exactly
- `[Protocol]State` interface
- `is[Protocol]State()` type guard for loaded session state
- `[protocol]StateToJson()` / `jsonTo[Protocol]State()` helpers

### Step 5: Client components

Shell component receives `SessionProtocolProps`:

```typescript
interface SessionProtocolProps {
  sessionId: string;
  participantId: string;
  role: SessionParticipantRole;
  teamId: string;
}
```

Rules:
- **All state transitions via `sendAction(type, payload)`** — never mutate `state_json` client-side
- Timers display client-side; **phase transitions are server-authoritative**
- **Mobile-first** for all participant-facing screens
- **Role-check before serving sensitive data** (see Draw It By Ear: images never sent to Drawer role)
- Use Tailwind design tokens only — no hardcoded hex or font-family strings
- Protocol labels: `font-mono uppercase tracking-widest text-[10px]`
- Timers: visual arc only, no numeric countdown

Pass `sendAction` down to child views as a prop (see `the-truth-is/components/SubmissionView.tsx`).

### Step 6: Wire the action route

If the protocol has an engine, add a case in `app-platform/app/api/session/[id]/action/route.ts`:

1. Import engine reduce function and type guards
2. Add lead-only action sets if the spec restricts certain actions to Lead
3. Call `reduce[Protocol]State(currentState, action)` and persist result

Follow the existing `the-truth-is` and `draw-it-by-ear` branches in that file.

### Step 7: Pre-PR verification

Before opening a PR:

1. Spec coverage — every phase in the state machine has a view
2. Scoring edge cases from spec are handled in engine
3. Role visibility constraints enforced server-side, not just hidden in UI
4. Join codes remain 6-char uppercase alphanumeric (session shell, not protocol)
5. Run `/review-bugbot` on branch changes

## Plan Mode integration

For a new protocol, prefer this sequence:

1. **Spec** in `docs/protocols/` (user or agent drafts)
2. **Plan Mode** — architecture, file list, phase diagram, open questions
3. **Save plan to workspace** before building
4. **Build** — invoke this skill or say "implement per spec"
5. **Local playtest** — run dev server, join as Lead + Members
6. **PR + Bugbot**

## Additional resources

- Spec template and required sections: [reference.md](reference.md)
- Project rules (design system, data model): `.cursorrules` at repo root
