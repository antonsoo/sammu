import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "https://antonsoo.github.io/sammu/";
const output = path.resolve(process.argv[3] ?? "/tmp/sammu-publication/bytes.json");
const build = JSON.parse(
  await readFile(new URL("../docs/build-review.json", import.meta.url), "utf8"),
);
const records = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const file of build.files) {
  const url = new URL(file.path, base).href;
  const response = await fetch(url, { cache: "no-store", redirect: "error" });
  assert.equal(response.status, 200, url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, file.bytes, url);
  assert.equal(sha256(bytes), file.sha256, url);
  records.push({ ...file, url, status: response.status });
}
const index = build.files.find((file) => file.path === "index.html");
const response = await fetch(base, { cache: "no-store", redirect: "error" });
assert.equal(response.status, 200);
assert.equal(sha256(new Uint8Array(await response.arrayBuffer())), index.sha256);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify({ checkedAt: new Date().toISOString(), base, runtimeSource: build.runtimeSource, files: records, directoryAliasMatches: true, queryCacheBust: false, passed: true }, null, 2)}\n`,
);
process.stdout.write(
  `${records.length} canonical public files and the directory alias match the reviewed build.\n`,
);
