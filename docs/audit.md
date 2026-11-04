# Keep the experiment; repair the instrument

This is the earlier audio and asset review. The subsequent [navigation and
transfer audit](navigation-transfer-review.md) replaces its total download
deadlines with separate body-inactivity and active-transfer limits. The old
measurements and pinned runtime below remain historical evidence.

The continuous-listening feature made the practice room usable as a tuning
exercise. This audit found consequential failures around it: stopped audio could
return after an interruption, a closed audio context could not recover, and a
saved reading could embed damaged font bytes while the page still said it was
ready offline. These failures were reproduced in Chromium and Firefox before
the fixes.

## Hear the adjustment

Open [the practice room](https://antonsoo.github.io/sammu/practice.html?moves=LL&listen=partials&cents=110#practice).
Press **Listen while adjusting**, then focus the adjustment slider. Shift + right
arrow moves one cent; ordinary arrows move a tenth. Try 110, 112, 114 and 120
cents. The beats slow down and then increase beyond the alignment. Reveal the
measurements afterward. At 112 cents the selected partials differ by
`1.015608 Hz` in this model; the exact base still has two loosening operations.

This is a modern teaching signal. The source does not provide a concert pitch,
these exact ratios, an instrument timbre, or a hearing-test threshold for
_zakû_. The saved comparison is a fixed before/after experiment; it does not
record the hand movement. The [original listening review](live-review.md)
explains the numerical example and the signal model.

The HTML save buttons embed the current experiment, diagrams, audio,
fonts and full license notices. It now checks all four retained font/license
files against independently pinned lengths and SHA-256 digests. If a server or
cache supplies different bytes with HTTP 200, saving fails visibly. A pending
save can be cancelled and retried. The current reader allows active transfers
for up to three minutes but stops an asset after fifteen seconds without body
progress; see the subsequent transfer review.
The experiment stays available during preparation.

The footer's **Check offline copy** inspects the actual saved bytes. A missing
or damaged file replaces readiness with a count and **Repair offline copy**.
Online repair replaces only absent or damaged files. Both already-open entry
pages receive the result. Entire-cache eviction and a failed first installation
also have recovery paths that keep the current experiment. External scholarship
still needs a connection.

## Defects reproduced and corrected

| Trigger                                         | Before this audit                                         | Corrected behavior                                                                  |
| ----------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Same-length wrong font body, HTTP 200           | Export embedded it; cache inspection reported complete    | Both export and worker verify the digest; damaged bytes are refused                 |
| Required script deleted from cache              | Visible readiness survived a failed independent inventory | Visible-page checks and worker broadcasts withdraw readiness; explicit repair works |
| Entire cache removed                            | No operable repair control                                | Both open pages show the loss and acknowledge the rebuilt inventory                 |
| First worker install receives substituted bytes | Offline saving failed without a retry control             | Bounded attempt, explicit retry, unchanged adjustment, successful offline reload    |
| Font response never ends                        | Save remained pending                                     | Cancel or 15-second deadline; no partial download; subsequent retry succeeds        |
| Stop during live or comparison audio            | Output cut at a nonzero sample                            | Linear release reaches zero before node termination                                 |
| Suspend, then resume the audio context          | Old live graph sounded again without a new start          | Abandoned graph disconnects immediately; resume remains silent                      |
| Browser closes an audio context                 | Repeated Listen failed permanently                        | Explicit start creates a fresh context; active closure also recovers                |
| Main/footer or saved reading attribution        | Former author name                                        | Anthony Mercer                                                                      |

The baseline is source `e6e75e8`; the reviewed runtime is `3ce4352`.
The [baseline asset receipt](audit/assets-before.json),
[baseline audio measurements](audit/audio-before.json) and
[corrected audio measurements](audit/audio-after.json) retain the observed
failures and results. These are actual browser executions, not merely expected
outcomes written into unit tests.

## Audio evidence

A review-only AudioWorklet taps the actual output without replacing its samples.
Its render-frame coordinates identify the stop and resume intervals. The
independent Python analysis requires contiguous capture coordinates, finite
samples, a terminal sample within the one-sample linear-release bound, and exact
digital silence after the scheduled stop. Browser startup gaps are identified
and discarded before the measured interval; no gap is interpolated. The receipt
records any discarded startup chunks.

In the baseline, the largest observed live stop cutoff was `0.001112681` in
sample amplitude; a fixed comparison cutoff reached `0.180631042`. The abandoned
live graph reached approximately `0.060` after resuming without a new start.
After correction, all eight measured stop paths satisfy their linear-release
bounds and leave exact silence. Both engines' resumed live and fixed-comparison
probes remain silent after the scheduling allowance of 8 ms. Explicit starts
recover from closed contexts.

This measures generated digital output. It does not measure speakers, headphones,
a physical ancient instrument or perception. Firefox does not expose the
OfflineAudioContext suspension method used by an earlier diagnostic; the
cross-browser evidence here comes from actual running AudioContexts instead.

The separate continuous-signal review checks stationary windows against
independently computed pitches and harmonic levels, including an uncut sequence
of successive changes. The fixed-setting review independently reconstructs the
downloaded PCM and the played AudioBuffers. The release change leaves these
fixed artifacts' synthesis intact.

## Offline and export evidence

The [asset receipt](audit/assets.json) records ten workflows: both engines at
desktop and phone widths, two failed-first-install recoveries, and both entry
pages' HTTP-200 substitution/cancellation/deadline/retry paths. It compares every
repaired cached file with the build, verifies the embedded fonts and complete
license texts, opens the saved HTML as a native file and observes zero network
requests from it. Automated accessibility checks cover the visible failure
states.

The origin is actually unavailable during local offline trials. This matters
because Firefox's service-worker network can remain available when a browser
context alone is marked offline. The upgrade review separately holds a new
entry, supplies an old HTTP-200 body and delays an older worker reply before
checking takeover, readiness and offline navigation from the preceding build.

An additional six-scenario run starts from the exact preceding published Pages
snapshot `a57c8ea`, rather than the intervening local continuous-listening
edition. Its [thirteen-file inventory](audit/preceding-public.json) comes from
that committed Pages tree; all held-entry, substituted-body and delayed-reply
[upgrade scenarios](audit/upgrade-public-predecessor.json) pass in both engines
before offline listening, saved reading and navigation back to the bench.

Workers identify their edition, instance and message sequence. Only the current
controller can update a page's status, and an old open page cannot repair or
invalidate a new worker using its old assumptions. Cache filenames alone are
never taken as proof of a complete edition.

## Reproduce

```sh
npm ci
npm run check
npm run verify:tuning
npm run verify:practice
npm run test:assets -- /tmp/sammu-assets/receipt.json
npm run test:audio-lifecycle -- dist /tmp/sammu-lifecycle/receipt.json after
npm run verify:audio-lifecycle -- /tmp/sammu-lifecycle/receipt.json
npm run test:live -- /tmp/sammu-live/browser.json
npm run verify:live-audio -- /tmp/sammu-live/browser.json
npm run test:practice -- /tmp/sammu-practice/browser.json
python3 scripts/audio-oracle.py /tmp/sammu-practice/browser.json
```

Playwright Chromium/Firefox and the audio requirements in
`scripts/requirements-audio.txt` are needed. The lifecycle oracle uses only the
Python standard library. Capture files are generated by the reviewer and are
not part of the production offline inventory. Do not rebuild during a review.

The [build inventory](audit/build.json) records a clean Node 24 install and
thirteen files byte-identical to the Node 26 build. The independent model checks
cover 812 exact tuning states, 7,308 string pitches, 49 shortest routes and 672
tentative practice cases.

## Source and delivery boundaries

The Mirelman PDF was freshly fetched and printed page 52 visually inspected:
all seven clear/unclear pairs in figure 5 match the independent fixture; figure
4's omission and restoration marks remain distinct in the app. The PDF SHA-256
is `665af5ee1a0fa6ed90b70beebccaf693d61c1126665f85f2720abdf199c4ef3d`.
[The source ledger](sources.md) identifies the paper and the limits of this
interpretation. No scholarly page, figure or photograph is redistributed.

The [publication receipt](audit/publication.json) records the source and Pages
branch commits. All thirteen [canonical hosted files](audit/public-bytes.json)
match the clean build, including both entry pages, the worker and retained
fonts/licenses. The [post-browser comparison](audit/public-after-browser.json)
confirms the same bytes after the public trials.

The actual public bench and practice pages run in Chromium and Firefox at 1440
and 375 pixels: eight workflows, with one hundred WAV exports and native saved
readings. Their [practice](audit/public-practice.json) and
[bench](audit/public-bench.json) receipts are separate from the local tests;
independent [practice PCM](audit/public-practice-audio.json) and
[bench PCM](audit/public-bench-audio.json) checks use the actual public downloads
and played buffers. Public scripts use browser offline mode. The stronger
origin-unavailable proof is local, on the byte-identical build, because Firefox
service-worker networking can outlive that emulation.

The branch-based Pages build and deployment completed with executed steps.
Source CI and the source-triggered Pages workflow were reported as failures
with empty step lists; neither establishes a successful remote check. The
reviewed local checks, actual public behavior and matching hosted bytes are
recorded independently. Physical speakers, mobile hardware and a complete
screen-reader audit remain outside this review.
