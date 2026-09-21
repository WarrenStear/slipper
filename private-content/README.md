# Private gift content overlay

The public archive intentionally retains redacted placeholders. A private gift build may provide `private-content/slipperGiftOverrides.json`; that exact file is git-ignored and is loaded automatically at build time.

Copy `slipperGiftOverrides.example.json`, then provide the complete canonical body for each fragment being replaced. `expectedPlaceholderCount` must equal the number of public redaction markers currently present in that fragment. A mismatch, unknown ID, duplicate ID, remaining redaction marker, or empty replacement stops the build rather than attaching private prose to the wrong memory.

Do not commit the private override. Fragment IDs must remain unchanged.
