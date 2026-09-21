import assert from "node:assert/strict";
import test from "node:test";
import {
  PRIVATE_LINE_PLACEHOLDER,
  applySlipperGiftOverrides,
} from "../src/data/privateContentOverlay.ts";

const baseEntry = {
  id: "fragment-001",
  title: "Opening",
  chapter: "The First Wood",
  tags: [],
  body: `Before ${PRIVATE_LINE_PLACEHOLDER} after.`,
  paragraphs: [`Before ${PRIVATE_LINE_PLACEHOLDER} after.`],
  engine3d: { linkedVisualId: "visual-001" },
};

test("private gift overlay replaces prose while preserving stable world identity", () => {
  const result = applySlipperGiftOverrides([baseEntry], {
    version: 1,
    fragments: [{
      id: "fragment-001",
      expectedPlaceholderCount: 1,
      body: "Before the exact private line after.",
    }],
  });

  assert.deepEqual(result.appliedFragmentIds, ["fragment-001"]);
  assert.equal(result.entries[0].body, "Before the exact private line after.");
  assert.deepEqual(result.entries[0].paragraphs, ["Before the exact private line after."]);
  assert.equal(result.entries[0].engine3d, baseEntry.engine3d);
});

test("private gift overlay fails closed on the wrong fragment or redaction count", () => {
  assert.throws(
    () => applySlipperGiftOverrides([baseEntry], {
      version: 1,
      fragments: [{ id: "fragment-999", expectedPlaceholderCount: 1, body: "Private text." }],
    }),
    /no public fragment/,
  );

  assert.throws(
    () => applySlipperGiftOverrides([baseEntry], {
      version: 1,
      fragments: [{ id: "fragment-001", expectedPlaceholderCount: 2, body: "Private text." }],
    }),
    /expected 2 redactions, found 1/,
  );
});

test("public content remains unchanged when no private overlay is supplied", () => {
  const result = applySlipperGiftOverrides([baseEntry], null);
  assert.deepEqual(result.appliedFragmentIds, []);
  assert.equal(result.entries[0].body, baseEntry.body);
});
