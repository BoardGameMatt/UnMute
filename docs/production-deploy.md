# Production Deploy — Unmute Labs

**Owner:** Matt Hendricks  
**Applies to:** Every merge to `main` that ships app code to Vercel (`app.unmutelabs.com`)

Vercel deploys the Next.js app automatically when `main` updates. **Supabase schema does not.** If app code references a column or table that production Postgres does not have yet, live sessions fail mid-flow (e.g. Cover Story “Deal cover cards” before migration `018`).

**Rule:** Apply SQL migrations to production **before** anyone runs a live session on the new build.

---

## Release checklist (every production push)

Copy this list when merging to `main` or announcing a demo:

```
Production release:
- [ ] Identify new/changed files under app-platform/supabase/migrations/
- [ ] Apply pending migrations to production Supabase (CLI or SQL editor)
- [ ] Run schema verification (see below) — all checks pass
- [ ] Merge / confirm Vercel deploy finished
- [ ] Smoke-test the first action that touches new schema for each affected Moment
- [ ] Run content seed scripts if the release adds pack/card/question data
- [ ] Only then mint join codes or share host links with facilitators
```

### Apply migrations (pick one path)

**Preferred — Supabase CLI** (applies every pending file in order):

```bash
cd app-platform
npx supabase link --project-ref <your-project-ref>   # once per machine
npx supabase db push
```

**Manual — Supabase SQL editor**  
Run each file from `app-platform/supabase/migrations/` that production has not seen yet, **in numeric order** (`001` → `020`). Files use `IF NOT EXISTS` where possible; re-running an applied migration is usually safe.

### Verify schema

**From your laptop** (uses `app-platform/.env.local` pointed at production):

```bash
cd app-platform
npm run verify:schema
```

**In Supabase SQL editor** (no local env):

Open `app-platform/supabase/verify-schema.sql`, run the full script. Any row in the result set is a missing object — apply the migration listed in that row.

### Smoke tests by Moment

| Moment | Slug | First schema touchpoint after lobby |
|--------|------|-------------------------------------|
| Draw It By Ear | `draw-it-by-ear` | Start session → team formation |
| Wrong Answers Only | `wrong-answers-only` | Start round → pair/tap tables |
| The Truth Is | `the-truth-is` | Submit / advance (session_state) |
| Trane Quiz | `trane-quiz` | Create offering / join |
| Cover Story | `cover-story` | **Deal cover cards** (needs `014`–`018`) |
| Talk Track | `talk-track` | Start session → `talk_track_*` tables (needs `019`) |
| Unmute Console | `/console` | Staff sign-in → `clients`, `staff_profiles` (needs `020`) |
| Zoning Rights | `zoning-rights` | Start session → `zoning_rights_*` tables (needs `021`) |

### Content seeds (after schema, when needed)

These are **data**, not DDL — run after migrations if the Moment needs library content on prod:

```bash
cd app-platform
npm run load:wao              # WAO question bank
npm run load:cover-story      # Cover Story agencies
npm run load:talk-track       # Talk Track Pack A cards
npm run seed:trane-quiz       # Trane Quiz fixtures
```

---

## Migration catalog

All files live in `app-platform/supabase/migrations/`. Production must have **every file through the latest** before demoing any Moment.

| # | File | Moment / area |
|---|------|----------------|
| 001 | `001_initial_schema.sql` | Core platform |
| 002 | `002_session_feedback.sql` | All Moments (feedback) |
| 003 | `003_draw_it_by_ear.sql` | Draw It By Ear |
| 004 | `004_allow_duplicate_display_names.sql` | Join / roster |
| 005 | `005_session_lead_designation.sql` | Lead role |
| 006 | `006_session_host_token.sql` | Host link |
| 007 | `007_unambiguous_join_codes.sql` | Join codes |
| 008 | `008_wrong_answers_only.sql` | Wrong Answers Only |
| 009 | `009_session_participant_department.sql` | WAO departments |
| 010 | `010_wrong_answers_only_protocol.sql` | WAO protocol row |
| 011 | `011_wao_timer_default_60.sql` | WAO timer default |
| 012 | `012_wao_saver_participant.sql` | WAO saver |
| 013 | `013_trane_quiz.sql` | Trane Quiz |
| 014 | `014_cover_story.sql` | Cover Story tables |
| 015 | `015_cover_story_protocol.sql` | Cover Story protocol row |
| 016 | `016_cover_story_mission_report.sql` | Cover Story mission / note |
| 017 | `017_cover_story_sessions_rls.sql` | Cover Story session RLS |
| 018 | `018_cover_story_pick_token.sql` | Cover Story pick links |
| 019 | `019_talk_track.sql` | Talk Track + content packs |
| 020 | `020_unmute_console.sql` | Unmute Console |
| 021 | `021_zoning_rights.sql` | Zoning Rights |

When adding migration `021+`, update this table, `verify-schema.sql`, and `scripts/verify-prod-schema.ts`.

---

## Why this happens

| Surface | Trigger | What updates |
|---------|---------|--------------|
| **Vercel** | Push to `main` | App code |
| **Supabase** | Manual `db push` or SQL editor | Postgres schema |

There is no automatic link between the two today. Until Supabase GitHub integration (or CI) runs migrations on deploy, **migrations are a required human step** in every release.

---

## Agent / Cursor workflow

When an agent merges protocol work or says “push to production”:

1. Read `docs/production-deploy.md` (this file).
2. List migrations added or changed in the branch.
3. Tell the operator which migrations to apply before the session/demo.
4. Run or instruct `npm run verify:schema` after apply.
5. Do not mint production join codes until verification passes.

See also: `docs/cursor-workflow-plan.md` §7, `.cursorrules` (Production deploy), `.cursor/skills/new-unmute-protocol/SKILL.md` (Step 7).
