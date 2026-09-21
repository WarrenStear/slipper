# Testing and validation

## Supported toolchain

- Node.js `>=22 <25`
- npm `10.9.2`

Use the lockfile for application dependencies:

```bash
npm ci
```

The Playwright runner is pinned to `1.62.0` in `devDependencies` and the
lockfile. Install its browser binaries and system dependencies once:

```bash
npm run test:e2e:setup
```

Application and test-runner packages remain reproducible through `npm ci`.

## Commands

| Command | What it validates |
|---|---|
| `npm run validate` | Required mobile architecture, package scripts, generated world references, CI safety, and all five Playwright projects. |
| `npm run lint` | Project-specific static source lint: conflict markers, TypeScript suppressions, debugger/dynamic-code APIs, trailing whitespace, newline hygiene, and explicit `any` in the focused mobile/settings surface. |
| `npm run content:qa` | Generated archive/world content consistency. |
| `npm run typecheck` | Strict application TypeScript projects. |
| `npm run typecheck:functions` | Strict Cloudflare Pages Functions TypeScript. |
| `npm run test:unit` | All top-level `tests/*.test.mjs` suites, discovered automatically; the dedicated session-security suite runs separately. |
| `npm run test:security` | Session/payload Node tests plus static headers, routes, secret-pattern, and token safeguard checks. |
| `npm run build` | Existing final-world/content prebuild, TypeScript, and Vite production build. |
| `npm run wrangler:check` | Local Wrangler compilation of Pages Functions into ignored `.wrangler/` output. It does not publish. |
| `npm run check` | Complete non-browser validation chain. |
| `npm run test:e2e` | Every configured Playwright project against an already built production preview. Run `npm run build` first outside CI. |
| `npm run test:e2e:desktop` | Chromium, Firefox, and WebKit desktop projects. |
| `npm run test:e2e:mobile` | Pixel-class Chromium and iPhone-class WebKit projects. |

`npm run lint` is deliberately not described as ESLint. This repository does
not currently install or configure ESLint; the command runs the checked-in,
project-specific static source validator.

To inspect the exact unit-suite selection without executing tests:

```bash
node scripts/run-unit-tests.mjs --list
```

Discovery rejects an empty selection and ignores fixture files and directories.
A new top-level unit suite does not need another package-script edit. Browser
specs and the dedicated security command remain separate.

## Playwright projects

The broad suite runs without project-level suite exclusions:

- `chromium`
- `firefox`
- `webkit`
- `mobile-chromium` using a Pixel 7 profile
- `mobile-webkit` using an iPhone 15 profile

The configuration serves the production `dist/` output through Vite preview.
It covers opening paths, mobile controls, direct and guided behavior, reader
and map/archive flows, settings access, recovery, reduced motion, viewport
orientation, and journey-state recovery where represented by the checked-in
specs.

Browser binaries and system dependencies are installed by
`npm run test:e2e:setup`. If the environment blocks browser downloads or
sandboxed browser execution, report that exact blocker; do not report the
Playwright suite as passed.

## Continuous integration

`.github/workflows/ci.yml` is read-only and non-deploying. Pull requests and
main pushes validate source and create one production build. That job fingerprints
every file in `dist/` plus generated `src/data/worldState.json`, then uploads the
build as a commit-scoped artifact. The browser job installs the pinned toolchain,
restores that artifact, and rejects missing, extra or changed files and a different
commit SHA. It does not rebuild a different preview before testing.

Browser reports and traces are retained when the browser job fails. This workflow
does not itself deploy or configure branch protection. Cloudflare's Git integration
can still deploy independently; a successful deployment does not prove that the
browser or complete validation workflow ran.

The content compiler emits deterministic output from the same archive source.
It no longer duplicates every entry in a generated `byId` object. Optional
`SOURCE_DATE_EPOCH` metadata must be non-negative integer seconds; the default
output has no wall-clock build timestamp. Content tests compare every compiled
entry and visual with the canonical generated baseline.

## Persistence and request qualification

Queue and transport tests use mocked requests and storage. They establish bounded
client writes, immutable pending snapshots, account-change guards, response
validation and failure handling; they do not establish atomic writes across tabs
or devices. Restore-delivery tests do not send actual emails. Operator-configured
KV bindings, the HTTPS email sender and production-origin configuration need their
own deployment verification.

Production restore-email requests return unavailable rather than reporting success
when no sender is configured. Development links require explicit opt-in. Mutable
model/texture/visual URLs revalidate, but this cannot invalidate an older browser
response already cached under a previous immutable policy; versioned asset URLs
are still needed when replacing those resources for existing players.

## Manual release qualification

Automated browser emulation does not establish physical-device support. A
release candidate still needs Android Chrome and iOS Safari checks for
multi-touch, real safe areas/browser chrome, orientation interruption,
on-screen keyboard behavior, accessibility technology, haptics, and sustained
WebGL performance.

Record the exact device/OS/browser versions and results in the release or pull
request. Do not use historical test totals, and do not infer physical-device
success from Playwright emulation.
