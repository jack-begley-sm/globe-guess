# 04 — TOSD working model

Time-Oriented Software Development (Niels Pflaeging & Sebastian Kubsch,
BetaCodex white paper #26, 2025). This doc records how TOSD is applied on
GlobeGuess, because several of its rules change what the rest of this plan is
allowed to look like.

## What TOSD actually asks for

The parts that bind this plan:

| Principle | What it means here |
|---|---|
| **Time orientation** | Time is the organising structure. Not capacity, not volume, not points. |
| **Fixed timing, variable capacity** | The box does not move. What fits inside it does. |
| **Time-boxed Realization** | Every item is **1, 2 or 3 days maximum**. No exceptions, no 5-day items. |
| **The OK Point** | The handshake between Conceptualization and Realization. "A seam, not a separator." Nothing is realized before it crosses. |
| **Ks and Rs** | Conceptualizers produce requirements precise enough that you *know* an item is 1, 2 or 3 days. Realizers build within the box. |
| **List of Items** | One list. Prioritised. Has a keeper. Continuously updated. Completed and replaced periodically. |
| **No estimation** | No poker, no story points. Clarity replaces guessing. If you cannot tell whether it is 1 or 3 days, it is not conceptualized yet — that is a K failure, not an estimation problem. |
| **TTEO** | Talk to each other, immediately. Not applicable solo; see below. |

TOSD explicitly **discards**: sprints, iterations, MVPs, backlogs, development
teams, estimation and story points, Kanban boards, retrospectives, scaling
frameworks, planning ceremonies, user stories, Scrum Master and Product Owner
roles.

It explicitly lists as **complementary**: Test-Driven Development, CI/CD, pair
programming, DevOps, Domain-Driven Design, Architecture Decision Records. The
ATDD/TDD loop in [03-test-strategy.md](03-test-strategy.md) is not in tension
with TOSD — it is one of the practices TOSD names as aligned.

## How it applies to this project

Two things about GlobeGuess make the standard shape need adapting, and both were
decided rather than assumed:

### A "day" is one evening session, ~2–3 hours

So a 3-day item is three evenings, not twenty-one hours. Everything in
[06-list-of-items.md](06-list-of-items.md) is boxed against that unit. This makes
the constraint bite much harder than a working-day box would — most of what
looks like "one task" is two or three evenings — and that is the point. An item
that cannot be described tightly enough to fit three evenings gets split before
it is listed, not discovered halfway through.

### You are both K and R

TOSD assumes Ks and Rs are different people, and the OK Point is a social
handshake. Solo, the separation is **temporal instead of social**: you
conceptualize a run of items, cross the OK Point, then realize them without
redesigning mid-item. The failure mode this is guarding against is the one that
actually happens on solo hobby projects — opening the editor with a vague idea,
designing while typing, and stopping when tired rather than when done.

So the OK Point here is a self-check, applied before an item is started, never
during:

> **OK Point checklist** — an item may not be started until all four hold:
> 1. Its acceptance scenario exists in a `.feature` file and reads as English.
> 2. Its box is 1, 2 or 3 evenings and you *know* which — not "probably two".
> 3. Every file it touches is named.
> 4. You could hand it to someone else and they would build the same thing.
>
> If any fails, the item goes back to Conceptualization. Conceptualizing is real
> work and is itself listable — several items in the list are conceptualization
> items.

The corollary matters as much: **once an item is started, the design is closed.**
If you discover mid-item that the conceptualization was wrong, stop, finish or
abandon the box, and re-conceptualize. Do not redesign inside a Realization box.
That is the discipline TOSD is actually selling.

### TTEO, solo

"Talk to each other" has no counterpart with one person. The nearest useful
substitute is writing the reason down at the moment of the decision — an ADR-style
line in the relevant conceptualization file — since the person you would have
talked to is yourself in three weeks. TOSD names Architecture Decision Records as
complementary; use them where you would have had the conversation.

## What this changes about the rest of this plan

The first draft of this plan was organised into fourteen vertical "slices". Under
TOSD that is the wrong unit — several were a week or more of evenings, which is
exactly the sizing TOSD exists to prevent. So:

- The fourteen files in [05-conceptualization/](05-conceptualization/) are now
  **Conceptualization material**, not work units. They are the K-side output: the
  acceptance scenarios, the contracts, the traps. They are what an item points at.
- The actual work unit is the **Item**, in [06-list-of-items.md](06-list-of-items.md),
  each boxed at 1, 2 or 3 evenings.
- The word "slice" is retired. The S00–S13 labels survive purely as citations, so
  an item can say where it is conceptualized.

### The list is deliberately short

TOSD discards backlogs, and a list of every item to the end of the feature *is* a
backlog wearing a different hat. Decomposing all fourteen groups up front would
produce roughly eighty items and well over a hundred evenings — a number that is
both discouraging and mostly fiction, since items after the first playtest depend
on what that playtest teaches.

So [06-list-of-items.md](06-list-of-items.md) holds **only the items through to
the first decision point**, and is completed and replaced rather than extended.
Everything beyond it stays as conceptualization material until the current list
is nearly done. That is the "completed and replaced periodically" rule doing its
job, and it is why the list has a stated end rather than trailing off.

## Honest caveats

- TOSD's headline results (Pradtke: throughput doubled by week three) come from a
  24-developer organisation replacing a steered hierarchy. Most of the mechanism
  being measured there — decentralisation, removing approvals, TTEO — has no
  surface on a one-person hobby project. What transfers is the time-box and the
  OK Point. Do not expect the rest.
- Fixed timing / variable capacity inverts cleanly at work and awkwardly on
  evenings, where capacity is whatever is left after the day. The honest reading
  solo: the box is fixed, and if an evening disappears the item slips a day
  rather than growing. Slipping is fine. Growing is not.
- Adherence to the box is described in the source as "a matter of honor". Solo,
  nobody is watching. If you routinely blow boxes, the signal is that
  conceptualization is too loose, not that the boxes are too small.

## Source

- Pflaeging, N. & Kubsch, S., *Introducing Time-Oriented Software Development*,
  BetaCodex Network white paper #26, 2025 — <https://betacodex.org/white-papers/paper/introducing-time-oriented-software-development-26>
- <https://www.redforty2.com/tosd>
