# Retuning by ear and the saved reading packet

## Try the result

[Open the listening practice](https://antonsoo.github.io/sammu/practice.html?moves=LL&listen=partials). Listen to the pair, move the adjustment, then reveal the measurements. The control changes the string prescribed by the reconstructed procedure; it leaves the underlying exact tuning untouched. The full pair uses six decaying partials. Isolated mode plays two selected partials as equally loud, steady sine tones.

With two loosening steps already applied, the tuning is embūbum and the diagnostic pair is kitmum, strings 6 + 3. A tentative 110-cent loosening leaves the selected partials at approximately 1042.963 and 1045.185 Hz: a difference of 2.222356 Hz. Selecting the model’s exact target uses the rational factor 2048/2187 and brings those partials into exact agreement. Hearing the reference does not replace the attempt; applying the exact operation is a separate action that returns to the main bench.

This is a modern listening exercise within the named fourths-and-fifths realization. The frequency difference is the amplitude-beat rate for the two isolated steady sine tones. In the full sound it is one interaction among several partials. There is no hearing score, ancient perceptual threshold or claim of a recovered performance.

The saved worksheet keeps the tentative adjustment separately from its exact base, with comparison audio, shared frequency rulers, all base pitches and moves, **nine Akkadian word notes and three source-preservation cases**. The reading packet distinguishes a supplied omission, a restored result and a largely restored clause. [The source ledger](sources.md) identifies the historical and lexical sources; the new action-word notes distinguish preserved forms from restored interpretations.

## Reviewed implementation

Runtime source: `45319eb67076ecbad2338bb0f92d7c0cfb20da21`. A fresh archive, fresh `npm ci`, and production previews owned by the review scripts were used under Node.js 24.21.0 / npm 11.19.0. The Node.js 26.7.0 / npm 12.0.1 build is byte-identical. Strict TypeScript, lint, thirteen focused tests and the production build passed. The static output contains thirteen files, 675,754 bytes before HTTP compression, with no runtime package dependencies. [Build inventory](build-review.json).

| Check                                 | Measured result                                                                                                                             | Receipt                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Exact base tuning                     | 812 states, 7,308 pitches, 49 shortest routes                                                                                               | [Independent constraints](practice-tuning-review.json)                                |
| Tentative adjustments and audio plans | 672 cases, 2,688 note frequencies and times; exact fractions and 60-digit decimal exponentials                                              | [Practice arithmetic](practice-math-review.json)                                      |
| Practice workflows                    | Chromium and Firefox, each at 1440 × 1000 and 375 × 900; real keyboard controls, links, downloads, native worksheets and offline navigation | [Practice browser](practice-browser-review.json)                                      |
| Original bench regression             | Same four browser configurations; retuning, undo, focus, history, route planning, native exports and offline operation                      | [Bench browser](practice-workshop-browser-review.json)                                |
| Practice signal                       | 60 downloaded WAV comparisons and eight captured played buffers                                                                             | [Practice audio](practice-audio-review.json)                                          |
| Bench signal                          | 40 downloaded WAVs and four captured played buffers                                                                                         | [Bench audio](practice-workshop-audio-review.json)                                    |
| Offline edition upgrade               | Six controlled upgrades across both engines; delayed precache, wrong HTTP 200 bytes, late older inspection reply                            | [Upgrade after](practice-upgrade-review.json), [before](practice-upgrade-before.json) |

The arithmetic oracle starts from an independent source-order fixture and solves prime-exponent constraints with Gaussian elimination. The practice oracle keeps the exact base distinct from the tentative exponential adjustment. The audio oracle reconstructs note frequencies independently and synthesizes every sample with NumPy 2.4.4 under Python 3.12.3. It checks the played reference separately from the comparison, including the silent gap and sample-rate differences between engines. The practice corpus contains 30,153,600 WAV samples; the bench corpus contains 7,430,400. Maximum normalized sample errors are `1.5273906005364157e-5` for downloaded PCM16 (bound `2e-5`) and `2.2321278825288005e-8` for live buffers (bound `1e-7`). This establishes digital signal agreement, not the sound of a physical speaker or an ancient instrument.

Changing the setting stops playback. The browser study also holds an actual `AudioContext.resume()` response after unlocking audio, changes the adjustment, then releases that response: the abandoned request must not begin playback. Revealing measurements preserves an already playing sound. Applying the model’s move appends its exact operation rather than relabelling the tentative preview.

## Offline upgrade reproduced and repaired

The controlled server first supplies the new entry and assets while still serving the old worker, then makes the new worker available. This represents an entry/worker publication gap; it is not a claim that the public host was observed in this state. The old build is the actual initial Pages commit `50f1c4d1ab964b63fb2ce24bf32246a00365d3db`.

Before the fix, all four delayed-file and wrong-body scenarios left the page’s readiness message stale after an independent inspection confirmed the complete new edition was controlling it. The page only inspected once. The fix listens for controller changes, checks the edition identity and complete file inventory again, and ignores superseded inspection replies. Existing controllers can be inspected while registration waits behind an install.

The wrong-body scenario returns HTTP 200 with the old entry instead of the new practice page. Subresource integrity rejects that installation; readiness is not claimed for it. After the correct bytes arrive, both engines acknowledge the complete new edition. A deliberately delayed actual old-worker reply cannot overwrite that result. Each successful upgrade then reloads the practice offline, plays and stops audio, saves a worksheet, and returns to the correct base tuning offline.

The reproduction uses real service workers and cache installation. It delays network bytes or an actual message-channel reply; it does not fabricate a readiness response.

## Inspect and reproduce

- [Desktop practice](assets/practice-desktop.png), [phone controls](assets/practice-phone.png)
- [Revealed phone measurements](assets/practice-reading-phone.png), [native phone worksheet](assets/practice-worksheet-phone.png)
- [Standalone worksheet](../examples/practice-partials-110.html), [printed A4 PDF](../examples/practice-partials-110.pdf)
- [Actual comparison WAV](../examples/practice-partials-110.wav), [base and tentative record](../examples/practice-partials-110.json)

The listening control and slider are visible within the initial 900 px phone viewport. The native HTML embeds its fonts and audio and opens without HTTP requests. Browser audits report no violations; the native document retains one item for manual review. That is not a full screen-reader assessment. The six-page A4 PDF is printed by Chromium with tags enabled; its extracted text and all six rendered pages were inspected. [Print receipt](practice-print-review.json).

```sh
npm ci
npm run check
npm run verify:tuning
npm run verify:practice
npm run test:browser -- /tmp/sammu-review/browser.json
npm run test:practice -- /tmp/sammu-practice-review/browser.json
python3 -m pip install -r scripts/requirements-audio.txt
python3 scripts/audio-oracle.py /tmp/sammu-review/browser.json
python3 scripts/audio-oracle.py /tmp/sammu-practice-review/browser.json
```

Install the matching Playwright Chromium and Firefox browsers first. Use a Python environment appropriate for your machine. The review scripts own distinct production-preview ports and reject an occupied port; `SAMMU_BASE` selects an explicitly supplied server. Keep each review’s artifacts in its own directory.

To repeat the controlled upgrade against the original published build:

```sh
git fetch origin gh-pages
mkdir -p /tmp/sammu-initial-pages
git archive 50f1c4d1ab964b63fb2ce24bf32246a00365d3db | tar -x -C /tmp/sammu-initial-pages
node scripts/offline-upgrade.mjs /tmp/sammu-initial-pages /tmp/sammu-upgrade/after.json after
```

The [initial workshop review](review.md) remains a historical receipt. Publication of this later edition is recorded separately after verification of the public bytes and browser behavior. No remote CI run, registry release or tag is implied.

## Published practice edition

Source `b025186cf2cd6e36142a6822a4a78289b84abe62` and Pages `a57c8ea2def38e6bda4415f8cb2b43b9399c5437` publish this practice edition. All thirteen canonical public files and the directory alias match the reviewed build by SHA-256, without query-string cache busting; [public byte receipt](practice-public-bytes.json). The two previous hashed assets remain available with their original bytes.

Eight full hosted browser workflows repeat the desktop/phone exercises in Chromium and Firefox: [practice](practice-hosted-review.json), [main bench](practice-hosted-workshop-review.json). The hundred hosted WAVs and hundred JSON records match the independently measured local corpus byte for byte; [publication comparisons](practice-publication-review.json). Each of the eight saved native files was then opened in a fresh offline browser context, with embedded fonts loaded, audio decoded, nine word notes and three source cases present, and no HTTP requests; [native offline receipt](practice-hosted-native-review.json). Documentation-only commits after this publication do not change the runtime edition.
