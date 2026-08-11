# Unmute Moment — Platform Conventions

**Status:** Living document  
**Reference implementation:** Wrong Answers Only (WAO) v1  
**Applies to:** Every new protocol / Moment spec in `docs/protocols/`

Individual protocol specs define *game mechanics*. This document defines *platform patterns* every Moment must follow unless the spec explicitly opts out with rationale.

---

## 1. Lobby explainer (required)

Every protocol registers a **`lobbyExplainer`** component via `registerProtocol()`. It renders in the lobby **below the join QR, above the participant roster**.

### Purpose

Teach the mechanic before the Lead starts — not trivia content, not facilitator script. Participants waiting in lobby should understand how to play without verbal instruction.

### Format

WAO uses a **coded animated teaching loop** (~20 seconds, looping), not a video file. Either is acceptable:

| Approach | When to use |
|----------|-------------|
| **Animated loop** (preferred) | Mechanic can be taught with simplified sample data and visual states — see `WaoLobbyExplainer.tsx` |
| **Embedded video** | Mechanic needs motion/video that is impractical to code; host file in `/public` |

### Required beats

Every lobby explainer must include at minimum:

1. **Device setup** — "Play on your phone. Keep everyone's video up on your laptop." (Illustration: phone + laptop with video grid.)
2. **Core action** — What the participant physically does (tap, submit, vote, etc.)
3. **Key constraint** — The non-obvious rule that causes silent failure if missed (WAO: "Only what you BOTH tap counts")
4. **Scoring upside** — What good play looks like
5. **Penalty / zero rule** — What kills a round or score (if applicable)

Use **easy sample data** — never real session content. Reuse shared visual components from play UI where possible (WAO: `WaoItemFace` in the explainer matches play).

### Visual shell

```tsx
<section className="rounded-lg border border-unmute-navy/10 bg-unmute-navy/[0.05] p-6 sm:p-7">
  <p className="mb-5 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-steel-blue">
    How it works
  </p>
  {/* beats */}
</section>
```

### Motion rules

- Fade and slide only (200–400ms, `cubic-bezier(0.4, 0, 0.2, 1)`)
- Overlapping opacity on beat transitions — no blank frame between beats
- **`useReducedMotion()`** → render all beats as static stacked panels (no loop)
- No bounce, confetti, or game-show energy

### Spec requirement

Every protocol spec must include a **§ Lobby explainer** section listing:
- Beat sequence (caption text for each beat)
- Sample data used (must be obviously fake / easy)
- Which play UI components are reused

---

## 2. Device & session context (required)

All virtual Moments assume:

| Assumption | Spec language |
|------------|---------------|
| Phone is primary controller | "Phone is the primary controller; desktop works but is not optimized." |
| Video call stays on laptop | Persistent norm; first lobby explainer beat teaches it |
| Lead on phone + laptop | Lead sees facilitator controls on phone; shared screen shows join QR |

---

## 3. Timer presentation (required when timed)

Follow the WAO timer pattern (`WaoPlayTimer.tsx`):

| Phase | Treatment |
|-------|-----------|
| Most of round | Depleting circular arc, **no numerals** |
| Track | `cloud-grey`; arc fill `unmute-navy` |
| Final ~15 seconds | Arc shifts to `signal-amber`, subtle pulse (1s cycle) |
| Final ~3 seconds | Large numeric 3-2-1 only (accessibility exception to no-countdown rule) |
| Settle / lock | Numerals disappear; "locking in" state |

**Server-authoritative:** Timers display client-side; phase transitions are driven by server state, not client timer expiry alone.

Spec must document: duration, urgent threshold, numeric threshold, settle window (if any).

---

## 4. Persistent play instructions (required)

State the inverted or non-obvious mechanic **once in lobby AND keep visible during play.** WAO example:

> Tap the answers you think are WRONG. Only what you and your partner BOTH tap counts.

Plus session norm where applicable:

> No searching. No chat.

One-time verbal instruction from the Lead is not sufficient — the penalty for misunderstanding must be visible throughout.

---

## 5. Partner & identity display (when pairs exist)

- **Display names required** on play and reveal screens — initials alone are insufficient
- Reflection close references specific colleagues by name; anonymity defeats the protocol
- Solo / sit-out copy must **never** use "both" or reference a partner

---

## 6. Visual state differentiation (when multi-state UI exists)

**States cannot be color-only.** Amber is reserved for primary actions and timer urgency — not state fills.

Differentiate by: fill, border weight, border style (solid vs dashed), left accent bar, initial chips, checkmark glyphs.

WAO four-state reference (`WaoItemFace.tsx`):

| State | Treatment |
|-------|-----------|
| Unselected | `warm-white`, 1px navy @ 20% opacity |
| Mine | `warm-white`, 2px solid navy, navy left bar, my initial chip |
| Theirs | `warm-white`, 2px **dashed** navy, partner initial chip |
| Both | Solid navy fill, warm-white label, both chips, ✓ |

Verify 4.5:1 contrast and greyscale distinguishability. Document equivalent states in the protocol spec § UI states.

---

## 7. Reveal & scoring screens

When a round or session produces results:

- **Bucket-based layout** — group outcomes by type (correct eliminations, mistakes, left on table, etc.)
- Reuse the same visual language as play UI (WAO: reveal buckets mirror item-face treatments)
- **Lead-only facilitator panel** — separate from member "waiting" copy; never show Lead controls to members
- Score display: `font-display` for values, `font-mono` uppercase labels

---

## 8. Session end flow (required)

Standard path for Season Moments:

```
Protocol complete → Session scoreboard → NPS feedback → Reflection close
```

| Step | Screen | Notes |
|------|--------|-------|
| Scoreboard | Protocol-specific or shared | Totals, highlights; "Continue" CTA |
| NPS | `/session/[id]/feedback` | 1–10 + optional comment |
| Reflection | `/session/[id]/reflection` | Display-only; nothing stored |

Reflection is the **final screen** — do not park on NPS thank-you.

### Standard reflection prompts (Season default)

1. What did you assume that turned out to be wrong?
2. Where does that same assumption show up in how we work?

Spec may add a **facilitator prompt** (used if the room is quiet) — protocol-specific, tied to the Moment's payload.

---

## 9. Facilitator tooling (required)

Every spec includes **§ Facilitator script beats** — numbered list the Lead reads aloud or paraphrases.

Lead-only UI pattern:
- `font-mono` label: "FACILITATOR"
- Session status metrics (rounds completed, concurrence rate, etc. as applicable)
- Primary action: amber button (start next round / end session)
- Secondary: navy or ghost

Spec must list which metrics the Lead sees and when.

---

## 10. Session progress bar (required for multi-phase protocols)

Thin bar at top of play screen: 3px, navy fill on cloud-grey track, no numeric labels. Environmental — always visible, never competing for attention.

Implement via `SessionProgressBar`; progress = completed phases / expected total.

---

## 11. Realtime & reliability (when realtime)

From WAO build — apply to any tap/selection sync:

1. **Optimistic local state → server write → ack → confirmed state**
2. Visible sync indicator for unconfirmed actions
3. Retry twice on failure, then non-blocking warning
4. Server truth at lock/timer expiry — not client-reported intersection

Spec § Technical constraints must mention tap reliability if participants mutate shared state in realtime.

---

## 12. Authorization (when using service-role client)

If RLS is bypassed via service client for performance:

Every route must verify **before** touching service client:
1. Caller participant identity from cookie
2. Participant belongs to the session
3. Pair/team scope matches caller (for scoped reads/writes)

Document in spec § Authorization boundary. Acceptance bar must include cross-participant access test.

---

## 13. Degraded fallback (required)

Every spec includes **§ Degraded fallback** — how to run the Moment with zero platform (facilitator reads items aloud, Teams chat, paper, etc.). Must be written **before build**, not improvised live.

---

## 14. Acceptance bar (required)

Every spec includes **§ Acceptance bar** — non-negotiable rehearsal criteria before a live Season run. Minimum template:

1. Two consecutive full-scale rehearsals, 8+ real people on real phones, zero facilitator intervention
2. Self-service QR join works without assistance
3. Disconnect / ghost-participant path tested mid-round
4. Edge headcounts tested (odd numbers, min/max players)
5. RLS / authorization verified (participants cannot read other pairs' state)
6. Throttled-network path tested for realtime actions
7. Degraded fallback documented in facilitator notes

Customize items 3–4 per protocol; items 1, 2, 5, 6, 7 are platform-standard.

---

## 15. Spec checklist (copy into every new spec)

Before marking a spec "locked for v1":

- [ ] § Lobby explainer — beat list + sample data
- [ ] § Device context — phone + laptop video
- [ ] § UI states — shape/weight table (if multi-state)
- [ ] § Timer — durations and presentation thresholds (if timed)
- [ ] § Persistent play instruction — exact copy
- [ ] § Facilitator script beats
- [ ] § Session end flow — scoreboard → NPS → reflection
- [ ] § Reflection — standard prompts + optional facilitator prompt
- [ ] § Degraded fallback
- [ ] § Acceptance bar
- [ ] § Authorization boundary (if service-role routes)
- [ ] § Build sequence — one step at a time, independently testable

---

## Reference files

| Pattern | Implementation |
|---------|----------------|
| Lobby explainer | `app-platform/lib/protocols/wrong-answers-only/components/WaoLobbyExplainer.tsx` |
| Item visual states | `app-platform/lib/protocols/wrong-answers-only/components/WaoItemFace.tsx` |
| Timer | `app-platform/lib/protocols/wrong-answers-only/components/WaoPlayTimer.tsx` |
| Reveal buckets | `app-platform/lib/protocols/wrong-answers-only/components/WaoRevealView.tsx` |
| Lead controls | `app-platform/lib/protocols/wrong-answers-only/components/WaoLeadAdvanceControls.tsx` |
| Scoreboard → NPS | `app-platform/lib/protocols/wrong-answers-only/components/WaoSessionScoreboard.tsx` |
| Reflection close | `app-platform/components/session/session-reflection-view.tsx` |
| Progress bar | `app-platform/components/ui/SessionProgressBar.tsx` |
| Registry hook | `lobbyExplainer` on `ProtocolDefinition` in `lib/protocols/registry.ts` |
