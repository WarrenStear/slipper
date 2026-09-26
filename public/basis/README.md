# Local Basis / KTX2 runtime

The JavaScript wrapper and WebAssembly transcoder are copied unchanged from the
locked `three` npm package's `examples/jsm/libs/basis/` distribution. They decode
reviewed textures; their presence does not approve any material map or GLB.

`KTX2Loader` uses `/basis/` and detects the receiving renderer's compressed-texture
capabilities before decoding. The runtime requires no third-party transcoder CDN.
The exact package version, byte sizes and SHA-256 hashes are recorded in
[`docs/asset-decoder-manifest.json`](../../docs/asset-decoder-manifest.json).

After an intentional Three upgrade, run `npm run assets:sync-decoders`, review
the vendor diff, and rerun real KTX2 decode and failure-fallback browser checks.
Normal builds verify the existing files without replacing them. Stable filenames
use revalidation rather than immutable caching.

Basis Universal is distributed under the accompanying Apache-2.0
[LICENSE](./LICENSE). Upstream: <https://github.com/BinomialLLC/basis_universal>.
Distribution documentation:
<https://github.com/mrdoob/three.js/blob/r171/examples/jsm/libs/basis/README.md>.
