#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export function buildVersion(directory, env = process.env, now = new Date()) {
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const revision = env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || git("rev-parse", "HEAD");
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("Build version requires a full Git commit SHA.");
  const branch = env.CF_PAGES_BRANCH || env.GITHUB_REF_NAME || git("branch", "--show-current") || null;
  const pkg = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  return {
    package: pkg.name,
    version: pkg.version,
    mode: "production",
    repository: "https://github.com/WarrenStear/slipper",
    revision,
    branch,
    builtAt: now.toISOString(),
    // world:compile regenerates this tracked output before every build.
    dirty: git("status", "--porcelain", "--untracked-files=normal", "--", ".", ":(exclude)src/data/worldState.json").length > 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const version = buildVersion(root);
    writeFileSync(resolve(root, "dist/version.json"), JSON.stringify(version, null, 2) + "\n");
    console.log(`[build-version] ${version.revision}${version.dirty ? " (modified working tree)" : ""}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
