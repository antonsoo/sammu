import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "https://antonsoo.github.io/sammu/";
const output = path.resolve(process.argv[3] ?? "/tmp/sammu-publication/bytes.json");
const directory = path.resolve(process.argv[4] ?? "dist");
const files = [];
async function visit(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await visit(file);
    else {
      const bytes = await readFile(file);
      files.push({
        path: path.relative(directory, file).split(path.sep).join("/"),
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
  }
}
const records = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
await visit(directory);
files.sort((a, b) => a.path.localeCompare(b.path));
const edition = /const EDITION = "([a-f0-9]+)"/.exec(
  await readFile(path.join(directory, "sw.js"), "utf8"),
)[1];
for (const file of files) {
  const url = new URL(file.path, base).href;
  const response = await fetch(url, { cache: "no-store", redirect: "error" });
  assert.equal(response.status, 200, url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, file.bytes, url);
  assert.equal(sha256(bytes), file.sha256, url);
  records.push({ ...file, url, status: response.status });
}
const index = files.find((file) => file.path === "index.html");
const response = await fetch(base, { cache: "no-store", redirect: "error" });
assert.equal(response.status, 200);
assert.equal(sha256(new Uint8Array(await response.arrayBuffer())), index.sha256);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ checkedAt: new Date().toISOString(), base, sourceAtCheck: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), edition, files: records, directoryAliasMatches: true, queryCacheBust: false, passed: true }, null, 2)}\n`,
);
process.stdout.write(
  `${records.length} canonical public files and the directory alias match the reviewed build.\n`,
);
