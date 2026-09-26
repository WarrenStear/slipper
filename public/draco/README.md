# Local Draco runtime

These decoder files are copied unchanged from the locked `three` npm package's
`examples/jsm/libs/draco/gltf/` distribution. They are decoder infrastructure,
not production hero models. No encoder is shipped to players.

`DRACOLoader` uses `/draco/` for its JavaScript fallback, WebAssembly wrapper,
and WebAssembly payload. The runtime requires no third-party decoder CDN.
The package version, byte sizes and SHA-256 hashes are recorded in
[`docs/asset-decoder-manifest.json`](../../docs/asset-decoder-manifest.json).

After an intentional Three upgrade, run `npm run assets:sync-decoders`, review
the vendor diff, and rerun the compressed/uncompressed/failure browser checks.
Normal builds verify the existing files; they never silently download or replace
decoder code. Stable filenames use revalidation rather than immutable caching.

Draco is distributed under the accompanying Apache-2.0 [LICENSE](./LICENSE).
Upstream: <https://github.com/google/draco>. Distribution documentation:
<https://github.com/mrdoob/three.js/blob/r171/examples/jsm/libs/draco/README.md>.
