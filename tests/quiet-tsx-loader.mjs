import { readFileSync } from "node:fs";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".") || /\.[a-z]+$/i.test(specifier)) throw error;
    try { return await nextResolve(`${specifier}.ts`, context); }
    catch (missing) { if (missing.code !== "ERR_MODULE_NOT_FOUND") throw missing; return nextResolve(`${specifier}.tsx`, context); }
  }
}
export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { shortCircuit: true, format: "module", source: "export default {};" };
  if (url.endsWith(".tsx")) return {
    shortCircuit: true, format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
  };
  return nextLoad(url, context);
}
