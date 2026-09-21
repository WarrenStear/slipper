import type { Slipper3DEntry } from "../../../data/slipper3dTypes.ts";

/** A contiguous, unchanged source excerpt. The full source stays in the DOM reader. */
export function canonicalSpatialExcerpt(entry: Pick<Slipper3DEntry, "paragraphs" | "body">, limit = 230) {
  const source = (entry.paragraphs.find((paragraph) => paragraph.trim().length > 0) ?? entry.body).trim();
  if (source.length <= limit) return source;
  const prefix = source.slice(0, limit);
  const boundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("? "), prefix.lastIndexOf("! "));
  if (boundary >= 45) return prefix.slice(0, boundary + 1);
  const wordBoundary = prefix.lastIndexOf(" ");
  return prefix.slice(0, wordBoundary > 0 ? wordBoundary : limit);
}

export function canonicalQuestionExcerpts(entry: Pick<Slipper3DEntry, "paragraphs" | "body">) {
  const text = entry.body || entry.paragraphs.join("\n");
  // Never turn narration into a newly authored question.
  const questions = text.match(/[^.!?\n]+\?/g)?.map((value) => value.trim()).filter(Boolean) ?? [];
  return questions.slice(0, 4);
}
