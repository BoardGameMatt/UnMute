# Protocol Spec Template

Use this when no spec exists yet. Save completed specs to `docs/protocols/[slug]-spec-v1.md`.

**Before drafting:** read [`docs/protocols/moment-conventions.md`](../../../docs/protocols/moment-conventions.md). Platform conventions (lobby explainer, session end flow, reflection, acceptance bar, etc.) are required for every Moment unless explicitly opted out with rationale.

## Required sections

Every build-ready spec must include:

### Header metadata

```markdown
# [Protocol Name] — Protocol Spec v1

**Status:** Draft | Build spec, locked for v1
**Slug:** `kebab-case-slug`
**Type:** realtime | turnbased
**Envelope:** [total minutes]
**Players:** [min]–[max]
**Owner:** [name]
```

### 1. What this protocol is

One paragraph: surface mechanic + underlying payload (what interpersonal failure or insight it reveals).

### 2. Core mechanic

Step-by-step player actions. Be explicit about:
- What a tap/click/submit means
- Visual states (if realtime sync)
- Lock/submit paths (manual + timer expiry)
- Post-timer settle behavior (if any)

### 3. Scoring

- Point rules
- Zero/partial credit rules
- Tie-breaking
- What gets shown at reveal

### 4. State machine

```
LOBBY → PHASE_A → PHASE_B → ... → WRAP_UP → RESULTS
```

Each phase needs:
- Who acts (all players, pairs, Lead only, rotating role)
- Timer duration (if any)
- What triggers transition to next phase
- What each role sees

### 5. Roles & visibility

| Role | Device | What they see | What they must NOT see |
|------|--------|---------------|------------------------|
| Lead | Phone | ... | ... |
| Member | Phone | ... | ... |

### 6. UI notes (mobile-first)

Per phase: layout, protocol label, timer style, button states (grey → navy → amber flow for submits).

### 7. Edge cases

- Disconnect/reconnect
- Timer expiry with no input
- Minimum players not met
- Lead end-early

### 8. Lobby explainer

Beat sequence for the animated teaching loop (see moment-conventions §1):
- Beat captions (device setup, core action, key constraint, upside, penalty)
- Sample data (must be fake/easy — not real session content)
- Which play UI components the explainer reuses

### 9. Persistent play instruction

Exact on-screen copy visible throughout play, plus norms ("No searching. No chat." if applicable).

### 10. Facilitator script beats

Numbered list the Lead reads aloud. Include pre-empt for predictable objections.

### 11. Session end flow

Scoreboard → NPS → Reflection. Protocol-specific scoreboard content.

### 12. Reflection close

Standard Season prompts (see moment-conventions §8) plus optional facilitator prompt if room is quiet.

### 13. Degraded fallback

How to run with zero platform. Written before build.

### 14. Acceptance bar

Non-negotiable rehearsal criteria before live Season run (see moment-conventions §14).

### 15. Authorization boundary

If service-role client is used: verification steps before every scoped read/write.

### 16. Build sequence

One change at a time, each step independently testable.

### 17. Open questions

List anything unresolved. Agent must not invent answers — flag and ask.

---

## Spec quality gate

Before invoking implementation, verify:

- [ ] Slug is final and kebab-case
- [ ] State machine has no unnamed phases
- [ ] Every phase has timer duration or "no timer"
- [ ] Scoring has worked examples (at least 2 rounds)
- [ ] Role visibility table is complete
- [ ] Envelope time is realistic for player count range
- [ ] Lobby explainer beats documented (moment-conventions §1)
- [ ] Persistent play instruction copy is exact
- [ ] Degraded fallback and acceptance bar present
- [ ] Session end flow includes reflection as final screen
