import assert from "node:assert/strict";
import test from "node:test";
import { Color, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createConstructionGeometry } from "../src/components/three/chapters/chapterArtGeometry.ts";
import { windowJoineryPieces, windowLinenRailPieces } from "../src/components/three/chapters/windowConstruction.ts";

test("batched linen rail retains the existing window parts, transforms and wood colours", () => {
  for (const [width, height, color] of [[1.35, 2.1, "#584535"], [2.8, 1.8, "#695544"]]) {
    const frame = windowJoineryPieces(width, height, color);
    const rail = windowLinenRailPieces(width, height);
    const batched = windowJoineryPieces(width, height, color, true);
    assert.equal(frame.length, 7);
    assert.equal(rail.length, 3);
    assert.deepEqual(batched, [
      ...frame.map(piece => ({ ...piece, color })),
      ...rail.map(piece => ({ ...piece, color: "#66543e" })),
    ]);
    assert.deepEqual(windowJoineryPieces(width, height, color), frame, "optional batching cannot change standalone windows");
  }
});

test("frame and supporting rail require one material draw without increasing triangle cost", () => {
  const width = 1.35, height = 2.1;
  const frame = createConstructionGeometry(windowJoineryPieces(width, height, "#584535"));
  const rail = createConstructionGeometry(windowLinenRailPieces(width, height));
  const combined = createConstructionGeometry(windowJoineryPieces(width, height, "#584535", true));
  try {
    assert.equal(combined.groups.length, 0, "no material groups split the combined timber draw");
    assert.equal(combined.index.count, frame.index.count + rail.index.count);
    assert.equal(combined.index.count / 3, 600);
    for (const attribute of Object.values(combined.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
    const colors = combined.getAttribute("color"), positionCount = frame.getAttribute("position").count;
    const frameColor = new Color("#584535"), railColor = new Color("#66543e");
    for (let index = 0; index < colors.count; index++) {
      const expected = index < positionCount ? frameColor : railColor;
      for (const [channel, value] of [["getX", expected.r], ["getY", expected.g], ["getZ", expected.b]]) {
        assert.ok(Math.abs(colors[channel](index) - value) < 1e-6);
      }
    }
    const material = new MeshBasicMaterial({ side: 2 });
    try {
      const mesh = new Mesh(combined, material);
      mesh.updateMatrixWorld();
      const ray = new Raycaster(new Vector3(.25, .4, 2), new Vector3(0, 0, -1));
      assert.equal(ray.intersectObject(mesh).length, 0, "the window opening remains unobstructed");
      assert.ok(combined.boundingBox.max.y < height / 2 + .21);
      assert.ok(combined.boundingBox.max.x < width * .66);
    } finally { material.dispose(); }
  } finally { frame.dispose(); rail.dispose(); combined.dispose(); }
});
