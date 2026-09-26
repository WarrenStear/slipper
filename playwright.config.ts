import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Each project can mount the full WebGL world. Serial workers keep the
  // five-engine matrix deterministic on constrained CI and local runners.
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  expect: {
    timeout: 12_000,
  },
  use: {
    baseURL,
    actionTimeout: 12_000,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    // Hosted software rendering must not compete with two continuous image
    // streams. Preserve DOM, actions, network, failure screenshots and the
    // explicit visual-review PNGs; local debugging still records video.
    trace: process.env.CI
      ? { mode: "retain-on-failure", screenshots: false }
      : "retain-on-failure",
    video: process.env.CI ? "off" : "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--use-angle=swiftshader",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // GPU-less Linux runners otherwise reject WebGL2 with
        // AllowWebgl2:false and correctly enter the text-only fallback.
        // Enable the real software renderer for this 3D regression project;
        // production capability detection and fallback tests stay unchanged.
        launchOptions: process.env.CI ? {
          firefoxUserPrefs: {
            "webgl.force-enabled": true,
            "webgl.disable-fail-if-major-performance-caveat": true,
          },
        } : undefined,
      },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          args: [
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--use-angle=swiftshader",
          ],
        },
      },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
