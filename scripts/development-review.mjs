import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:4384/sammu/";
const output = path.resolve(process.argv[3] ?? "/tmp/sammu-review/development.json");
const records = [];
for (const [engine, launcher] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await launcher.launch();
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(base);
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => ({
          font: getComputedStyle(document.body).fontFamily,
          background: getComputedStyle(document.body).backgroundColor,
          rootBackground: getComputedStyle(document.documentElement).backgroundColor,
          grid: getComputedStyle(document.querySelector(".bench-grid")).display,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          columns: getComputedStyle(
            document.querySelector(".bench-grid"),
          ).gridTemplateColumns.split(" ").length,
        }));
        assert.match(layout.font, /Atkinson/);
        assert.equal(layout.rootBackground, "rgb(244, 241, 233)");
        assert.equal(layout.grid, "grid");
        assert.equal(layout.overflow, false);
        assert.equal(layout.columns, width === 375 ? 1 : 2);
        assert.equal(await page.locator("#edition").textContent(), "Workshop edition: development");
        assert.match(await page.locator("#offline-status").textContent(), /production build/);
        await page.locator("#loosen").click();
        assert.equal(await page.locator("#string-2").getAttribute("data-ratio"), "8/9");
        await page.locator("#play-last").click();
        await page.waitForFunction(
          () => document.getElementById("audio-status").dataset.playing === "true",
        );
        await page.locator("#stop").click();
        assert.equal(await page.locator("#audio-status").textContent(), "Stopped.");
        await page.locator("#undo").click();
        assert.equal(await page.locator("#string-2").getAttribute("data-ratio"), "243/256");
        assert.deepEqual(errors, []);
        records.push({ engine, width, layout, retuning: true, audio: true, undo: true, errors });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ base, records, passed: true }, null, 2)}\n`);
process.stdout.write("Four styled development workflows passed in Chromium and Firefox.\n");
