# CLAUDE.md

Things that cannot be inferred by reading the code. Everything else, read the
code.

## Layout

Two parts in one repository:

- `/` is the static marketing site (`index.html`, `images/`).
- `/app-platform/` is the Next.js application, which is the product. All app
  work happens here. Do not modify files outside it unless asked.

## Vocabulary: protocol vs Moment

"Protocol" is the code term. It stays in table names, slugs, registry
functions, directory paths, and route segments. Never rename it.

"Moment" is the product and client-facing term. Every user-visible string,
every piece of copy, and all documentation written for a non-engineering reader
says "Moment."

## Deployment chain

Vercel builds and hosts the app. Supabase provides Postgres, Realtime, and
Auth.

The database is not part of the deploy. Migrations in
`app-platform/supabase/migrations/` are applied by hand in the Supabase SQL
editor. There is no migration runner and no ledger recording what has been
applied, so shipping code that depends on an unapplied migration is possible
and will fail at runtime.

## Danger

- Local development and production share one Supabase project. A destructive
  local operation reaches production data.
- The seed script deletes rows. Understand what it removes before running it.
- Creating a session by hand requires inserting both the `sessions` row and its
  `session_state` row. Omitting the second produces a runtime error, not an
  empty state.

## Working agreements

- Never report repo state from memory or session history. Run the git command
  and quote its output.
- Work on a feature branch, never directly on the default branch.
- Do not commit unless explicitly asked.
- Run `npm run lint` and `npx tsc --noEmit` from `app-platform/` before handing
  work back.

## Writing

No em dashes, in code, copy, or documentation. Use a period, a colon, or a
comma.

## Authority

`docs/moment-contract.md` is normative for all protocol work. `.cursorrules` is
authoritative for the design system.
