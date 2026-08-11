# Cursor Workflow Plan — Unmute Labs

**Status:** Ready for execution  
**Created:** 2026-08-09  
**Owner:** Matt Hendricks

This plan captures the Cursor setup decisions from the Aug 9 workflow review. Work through the checklist in order.

---

## 1. Understanding (confirmed)

| Question | Answer |
|----------|--------|
| Spec first? | **Yes.** Write the protocol spec in `docs/protocols/` before any code. |
| Then what? | Invoke `/new-unmute-protocol` (or say "use the new protocol skill") to scaffold and implement. |
| Cloud vs local? | **Local for iteration** (debug, playtest, UI tuning). **Cloud when mobile/away** for scoped build tasks from a saved plan. Not exclusive either way. |
| Skills vs rules? | **Rules** (`.cursorrules`) = always-on constraints. **Skills** = invoked workflows. The new protocol skill adds procedure; it does not replace the spec. |

---

## 2. Bugbot setup checklist

Bugbot reviews PR diffs automatically for bugs, security issues, and rule violations. Project-specific rules live in `.cursor/BUGBOT.md` (created).

### Step 2a: Connect GitHub

1. Open **[Cursor Dashboard → Integrations](https://cursor.com/dashboard?tab=integrations)**
2. Connect your GitHub account
3. Grant access to the **UnMute** repository

> If you don't see Dashboard: click your avatar (top-right) in Cursor IDE → **Dashboard**, or go directly to [cursor.com/dashboard](https://cursor.com/dashboard).

### Step 2b: Enable Bugbot on the repo

1. Open **[Bugbot Automations](https://cursor.com/automations/from-cursor/bugbot)**
2. Enable Bugbot for the UnMute repo
3. Choose trigger: **automatic on every PR update** (recommended)

### Step 2c: Verify it works

1. Push a branch with any small change (or use your next protocol PR)
2. Open the PR on GitHub
3. Confirm the **`Cursor Bugbot`** check appears
4. Review findings in the PR comments

Manual re-run anytime: comment `cursor review` or `bugbot run` on the PR.

### Step 2d: Local pre-PR review (optional but recommended)

Before opening a PR, run in Cursor agent chat:

```
/review-bugbot
```

This reviews your branch changes locally using the same Bugbot rules.

### Step 2e: Branch protection (when ready)

On GitHub → repo Settings → Branch protection rules for `main`:

- Require status check: **`Cursor Bugbot`**

Do this once you're confident false-positive rate is acceptable.

---

## 3. New protocol skill (created)

| Item | Location |
|------|----------|
| Skill | `.cursor/skills/new-unmute-protocol/SKILL.md` |
| Spec template | `.cursor/skills/new-unmute-protocol/reference.md` |
| Invoke | `/new-unmute-protocol` in agent chat |

### Usage for your next moment

```
1. Write spec     → docs/protocols/[slug]-spec-v1.md
2. Plan Mode      → Shift+Tab, review plan, Save to workspace
3. Build          → /new-unmute-protocol
4. Playtest       → local agent, npm run dev, join as Lead + Members
5. Review         → /review-bugbot
6. PR             → Bugbot runs automatically on push
7. Merge          → when Bugbot check passes
```

---

## 4. MCP setup (optional, do when needed)

| Service | Status | Action |
|---------|--------|--------|
| Supabase | Enabled in `.cursor/settings.json` | No action needed |
| GitHub | `gh` CLI available locally | Add GitHub MCP via [Cursor Marketplace](https://cursor.com/marketplace) if doing frequent mobile/cloud work |
| Vercel | Not configured | Add via Marketplace only if you need deploy logs/preview URLs in agent context |

Configure at: **Cursor Settings → MCP** or `.cursor/mcp.json`

---

## 5. Future improvements (not blocking)

These are worth doing but not required before your next protocol:

- [ ] Migrate `.cursorrules` → `.cursor/rules/*.mdc` (split by concern: design-system, protocol-architecture, supabase)
- [ ] Run `/migrate-to-skills` for any workflow-shaped rules
- [ ] Enable Remote Control (`/remote-control`) if you want phone supervision of local dev sessions
- [ ] Save Plan Mode outputs to workspace for every new protocol

---

## 6. Agent mode quick reference

| Task | Where |
|------|-------|
| Write/edit protocol spec | Local agent or Plan Mode |
| Scaffold + implement from spec | Local (at desk) or Cloud (away) |
| Debug realtime / playtest | Local only |
| Fix Bugbot findings | Local or Cloud |
| Review before PR | `/review-bugbot` (local) |
| PR quality gate | Bugbot (automatic on GitHub) |

---

## Execution status

- [x] `.cursor/BUGBOT.md` created
- [x] `.cursor/skills/new-unmute-protocol/` created
- [x] This plan document created
- [ ] GitHub connected in Cursor Dashboard
- [ ] Bugbot enabled on UnMute repo
- [ ] First `/review-bugbot` run on a branch
- [ ] Branch protection with Bugbot check (when ready)
