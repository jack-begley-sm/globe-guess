# 01 — Scoring model

## The rule

> Score is a proportion of the distance from the site to the total area available
> to guess, where anything above 45% away scores 0.

Formalised:

```
d  = great-circle distance from guess to actual location, km
D  = the play area's maximum diameter, km   (see "Choosing D" below)
r  = d / D                                   (the "proportion away")

score = 0                                        when r >= CUTOFF_RATIO
score = MAX_SCORE * (1 - r / CUTOFF_RATIO)^p     when r <  CUTOFF_RATIO

CUTOFF_RATIO = 0.45
MAX_SCORE    = 5000        (unchanged)
p            = SCORING.CURVE_EXPONENT, shipped at 2, lowered to 1.5 — see
               "Custom-mode playtest decision (2026-08-29)" below
```

At `r = 0` the score is `MAX_SCORE`. At `r = 0.45` it is exactly 0 and the
function is continuous there. `p = 2` preserves the shape of the current curve —
it is the same `(1 - x)^2` decay, with `x` rescaled from "fraction of 2000 km" to
"fraction of 45% of the play area".

`d` keeps using the existing haversine in `js/scoring.js`. Nothing about the
speed bonus changes; it still multiplies the base score.

## Choosing D — and the trap in it

`D` is the greatest great-circle distance between any two points **inside** the
play area. The obvious implementation — max pairwise distance over the ring's
vertices — is wrong for wide areas, and the built-in `WORLD` region proves it:

| Region | D from vertices only | D from densified boundary | 45% cutoff |
|---|---:|---:|---:|
| WORLD | 14 455 km | **20 015 km** | 9 007 km |
| UK | 1 171 km | 1 171 km | 527 km |
| EUROPE | 6 232 km | 6 232 km | 2 805 km |
| AMERICAS | 17 174 km | 17 305 km | 7 787 km |
| AFRICA | 10 783 km | 10 783 km | 4 852 km |
| ASIA | 13 260 km | 13 260 km | 5 967 km |
| OCEANIA | 7 684 km | 7 684 km | 3 458 km |

`WORLD` is a lat/lng rectangle spanning −180…180. Its four corners collapse to
two distinct meridians, so the vertex-only maximum (14 455 km) badly understates
the real answer: two points on the boundary at, say, (−60, 0) and (70, 180) are
20 015 km apart — nearly antipodal. A 39% error in `D` is a 39% error in the
cutoff and skews every score in the mode.

**So: densify the boundary before measuring.** Split every edge into segments of
at most `CUSTOM_MAP.DENSIFY_STEP_DEG` (2° works; ~220 km) and take the max
pairwise distance over the resulting point set. For a convex-ish spherical
region the diameter is attained on the boundary, so boundary sampling is
sufficient; a hand-drawn concave polygon can in principle do slightly better
through its interior, but the error is small and always in the direction of a
*tighter* (harder) score, which is the safe direction.

Cost is O(n²) over densified points. For a 24-vertex polygon at 2° that is a few
thousand points worst case — a few million distance calls, tens of milliseconds,
computed **once** when the shape is created and cached on it. Never in a round.
`CUSTOM_MAP.MAX_VERTICES = 24` exists partly to bound this. If it ever matters,
the standard fix is a convex hull first (the diameter is always a hull pair);
don't do it until measured.

## What this does to existing modes

This is the part to look at before merging S04. With `p = 2`:

**WORLD (`D` = 20 015 km, cutoff 9 007 km)**

| Miss | New score | Score today |
|---:|---:|---:|
| 10 km | 4 989 | 4 950 |
| 100 km | 4 890 | 4 513 |
| 500 km | 4 460 | 2 813 |
| 1 000 km | 3 951 | 1 250 |
| 2 000 km | **3 026** | **0** |
| 4 000 km | 1 545 | 0 |
| 8 000 km | 62 | 0 |
| 9 007 km+ | 0 | 0 |

**UK (`D` = 1 171 km, cutoff 527 km)**

| Miss | New score | Score today |
|---:|---:|---:|
| 10 km | 4 812 | 4 950 |
| 50 km | 4 096 | 4 753 |
| 100 km | 3 282 | 4 513 |
| 250 km | 1 381 | 3 828 |
| 527 km+ | 0 | 2 712 |

That is the intended correction — UK games become sharp, and a wrong-continent
guess in a World game stops being indistinguishable from a wrong-country one.
But World also becomes markedly more forgiving: a 2 000 km miss goes from 0 to
3 026. If you want World to stay punishing, the lever is `p`:

| Miss (WORLD) | p = 1 | p = 2 | p = 3 |
|---:|---:|---:|---:|
| 250 km | 4 861 | 4 726 | 4 595 |
| 1 000 km | 4 445 | 3 951 | 3 513 |
| 2 000 km | 3 890 | 3 026 | 2 354 |
| 4 000 km | 2 779 | 1 545 | 859 |
| 8 000 km | 559 | 62 | 7 |

`p` is a single config constant. Ship `p = 2`, play five rounds of World and five
of UK, then decide. Do not tune it by changing `CUTOFF_RATIO` — 0.45 is the
stated rule and the tests pin it.

The knock-on effects to check when S04 lands:

- **Stitch Up setter scoring** (`js/su-host.js:394`) is `5000 - guesserScore`. A
  more generous guesser curve means a stingier setter. Same file also caps
  auto-placed rounds at `guesserScore * 1.5`. Both still work arithmetically;
  they just feel different. Re-play a Stitch Up round before calling S04 done.
- **Awards** (`js/awards.js`) — check nothing thresholds on a raw km distance
  that assumed the 2000 km scale.
- **`MAP_SETTINGS.MAX_GUESS_DISTANCE`** becomes dead. Delete it in S04 rather
  than leaving a misleading constant; `js/vs-round.js:5` imports `MAP_SETTINGS`,
  so check what else it uses from there first.

## Item 24 decision (2026-08-29)

**`CURVE_EXPONENT` stays at `p = 2`.** This was **not** decided from the
five-World/five-UK/one-VS/one-Stitch-Up playtest this section calls for —
Jack chose to skip that playtest and keep the shipped default rather than
block the list on it. Record this plainly rather than let it read as a
played-and-confirmed decision: if World ends up feeling too soft in practice
(a 2000km miss now scoring 3026 instead of 0 is the biggest behavioural
change), revisit `p` then, informed by real play rather than a table.

The two "knock-on effects" above were addressed without a played round:
Stitch Up's `su-host.js:394` (`5000 - guesserScore`) works arithmetically
and was left alone per this doc's own note; the awards audit (item 23,
06-list-of-items.md) found and documented — but did not fix — four SOLO
awards with now-stale absolute-km thresholds, deferred for the same reason
`p` wasn't played in: choosing new numbers without playing first would be a
guess dressed up as a decision.

## Custom-mode playtest decision (2026-08-29)

**`CURVE_EXPONENT` changes from `p = 2` to `p = 1.5`.** This is the revisit the
Item 24 decision above called for — "informed by real play rather than a
table" — after Jack played a solo Custom game in a small, tightly-drawn area
("super duper central London") and found the quadratic drop-off too
punishing: near misses (under a km) scored fine, but scores collapsed hard
by 2-4 km even though the whole point of a hyper-local area is that a few
km *is* still a reasonable guess.

Two levers were on the table — `CUTOFF_RATIO` (how far out the zero-score
cliff sits) and `CURVE_EXPONENT` (how sharply score falls off before it).
Widening `CUTOFF_RATIO` was explicitly rejected: Jack's framing was "I want
smoother not more forgiving" — the zero-point distance should stay exactly
where it was, only the shape of the descent toward it should soften.
`CUTOFF_RATIO` therefore stays at 0.45, unchanged since Item 24, and the
"do not tune it by changing `CUTOFF_RATIO`" line further up still holds for
the reason it always did: it's a single global constant shared by every
region and every Custom shape alike, not something to special-case per mode.

`p = 1.5` was chosen from a table of `p = 1.5 / 1.3 / 1` (linear) shown
against % of the way to the cutoff distance, scale-independent so it applied
equally to a tiny Custom area and to World. `p = 1.5` was picked as
noticeably smoother without going all the way to a straight line, which
would have lost the "extra reward for being extra close" curve shape
entirely.

Because `CURVE_EXPONENT` is global, this also softens every built-in
region's scoring, not just Custom's — e.g. a 100 km UK miss goes from 3283
to 3647, a 4000 km World miss from 1545 to 2072. That's a deliberate,
accepted side effect of keeping one shared constant rather than forking the
formula per shape type; every acceptance test with a `p`-dependent exact
score (`region-scoring.feature`, `scoring-scale.feature`,
`custom-solo-game.feature`) was recomputed against the real formula, not
hand-copied, and re-verified green.

## Out-of-polygon guesses

Blocked at the map (decision 3), so the scorer never sees `r > 1` from a legal
guess. It must still behave for `r > 1` — a no-guess timeout, a guest on an older
build, a rounding case exactly on the boundary — and it does: `r >= 0.45` returns
0 for any larger `r`. No special case, no clamping, no negative scores.

## Degenerate inputs

The scorer is total. Every one of these has a test in S03:

| Input | Result |
|---|---|
| `guess` null (timeout) | `{ distanceKm: Infinity, totalScore: 0 }` — unchanged from today |
| `scaleKm` 0, negative, `NaN`, or missing | **throw**. A missing scale means a call site wasn't migrated; failing loud in dev is the point. |
| `d = 0` | exactly `MAX_SCORE` |
| `d` exactly `0.45 * D` | exactly 0 (`>=`, not `>`) |
| `d` slightly below cutoff | small positive, never negative |

## Reference implementation

Target shape for `js/scoring.js`. Written here so the tests in S03 can be written
against it before the code exists.

```js
export function scoreFromDistance(distKm, scaleKm) {
    if (!Number.isFinite(scaleKm) || scaleKm <= 0) {
        throw new Error(`scoreFromDistance: invalid scaleKm ${scaleKm}`);
    }
    if (!Number.isFinite(distKm)) return 0;
    if (distKm <= 0) return MAX_SCORE;

    const ratio = distKm / scaleKm;
    if (ratio >= SCORING.CUTOFF_RATIO) return 0;

    return MAX_SCORE * Math.pow(1 - ratio / SCORING.CUTOFF_RATIO,
                                SCORING.CURVE_EXPONENT);
}
```

`calculateScore(guess, actual, timeTaken, timeLimit, bonusEnabled, bonusPct, scaleKm)`
gains `scaleKm` as a seventh argument. It is appended rather than inserted so the
existing positional calls keep their meaning, and it is validated eagerly so an
un-migrated call site throws on the first round instead of quietly scoring
against `undefined`.
