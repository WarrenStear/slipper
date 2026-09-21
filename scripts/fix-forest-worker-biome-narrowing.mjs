import fs from "node:fs";
import path from "node:path";

const workerPath = path.join(process.cwd(), "src/workers/forestWorker.ts");

if (!fs.existsSync(workerPath)) {
  console.error("[worker:narrowing] Missing src/workers/forestWorker.ts");
  process.exit(1);
}

let source = fs.readFileSync(workerPath, "utf8");
const original = source;

source = source
  .replace(/biome === "archive"/g, '(biome as WorkerBiome) === "archive"')
  .replace(/biome !== "archive"/g, '(biome as WorkerBiome) !== "archive"');

if (source !== original) {
  fs.writeFileSync(workerPath, source);
  console.log("[worker:narrowing] Patched archive biome comparisons for TypeScript narrowing.");
} else {
  console.log("[worker:narrowing] No archive biome narrowing patch needed.");
}
