# Decoder diagnostic, never production art

`diagnostic-etc1s.ktx2` is the 6,629-byte ETC1S decoding sample from Three.js r171:
<https://github.com/mrdoob/three.js/blob/r171/examples/textures/compressed/2d_etc1s.ktx2>.
The accompanying `THREE-LICENSE` is the upstream MIT licence.

It exists only to exercise the real local Basis transcoder in development/test
fixtures, including failed delivery and invalid-UV paths. It is outside `public`,
is never imported by the application, and is never a production material entry.
Review servers may copy it into their own temporary asset directory. Any review
metadata in those isolated fixtures describes a technical test, not artistic
approval. Do not copy it into shipping art or use it to populate a delivery slot.

Draco diagnostic GLBs are generated as temporary test geometry by the review
script. They likewise carry no production-art claim and never enter `dist`.
