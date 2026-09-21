import StoryTextMoment, { type StoryTextMomentProps } from "./StoryTextMoment";

export function WallProse(props: Omit<StoryTextMomentProps, "treatment">) {
  return <StoryTextMoment {...props} treatment="wall"><i /><i /></StoryTextMoment>;
}
