# Hear the string move

## What changed

The earlier practice room stopped playback on every adjustment. A learner could
compare fixed settings, but could not turn the string while hearing its beats
slow down. The [before receipt](live/before.json) reproduces that behavior on
source `f6794c6`.

The primary listening control now sustains the pair while the slider or keyboard
changes its prescribed string. Switching between six partials and the selected
isolated partials preserves the same oscillators. Revealing measurements leaves
the sound alone. A fixed comparison or reference takes over the output; it does
not change the tentative adjustment. Applying the exact operation remains a
separate action.

No repository was added. The existing instrument-bench design, model, source
vocabulary, exact tuning history and saved reading packet remain the lesson's
context. New work changes what the learner can hear while operating the model.

## Try the actual instrument

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4384/sammu/practice.html?moves=LL&listen=partials&cents=110#practice`.
Press **Listen while adjusting**, then focus the slider. Shift + right arrow
moves one cent; ordinary arrows move a tenth. Explore both sides of the place
where the beats settle. Reveal the measurements afterward.

The following frequencies come from the independent source-order fixture and
60-digit calculation, not measurements of an ancient instrument. Here the base
is embūbum; the pair is kitmum, strings 6 + 3; the tentative loosening changes
string 3. String 6's selected partial stays at 1042.962963 Hz.

| Tentative loosening    | String 3's selected partial | Difference / isolated beat rate |
| ---------------------- | --------------------------- | ------------------------------- |
| 110 cents              | 1045.185319 Hz              | 2.222356 Hz                     |
| 112 cents              | 1043.978571 Hz              | 1.015608 Hz                     |
| 114 cents              | 1042.773216 Hz              | 0.189747 Hz                     |
| 120 cents              | 1039.165494 Hz              | 3.797469 Hz                     |
| Exact factor 2048/2187 | 1042.962963 Hz              | 0 Hz in the exact model         |

The exact adjustment is approximately 113.685006 cents. Thus 114 cents is just
beyond the alignment. A smaller beat rate does not by itself identify which side
you are on. Changing loudness is also not a score: relative phase affects the
result even when two frequencies match.

An [actual continuous output recording](../examples/live-adjustment.wav) follows
those four tentative settings, with [observed change times](../examples/live-adjustment.json).
This is an uncut review excerpt rounded to PCM16, beginning while the tone is
already sounding; it is separate from the normal comparison download.

[Desktop instrument](assets/live-desktop.png) · [Phone instrument](assets/live-phone.png).

## Signal and controls

`SustainedPair` keeps twelve sine oscillators, six per string, alive throughout
an adjustment. Frequencies and harmonic levels approach their new targets with
an 8 ms time constant, using the [Web Audio parameter-automation model](https://www.w3.org/TR/webaudio/#dom-audioparam-settargetattime).
No oscillator is restarted to make a new setting sound settled.

The first string's maximum amplitude is 0.13; the second's is 0.104. These
slightly unequal levels prevent complete cancellation of equal-frequency
isolated tones. The full sound uses the existing normalized harmonic weights,
now sustained. These are explicit teaching choices. The [historical source
ledger](sources.md) and [Rahn's discussion](https://mtosmt.org/issues/mto.22.28.1/mto.22.28.1.rahn.html)
remain distinct from this new synthesis implementation.

There is a 20 ms attack and a short release. Each session ends after sixty
seconds of audio time. Stop, direction changes, navigation, backgrounding and
audio interruptions invalidate the active request. A delayed `resume()` cannot
restart a stopped request. An edit while `resume()` is pending starts the newest
setting. Interrupted sound requires an explicit new start.

The WAV, JSON and worksheet retain fixed before/after settings. The full
comparison decays, and its isolated tones have equal levels. Both the page and
saved artifacts say that these are not recordings of the live movement.

## Verification

Reviewed runtime source: `e756a69cd9cd217c2ad22c4acb4cefc26b8ce5f9`.

The current review is local. Nothing in this change was pushed or deployed.
Existing public links can still serve the preceding fixed-setting edition.
Source/build identity, local browser behavior and public delivery are separate
claims.

The [live signal receipt](live/continuous-audio.json) checks 32 captured windows,
including four successive settings from one continuous run: 2,676,831 samples.
Its largest fitted residual RMS is `9.456488641999807e-6`; the largest measured
frequency offset from the independent target is `0.0005110012218665361` Hz.
The [fixed-setting receipt](live/snapshots-audio.json) independently checks sixty
WAVs (30,153,600 samples) and eight played buffers. The [upgrade receipt](live/upgrade.json)
records all six fault/recovery scenarios. These are generated digital signals;
no physical speaker measurement is implied.

The [source check](live/source-check.json) records the PDF identity. Printed page
52 was freshly rendered and inspected: the seven rows in figure 5 match the
independent fixture; figure 4 retains its restored/omitted passages. No source
PDF, page or scholarly figure is redistributed with this change.

The receipts in [live/](live/) record the current build, actual browser journeys,
captured signal measurements, fixed-setting exports and upgrade faults. The
clean Node 24 install runs lint, strict TypeScript, the existing focused tests,
production build and both independent model oracles. Its thirteen output files
are byte-identical to the Node 26 build. `npm run build` writes `dist/`.

Chromium and Firefox operate the production edition at 1440 and 375 pixels.
The review exercises continuous changes, mode switching, measurements, unchanged
base state, fixed comparisons, pending edits/stops, audio interruption, explicit
restart and offline worksheets. Both engines run a real minute to verify the
scheduled end. Automated accessibility checks apply to the reviewed states;
physical speakers, mobile hardware and a complete screen-reader audit remain
outside this evidence.

The live signal is tapped by an audio-thread worklet used only by the reviewer.
Its messages retain contiguous render-frame indices. The worklet is served
beside the unmodified build and never enters its offline inventory. The oracle
calculates frequencies independently using the source-order Fraction/Decimal
fixture, fits their sine and cosine components with free phase, and checks
harmonic levels, bounded frequency error, residual energy and stopped silence.
It does not synthesize samples on behalf of the application. The analysis allows
up to 0.002 Hz frequency error for engine arithmetic, amplitude error below
0.0001, and residual RMS below 0.00005.

The separate fixed-setting oracle still reconstructs every sample in the actual
WAV downloads and captured played buffers. The upgrade review begins with a
build of the actual preceding source. It holds a new entry, substitutes an old
HTTP-200 body, delays an older worker reply, then checks recovery and real
offline navigation in both engines.

```sh
npm run check
npm run verify:tuning
npm run verify:practice
npm run test:live -- /tmp/sammu-live-review/browser.json
npm run verify:live-audio -- /tmp/sammu-live-review/browser.json
npm run test:practice -- /tmp/sammu-practice-review/browser.json
python3 scripts/audio-oracle.py /tmp/sammu-practice-review/browser.json
```

The live reviewer owns a local server on port 4391. Chromium's worklet loader
bypasses Playwright routing, so a real local response supplies the review tap.
NumPy and installed Playwright Chromium/Firefox are required. Do not rebuild
while any production review is running.

## Limits

The audible realization does not establish ancient pitches, timbre, string
tension, a perceptual threshold for _zakû_, or an ancient performance practice.
The interface grades no one's hearing. It does not record the live hand
movement into the normal downloads. The review verifies the generated digital
signal, not a physical instrument or acoustic output device.
