# Wrong Answers Only — Question Design and Verification Contract v1

**Status:** Normative. A question either passes this contract or it does not ship.
**Location:** `docs/protocols/wao-question-contract-v1.md`
**Supersedes:** the content rules in the WAO spec Section 9.5 and the working
notes in the build handoff.
**Owner:** Matt Hendricks

---

## 0. Why this exists

Content is the binding constraint on this protocol, not code. Three questions
were drafted before the rules were written, and all three violated at least one
rule that emerged during drafting. This document states the rules first so the
next twenty questions do not repeat that.

The failure this contract prevents is specific. Under the zero rule, a pair that
eliminates a correct answer scores nothing for the round. If an item is marked
correct when it is not, the software tells a pair that converged correctly that
they failed, and the reflection then runs on a false premise. The protocol
misinforms the client about their own team. That is worse than the round not
running.

---

## 1. Category selection

### 1.1 The arbiter test

**Every category must have an arbiter: a body, registry, or institution whose
answer settles the question.**

Categories with an arbiter verify in one lookup and survive a live challenge:

- Codes and designations assigned by an authority (IATA, ISO, ticker symbols)
- Official product names published by the company that makes them
- Dates recorded in a registry (incorporation, patent grant, publication)
- Taxonomic or scientific classification with a governing convention

Categories without an arbiter do not, however well known the facts feel:

- Etymology and word origin, where standard dictionaries disagree
- "First to do X," which depends on definitional edge cases
- Attribution of quotes, inventions, or discoveries
- Anything resting on scholarly consensus rather than a ruling

This single rule cuts verification time more than any process change, because an
authority-governed item resolves once and cannot be relitigated.

### 1.2 No drifting ground truth

The answer must be true at the time of authoring and still true in two years.
Excluded: current officeholders, current rankings, living or dead status,
current records, anything a news cycle changes.

### 1.3 The concentration check

Avoid categories where knowledge is concentrated in a small minority of the
room.

A category nobody knows is safe. Two people who are both guessing still have to
converge on reasoning and mutual observation alone, which is the purest version
of the mechanic. A category everybody knows is also safe.

The risk case is a category two or three people know cold. The expert taps with
confidence, the partner either defers without basis or holds out and blocks the
score, and the reveal frames a knowledge gap as a calibration failure.

This is a judgment call made at selection, not something verification catches.
Ask: would roughly the same fraction of this room have a view on this?

### 1.4 What is no longer a rule

**The "no category resolvable from a single page" rule is withdrawn.**

It was defending against participants looking answers up mid-round. The mechanic
already handles that. Looking something up costs the participant the partner's
selection updates, which is the only channel they have. Scoring rewards
concurrence, not correctness: a looked-up answer earns nothing unless the
partner independently confirms it.

The residual risk is a participant who taps confidently from a search result and
whose partner defers. That degrades one calibration data point. It does not
break the protocol.

Handled instead by a facilitator line at the open:

> "No looking things up. Half the point is watching what your partner does."

---

## 2. Question structure

- Exactly **10 items**
- Between **1 and 5** items are correct, so 5 to 9 are eliminable
- **`correct_count` must match** the number of items with `is_correct: true`.
  The validator enforces this
- At least **2 gimmes** and **2 traps** (Section 2.2)
- One **disambiguation rule**, one sentence, displayed to participants
- One **disambiguation detail**, expanding the edge cases

### 2.1 The disambiguation rule carries the weight

It must make every item a yes or no with no judgment left over. If a reasonable
participant could read the rule and still be unsure which way an item falls, the
rule is not finished or the item does not belong.

Write the rule before writing the items. Items written first tend to produce a
rule reverse-engineered to justify them.

### 2.2 Trap tiers

- **`gimme`** — most participants will get this right. Present so pairs can
  build early concurrence and so the round is not a coin flip
- **`graded`** — the working middle of the question
- **`trap`** — looks like the opposite of what it is. This is where errors
  concentrate, both the participants' and the author's

Tier the items honestly. A well-known item labelled `trap` does not become
harder for being labelled that way, and mis-tiering distorts difficulty
calibration across the library.

---

## 3. Verification

### 3.1 The asymmetry rule

Verification effort follows where the zero rule bites, not where the question
feels hard.

| Item | Sources required | Why |
| --- | --- | --- |
| `is_correct: true` | **Two** | A wrongly-marked true item zeroes a pair that was right to eliminate it. This is the catastrophic case |
| `is_correct: false` | **One** | A wrongly-marked false item only costs points nobody claimed |

Most questions run three to five correct items, so this roughly halves the pass
against a flat two-source standard.

### 3.2 What counts as a source

Wikipedia is acceptable, provided the claim is **uncontested**, defined
operationally:

1. The claim carries no dispute banner, citation-needed flag, or active talk
   page controversy, **and**
2. The article's own cited source does not contradict it

That is one extra click, not a second research pass.

Preferred over Wikipedia where available: the governing authority named in
Section 1.1. An IATA code from IATA settles faster than the same code from a
list article.

Not acceptable: content farms, listicles, SEO aggregators, AI-generated
reference sites, and any page that appears to be restating Wikipedia.

Two sources must be **independent**. Two pages that both cite the same origin
are one source.

### 3.3 The contested-item rule

**If standard references disagree, cut the item. Do not adjudicate.**

There is no version of this where Unmute is right and a reference work is wrong
in front of a client. An item that requires an argument to defend is not a trap,
it is a liability.

Worked example: `aardvark` in the Dutch loanword question. The OED lists a Dutch
etymon. Merriam-Webster gives Afrikaans. Wiktionary carries both accounts on the
same page. Marked as not-Dutch, the participant who recognises the Dutch
compound and leaves it standing loses points, and the reveal tells them they
were wrong. In a protocol about trust calibration, punishing the best-informed
person in the room is the worst available outcome. Cut, not defended.

### 3.4 Storage

Both source fields are populated on every item that requires two. The single
source goes in `source_1_url` and `source_1_note` for items requiring one.

`source_1_note` states what the source actually says, in a few words. A bare URL
is not verification, because nobody can audit it later without repeating the
lookup.

**No question may be set `active: true` until its source requirements are met on
every item.** The validator enforces this.

---

## 4. Live disputes

A participant challenges an answer out loud during the reveal.

**The facilitator does not adjudicate live and does not reopen the score.**

The line is:

> "Noted. I'll check the source and send it round."

Then move on. Ten seconds.

Two reasons this is fixed policy rather than judgment. Arguing about trivia
accuracy inside a psychological safety exercise is the worst available use of
that room's time, and it puts the client's manager in the position of defending
Unmute's content in front of his own team. And rescoring mid-session is build
work that does not exist and a live failure mode nobody wants.

The follow-up is an asset, not a chore. A short note after the session with the
source is a between-meeting touchpoint, and D8 is the primary endpoint with the
most headroom.

Disputed items are logged in the facilitator notes. No product change required.

---

## 5. Selection before verification

Only three or four scored questions run in a 15-minute envelope. Roughly three
minutes per round covers the 90-second timer, the reveal, and advancement.

**Pin the running set before verifying anything.** Verifying a library and then
selecting from it does the work in the wrong order and most of it goes unused.

Note the pinning semantics: `drawQuestion` uses `pinned.length > 0 ? pinned :
eligible`, so pinned questions exhaust before any unpinned question is drawn.
Pinning is a "play these first, in this pool" flag, not a "guarantee this
appears somewhere" flag. Pin the full running set or pin nothing.

Unselected drafts stay in the library at `active: false`. They cost nothing and
they are ready when a later Season needs them.

---

## 6. Pre-session check

Run before every session:

```sql
select count(*) from wao_questions where active = true;
```

The count must exceed the number of rounds intended, with at least one spare. An
exhausted pool mid-session produces a dead end on the lead's screen with no way
forward.

---

## 7. AI-assisted verification

Verification is well suited to delegation. The instructions below produce output
that can be pasted back into the item records without reformatting.

### 7.1 The instruction

> For each item below, tell me whether the claim is true under the stated
> disambiguation rule.
>
> Rules for your answer:
> - Give me the source URL and a short note on what the source actually says
> - Items marked `is_correct: true` need two independent sources. Items marked
>   `is_correct: false` need one
> - Two pages citing the same origin count as one source
> - If standard references disagree, say so explicitly and recommend cutting
>   the item. Do not pick a side
> - If you cannot find a source, say so. Do not infer from general knowledge
> - Flag any item where the disambiguation rule leaves the answer ambiguous
>
> Then give me a summary line: items confirmed, items to cut, items unresolved.

### 7.2 What the human still does

The final call on every item, and specifically:

- Whether a cut recommendation is accepted
- Whether the concentration check (1.3) passes for the category
- Trap tier assignment, which is a judgment about the room, not about the fact
- Whether the question ships

AI verification changes the cost of the lookup. It does not change who owns the
content.

---

## 8. Checklist

A question ships when all of the following are true.

- [ ] Category has an arbiter (1.1)
- [ ] Ground truth does not drift (1.2)
- [ ] Concentration check passes (1.3)
- [ ] Disambiguation rule makes every item a clean yes or no (2.1)
- [ ] Exactly 10 items, 1 to 5 correct, `correct_count` matches (2)
- [ ] At least 2 gimmes and 2 traps, tiered honestly (2.2)
- [ ] Every `is_correct: true` item has two independent sources (3.1)
- [ ] Every `is_correct: false` item has one source (3.1)
- [ ] Every source meets the uncontested standard (3.2)
- [ ] No item where standard references disagree (3.3)
- [ ] Source notes state what the source says, not just a URL (3.4)
- [ ] Question is in the pinned running set or deliberately held back (5)
