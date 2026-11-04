import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import { offlineScript } from "./scripts/offline-template.ts";
import { STUDY_ASSETS } from "./src/study-assets.ts";

const base = "/sammu/";

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : Promise.resolve([path.join(directory, entry.name)]),
    ),
  );
  return nested.flat();
}

export default defineConfig(async ({ command }) => {
  for (const [name, expected] of Object.entries(STUDY_ASSETS)) {
    const bytes = await readFile(path.join("public/fonts", name));
    if (
      bytes.length !== expected.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== expected.sha256
    )
      throw new Error(
        `The retained study asset changed: ${name}. Review and update its byte identity.`,
      );
  }
  const inputFiles = [
    ...(await filesIn("src")),
    ...(await filesIn("public")),
    "index.html",
    "practice.html",
    "routes.html",
    "LICENSE",
    "vite.config.ts",
    "scripts/offline-template.ts",
    "tsconfig.json",
    "package.json",
    "package-lock.json",
  ].sort();
  const inputHash = createHash("sha256");
  for (const file of inputFiles) {
    inputHash.update(file);
    inputHash.update(await readFile(file));
  }
  const edition = command === "build" ? inputHash.digest("hex") : "development";
  return {
    base,
    build: {
      rollupOptions: {
        input: { main: "index.html", practice: "practice.html", routes: "routes.html" },
      },
    },
    define: { __SAMMU_EDITION__: JSON.stringify(edition) },
    plugins: [
      {
        name: "offline-tuning-workshop",
        apply: "build",
        async closeBundle() {
          const files = (await filesIn("dist")).filter((f) => !f.endsWith("sw.js")).sort();
          const urls = files.map(
            (file) => base + path.relative("dist", file).split(path.sep).join("/"),
          );
          const integrity = Object.fromEntries(
            await Promise.all(
              files.map(async (file, index) => [
                urls[index],
                `sha256-${createHash("sha256")
                  .update(await readFile(file))
                  .digest("base64")}`,
              ]),
            ),
          );
          await writeFile("dist/sw.js", offlineScript({ edition, base, urls, integrity }));
        },
      },
    ],
  };
});
