import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Node's native type stripping runs the actual source. This resolver supplies
// extensionless Vite imports; the one Vite-only glob uses the same optional JSON.
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".") || /\.[a-z]+$/i.test(specifier)) throw error;
    return nextResolve(specifier + ".ts", context);
  }
}
export async function load(url, context, nextLoad) {
  if (url.endsWith("/src/data/privateContentOverlayRuntime.ts")) {
    const file = new URL("../../private-content/slipperGiftOverrides.json", url);
    const source = existsSync(fileURLToPath(file)) ? readFileSync(file,"utf8") : "null";
    return { shortCircuit: true, format: "module", source: `export const privateGiftOverrideFile = ${source};` };
  }
  return nextLoad(url, context);
}
