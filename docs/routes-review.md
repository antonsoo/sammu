# Two roads, one tuning

Reviewed 3 November 2026. This is a local implementation and browser review;
it is not a receipt for a deployed edition. The later [navigation and transfer
review](navigation-transfer-review.md) covers outage, progress and activation
failures found during the follow-up audit.

## The learning gap

The original bench could make a cycle and report a returning name with a pitch
shift. Its route planner offered one short route. It could not hold an origin
fixed while comparing two routes to one destination. That left a useful claim
about tuning identity largely as prose beside a single experiment.

The new `routes.html` room forks the actual current state. It never reconstructs
a fresh state merely from the current name. A preceding seven-move cycle, for
example, stays audible in both branches and in any route continued on the bench.

```
                         Actual bench pitches
                         /                  \
                    A: loosen           B: tighten
                         |                  |
                    Destination         Destination
                     raw pitches         raw pitches
                         \                  /
                          A/B listening test
                         /                  \
                   Raw pitches       Transpose only heard B
```

A uses zero to six loosening steps; B takes the complementary seven to one
tightening steps. If the destination is already the origin name, A stays put
and B completes seven tightening steps. The two directions together visit each
primary string exactly once. Companion strings follow their primary string.
Each branch lists its changed strings and resulting names, including the zero
move case.

## Source reviewed now

Sam Mirelman, [“Tuning Procedures in Ancient Iraq,” *Analytical Approaches to
World Music* 2(2), 2013, 43–56](https://journal.iftawm.org/previous/vol2no2/mirelman/).
The complete publisher PDF was downloaded, and printed pp. 52–55 were rendered
and visually inspected. Figure 5 on p. 52 supplies the named and unclear pairs;
p. 53 treats tightening in the reverse direction; pp. 54–55 qualify the
interpretation and discuss relative versus precise pitch.
- PDF URL: <https://journal.iftawm.org/wp-content/uploads/2022/02/Mirelman_AAWM_Vol_2_2.pdf>
- SHA-256 of the inspected PDF: `665af5ee1a0fa6ed90b70beebccaf693d61c1126665f85f2720abdf199c4ef3d`
- Printed p. 52 is PDF page 10; printed pp. 53–55 are PDF pages 11–13.
- No cropped figure or article PDF is redistributed. The journal's whole-article
  conditions are not treated as permission to extract its figures.

Jay Rahn, [“Was Mesopotamian Tuning Diatonic? A Parsimonious Answer,” *Music
Theory Online* 28.1, 2022](https://mtosmt.org/issues/mto.22.28.1/mto.22.28.1.rahn.html),
DOI 10.30535/mto.28.1.7. Paragraphs 11–16 describe the network and repeated
cycles; paragraph 45 explains the partially preserved and editorially restored
action terminology. This room's Akkadian notes are normalized lemmas, not
invented cuneiform sentences or a pronunciation reconstruction.

The numerical ratios, synthetic sound, hertz reference and transposition are
modern modeling choices. The exact frequency gap below is a deduction from those
choices, not a newly established ancient measurement. Existing preservation
cases and the fuller source ledger remain in [sources.md](sources.md).

## The calculation

The numerical bench makes six designated clear pairs exact fourths or fifths.
Each loosening operation multiplies its prescribed string by
`q = 2^11 / 3^7 = 2048/2187`; tightening uses `1/q`. A changes one subset of
strings by `q`; B changes the complementary subset by `1/q`. Consequently,
for every string, `B / A = 1/q = 2187/2048`.

Multiplying B by `q` makes all nine of its pitches equal to A. The listening
control does exactly that; it never changes the raw branch state. The diagram
uses one logarithmic axis for all strings, with its extent computed from the
origin and both raw results. Toggling transposition keeps the axis and A's marks
fixed. JSON and CSV distinguish raw B from heard B, and JSON records the multiplier. CSV names the noncommercial license; WAV keeps the original synthesis notice in a standard RIFF INFO copyright chunk.

The retained example starts after seven loosening moves from išartum, at an
initial 440 Hz reference, and compares two routes to embūbum:

| Quantity                           | A                 | Raw B              | Heard B, transposed |
| ---------------------------------- | ----------------- | ------------------ | ------------------- |
| Further route                      | 2 loosening moves | 5 tightening moves | Same B route        |
| Final string 1                     | 412.034750800 Hz  | 440 Hz             | 412.034750800 Hz    |
| Ratio to original initial string 1 | 2048/2187         | 1/1                | 2048/2187           |

These values come from the independent checker and actual native downloads.
The example JSON retains every intermediate route state and all earlier moves.

## Interface decisions

Keep Sammû's self-hosted Atkinson/Noto type and ink `#173441`, paper `#f4f1e9`,
rule `#b6c1bd` and teal `#216568`. The second route uses plum `#713b77`, a colour
with a distinct marker shape rather than colour alone. Use a literal branching
route ledger beside one shared nine-string ruler. This is an extension of an
existing instrument bench, so preserving its visual vocabulary matters more
than giving the new room an unrelated decorative theme.

The two branches share a baseline and destination name. Equal-height branches
make their different operation counts visible. At 375 px they stay side by
side, while listening and evidence stack. The exact table scrolls in a labelled,
keyboard-focusable region. The saved reading also keeps a scrollable table on
small screens instead of squeezing frequency values into broken fragments.
No new runtime dependency, external font call, asset service or animation is
introduced.

## Verification

Clean installation and checks use Node.js 24.22.1. Commands, run from this repository:

```sh
npm ci
npm run check
npm run verify:tuning
npm run verify:practice
npm run verify:routes
npm run test:routes
npm run verify:routes-audio
```

`verify:routes-audio` needs NumPy from `scripts/requirements-audio.txt`. The
browser driver uses the cached Chromium and Firefox installations; it builds on
the repository's existing Playwright setup.
- The full unit suite has 19 passing tests. New checks cover prior drift, the
  zero-step branch, full sessions, invalid links, exact alignment, raw-versus-
  heard records, audio timing and silent gaps.
- The independent exact checker covers 1,764 comparisons and 31,752 endpoint
  pitches across all origins/destinations, both companion choices, three
  reference pitches and six prior histories. It solves initial prime-exponent
  equations with rational Gaussian elimination, then uses a closed-form retuning
  multiplier and separately retained source-order fixtures.
- Four browser journeys cover Chromium and Firefox at 1440 and 375 px: bench
  discovery after a preceding cycle, both branch records, return to the actual
  endpoint, keyboard destination changes, history restoration, malformed links,
  a full 28-move session, native downloads and zero page-level horizontal overflow.
- Both raw and aligned states pass automated accessibility checks with no
  reported violations. This supplements keyboard and visual inspection; it
  does not establish compatibility with every assistive technology.
- Each journey waits for a controlling worker and verified edition, deletes
  this room from the cache, observes readiness withdrawal, repairs it, reloads
  offline, and saves a reading while offline.
- The standalone reading is opened from disk in both engines with networking
  disabled. Embedded fonts and audio work, native JSON matches the page's record,
  native WAV matches the downloaded WAV byte for byte, and no HTTP requests occur.
- Eight actual buffers supplied to Web Audio contain 80 notes reconstructed
  independently with NumPy. Maximum absolute sample error in this review was
  below `4e-8`. This verifies scheduled PCM, not physical speakers or subjective
  historical hearing.

The existing bench and practice browser reviews also passed four layouts each;
their independent audio checkers validated 40 and 60 WAV files respectively.
The final local production preview served 16 files byte-identical to `dist/`.
The [retained receipt](routes-receipt.json) records their identities and the
five portable example files; this does not assert public hosting.

Browser receipts and retained examples are generated by `scripts/routes-browser.mjs`.
The screenshot pair is [desktop](assets/routes-desktop.png) and
[375 px](assets/routes-mobile.png); the [retained reading](../examples/routes/reading.html)
and [printed reading](../examples/routes/reading.pdf) are actual browser outputs.

## Delivery boundary

`npm run build` writes the complete three-room site to `dist/` with base
`/sammu/`. The build's edition identity includes the new page, all source files
and the embedded original-code license. The worker's generated inventory
includes the room and its assets automatically.

No remote push or deployment is part of this review. The live README links
name the intended published route; the repository examples are reviewable now.
External articles need a connection; downloaded readings retain explanatory
source notes and citations, not the full articles. At the 28-move bench limit,
preview and export stay available while applying an over-limit branch is disabled.

Suggested repository description: “Hear ancient Mesopotamian retuning: compare
routes, exact pitches and the limits of a modern audible model.”

Topics: `mesopotamia`, `akkadian`, `music-theory`, `tuning`, `web-audio`,
`education`, `interactive-learning`.
