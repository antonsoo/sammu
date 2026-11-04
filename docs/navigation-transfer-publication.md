# Published audit: the lesson survives the connection

Reviewed 3 November 2026. This follows the reproduced failures and fixes in
[the navigation/transfer review](navigation-transfer-review.md), including the
later correction to the bench/practice reading licenses.

The [public route experiment](https://antonsoo.github.io/sammu/routes.html?moves=LLLLLLL&target=embubum#comparison)
and [Officina search](https://antonsoo.github.io/officina/?q=two+roads#catalogue)
are operated browser journeys, rather than availability inferred from a push.

## Source, build and delivery

The [clean build inventory](navigation-transfer/published/clean-build.json)
was reproduced from committed source `8d7244e` with Node 24.22.1 and a fresh
`npm ci`. Lint, strict types, all 19 repository tests, the production build and
the three independent exact-arithmetic oracles passed. Source `d918e1e` adds
only a stronger reading-notice check and documentation; its build inputs are
the same. Both builds produce edition
`f18c535e5bafc0ed1b95c306c1c868a89475b94177a237b4ce1715bdac577e69`.

All [16 canonical hosted files](navigation-transfer/published/hosted.json)
match that inventory, including explicit `index.html`, the bare entry URL and
the worker. Requests use ordinary canonical URLs without cache-busting query
strings. A [second full comparison](navigation-transfer/published/hosted-after-browser.json)
follows the browser journeys. Earlier hashed Pages assets are deliberately
retained for older entry pages; those extra files are outside the new worker's
15-file verified inventory.

Five [public immutable source artifacts](navigation-transfer/published/source.json)
match their Git objects separately from the hosted build: both reviews, the
reading implementation, the transport-cut driver and the complete license.
Later evidence-only commits do not change the reviewed runtime. Source and
Pages updates used normal fast-forward pushes.

## Final edition verification

| Exercise                                                                      | Observed scope                                                                                           |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [Navigation faults](navigation-transfer/published/navigation.json)            | 36: three rooms, six actual origin faults, both engines                                                  |
| [Activation/navigation race](navigation-transfer/published/control-race.json) | 40 cold contexts; all reached verified readiness                                                         |
| [Transfer matrix](navigation-transfer/published/transfers.json)               | 34: shared bandwidth, slow exports, stopped headers/bodies, excess bytes, cancellation and retry         |
| [Damaged-cache recovery](navigation-transfer/published/assets.json)           | 10: exact embedded font/notices, whole-cache loss, multiple tabs, deadlines and retry                    |
| [Saved-edition update](navigation-transfer/published/saved-edition.json)      | Four: two built editions, both open rooms reloaded with the origin unavailable; legacy-room guard        |
| [Legacy-worker update](navigation-transfer/published/upgrade-legacy.json)     | Six: held entry, substituted body and late reply in both engines                                         |
| [Public route room](navigation-transfer/published/routes-browser.json)        | Four desktop/mobile journeys; 32 actual downloads, native reading/audio and zero HTTP requests from disk |
| [Route sound](navigation-transfer/published/routes-audio.json)                | Eight scheduled buffers, 80 independently reconstructed notes; maximum sample error below 2.3e-13        |
| [Public connection cut](navigation-transfer/published/public-outage.json)     | Four browser/device contexts; all three rooms and 12 illustrated readings                                |

The final edition's race run includes actual claim handshakes. The earlier
baseline reached readiness in 30 of 40 scheduled contexts. These are observed
trials, not estimated real-world failure probabilities.

The legacy-upgrade driver intentionally starts with the pre-feature public
snapshot (`1e4685a`), whose network-first worker can deliver a new page before
its new worker. That scenario does not describe the new saved-entry policy.
Updates between modern saved-entry workers use the separate two-build
saved-edition driver and require the explicit supported-edition reload.

## Cut the transport, leave the browser online

```sh
npm run test:public-outage -- /tmp/claude-1000/sammu-public-outage
```

The driver forwards actual public HTTPS through an HTTP CONNECT proxy. TLS
remains end-to-end with GitHub; no certificate is bypassed and no app response
is replaced. After the current worker controls the page and all 15 cached file
digests match the build, it destroys every tunnel and refuses new connections.
An unsupported uncached path returns a real 404 before the cut and fails
through the refused transport afterward. Browser offline emulation stays
disabled and `navigator.onLine` remains true.

Both engines at 1440px and 375px then navigate through bench, practice and
route comparison. They preserve the seven earlier moves, the 110-cent attempt
and the selected transposition. Route sound starts and stops. Every room saves
an actual illustrated reading despite the failed connection.

Each of the twelve downloaded files is opened from disk during the same
outage. Its embedded fonts must be byte-identical to both retained font files;
the parsed text must contain the full original license and both full font
notices. Each reading makes zero HTTP requests. The driver rechecks the full
cache, restores the transport and separately compares the public canonical
entry after each browser/device journey. This establishes behavior through a
controlled client transport failure, not that the public service itself was down.

## Reading the receipts

Earlier audit snapshots remain in the parent `navigation-transfer/` directory
with their original edition IDs. Adding the public audit command changes a
build input (`package.json`), so the final long-transfer and navigation matrices
were rerun against the exact published edition. The `published/` directory is
the final evidence boundary; similarly named older scripts or receipts are not
substitutes for it.

The public screenshots were opened and inspected: [desktop](assets/routes-public-desktop.png)
and [375px](assets/routes-public-mobile.png). The offline reading was also printed
and inspected as a three-page A4 PDF, with its complete pitch table together.

The [remote CI and Pages jobs](navigation-transfer/published/ci-observation.json)
for the reviewed source had no executed steps;
they are not reported as successful checks. The local checks, actual browser
behavior and hosted-byte comparisons above are independent evidence.

Historical limits remain unchanged: this is an explicit modern numerical and
synthetic-sound realization of a reconstructed procedure. It establishes no
ancient absolute pitch, instrument timbre or frequency prescription. External
scholarly articles still require a connection.
