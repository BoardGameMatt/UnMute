# CLAUDE.md (app-platform)

The Next.js application. Read this with the repository root `CLAUDE.md`.

## Commands

Run all of these from `app-platform/`, not from the repository root, which has
no `package.json`.

- `npm run dev` starts the dev server.
- `npm run lint` and `npx tsc --noEmit` are the two checks to pass before
  handing work back.
- `npm test` runs the unit tests, which currently cover one protocol only.
- `npm run seed` reseeds demo data. It deletes rows first, against the same
  Supabase project production uses.

## Where things live

App Router only, never Pages Router. Routes in `app/`, API routes in
`app/api/`.

Each Moment lives entirely in `lib/protocols/<slug>/`: `index.ts` registers it,
`<Name>Protocol.tsx` switches on phase, `engine.ts` is a pure reducer,
`types.ts` holds the phase union and state type, and `components/` holds the
per-phase views. Genuinely shared UI primitives go in `components/ui/`, never
inside another Moment's folder.

## Things that will surprise you

- Migrations here are never run by a build step. They are applied by hand.
- The engine snapshots its participant roster at initialization, so anyone
  joining later is unknown to it and must be handled as a spectator.
- Phase state lives in `session_state` and arrives on every client over
  Realtime. Never hold a phase in client-local state.

## Writing

No em dashes, in code, copy, or documentation.

## Authority

`docs/moment-contract.md` at the repository root is normative for all protocol
work. `.cursorrules` is authoritative for the design system.
