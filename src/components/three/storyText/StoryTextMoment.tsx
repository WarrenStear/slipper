import type { PropsWithChildren } from "react";
import type { JourneyScenePresentation } from "../../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../../data/slipper3dTypes";
import "./StoryTextMoment.css";

export type StoryTextTreatment = NonNullable<JourneyScenePresentation["proseTreatment"]>;

export type StoryTextMomentProps = PropsWithChildren<{
  entry: Slipper3DEntry;
  treatment: StoryTextTreatment;
  onOpenReader: () => void;
}>;

function canonicalExcerpt(entry: Slipper3DEntry) {
  const paragraph = (entry.paragraphs.find((value) => value.trim().length > 0) ?? entry.body).trim();
  if (paragraph.length <= 310) return paragraph;
  const boundary = paragraph.slice(0, 310).match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return boundary && boundary.length >= 72 ? boundary : `${paragraph.slice(0, 286).trimEnd()}…`;
}

export function StoryTextMoment({
  entry,
  treatment,
  onOpenReader,
  children,
}: StoryTextMomentProps) {
  const excerpt = canonicalExcerpt(entry);

  return (
    <aside
      className={`story-text-moment story-text-moment--${treatment}`}
      data-diegetic-prose={treatment}
      data-source-entry={entry.id}
      aria-label={`Words from ${entry.title}`}
    >
      <div className="story-text-moment__material" aria-hidden="true">{children}</div>
      <blockquote>{excerpt}</blockquote>
      <button type="button" onClick={onOpenReader} aria-label={`Read ${entry.title} in full`}>
        <span aria-hidden="true">read</span>
        <span className="sr-only">Read {entry.title} in full</span>
      </button>
    </aside>
  );
}

export default StoryTextMoment;
