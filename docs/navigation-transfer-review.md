# Keep a saved lesson usable

Reviewed 3 November 2026. This review follows the [two-road lesson](routes-review.md)
and audits both that work and the older bench/practice infrastructure.

## Reproduced failures

A complete saved edition was insufficient to guarantee a usable reload. The
worker fetched navigation documents before consulting its verified cache. Both
browsers accepted an HTTP-200 maintenance document in place of the lesson. A
request that stalled before headers or partway through its body could keep
navigation pending despite a complete local copy.

First installation also had a fixed ten-second batch deadline. Under a real
shared 96,000-byte/second origin budget, foreground fonts and the installation
competed for the same bandwidth. Both browsers reported failure with no
controller while bytes were still arriving. The two baseline trials sent more
than a megabyte each; the connection was progressing, not silent.

| Trigger                                                         | Corrected behavior                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Maintenance, wrong room, error status or stalled entry document | Controlled navigation opens the verified saved entry and preserves query state                   |
| Cold, continuously progressing installation                     | Files can continue for up to three minutes; readiness still requires the full verified inventory |
| Header or body stops arriving                                   | A fifteen-second inactivity limit aborts the file                                                |
| Failed first worker installation                                | The page observes failure, enables retry and preserves the experiment                            |
| Oversized saved-reading asset                                   | Reject as soon as it exceeds its pinned byte count; no partial reading downloads                 |
| Slow but progressing reading export                             | Continue within the same total allowance; cancellation stays available                           |
| Different saved edition takes control                           | Offer an explicit reload only when it confirms that this room is saved                           |
| Read source evidence from the route room                        | Keep the actual earlier retuning history in the destination bench                                |

The baseline is source `aac9654`, before this follow-up. Baseline receipts are
retained separately from corrected runs; a Playwright navigation timeout counts
as a failure even when Firefox leaves the previous document visible.

## Why navigation uses a complete edition

A controlled navigation serves the entry in its worker's verified inventory.
The page continues to register the worker with HTTP-cache bypass. A different
worker downloads and verifies its own complete edition before activation; the
open page then explains the edition difference and offers **Reload saved
edition** when the requested room is present.

This deliberately permits a saved page to remain on its prior edition until an
update completes. It avoids mixing a new entry with old asset hashes, accepting
a maintenance body, or waiting for a network body before opening a saved lesson.
The reload keeps the URL's exact experiment and listening choices. Both route
branches and the practice adjustment survive an offline reload into the next
saved edition.

A first navigation can also commit after activation has already claimed its
client snapshot. The active worker then has complete files but the new page is
uncontrolled. A bounded message handshake asks it to claim the live client.
Legacy workers that cannot do this offer an explicit online page reload, without
promising that a newly added room is saved.

An older worker's `complete` flag alone cannot promise that it contains a newly
added room. Modern replies include the saved entry paths. An unsupported or
legacy reply never enables that reload action. A new room can still load online
and install its complete edition normally.

## Active transfer versus inactivity

A file transfer has two independent bounds:

```
receive bytes --> reset 15-second inactivity timer --> receive more bytes
     |
     +-- total elapsed transfer stays within 180 seconds
```

The build records exact file sizes alongside digests. Readers reject excess
bytes before accumulating an unbounded body, require the final byte count, then
verify SHA-256. The worker explicitly reads bounded chunks rather than relying
on native SRI to expose body progress. A first installation verifies every file
before publishing any cache entries; a failed write removes the incomplete
edition. Repair replaces missing or damaged files without labelling a partial
copy ready.

The page separately observes worker activation or redundancy: waiting only on
`serviceWorker.ready` cannot report a failed first installation because that
promise does not reject. Registration has its own finite wait, and activation
and repair fit the bounded transfer window. The illustrated-reading downloader
uses the same policy, verifies retained font/license identities, and keeps a
snapshot while the learner continues working.

## Operated verification

```sh
npm ci
npm run check
npm run verify:tuning
npm run verify:practice
npm run verify:routes
npm run test:navigation
npm run test:control-race
npm run test:transfers
```

The navigation driver exercises all three rooms in Chromium and Firefox through
six real origin faults: 503, HTTP-200 maintenance, another room's HTML, stalled
headers, stalled body and a disconnected origin. All 36 journeys require a
current controller, a verified cache and unchanged experimental state. Following
the route room's evidence link must retain the earlier seven-move cycle.

The transfer driver runs 34 workflows. It shares one bandwidth budget across
foreground requests and installation, checks every cached file independently,
then makes the origin unavailable for an offline reload and reading download.
In all three rooms it also exercises a slow reading export, header/body stalls,
excess bytes, cancellation and retry. Each slow export must actually exceed the
former fifteen-second total deadline and embed byte-identical fonts.

The fast-navigation driver varies real entry-response timing across forty cold
contexts. It observes initial control and claim messages without replacing the
browser's state. Each final trial must reach verified readiness with an actual
controller.

The saved-edition driver uses two separately built fixtures, differing in one
index title, to exercise a real worker update. Both open rooms offer a supported
reload, the actual origin is disconnected, and their state and full cache are
checked afterward. It separately starts from the exact preceding public Pages
snapshot to check the unsupported-legacy-room guard. The original six-scenario
upgrade review also covers held entries, substituted HTTP-200 bodies and delayed
old-worker replies before offline audio and reading downloads.

The regular browser/audio suites remain separate checks on diagrams, keyboard
controls, native files and the numerical teaching model. These transfer checks
do not establish speaker output, ancient performance, or a historical pitch
standard. Source and model boundaries remain in [sources.md](sources.md).

## Publication

Build with `npm run build`; the reviewed complete site is `dist/`, base `/sammu/`.
Publication receipts distinguish source synchronization, immutable public raw
files, current canonical build bytes and actual hosted browser journeys.
Previous hashed assets on Pages are retained for compatibility with older cached
entry pages; they are not included in a new edition's verified inventory.

[Navigation before](navigation-transfer/navigation-before.json),
[cold installation before](navigation-transfer/cold-before.json),
[control race before](navigation-transfer/control-before.json),
[navigation after](navigation-transfer/navigation-after.json),
[control race after](navigation-transfer/control-after.json),
[transfer matrix](navigation-transfer/transfers-after.json) and
[asset recovery](navigation-transfer/assets-after.json),
[saved-edition reload](navigation-transfer/saved-edition.json),
[public-predecessor upgrade](navigation-transfer/upgrade-public.json) and
[audio lifecycle](navigation-transfer/audio-lifecycle.json) retain the measured runs.
The original fast-navigation probe reached readiness in 30 of 40 contexts; the
corrected probe reached readiness in all 40, including actual claim handshakes.
These are the specified schedules in these browser runs, not a general failure
probability for users.

The accompanying receipts record the tested editions and actual observations.
They must not be read as evidence for a future build merely because its tests
have similar names.
