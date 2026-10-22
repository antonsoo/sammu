# Contributing

Use Node.js 24 or later, run `npm ci`, then `npm run dev`. The static site uses Vite and strict TypeScript with no runtime package dependencies.

Before submitting a change, run `npm run check` and `npm run verify:tuning`. For audio, layout, navigation or export changes, also run `npm run test:browser -- /tmp/sammu-review/browser.json` and `python3 scripts/audio-oracle.py /tmp/sammu-review/browser.json` with the pinned NumPy requirement installed. See the README for browser installation on a new machine.

Check the actual workshop and native HTML export at desktop and 375 px widths in Chromium and Firefox. Inspect new screenshots. Keep live playback finite, stoppable and tied to the same audio plan as downloaded WAVs. Keep focus on controls after state changes and make horizontally scrolling tables reachable by keyboard.

Historical changes need a source, a precise location within it, preservation information where relevant, and a clear distinction between evidence and model. Add a different numerical interpretation as a named model rather than silently changing the existing one. Do not supply invented ancient text, pronunciation, instrument samples, or archaeological detail.

Keep original synthesis and diagrams separate from third-party scholarship and photographs. Preserve the font notices when changing export behavior. The source ledger explains existing reuse boundaries.
