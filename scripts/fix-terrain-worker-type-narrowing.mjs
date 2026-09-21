import { readFileSync, writeFileSync } from "node:fs";

const workerPath = new URL("../src/workers/forestWorker.ts", import.meta.url);
const before = 'const chapterPressure = biome === "thorned" ? pressure * 1.06 : biome === "archive" ? 0 : pressure;';
const after = 'const chapterPressure = biome === "thorned" ? pressure * 1.06 : pressure;';

const source = readFileSync(workerPath, "utf8");
if (source.includes(before)) {
  writeFileSync(workerPath, source.replace(before, after));
}
