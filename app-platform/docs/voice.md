# Voice

**POV** — shared context for reviewing how Unmute code reads, preserves its
workshop meaning, and gives the next developer or agent a dependable example to
follow. One recognizable engineering voice across many Moments.

This is a review perspective, not a style guide, a rewrite charter, or a new
protocol specification. Project rules live in [the root AGENTS.md](../../AGENTS.md).
The execution guarantees live in [Workshop reliability](workshop-reliability.md).
Individual protocol specs define the game. This page asks whether the code makes
those responsibilities understandable and consistent.

A review recommends; the developer decides which changes to make and when.
Finding a duplicate or a weaker pattern does not authorize adjacent cleanup,
new mechanics, or a platform rewrite. Use this POV for requested reviews and
relevant changes, not as a requirement to audit the whole app on every commit.

## What we believe

1. **The workshop is the reason for the software.**
   A facilitator has a room of people waiting. Lost input, incorrect scores, or
   a stalled phase interrupt that room and put the facilitator's credibility at
   risk. Judge technical quality by whether the workshop stays accurate,
   understandable, and recoverable under ordinary human and network conditions.

2. **The app should have one engineering voice.**
   Different Moments need different mechanics. They should not need a different
   interpretation of success, retries, deadlines, or recovery. A developer moving
   between protocol modules should recognize the same underlying commitments.

3. **Match the room, but do not copy a known weakness.**
   Follow surrounding naming, component structure, type conventions, and design
   tokens. Local precedent does not justify a state overwrite, an incomplete
   transition, or a retry that loses input. Preserve useful conventions while
   checking behavior against the reliability contract.

4. **One home for each decision.**
   Search the app before adding another helper or interpretation of a rule.
   Protocol rules belong with their protocol; shared session concerns belong in
   a clearly identified shared home. A UI, API route, and maintenance path should
   not independently decide when the same round ends or what the same score means.

5. **Mechanics vary; guarantees should not drift.**
   Two protocols may deliberately use different round lengths, scoring systems,
   or late-join policies. Those differences come from their specs. Whether an
   acknowledged action survives a refresh or whether a failed write leaves the
   game usable is an engineering guarantee shared across protocols.

6. **Every example teaches the next agent.**
   A locally convenient workaround becomes the template for the next Moment.
   Leave patterns worth repeating. Do not describe a fragile implementation as
   the reference merely because it was built first or has the most callers.

7. **Prefer clear, repeatable patterns over cleverness.**
   Similar concerns should have recognizable names, results, and failure paths.
   Variation should buy a clearer responsibility or support a real mechanic.
   Personal preference alone does not justify a second action transport, error
   shape, timer convention, or persistence idiom.

8. **A new abstraction or file needs a responsibility.**
   Extract when a name and boundary make ownership easier to find and change.
   Do not create a parallel kit, a second generic engine, or a collection of
   fragments that makes one simple rule harder to follow. File count is not the
   measure; clarity of ownership is.

9. **Name deliberate differences.**
   If a protocol needs a different contract, identify the requirement and its
   consequences. Distinguish a warranted exception from legacy debt. Two helpers
   with similar names and different meanings should not silently coexist as
   interchangeable examples.

10. **Improve by selected changes, not by a rewrite campaign.**
    Keep new work consistent and strengthen a touched surface within the agreed
    scope. When retiring a path, account for its callers and remove the obsolete
    wiring as part of that change. Do not expand a review into unrelated cleanup
    or replace the stack to solve a local implementation problem.

11. **The engine owns the rules; the coordinator owns execution.**
    The engine expresses what an action means under the protocol's rules. Server
    coordination handles loading, validation, committing, conflicts, and results.
    Presentation communicates the state and gathers intent. Each should make its
    responsibility visible without quietly becoming a second owner of another's.

12. **Evidence should match the claim.**
    A readable reducer and passing unit tests are useful evidence about game
    logic. They do not establish that simultaneous submissions survive database
    writes or that a phone recovers after missing an event. Say what was tested,
    what failed, and what remains unverified.

## One voice across different Moments

Unmute has a common participant journey: join a room, understand a role, take an
action, see the session move forward, and reach a result. Each Moment gives that
journey its own mechanic. The engineering should make both the common structure
and the deliberate differences easy to recognize.

In an expanding app, inconsistency often appears as individually reasonable
changes: a new hook for one screen, a slightly different action response, another
timer callback, a copied store with one missing guard. Each block can look tidy
while the system accumulates incompatible assumptions.

Consistency matters because developers and agents learn from the nearest code.
If one module treats success as “the pile moved” and another as “the pile and its
score committed together,” they teach different meanings for the same promise.
That is more consequential than a difference in formatting.

The desired voice is practical and calm: explicit rules, visible ownership,
predictable action outcomes, and understandable recovery. The product's phrase
“a well-run workshop in a beautiful room” applies to the implementation too.
The code should support the facilitator's confidence in what the room is seeing.

## Let the evidence choose the example

The review found concrete reliability failures in existing implementations. The
[local harness baseline](../tests/reliability/README.md#baseline-2026-10-29)
reproduced lost submissions, overwritten choices, early and late timer acceptance,
silently ignored input after refresh, incomplete phase transitions, and missing
score events. These are reasons to change which examples we copy. They do not
show that the stack needs replacing or that every protocol has the same defects.

For these concerns, “match the room” means preserve useful conventions while
choosing a pattern that meets the reliability contract. Existing code is evidence
of how the app works today, not automatic authority for how the next Moment
should work.

| What the evidence exposed | Pattern we want the next change to teach |
| --- | --- |
| Two accepted submissions overwrite each other; a delayed no-op erases a newer choice | Protect writes against concurrent changes. Reconsider the action against current state after a conflict; a no-op must not save an old snapshot. |
| The phase advances without its required timer data; a card leaves the pile without its point | Commit the whole meaningful operation together. “Success” describes a complete durable result, not the first successful write. |
| Refresh reuses an old sequence and a different tap receives a successful retry response | Identify the intended operation across retries, reloads, and tabs. An identical retry and a different action must remain distinguishable. |
| An expiry request ends a fresh timer; input remains accepted beyond the deadline | Persist and enforce the deadline on the server for the exact timer instance. Browser callbacks request progress; they do not decide when time has elapsed. |

Recovery deserves the same scrutiny, with a different evidence status: the review
identified missing reconciliation paths, but the local harness does not exercise
browser reconnects. The pattern to prefer is an authoritative refresh after
interruption, with older responses unable to rewind newer state. A socket
notification alone is insufficient evidence of recovery. Verify that behavior
with browser tests before claiming it works.

When recommending an existing module as a reference, name the specific behavior
worth copying and the evidence for it. For example, The Truth Is's atomic,
version-checked save is a useful persistence example; that does not certify its
entire client, retry, or lifecycle behavior. Prefer demonstrated guarantees over
the age, size, or apparent completeness of a module.

For an agreed fix, keep the failing behavioral scenario as a regression test and
show that the application change makes it pass. A test that merely asserts the
current behavior is not protection against repeating the defect. Detailed
guarantees remain in the [reliability contract](workshop-reliability.md); this POV
guides which patterns we trust and leave for the next developer to copy.

## Locality and structure

Keep the knowledge needed to understand a mechanic together. For example, who
may give a clue, how a correct guess changes the pile, and how that guess scores
belong to the protocol's rules. A server route can identify the action and invoke
those decisions; it should not reconstruct a competing set of rules inline.

Locality does not mean putting the entire workshop into one component or copying
all required rules into each route. It means a developer can find the owner of
a decision and use it without reproducing its meaning somewhere else.

Structure should reveal the sequence of an operation: obtain authoritative state,
validate the action in context, decide the result, commit the necessary changes,
and return the outcome. That sequence must also satisfy the reliability contract.
A clean sequence of separate writes can still leave the workshop broken halfway
through. Readability is necessary; it is not evidence of atomicity.

Likewise, a clear client hook can still mishandle recovery. The questions are
whether it preserves pending work, recognizes a retry, reconciles current state,
and avoids replacing newer state with an older response. These promises should
be recognizable across hooks, even where their screens differ.

A shared capability does not require one universal protocol engine. Keep distinct
game decisions local. Share infrastructure when its contract is genuinely common,
and do not make the common layer understand every protocol's special cases.

## Rooms and responsibilities

| Room | What belongs here | What to watch for |
| --- | --- | --- |
| Participant views and protocol components | Present the current role and phase; collect intent; communicate pending, success, and recovery states | Browser state quietly becoming the source of truth; UI checks standing in for server rules |
| Protocol engines | Spec-defined transitions, scoring decisions, role mechanics, and pure calculations | Another copy of a rule in a route, component, or timeout handler |
| Server actions and API coordination | Runtime validation, action context, authoritative execution, and explicit results | Generic patches bypassing protocol decisions; retrying stale writes; ambiguous success |
| Protocol stores and database functions | Durable state and the persistence boundary required by an operation | Phase, score, and required round data committed in separate steps without recovery |
| Shared session infrastructure | Common identity context, action/recovery semantics, lifecycle coordination, and synchronization guarantees | Each protocol inventing a different meaning for revision, acknowledgement, or reconnect |
| Shared UI primitives and design system | Consistent buttons, timers, progress, typography, and state communication | Protocol-specific copies drifting in behavior or presentation |
| Separate product surfaces, including Trane Quiz | Their own actors, flows, and deliberate product requirements | Assuming every Moment's vocabulary or screen structure applies, or duplicating infrastructure without a reason |

These are responsibilities, not instructions to create a new layer or file for
every row. Use the existing organization where it serves the responsibility.

## Differences worth keeping, duplicates worth questioning

| Difference | Review perspective |
| --- | --- |
| A 45-second turn in one protocol and a different duration in another | Legitimate mechanic when the specs say so; deadline enforcement should remain consistent |
| A protocol-specific score table or engine action | Legitimate ownership of a distinct game rule |
| Different participant views for describer, drawer, reader, or facilitator | Legitimate role distinction; keep the underlying state meaning coherent |
| Another hook with different pending/retry/reconnect behavior | Question whether this is a product requirement or infrastructure drift |
| Another read/reduce/write loop without conflict protection | A reliability defect, even if nearby code uses it |
| Another helper named “save” with a different acknowledgement guarantee | A contract difference that must be explicit or removed |
| A shared abstraction full of protocol-name conditionals | Question whether game rules have moved out of their proper homes |
| An extraction that leaves both the old implementation and its replacement live | A second owner likely to drift; identify callers and the intended migration |

Convergence must preserve legitimate mechanics. Do not make two games behave the
same merely to make their code look similar, or blindly copy one module into
another without understanding its callers and persistence requirements.

## Reviewing through this POV

Read the requested block with enough context to understand its responsibility,
the protocol rule it implements, and the contracts it depends on. Search farther
when an apparent duplicate or conflicting owner needs evidence. Keep the review
bounded to the request.

Ask:

- Can the next developer find the authoritative home of this rule?
- Does the code distinguish game decisions from execution and presentation?
- Does this match a useful shared convention, or add another interpretation?
- Is a difference required by the protocol, justified by a distinct surface, or
  simply inherited from an older implementation?
- Does the action's response accurately describe what was committed?
- Would ordinary workshop behavior—simultaneous taps, refresh, retry, a sleeping
  phone—expose an assumption hidden by the happy path?
- Does an extraction make responsibility clearer, or scatter the knowledge
  needed to understand one mechanic?
- What evidence supports the claimed correctness or recovery behavior?

For each finding, identify the concrete code, explain the inconsistency or
ownership problem, and connect it to a workshop consequence. Recommend the
smallest useful improvement within scope. Distinguish a demonstrated failure
from a concern that needs a test. Recognize a warranted difference and say when
a block already fits; do not manufacture findings to justify a refactor.

Prioritize interruption, lost input, wrong results, and difficult recovery over
cosmetic uniformity. A review may identify a broader concern without turning it
into the current workstream. The developer retains the choice of scope and timing.

## Where the detail lives

| Concern | Source |
| --- | --- |
| Project structure, TypeScript, design tokens, component and animation rules | [Root project rules](../../AGENTS.md) |
| Engineering guidance for protocol changes in this app | [App agent instructions](../AGENTS.md) |
| Game mechanics and protocol-specific decisions | [Protocol specs](../../docs/protocols/) and [Draw It By Ear spec](../../docs/Protocol_Spec_Draw_It_By_Ear.md) |
| Shared product conventions and specification shape | [Moment conventions](../../docs/protocols/moment-conventions.md) |
| Action, persistence, timer, lifecycle, and recovery guarantees | [Workshop reliability contract](workshop-reliability.md) |
| Reproduced weaknesses and the current limits of local testing | [Reliability harness](../tests/reliability/README.md) |
| Product deployment, migrations, and schema verification | [Production deployment](../../docs/production-deploy.md) |

This POV supplies the perspective. Those documents supply the rules, mechanics,
procedures, and evidence. Selected improvements should make the next change
easier to place, easier to review, and safer to use in a live workshop.
