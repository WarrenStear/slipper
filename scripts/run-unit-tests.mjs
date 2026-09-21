#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));

/** Security runs separately; every other top-level test is discovered automatically. */
export function discoverUnitTests(directory = resolve(root, "tests")) {
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith(".test.mjs") && entry.name !== "session-security.test.mjs")
    .map(entry => resolve(directory, entry.name))
    .sort();
}

export function runUnitTests(args = []) {
  const tests = discoverUnitTests();
  if (!tests.length) throw new Error("No unit test files found; refusing an empty test run.");
  if (args.length === 1 && args[0] === "--list") {
    console.log(tests.map(path => path.slice(root.length)).join("\n"));
    return 0;
  }
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...args, ...tests], {
    cwd: root, stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = runUnitTests(process.argv.slice(2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
