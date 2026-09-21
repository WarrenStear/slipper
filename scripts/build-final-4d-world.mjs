#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const canonicalFinalizer = path.join(
  SCRIPT_DIRECTORY,
  "check-final-4d-world.mjs",
);

console.log(
  "[repair:world] Applying the canonical terrain and world finalizer.",
);

const result = spawnSync(process.execPath, [canonicalFinalizer], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (result.error) {
  console.error(`[repair:world] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
