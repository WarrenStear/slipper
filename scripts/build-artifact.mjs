#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const VERSION = 1;

/** Fingerprint the preview and its generated source data; never dependency caches. */
export function describeBuild(directory, revision) {
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("A full commit SHA is required.");
  const files = {};
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("Build artifacts must not contain symbolic links.");
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name));
    } else if (stat.isFile()) {
      const name = relative(directory, path).split(sep).join("/");
      files[name] = createHash("sha256").update(readFileSync(path)).digest("hex");
    } else throw new Error("Unsupported artifact entry.");
  }
  visit(join(directory, "dist"));
  visit(join(directory, "src/data/worldState.json"));
  if (!files["dist/index.html"]) throw new Error("The validated preview has no entry page.");
  return { version: VERSION, revision, files };
}

export function verifyBuild(directory, revision, manifest) {
  const actual = describeBuild(directory, revision);
  if (manifest?.version !== VERSION || manifest.revision !== revision) throw new Error("Build revision mismatch.");
  const expectedFiles = manifest.files;
  if (!expectedFiles || typeof expectedFiles !== "object" || Array.isArray(expectedFiles)) throw new Error("Invalid build manifest.");
  const names = Object.keys(actual.files);
  if (names.length !== Object.keys(expectedFiles).length || names.some(name => actual.files[name] !== expectedFiles[name])) {
    throw new Error("The browser preview differs from the validated build.");
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [operation, revision, manifestPath] = process.argv.slice(2);
    if (!manifestPath || !["write", "verify"].includes(operation)) throw new Error("Usage: build-artifact.mjs write|verify COMMIT_SHA MANIFEST_PATH");
    if (operation === "write") writeFileSync(manifestPath, JSON.stringify(describeBuild(root, revision), null, 2) + "\n");
    else verifyBuild(root, revision, JSON.parse(readFileSync(manifestPath, "utf8")));
    console.log(`[build-artifact] ${operation} passed for ${revision}.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
