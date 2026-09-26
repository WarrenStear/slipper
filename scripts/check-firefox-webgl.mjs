import { pathToFileURL } from "node:url";

/** Inspect a real WebGL2 context, then release the temporary GPU resource. */
export function inspectWebGL2(documentObject = document) {
  const canvas = documentObject.createElement("canvas");
  const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
  if (!gl) return { webgl2: false };
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      webgl2: true,
      renderer: gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    };
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Qualification must not silently test the text fallback instead of the forest. */
export async function requireFirefoxWebGL2(browserType) {
  const browser = await browserType.launch({
    headless: false,
    firefoxUserPrefs: {
      "webgl.force-enabled": true,
      "webgl.disable-fail-if-major-performance-caveat": true,
    },
  });
  try {
    const page = await browser.newPage();
    const capability = await page.evaluate(inspectWebGL2);
    if (!capability.webgl2) {
      throw new Error("Firefox 3D qualification requires a real WebGL2 renderer; check Xvfb and Mesa before running the suite.");
    }
    return capability;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { firefox } = await import("@playwright/test");
  console.log(JSON.stringify(await requireFirefoxWebGL2(firefox)));
}
