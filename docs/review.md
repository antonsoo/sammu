# Retuning workshop review

This receipt describes the initial edition. The later [practice and offline-upgrade review](practice-review.md) records the current build and its separate regression checks.

## What can be learned

The first operation makes a named pair clear by changing string 2 and its companion 9. A different pair becomes unclear, and the tuning name changes from išartum to kitmum. Comparing the same physical pair makes that action audible; substituting a different pair would hide it.

Seven names form a reversible cycle, but a returning name does not fix absolute pitch. In this exact fourths-and-fifths realization, seven loosening operations multiply every frequency by 2048/2187. Seven tightening operations undo that change. This is a mathematical model result, not a claim about an ancient absolute reference or recovered performance.

The three neighboring source cases have different preservation: a supplied omission, a restored result, and an almost entirely restored clause. The full reconstructed procedure should not be presented as fourteen equally intact instructions. [The source ledger](sources.md) gives the locations and interpretation boundaries.

## Reviewed implementation

Runtime source: `4209926913dc33626ccb69bf9ccb34901f50f0a4`. A fresh archive of that commit, a fresh `npm ci`, and its own production preview were used for the final local review. All nine production files are byte-identical to the working build. Later documentation and example files are outside the runtime edition inputs.

Environment: Node.js 26.7.0, npm 12.0.1, Python 3.12.3, NumPy 2.4.4, WSL2 Linux 6.18.54.1. A second fresh installation under Node.js 24.21.0 passed the same complete check and exact oracle; all nine output files are byte-identical. This is local evidence; it does not assert a remote CI run.

| Check                                 | Observed result                                                                                                                             | Receipt                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Fresh installation and complete check | Lint, strict typecheck, eight tests and production build passed                                                                             | [Build](initial-build-review.json)                       |
| Independent exact constraints         | 812 states and 7,308 string pitches; two companion models, seven starting tunings, both directions through 28 moves; all 49 shortest routes | [Tuning](tuning-review.json)                             |
| Browser workflows                     | Chromium and Firefox, each at 1440 × 1000 and 375 × 900                                                                                     | [Browser](browser-review.json)                           |
| Real keyboard controls                | Skip link, Enter to retune, focus preservation, undo, history Back, goal routes, bounded sequence recovery and focusable scrolling tables   | [Browser](browser-review.json)                           |
| Accessibility audits                  | Twelve audits, zero reported violations; each retains one incomplete/manual-review item                                                     | [Browser](browser-review.json)                           |
| Native exports                        | Actual CSV, JSON, SVG, WAV and HTML downloads; four saved studies opened as local files with no HTTP requests                               | [Browser](browser-review.json), [examples](../examples/) |
| Embedded study audio                  | SHA-256 equals the separately downloaded WAV; both browser engines decode it and report the expected duration                               | [Browser](browser-review.json)                           |
| Offline operation                     | Reload, retune, play, stop and save a fully embedded study with the browser context offline                                                 | [Browser](browser-review.json)                           |
| Page and policy errors                | No page errors, console errors, CSP violations or external requests in the reviewed app workflows                                           | [Browser](browser-review.json)                           |
| Downloaded audio                      | 40 WAVs, 7,430,400 samples independently reconstructed and synthesized                                                                      | [Audio](audio-review.json)                               |
| Live audio buffers                    | Four actual played buffers, including the engines’ different sample rates                                                                   | [Audio](audio-review.json)                               |
| Complete static output                | Nine files, 643,352 bytes before HTTP compression; no runtime package dependencies                                                          | [Build](initial-build-review.json)                       |

The audio oracle rebuilds the expected note frequencies from the independent source fixture and exact rational constraints. NumPy then synthesizes a separate signal, checking every sample, including envelope timing and the silent before/after gap. The largest normalized sample error is `1.526900754347804e-5` for PCM16 WAVs against a `2e-5` bound, and `1.1147137185529843e-8` for live buffers against `1e-7`. These establish digital signal agreement, not the output of a physical speaker or an ancient instrument.

## Inspect the result

The first listening button appears at about y=714 px on desktop and y=677 px on the phone viewport. Stop is above it. All current controls remain available at 375 px; tables scroll inside keyboard-focusable regions rather than widening the document.

The saved study uses a compact HTML pitch diagram on phones and the larger SVG for desktop and print. Its original diagram, overtone comparison, all pitch ratios, every intermediate move, sources, audio and font notices travel together.
- [Desktop overview](assets/overview-desktop.png)
- [Phone overview](assets/overview-phone.png)
- [Retuned desktop bench and overtones](assets/retuning-desktop.png)
- [Retuned phone bench](assets/retuning-phone.png)
- [Standalone illustrated study](../examples/retuning-study.html)
- [Four-page A4 PDF](../examples/retuning-study.pdf)
- [The study’s actual audio](../examples/retuning-study.wav)
- [Machine-readable record](../examples/retuning-study.json), [pitch history](../examples/retuning-history.csv), [diagram](../examples/retuning-diagram.svg)

The PDF is produced by actual Chromium printing, with tags enabled. Source text and numeric rows were recovered with Poppler; rendered pages were inspected. The receipt does not claim a native Firefox PDF or a full screen-reader audit.

## Reproduce

```sh
npm ci
npm run check
npm run verify:tuning
npm run test:browser -- /tmp/sammu-review/browser.json
python3 -m pip install -r scripts/requirements-audio.txt
python3 scripts/audio-oracle.py /tmp/sammu-review/browser.json
```

Use an isolated Python environment where required by your system. The exact tuning oracle requires no third-party Python packages. Browser review requires matching Chromium and Firefox installations; it starts and stops its own production preview on port 4385. Set `SAMMU_BASE` to exercise another served build instead. The normal local development and preview commands use port 4384.

## Limits

The workshop is an original executable explanation of a scholarly reconstruction. It is not a cuneiform edition, a recovered composition, a reconstruction of a particular excavated instrument, or a formal proof of historical musical practice. The source words, companion-string relationships, exact ratios, sound colour and reference pitch have the distinctions described in the app and source ledger.

The local review establishes the named source and build. The published workshop has a separate receipt below. No registry release or tag is implied.

## Published workshop

The source is public at [antonsoo/sammu](https://github.com/antonsoo/sammu), and the workshop is live at [antonsoo.github.io/sammu](https://antonsoo.github.io/sammu/). The initial published source is `c671f39ca9405933132831a0a2f88c4f568f47af`; runtime inputs remain those of `4209926`. Pages branch commit: `50f1c4d1ab964b63fb2ce24bf32246a00365d3db`.

All nine canonical public file URLs, plus the directory alias, match the reviewed build by SHA-256 without query-string cache busting. Four full hosted workflows repeated the local desktop/phone exercises in Chromium and Firefox, including offline operation and native saved studies. The forty hosted WAV downloads and their JSON audio plans are byte-identical to the independently measured local corpus. See [publication bytes and audio comparisons](publication-review.json) and [hosted browser workflows](hosted-review.json).

The README’s clone, install and development commands were also run in a new public clone. Four styled development-mode browser workflows verified the responsive bench, audio, stop and undo with no console or page errors; [receipt](development-review.json). This is separate from the production and hosted evidence.

Suggested repository description: Hear an ancient Mesopotamian retuning procedure, one string at a time, with exact pitches and source notes. Topics: mesopotamia, akkadian, music-theory, microtonal, web-audio, education, typescript.
