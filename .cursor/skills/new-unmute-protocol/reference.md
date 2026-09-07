# Protocol Spec Template

Use this when no spec exists yet. Save completed specs to `docs/protocols/[slug]-spec-v1.md`.

**Before drafting:** read [`docs/protocols/moment-conventions.md`](../../../docs/protocols/moment-conventions.md). Platform conventions are required unless the spec explicitly opts out with rationale.

**Copy section order from** `docs/protocols/talk-track-spec-v1.md` or `docs/protocols/zoning-rights-spec-v1.md`. Do not copy the older WAO / Truth Is / Draw It By Ear documents for structure.

## Required sections

### Header metadata

```markdown
# [Display Name] — Protocol Spec v1

**Status:** Draft | Build spec, locked for v1
**Slug:** `kebab-case-slug`
**Type:** realtime | turnbased | async
**Players:** [min]–[max] (optimal …). Facilitator is a player.
**Envelope:** ~[minutes] at optimal headcount
**Owner:** Matt Hendricks
**Pack mode:** `required` | `none`. Pack A is …

This spec follows `docs/protocols/moment-conventions.md` except where it explicitly opts out, with rationale.
```

### 1. What this Moment is

Surface mechanic + payload (what interpersonal failure or insight it reveals). Target dimensions if known.

### 2. Players, join, device

Start floor, cap, facilitator-as-player, phone + laptop, names close at Start (see moment-conventions §2).

### 3. Lobby explainer

Beat sequence for the animated teaching loop (see moment-conventions §1):
- Beat captions (device setup, core action, key constraint, upside, penalty)
- Sample data (must be fake/easy — **not** Pack A)
- Fixed panel size
- Which play UI components the explainer reuses

### 4. Core mechanic

Step-by-step player actions. Be explicit about:
- What a tap/click/submit means
- Visual states (if realtime sync)
- Lock/submit paths (manual + timer expiry)
- Post-timer settle behavior (if any)
- Exact persistent play instruction copy

### 5. Scoring

Point rules, zero/partial credit, tie-breaking, what gets shown at reveal. Worked example.

### 6. State machine

Named phases, who acts, timer or “no timer”, what advances.

### 7. UI notes (mobile-first)

Protocol label, UI state table (not color-only), timer thresholds, button states (grey → navy → amber).

### 8. Roles & visibility

| Role | Device | What they see | What they must NOT see |
|------|--------|---------------|------------------------|
| Lead | Phone + laptop | ... | ... |
| Member | Phone | ... | ... |

### 9. Edge cases

Disconnect/reconnect, timer expiry with no input, min players, Lead end-early, late join closed.

### 10. Authorization boundary

If service-role client is used: verification steps before every scoped read/write. Name the secret (words / image / permutation / GIF owner) and the network-tab test.

### 11. Facilitator script beats

Numbered list the Lead reads aloud. Include pre-empt for predictable objections. List Lead-only metrics.

### 12. Content pack

`required` or `none`. What Pack A is. Intra-session uniqueness is not a pack. Engine loads through `sessions.content_pack_id`.

### 13. Data model (protocol-specific)

Tables. What is public vs secret. Secrets do not live in open-RLS `state_json`.

### 14. Session end flow

Scoreboard → NPS → Reflection. Protocol-specific scoreboard content. Reflection is the final screen.

### 15. Reflection close

Standard Season prompts (see moment-conventions §8) plus optional facilitator prompt if the room is quiet.

### 16. Locked decisions

Table of what this conversation decided. Build must not reopen them.

### 17. Degraded fallback

How to run with zero platform. Written before build.

### 18. Acceptance bar

Non-negotiable rehearsal criteria before live Season run (see moment-conventions §14).

### 19. Conservative leftovers

Calls the conversation did not make. Record the conservative option. Do not invent at build time.

### 20. Build sequence

One change at a time, each step independently testable.

### 21. Open questions

List anything unresolved. Agent must not invent answers — flag and ask.

---

## Spec quality gate

Before invoking implementation, verify:

- [ ] Slug is final and kebab-case
- [ ] Header includes pack mode and the follows-conventions line
- [ ] State machine has no unnamed phases
- [ ] Every phase has timer duration or "no timer"
- [ ] Scoring has a worked example
- [ ] Role visibility table is complete (including the secret)
- [ ] Envelope time is realistic for the player-count range
- [ ] Lobby explainer beats documented, sample data is not Pack A
- [ ] Persistent play instruction copy is exact
- [ ] Degraded fallback and acceptance bar present
- [ ] Session end flow includes reflection as final screen
- [ ] Locked decisions + conservative leftovers present
